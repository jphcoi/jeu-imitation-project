export const config = {
  runtime: 'edge',
};

// 🔄🔄🔄 Upstash Redis REST helpers 🔄🔄🔄

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...args: string[]): Promise<unknown> {
  const res = await fetch(`${UPSTASH_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return data.result;
}

async function redisPipeline(commands: string[][]): Promise<{ result: unknown }[]> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// 🔄🔄🔄 Room data structures 🔄🔄🔄

interface Room {
  host: string;
  guest: string | null;
  status: 'waiting' | 'playing' | 'ended';
  roles: Record<string, 'enqueteur' | 'enquete'> | null;
  createdAt: number;
}

interface QueueEntry {
  userId: string;
  timestamp: number;
  schoolId?: string;
  classId?: string;
}

// 🔄🔄🔄 Handler 🔄🔄🔄

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
    return json({
      error: 'Multiplayer non configuré. Ajoutez UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN.',
    }, 503);
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {

      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      // CREATE PRIVATE ROOM
      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      case 'create-room': {
        const { roomCode, userId } = body;
        const room: Room = {
          host: userId,
          guest: null,
          status: 'waiting',
          roles: null,
          createdAt: Date.now(),
        };
        await redis('SET', `room:${roomCode}`, JSON.stringify(room), 'EX', '600');
        return json({ roomCode, status: 'waiting' });
      }

      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      // JOIN AN EXISTING ROOM
      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      case 'join-room': {
        const { roomCode, userId } = body;
        const raw = await redis('GET', `room:${roomCode}`) as string | null;
        if (!raw) return json({ error: 'Salle introuvable' }, 404);

        const room: Room = JSON.parse(raw);
        if (room.status !== 'waiting') return json({ error: 'Salle déjà en jeu' }, 409);
        if (room.host === userId) return json({ error: 'Vous êtes déjà dans cette salle' }, 409);

        // Assign roles randomly
        const hostIsEnqueteur = Math.random() > 0.5;
        room.guest = userId;
        room.status = 'playing';
        room.roles = {
          [room.host]: hostIsEnqueteur ? 'enqueteur' : 'enquete',
          [userId]: hostIsEnqueteur ? 'enquete' : 'enqueteur',
        };
        await redis('SET', `room:${roomCode}`, JSON.stringify(room), 'EX', '600');

        return json({
          roomCode,
          status: 'playing',
          role: room.roles[userId],
          partnerId: room.host,
        });
      }

      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      // JOIN SESSION QUEUE (cross-school pairing)
      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      case 'join-session': {
        const { userId, sessionCode, schoolId, classId } = body as {
          userId: string;
          sessionCode: string;
          schoolId?: string;
          classId?: string;
        };
        const queueKey = `session:${sessionCode}:queue`;

        // Get all users waiting in this session (stored as hash: userId → JSON)
        const allEntries = await redis('HGETALL', queueKey) as string[] | null;

        if (allEntries && allEntries.length > 0) {
          for (let i = 0; i < allEntries.length; i += 2) {
            const waitingUserId = allEntries[i];
            const waitingData = JSON.parse(allEntries[i + 1]) as {
              schoolId?: string;
              classId?: string;
              timestamp: number;
            };

            if (waitingUserId === userId) continue;
            if (Date.now() - waitingData.timestamp > 180_000) continue;
            const sameSchool = schoolId && waitingData.schoolId && schoolId === waitingData.schoolId;
            if (sameSchool) continue;

            // Found a cross-school match
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const hostIsEnqueteur = Math.random() > 0.5;
            const room: Room = {
              host: waitingUserId,
              guest: userId,
              status: 'playing',
              roles: {
                [waitingUserId]: hostIsEnqueteur ? 'enqueteur' : 'enquete',
                [userId]: hostIsEnqueteur ? 'enquete' : 'enqueteur',
              },
              createdAt: Date.now(),
            };

            await redisPipeline([
              ['SET', `room:${roomCode}`, JSON.stringify(room), 'EX', '600'],
              ['SET', `queue:match:${waitingUserId}`, roomCode, 'EX', '120'],
              ['HDEL', queueKey, waitingUserId],
            ]);

            return json({
              status: 'playing',
              roomCode,
              role: room.roles[userId],
              partnerId: waitingUserId,
            });
          }
        }

        // No match yet – add self to the session queue
        const entry = JSON.stringify({ schoolId, classId, timestamp: Date.now() });
        await redisPipeline([
          ['HSET', queueKey, userId, entry],
          ['EXPIRE', queueKey, '180'],
        ]);
        return json({ status: 'waiting' });
      }

      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      // JOIN GENERIC QUEUE — uses hash so N users can wait simultaneously
      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      case 'join-queue': {
        const { userId, schoolId, classId } = body as { userId: string; schoolId?: string; classId?: string };
        const queueKey = 'queue:generic:v2';

        // Get all users currently waiting
        const allEntries = await redis('HGETALL', queueKey) as string[] | null;

        if (allEntries && allEntries.length > 0) {
          for (let i = 0; i < allEntries.length; i += 2) {
            const waitingUserId = allEntries[i];
            const waitingData = JSON.parse(allEntries[i + 1]) as QueueEntry;

            if (waitingUserId === userId) continue;
            if (Date.now() - waitingData.timestamp > 120_000) continue;

            // Found a match
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const hostIsEnqueteur = Math.random() > 0.5;
            const room: Room = {
              host: waitingUserId,
              guest: userId,
              status: 'playing',
              roles: {
                [waitingUserId]: hostIsEnqueteur ? 'enqueteur' : 'enquete',
                [userId]: hostIsEnqueteur ? 'enquete' : 'enqueteur',
              },
              createdAt: Date.now(),
            };

            await redisPipeline([
              ['SET', `room:${roomCode}`, JSON.stringify(room), 'EX', '600'],
              ['SET', `queue:match:${waitingUserId}`, roomCode, 'EX', '120'],
              ['HDEL', queueKey, waitingUserId],
            ]);

            return json({
              roomCode,
              status: 'playing',
              role: room.roles[userId],
              partnerId: waitingUserId,
            });
          }
        }

        // No match found – add self to the hash queue
        const entry = JSON.stringify({ userId, timestamp: Date.now(), schoolId, classId });
        await redisPipeline([
          ['HSET', queueKey, userId, entry],
          ['EXPIRE', queueKey, '300'],
        ]);
        return json({ status: 'waiting' });
      }

      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      // POLL – room status + messages
      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      case 'poll': {
        const { roomCode, userId, lastMsgIndex = 0 } = body;

        // 🔄 No room code: we're polling from the generic queue 🔄
        if (!roomCode) {
          const matchRoom = await redis('GET', `queue:match:${userId}`) as string | null;
          if (matchRoom) {
            // Delete so repeat polls don't re-trigger onMatched
            await redis('DEL', `queue:match:${userId}`);
            const raw = await redis('GET', `room:${matchRoom}`) as string | null;
            if (raw) {
              const room: Room = JSON.parse(raw);
              return json({
                status: 'matched',
                roomCode: matchRoom,
                role: room.roles?.[userId],
                partnerId: room.host === userId ? room.guest : room.host,
              });
            }
          }
          return json({ status: 'waiting' });
        }

        // 🔄 Room code provided: poll room + messages 🔄
        const results = await redisPipeline([
          ['GET', `room:${roomCode}`],
          ['LRANGE', `msgs:${roomCode}`, String(lastMsgIndex), '-1'],
          ['GET', `typing:${roomCode}`],
          ['GET', `gameend:${roomCode}`],
        ]);

        const roomRaw = results[0]?.result as string | null;
        const room: Room | null = roomRaw ? JSON.parse(roomRaw) : null;
        const rawMsgs = (results[1]?.result || []) as string[];
        const messages = rawMsgs.map((m: string) => JSON.parse(m));
        const typingRaw = results[2]?.result as string | null;
        const typingData = typingRaw ? JSON.parse(typingRaw) : null;
        const gameEnded = !!results[3]?.result;

        const partnerTyping =
          typingData &&
          typingData.userId !== userId &&
          Date.now() - typingData.timestamp < 4000;

        return json({
          status: room?.status || 'unknown',
          role: room?.roles?.[userId] ?? null,
          partnerId: room ? (room.host === userId ? room.guest : room.host) : null,
          messages,
          partnerTyping: !!partnerTyping,
          gameEnded,
          totalMessages: lastMsgIndex + messages.length,
        });
      }

      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      // SEND MESSAGE
      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      case 'send': {
        const { roomCode, senderId, content } = body;
        const msg = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          senderId,
          content,
          timestamp: Date.now(),
        };
        await redisPipeline([
          ['RPUSH', `msgs:${roomCode}`, JSON.stringify(msg)],
          ['EXPIRE', `msgs:${roomCode}`, '600'],
        ]);
        return json({ ok: true });
      }

      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      // TYPING INDICATOR
      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      case 'typing': {
        const { roomCode, userId } = body;
        await redis(
          'SET',
          `typing:${roomCode}`,
          JSON.stringify({ userId, timestamp: Date.now() }),
          'EX',
          '4',
        );
        return json({ ok: true });
      }

      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      // GAME END
      // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
      case 'game-end': {
        const { roomCode } = body;
        await redis('SET', `gameend:${roomCode}`, '1', 'EX', '600');
        return json({ ok: true });
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    console.error('Relay error:', error);
    return json({ error: 'Internal server error', details: String(error) }, 500);
  }
}
