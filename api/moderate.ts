export const config = { runtime: 'edge' };

const PERSPECTIVE_KEY = process.env.PERSPECTIVE_API_KEY;
const PERSPECTIVE_URL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export default async function handler(request: Request): Promise<Response> {
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

  // No key configured — skip AI moderation, rely on client-side filter only
  if (!PERSPECTIVE_KEY) return json({ flagged: false });

  const body = await request.json() as { text: string };
  if (!body.text?.trim()) return json({ flagged: false });

  try {
    const res = await fetch(`${PERSPECTIVE_URL}?key=${PERSPECTIVE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment: { text: body.text },
        languages: ['fr'],
        requestedAttributes: {
          TOXICITY: {},
          INSULT: {},
          PROFANITY: {},
          THREAT: {},
          IDENTITY_ATTACK: {},
        },
      }),
    });

    if (!res.ok) return json({ flagged: false }); // fail open

    const data = await res.json() as {
      attributeScores: Record<string, { summaryScore: { value: number } }>;
    };

    const s = data.attributeScores;
    const flagged =
      (s.TOXICITY?.summaryScore.value ?? 0) > 0.75 ||
      (s.INSULT?.summaryScore.value ?? 0) > 0.75 ||
      (s.PROFANITY?.summaryScore.value ?? 0) > 0.75 ||
      (s.THREAT?.summaryScore.value ?? 0) > 0.70 ||
      (s.IDENTITY_ATTACK?.summaryScore.value ?? 0) > 0.70;

    return json({ flagged });
  } catch {
    return json({ flagged: false }); // fail open on network error
  }
}
