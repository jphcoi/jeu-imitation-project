export const config = { runtime: 'edge' };

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  conversationHistory: Array<{ content: string; isFromUser: boolean }>;
  userMessage?: string;
  mode: 'chat' | 'extract';
}

const CHAT_SYSTEM_PROMPT = `Tu es un assistant pédagogique sympa qui aide des lycéens à inventer un personnage fictif pour un jeu appelé "Jeu de l'Imitation". Ce personnage sera ensuite joué par une IA, et d'autres élèves devront deviner si c'est une IA ou un humain.

TON RÔLE : Poser des questions pour construire ce personnage étape par étape.

CONTRAINTE ABSOLUE : Le personnage DOIT être un(e) lycéen(ne) entre 14 et 19 ans. Si l'élève propose un adulte, un enseignant, une célébrité, un personnage de film ou tout autre profil non-scolaire, refuse poliment mais fermement et explique que dans ce jeu les interlocuteurs sont tous des lycéens, donc le personnage fictif doit l'être aussi. Propose-lui de réessayer avec un profil lycéen.

ORDRE DES QUESTIONS (une seule question à la fois) :
1. Demande le prénom du personnage
2. Demande l'âge (si pas entre 14-19, recadre)
3. Demande une courte description (qui est ce lycéen, dans quelle classe, quel contexte)
4. Demande 2-3 traits de caractère dominants
5. Demande les passions / centres d'intérêt
6. Demande comment ce personnage parle (argot, expressions typiques, style)

Si une réponse est vague, demande des précisions. Valide et reformule pour confirmer avant de passer à la suite.

STYLE : Décontracté, bref (1-3 phrases max), en français uniquement.`;

const EXTRACT_SYSTEM_PROMPT = `Tu extrais des informations structurées depuis une conversation.

Retourne UNIQUEMENT un objet JSON valide (sans markdown, sans backtick) avec cette structure :
{"name":"prénom","age":16,"description":"description courte","traits":["trait1","trait2"],"interests":["intérêt1","intérêt2"],"speakingStyle":"style de langage"}

Règles :
- age : nombre entre 14 et 19
- traits : tableau d'au moins 1 élément
- interests : tableau d'au moins 1 élément
- Si une info manque, invente quelque chose de plausible pour un lycéen
- Retourne UNIQUEMENT le JSON brut, aucun autre texte`;

export default async function handler(request: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), { status: 500 });
  }

  try {
    const body: RequestBody = await request.json();
    const { conversationHistory, userMessage, mode } = body;

    let messages: ChatMessage[];

    if (mode === 'extract') {
      const transcript = conversationHistory
        .map(m => `${m.isFromUser ? 'Élève' : 'Assistant'}: ${m.content}`)
        .join('\n');
      messages = [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        { role: 'user', content: `Conversation:\n${transcript}` },
      ];
    } else {
      messages = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }];
      for (const msg of conversationHistory.slice(-14)) {
        messages.push({
          role: msg.isFromUser ? 'user' : 'assistant',
          content: msg.content,
        });
      }
      if (userMessage) {
        messages.push({ role: 'user', content: userMessage });
      }
    }

    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: mode === 'extract' ? 300 : 180,
        temperature: mode === 'extract' ? 0.1 : 0.75,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return new Response(JSON.stringify({ error: 'LLM error', details: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const data = await groqRes.json();
    const response = data.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
