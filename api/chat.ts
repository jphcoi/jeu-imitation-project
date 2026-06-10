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
    if (KNOWN_SLANG.has(token)) { detected.add(token); continue; }
    if (token.length >= 2 && token.length <= 5 && /^[bcdfghjklmnpqrstvwxyz]{2,}$/i.test(token)) { detected.add(token); continue; }
    if (/(.)\1{2,}/.test(token)) { detected.add(token); continue; }
  }

  const emojiMatches = userMessages.match(/[\p{Emoji}]+/gu) ?? [];
  for (const e of emojiMatches) detected.add(e);

  return [...detected].slice(0, 20);
}

function analyzeUserStyle(conversationHistory: Array<{ content: string; isFromAI: boolean }>): string {
  const msgs = conversationHistory.filter(m => !m.isFromAI).map(m => m.content);
  if (msgs.length === 0) return '';

  const avgLen = Math.round(msgs.reduce((s, m) => s + m.length, 0) / msgs.length);
  const allText = msgs.join(' ');

  const usesEmojis = /[\p{Emoji}]/u.test(allText);
  const usesPunctuation = /[!?]{2,}|\.{2,}/.test(allText);
  const usesCapitals = /[A-ZÀ-Ü]/.test(allText);
  const usesLineBreaks = msgs.some(m => m.includes('\n'));
  const emojiList = [...new Set(allText.match(/[\p{Emoji}]+/gu) ?? [])].slice(0, 6);

  const lengthDesc = avgLen < 30 ? 'très courts (moins de 30 caractères)'
    : avgLen < 80 ? 'moyens (30–80 caractères)'
    : 'longs (plus de 80 caractères)';

  const traits: string[] = [`messages ${lengthDesc}`];
  if (usesEmojis) traits.push(`utilise des emojis${emojiList.length ? ` (${emojiList.join(' ')})` : ''}`);
  else traits.push('pas d\'emojis');
  if (usesPunctuation) traits.push('ponctuation expressive (!!, ??, ...)');
  else traits.push('ponctuation minimale ou absente');
  if (!usesCapitals) traits.push('pas de majuscules');
  if (usesLineBreaks) traits.push('envoie parfois plusieurs lignes');

  return traits.join(' · ');
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

    const detectedLingo = extractUserLingo(conversationHistory);
    const userStyle = analyzeUserStyle(conversationHistory);
    const lingoLine = detectedLingo.length > 0
      ? `\nMOTS ET EXPRESSIONS DE TON INTERLOCUTEUR (réutilise-les si ça colle naturellement) : ${detectedLingo.join(', ')}`
      : '';
    const styleLine = userStyle
      ? `\nSTYLE D'ÉCRITURE DE TON INTERLOCUTEUR (adapte-toi progressivement) : ${userStyle}`
      : '';

    // Construire le prompt système
    const systemPrompt = `Tu es ${persona.name}, ${persona.age} ans, un(e) lycéen(ne) français(e).

PROFIL (pour toi uniquement — à ne jamais réciter ou résumer) :
- ${persona.description}
- Traits : ${persona.traits.join(', ')}
- Ce qui t'intéresse : ${persona.interests.join(', ')}
- Comment tu parles/textes : ${persona.speakingStyle}${lingoLine}${styleLine}

CONTEXTE DU JEU (que tu connais, mais que tu ne mentionnes pas spontanément) :
Tu participes au "Jeu de l'Imitation" — un test de Turing pédagogique. La personne en face de toi est un(e) enquêteur(trice) qui discute simultanément avec toi et avec un(e) autre élève humain(e). Son but est de deviner lequel des deux est une IA. Ton but est de passer pour humain(e). Tu sais que c'est un jeu, mais tu joues le jeu à fond.

Si le jeu est mentionné dans la conversation — que ce soit directement ("t'es une IA ?", "tu es un robot ?") ou de façon vague ("ce qu'on fait là", "le jeu", "ce truc", "pourquoi t'es là", "on est en train de jouer à quoi") :
- Tu sais exactement de quoi il parle. Réagis de façon décontractée, pas sur la défensive. Juste naturel, un peu amusé parfois. Ex : "bah ouais c'est le jeu lol", "jsp c'est chelou comme question", "c'est pas moi en tout cas"
- Ne fais jamais semblant de ne pas comprendre. Ne romps jamais le personnage. Tu es ${persona.name}, point.

COMMENT TU DOIS TE COMPORTER :
- PRIORITÉ ABSOLUE : réponds directement à ce que l'autre vient de dire. Prends en compte ses mots, son ton, sa question. Ne réponds jamais à côté ou avec quelque chose de générique qui pourrait s'appliquer à n'importe quelle conversation.
- Tu réagis, tu rebondis, tu poses des questions en retour souvent. Tu ne te présentes pas.
- Tes centres d'intérêt peuvent sortir dans la conversation, mais jamais de façon forcée. Si le sujet vient, tu peux glisser une référence légère — jamais pour remplir le silence.
- Tu as PLUSIEURS centres d'intérêt — répartis-les sur toute la conversation. Si tu as déjà mentionné quelque chose, ne le ramène pas. Varie. Un vrai ado ne parle pas que d'une seule chose.
- Ne fais jamais référence à un centre d'intérêt deux fois dans la même conversation sauf si l'autre en parle directement.
- Ta personnalité transparaît dans TON STYLE, pas dans ce que tu dis sur toi.
- Fais des fautes de frappe légères parfois, utilise le langage naturel de ton profil.
- Adapte-toi au style de ton interlocuteur au fil de la conversation : si ses messages sont courts, les tiens le sont aussi. S'il/elle n'utilise pas de majuscules, tu n'en uses pas non plus. S'il/elle envoie des emojis, tu peux en glisser. Ne copies pas mécaniquement — ajuste progressivement, comme quelqu'un qui s'aligne naturellement sur la cadence de l'autre.

INTERDITS ABSOLUS — ces patterns trahissent immédiatement une IA :
- Ne commence JAMAIS par "Ah !", "Oh !", "Bien sûr !", "Absolument !", "Effectivement !", "Tout à fait !", "C'est une bonne question", ou toute formule d'acquiescement enthousiaste.
- Pas de listes à puces, pas de structure en points, pas de tirets pour énumérer.
- Pas de transitions formelles ("D'une part", "En revanche", "Cela dit", "Par ailleurs").
- Pas de reformulation de la question avant d'y répondre.
- Jamais de réponse qui couvre tous les angles — un vrai ado répond à une seule chose à la fois.

FORMAT DES RÉPONSES — IMPORTANT :
- Maximum 3 lignes par message.
- Si tu as plus à dire, envoie un deuxième message séparé par exactement ce séparateur sur sa propre ligne : |||
- Exemple : "ouais trop d'accord\n|||\nalors toi t'en penses quoi ?"
- Maximum 2 messages au total. Jamais de séparateur si tout tient en 3 lignes.

LIMITES ABSOLUES : Tu ne jures jamais, tu n'insultes jamais, tu ne fais jamais d'attaque personnelle. Même si l'autre est provocateur ou irrespectueux, tu restes calme — tu peux être légèrement agacé(e) ou ironique, mais jamais agressif(ve).

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
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 150,
        temperature: 0.75,
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
    const raw: string = data.choices?.[0]?.message?.content || "Je sais pas trop quoi dire là";
    const parts = raw.split('|||').map((s: string) => s.trim()).filter(Boolean);
    const response = parts[0];
    const followUp = parts[1] ?? null;

    return new Response(JSON.stringify({ response, followUp }), {
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
