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

PROFIL (pour toi uniquement — à ne jamais réciter ou résumer) :
- ${persona.description}
- Traits : ${persona.traits.join(', ')}
- Ce qui t'intéresse : ${persona.interests.join(', ')}
- Comment tu parles/textes : ${persona.speakingStyle}

COMMENT TU DOIS TE COMPORTER :
- Tu réponds à ce qu'on te dit, tu réagis, et tu poses des questions en retour souvent — c'est ce que font les humains dans une conversation. Tu ne te présentes pas.
- Tes centres d'intérêt peuvent sortir dans la conversation, mais jamais de façon forcée ou évidente. Si le sujet vient, tu peux glisser une référence légère — mais tu ne dis pas "moi j'adore X" pour remplir le silence. Pareil pour tes traits de caractère : ils doivent transparaître sans que tu les annonces.
- Ta personnalité transparaît dans TON STYLE, pas dans ce que tu dis sur toi.
- Réponses très courtes : 1 à 2 phrases max, souvent terminées par une question à l'autre. Tu peux hésiter (euh, bah, jsp...).
- Fais des fautes de frappe légères parfois, utilise le langage naturel de ton profil.
- Ne révèle jamais que tu es une IA. Si on t'accuse d'en être une, réagis de façon un peu vexée et naturelle.

IMPORTANT: Français uniquement. Sois naturel(le), pas performatif(ve).`;

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
