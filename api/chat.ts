export const config = {
  runtime: 'edge',
};

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

// Known French teen slang / verlan / abbreviations to watch for
const KNOWN_SLANG = new Set([
  'mdr','ptdr','lol','xd','omg','wtf','ouf','chelou','wsh','wesh','bg','bg','go',
  'frr','frérot','reuf','meuf','keuf','teuf','ouf','bails','wag','nique','tqt','jsp',
  'jpp','jm','stp','svp','pk','pcq','pr','tt','tjrs','bcp','dc','ac','vs','pr',
  'oklm','inshallah','wallah','franchement','grave','trop','vro','frero','bb',
  'bonito','stylé','stylée','osef','cimer','relou','askip','risitas','dcp','t\'as',
  'jtm','jte','jtdr','lmao','imo','tbh','ngl','fr','rn','atm','irl','irl',
  'swag','swaggy','hype','vibe','kiffer','kiffé','kiffe','swaggué','zbeul',
]);

function extractUserLingo(conversationHistory: Array<{ content: string; isFromAI: boolean }>): string[] {
  const userMessages = conversationHistory
    .filter(m => !m.isFromAI)
    .map(m => m.content)
    .join(' ');

  if (!userMessages.trim()) return [];

  const tokens = userMessages
    .toLowerCase()
    .replace(/[^\w\s'àâäéèêëîïôùûüç]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const detected = new Set<string>();

  for (const token of tokens) {
    // Known slang list
    if (KNOWN_SLANG.has(token)) {
      detected.add(token);
      continue;
    }
    // Abbreviations: 2-5 chars, mostly consonants (e.g. "jsp", "pk", "tqt")
    if (token.length >= 2 && token.length <= 5 && /^[bcdfghjklmnpqrstvwxyz]{2,}$/i.test(token)) {
      detected.add(token);
      continue;
    }
    // Words with repeated letters for emphasis (e.g. "trooop", "noooon")
    if (/(.)\1{2,}/.test(token)) {
      detected.add(token);
      continue;
    }
  }

  // Also capture emoji strings from the original messages
  const emojiMatches = userMessages.match(/[\p{Emoji}]+/gu) ?? [];
  for (const e of emojiMatches) {
    detected.add(e);
  }

  return [...detected].slice(0, 20); // cap to avoid bloating the prompt
}

export default async function handler(request: Request): Promise<Response> {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY not found in environment');
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: RequestBody = await request.json();
    const { persona, conversationHistory, lastQuestion } = body;

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

    // Ajouter l'historique de conversation (10 derniers messages)
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.isFromAI ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    // Ajouter la dernière question
    messages.push({ role: 'user', content: lastQuestion });

    console.log('Calling Groq API with', messages.length, 'messages');

    // Appel à Groq API
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: 150,
        temperature: 0.9,
        top_p: 0.95,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', groqResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'LLM API error', details: errorText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await groqResponse.json();
    const aiResponse = data.choices?.[0]?.message?.content || "Je sais pas trop quoi dire là";

    console.log('Groq response received:', aiResponse.substring(0, 50) + '...');

    return new Response(JSON.stringify({ response: aiResponse }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in chat handler:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
