export const config = { runtime: 'edge' };

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function redisCommand(...args: string[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json() as { result: unknown; error?: string };
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

// ─── Password hashing (Web Crypto / PBKDF2) ───────────────────────────────────

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    key, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function randomBase64(bytes = 16): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function userKey(pseudo: string, classId: string): string {
  return `auth:user:${classId.trim().toUpperCase()}:${pseudo.trim().toLowerCase()}`;
}

function emailKey(email: string): string {
  return `auth:email:${email.trim().toLowerCase()}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

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

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return json({ error: 'Redis non configuré' }, 503);
  }

  const body = await request.json() as Record<string, string>;
  const { action } = body;

  // ── REGISTER ────────────────────────────────────────────────────────────────
  if (action === 'register') {
    const { id, pseudo, password, classId, email } = body;
    const key = userKey(pseudo, classId || '');

    const existing = await redisCommand('GET', key) as string | null;
    if (existing) return json({ result: 'already_exists' });

    const salt = randomBase64(16);
    const hash = await hashPassword(password, salt);

    const user = {
      id,
      pseudo: pseudo.trim(),
      classId: (classId || '').trim().toUpperCase() || null,
      email: email ? email.trim().toLowerCase() : null,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    };

    await redisCommand('SET', key, JSON.stringify(user));

    // Index email → userKey for password reset lookups
    if (email) {
      await redisCommand('SET', emailKey(email), key);
    }

    return json({ result: 'success' });
  }

  // ── LOGIN ───────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const { pseudo, password, classId } = body;
    const key = userKey(pseudo, classId || '');

    const raw = await redisCommand('GET', key) as string | null;
    if (!raw) return json({ result: 'not_found' });

    const user = JSON.parse(raw) as { passwordHash: string; salt: string; id: string; pseudo: string; email: string | null; classId: string | null; createdAt: string };
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) return json({ result: 'wrong_password' });

    return json({ result: 'success', user: { id: user.id, pseudo: user.pseudo, email: user.email, classId: user.classId, createdAt: user.createdAt } });
  }

  // ── FORGOT PASSWORD ─────────────────────────────────────────────────────────
  if (action === 'forgot-password') {
    const { email } = body;
    if (!email) return json({ result: 'ok' }); // always return ok to avoid enumeration

    const userKeyRef = await redisCommand('GET', emailKey(email)) as string | null;
    if (!userKeyRef) return json({ result: 'ok' });

    const token = randomBase64(32);
    // Store token → userKey, expires in 1 hour
    await redisCommand('SET', `auth:reset:${token}`, userKeyRef, 'EX', '3600');

    if (RESEND_API_KEY) {
      const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Jeu de l\'Imitation <onboarding@resend.dev>',
          to: email.trim().toLowerCase(),
          subject: 'Réinitialisation de mot de passe',
          html: `
            <p>Bonjour,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe pour le <strong>Jeu de l'Imitation</strong>.</p>
            <p><a href="${resetUrl}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Réinitialiser mon mot de passe</a></p>
            <p>Ce lien expire dans <strong>1 heure</strong>.</p>
            <p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
          `,
        }),
      });
    }

    return json({ result: 'ok' });
  }

  // ── TEACHER RESET PASSWORD ──────────────────────────────────────────────────
  if (action === 'teacher-reset-password') {
    const { pseudo, classId, newPassword } = body;
    if (!pseudo || !newPassword) return json({ result: 'invalid' });
    const key = userKey(pseudo, classId || '');
    const raw = await redisCommand('GET', key) as string | null;
    if (!raw) return json({ result: 'not_found' });
    const user = JSON.parse(raw);
    const newSalt = randomBase64(16);
    const newHash = await hashPassword(newPassword, newSalt);
    await redisCommand('SET', key, JSON.stringify({ ...user, passwordHash: newHash, salt: newSalt }));
    return json({ result: 'success' });
  }

  // ── RESET PASSWORD ──────────────────────────────────────────────────────────
  if (action === 'reset-password') {
    const { token, password } = body;
    if (!token || !password) return json({ result: 'invalid' });

    const userKeyRef = await redisCommand('GET', `auth:reset:${token}`) as string | null;
    if (!userKeyRef) return json({ result: 'invalid' }); // expired or not found

    const raw = await redisCommand('GET', userKeyRef) as string | null;
    if (!raw) return json({ result: 'invalid' });

    const user = JSON.parse(raw);
    const newSalt = randomBase64(16);
    const newHash = await hashPassword(password, newSalt);

    const updatedUser = { ...user, passwordHash: newHash, salt: newSalt };
    await redisCommand('SET', userKeyRef, JSON.stringify(updatedUser));

    // Consume the token
    await redisCommand('DEL', `auth:reset:${token}`);

    return json({ result: 'success' });
  }

  return json({ error: 'Unknown action' }, 400);
}
