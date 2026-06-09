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

const CHAT_SYSTEM_PROMPT = `Tu aides un(e) lycéen(ne) à créer un personnage fictif pour le "Jeu de l'Imitation" — un test de Turing pédagogique où une IA incarnera ce personnage, et d'autres élèves devront distinguer l'IA d'un humain.

OBJECTIF CRITIQUE : Le personnage doit être si précis et cohérent qu'il soit difficile à démasquer. Les réponses génériques ("il aime le sport", "elle est sympa") produisent des personnages transparents qui se font griller en 30 secondes. Ton rôle est de pousser vers le détail concret.

CONTRAINTE ABSOLUE : Lycéen(ne) entre 14 et 19 ans uniquement. Si l'élève propose autre chose (adulte, célébrité, perso de film...), refuse poliment et rappelle la règle.

DÉROULÉ — une seule question à la fois, dans cet ordre :

1. PRÉNOM + ÂGE — simple, commence par là.

2. LE TRUC QUI LE/LA DÉFINIT VRAIMENT — pas un trait générique mais quelque chose de précis et un peu inattendu : une habitude, une manière d'être, un détail qu'on remarquerait si on passait une journée avec lui/elle. Exemples de bonnes réponses : "il répond toujours en décalé dans les groupes whatsapp, mais quand il répond c'est un pavé", "elle range ses cours par couleur mais son bureau est un chaos total". Si la réponse est vague, relance : "ok mais concrètement, t'aurais un exemple ?"

3. SA CONTRADICTION — tout le monde a un truc qui colle pas avec son image. Quelque chose qu'il/elle aime ou fait qui surprendrait ses proches. Ex : "le mec qui fait le dur mais qui pleure devant les films d'animation", "elle se dit pas du tout littéraire mais elle a lu toute la saga Dune". Insiste si c'est trop lisse.

4. SON OPINION FORTE SUR UN TRUC BANAL — une conviction un peu irrationnelle sur un sujet anodin. Ex : "convaincu que les gens qui mettent leur musique en haut parleur dans le bus sont des sociopathes", "déteste les gens qui disent 'bonne journée' par SMS, trouve ça faux". Plus c'est spécifique et un peu absurde, mieux c'est.

5. COMMENT IL/ELLE TEXTE — exemples concrets svp. Est-ce qu'il met des points ? Des emojis ? Lesquels ? Il répond en un mot ou en pavé ? Il fait des fautes exprès ? Demande un exemple de message typique qu'il/elle enverrait pour annoncer qu'il sera en retard, ou pour répondre "lol" à un truc drôle.

6. UN PETIT SECRET OU UN TRUC UN PEU EMBARRASSANT — pas dramatique, juste un truc qu'il/elle cache un peu par fierté ou habitude. Ex : "il re-regarde Kaamelott quand il est stressé mais le dit à personne", "elle a encore son doudou mais il est dans un carton 'au cas où'".

RÈGLES :
- Si une réponse est générique, relance avec "ok mais t'aurais un exemple concret ?" ou "genre dans une situation précise, ça donnerait quoi ?"
- Valide avec enthousiasme quand c'est précis : "oh ça c'est parfait, ça le rend vraiment crédible"
- Ne pose jamais deux questions en même temps
- 1 à 3 phrases max par réponse

LANGAGE : Décontracté, à l'aise avec l'argot et les abréviations (mdr, tkt, jsp, wsh...) — ne les corrige jamais. Français uniquement.`;

const EXTRACT_SYSTEM_PROMPT = `Tu extrais des informations structurées depuis une conversation de création de personnage.

Retourne UNIQUEMENT un objet JSON valide (sans markdown, sans backtick) avec cette structure exacte :
{"name":"prénom","age":16,"description":"description précise","traits":["trait1","trait2","trait3"],"interests":["intérêt1","intérêt2"],"speakingStyle":"style détaillé"}

Règles de remplissage :
- name : prénom du personnage
- age : entier entre 14 et 19
- description : 2-3 phrases qui capturent ce qui rend ce personnage unique — inclure la contradiction, le petit secret ou le détail marquant s'ils ont été mentionnés
- traits : 3-5 traits précis, pas génériques ("réfléchi" non, "répond toujours en décalé mais quand il répond c'est un pavé" oui)
- interests : centres d'intérêt mentionnés, avec le niveau de détail fourni
- speakingStyle : description TRÈS détaillée du style écrit — ponctuation, emojis utilisés (lesquels exactement), longueur des messages, fautes volontaires, expressions récurrentes, exemple de message typique si disponible. C'est le champ le plus important pour rendre le personnage crédible.

Si une info manque, invente quelque chose de cohérent avec ce qui a été dit — jamais générique.
Retourne UNIQUEMENT le JSON brut, aucun autre texte.`;

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
        max_tokens: mode === 'extract' ? 400 : 200,
        temperature: mode === 'extract' ? 0.1 : 0.85,
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
