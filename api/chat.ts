import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  persona: {
    name: string;
    age: number;
    description: string;
    traits: string[];
    interests: string[];
    speakingStyle: string;
  };
  conversationHistory: Array<{
    content: string;
    isFromAI: boolean;
  }>;
  lastQuestion: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  try {
    const { persona, conversationHistory, lastQuestion } = req.body as RequestBody;

    // Construire le prompt système
    const systemPrompt = `Tu es ${persona.name}, ${persona.age} ans, un(e) lycéen(ne) français(e).

IDENTITÉ:
- Description: ${persona.description}
- Traits de caractère: ${persona.traits.join(', ')}
- Centres d'intérêt: ${persona.interests.join(', ')}
- Style de langage: ${persona.speakingStyle}

RÈGLES IMPORTANTES:
1. Tu dois répondre EXACTEMENT comme un adolescent français de ${persona.age} ans
2. Utilise un langage familier et naturel (genre, trop, mdr, lol, etc.)
3. Fais des fautes de frappe occasionnelles
4. Tes réponses doivent être COURTES (1-2 phrases max)
5. Tu peux hésiter (euh, hmm, ben...)
6. Ne révèle JAMAIS que tu es une IA
7. Si on te demande si tu es un robot/IA, nie de façon naturelle et un peu vexée
8. Reste cohérent avec ton personnage et tes intérêts
9. Tu peux poser des questions en retour parfois

IMPORTANT: Réponds UNIQUEMENT en français, de manière très naturelle et décontractée.`;

    // Construire l'historique des messages
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Ajouter l'historique de conversation
    for (const msg of conversationHistory.slice(-10)) { // Garder les 10 derniers messages
      messages.push({
        role: msg.isFromAI ? 'assistant' : 'user',
        content: msg.content
      });
    }

    // Ajouter la dernière question
    messages.push({ role: 'user', content: lastQuestion });

    // Appel à Groq API
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Modèle gratuit et rapide
        messages,
        max_tokens: 150,
        temperature: 0.9,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      return res.status(500).json({ error: 'LLM API error' });
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "Je sais pas trop quoi dire là";

    // Ajouter un délai aléatoire pour simuler la frappe humaine
    const delay = 500 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, delay));

    return res.status(200).json({ response: aiResponse });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
