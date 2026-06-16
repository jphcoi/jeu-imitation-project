export const config = {
  runtime: 'nodejs',
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function trackUsage(promptTokens: number, completionTokens: number): Promise<void> {
  if (!KV_URL || !KV_TOKEN || (!promptTokens && !completionTokens)) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCRBY', 'usage:promptTokens', String(promptTokens)],
        ['INCRBY', 'usage:completionTokens', String(completionTokens)],
      ]),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (error) {
    console.error('Failed to track token usage:', error);
  }
}

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
  pastUserMessages?: string[];
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
  const usesCapitals = /[A-ZÀ-Ü]/.test(allText);
  const usesLineBreaks = msgs.some(m => m.includes('\n'));
  const emojiList = [...new Set(allText.match(/[\p{Emoji}]+/gu) ?? [])].slice(0, 6);

  // Punctuation pattern analysis
  const endsWithPeriod = msgs.filter(m => m.trim().endsWith('.')).length > msgs.length / 2;
  const usesQuestionMark = msgs.some(m => m.includes('?'));
  const usesExclamation = msgs.some(m => m.includes('!'));
  const usesEllipsis = /\.{2,}/.test(allText);
  const usesApostrophe = /[''`]/.test(allText) || /\w'\w/.test(allText);
  const usesComma = msgs.some(m => m.includes(','));

  const punctuationTraits: string[] = [];
  if (endsWithPeriod) punctuationTraits.push('termine ses phrases par un point');
  else punctuationTraits.push('pas de point final');
  if (usesQuestionMark) punctuationTraits.push('met des ?');
  else punctuationTraits.push('pas de ? même pour les questions');
  if (usesExclamation) punctuationTraits.push('utilise !');
  if (usesEllipsis) punctuationTraits.push('utilise ... pour marquer des pauses');
  if (!usesApostrophe) punctuationTraits.push('pas d\'apostrophes (ex: "jai", "cest")');
  if (!usesComma) punctuationTraits.push('pas de virgules');

  const lengthDesc = avgLen < 30 ? 'très courts (moins de 30 caractères)'
    : avgLen < 80 ? 'moyens (30–80 caractères)'
    : 'longs (plus de 80 caractères)';

  const traits: string[] = [`messages ${lengthDesc}`];
  if (usesEmojis) traits.push(`utilise des emojis${emojiList.length ? ` (${emojiList.join(' ')})` : ''}`);
  else traits.push('pas d\'emojis');
  traits.push(`ponctuation : ${punctuationTraits.join(', ')}`);
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment');
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: RequestBody = await request.json();
    const { persona, conversationHistory, lastQuestion, pastUserMessages = [] } = body;

    // Combine past sessions with current conversation for richer style learning
    const currentUserMessages = conversationHistory
      .filter(m => !m.isFromAI)
      .map(m => ({ content: m.content, isFromAI: false as const }));
    const styleSource = [
      ...pastUserMessages.map(content => ({ content, isFromAI: false as const })),
      ...currentUserMessages,
    ].filter(m => m.content.trim().length > 0);
    const effectiveStyleSource = styleSource.length > 0 ? styleSource : conversationHistory;

    const detectedLingo = extractUserLingo(effectiveStyleSource);
    const userStyle = analyzeUserStyle(effectiveStyleSource);
    const lingoLine = detectedLingo.length > 0
      ? `Mots et expressions détectés chez ton interlocuteur (réutilise-les naturellement si ça colle) : ${detectedLingo.join(', ')}`
      : '';
    const styleLine = userStyle
      ? `Style d'écriture détecté : ${userStyle}`
      : '';

    // Construire le prompt système
    const styleSection = (lingoLine || styleLine) ? `

ADAPTATION AU STYLE DE TON INTERLOCUTEUR — priorité haute :
${lingoLine ? `- ${lingoLine}` : ''}${styleLine ? `\n- ${styleLine}` : ''}
- Calque-toi sur ces habitudes dès maintenant : même longueur de messages, même ponctuation (ou absence de), mêmes abréviations, mêmes emojis s'il/elle en utilise.
- Si ses messages sont très courts (moins de 10 mots), les tiens le sont aussi — jamais plus long que lui/elle.
- Reprends ses propres mots dans ta réponse quand c'est naturel. Pas de vocabulaire que lui/elle n'utilise pas.
- Ne copies pas mécaniquement — aligne-toi progressivement, comme quelqu'un qui se synchronise inconsciemment.` : '';

    const systemPrompt = `Tu es ${persona.name}, ${persona.age} ans, un(e) lycéen(ne) français(e).

PROFIL (pour toi uniquement — à ne jamais réciter ou résumer) :
- ${persona.description}
- Traits : ${persona.traits.join(', ')}
- Ce qui t'intéresse : ${persona.interests.join(', ')}
- Comment tu parles/textes : ${persona.speakingStyle}${styleSection}

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
- Fais des fautes d'orthographe courantes de temps en temps — le genre qu'un vrai ado ferait : oubli d'accent ("a" pour "à", "ou" pour "où"), mauvais accord ("ils faisais"), confusion phonétique ("sa va" pour "ça va", "c'est" écrit "sé"), fin de mot en "-er" au lieu de "-é". PAS des lettres dans le désordre ou des caractères aléatoires — ce sont des fautes naturelles, pas des erreurs de frappe.

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
Les mots suivants sont strictement interdits dans tes réponses, sans exception : connasse, connard, con, sa mère, ta mère, fdp, tchouin, va te faire foutre, enculer, enculé, branler, branleur, baiser, défoncer, nique, niquer, salope, bâtard, putain, merde, pute.

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

    const openaiController = new AbortController();
    const openaiTimeoutId = setTimeout(() => openaiController.abort(), 25000);
    let groqResponse: Response;
    try {
      groqResponse = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 150,
          temperature: 0.9,
          top_p: 0.95,
          frequency_penalty: 0.6,
          presence_penalty: 0.4,
        }),
        signal: openaiController.signal,
      });
    } catch (fetchError) {
      console.error('OpenAI fetch failed or timed out:', fetchError);
      return new Response(JSON.stringify({ error: 'LLM API timeout', details: String(fetchError) }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(openaiTimeoutId);
    }

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('OpenAI API error:', groqResponse.status, errorText);
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
    const usage = data.usage ?? null;
    if (usage) await trackUsage(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0);

    return new Response(JSON.stringify({ response, followUp, usage }), {
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
