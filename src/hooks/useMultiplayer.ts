import { useState, useRef, useCallback, useEffect } from 'react';

export type MultiplayerRole = 'enqueteur' | 'enquete';

export interface MatchData {
  partnerId: string;
  role: MultiplayerRole;
  roomCode: string;
}

export interface ReceivedMessage {
  id: string;
  content: string;
  timestamp: number;
}

const RELAY_URL = '/api/relay';

/**
 * Cross-device multiplayer via HTTP polling + Upstash Redis.
 *
 * Works across different browsers/devices/networks — any two users
 * accessing the same deployed URL can play together.
 *
 * External API is identical to the previous BroadcastChannel version
 * so PlayPage needs zero changes.
 */
export function useMultiplayer(userId: string) {
  const [isSearching, setIsSearching] = useState(false);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [receivedMessages, setReceivedMessages] = useState<ReceivedMessage[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  const roomCodeRef = useRef<string | null>(null);
  const lastMsgIndexRef = useRef(0);
  const gamePollRef = useRef<number | null>(null);
  const matchPollRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (gamePollRef.current) clearInterval(gamePollRef.current);
      if (matchPollRef.current) clearInterval(matchPollRef.current);
    };
  }, []);

  // ─── API helper ───

  const relay = useCallback(async (body: Record<string, unknown>) => {
    try {
      const res = await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[multiplayer] relay error:', res.status, err);
        return { error: true, status: res.status, ...(err as Record<string, unknown>) };
      }
      return res.json();
    } catch (e) {
      console.warn('[multiplayer] network error:', e);
      return { error: true, network: true };
    }
  }, []);

  // ─── Finalise a match ───

  const onMatched = useCallback(
    (partnerId: string, role: MultiplayerRole, roomCode: string) => {
      if (!mountedRef.current) return;

      // Stop any match polling
      if (matchPollRef.current) {
        clearInterval(matchPollRef.current);
        matchPollRef.current = null;
      }

      roomCodeRef.current = roomCode;
      lastMsgIndexRef.current = 0;
      setMatchData({ partnerId, role, roomCode });
      setIsSearching(false);

      // Start game polling (messages, typing, game end)
      gamePollRef.current = window.setInterval(async () => {
        if (!mountedRef.current) return;
        const data = await relay({
          action: 'poll',
          roomCode,
          userId,
          lastMsgIndex: lastMsgIndexRef.current,
        });
        if (data.error) return;

        // New messages from partner
        if (data.messages && data.messages.length > 0) {
          const fromPartner = data.messages.filter(
            (m: { senderId: string }) => m.senderId !== userId,
          );
          if (fromPartner.length > 0) {
            setReceivedMessages(prev => [
              ...prev,
              ...fromPartner.map((m: { id: string; content: string; timestamp: number }) => ({
                id: m.id,
                content: m.content,
                timestamp: m.timestamp,
              })),
            ]);
          }
          lastMsgIndexRef.current = data.totalMessages;
        }

        // Typing
        if (data.partnerTyping) {
          setPartnerTyping(true);
        } else {
          setPartnerTyping(false);
        }

        // Game ended
        if (data.gameEnded) {
          setGameEnded(true);
        }
      }, 1000);
    },
    [relay, userId],
  );

  // ─── Create private room ───

  const createPrivateRoom = useCallback(
    async (roomCode: string) => {
      setIsSearching(true);
      const res = await relay({ action: 'create-room', roomCode, userId });
      if (res.error) {
        console.warn('[multiplayer] could not create room:', res);
        setIsSearching(false);
        return;
      }

      // Poll until someone joins
      matchPollRef.current = window.setInterval(async () => {
        if (!mountedRef.current) return;
        const data = await relay({ action: 'poll', roomCode, userId });
        if (data.error) return;

        if (data.status === 'playing' && data.role) {
          onMatched(data.partnerId, data.role, roomCode);
        }
      }, 1500);
    },
    [relay, userId, onMatched],
  );

  // ─── Join private room ───

  const joinPrivateRoom = useCallback(
    async (roomCode: string) => {
      setIsSearching(true);

      const tryJoin = async (): Promise<boolean> => {
        const data = await relay({ action: 'join-room', roomCode, userId });
        if (data.status === 'playing' && data.role) {
          onMatched(data.partnerId, data.role, roomCode);
          return true;
        }
        return false;
      };

      // Try immediately
      if (await tryJoin()) return;

      // Retry every 2s (room may not exist yet)
      matchPollRef.current = window.setInterval(async () => {
        if (!mountedRef.current) return;
        if (await tryJoin()) {
          if (matchPollRef.current) clearInterval(matchPollRef.current);
          matchPollRef.current = null;
        }
      }, 2000);
    },
    [relay, userId, onMatched],
  );

  // ─── Join generic queue ───

  const joinGenericQueue = useCallback(async () => {
    setIsSearching(true);
    const data = await relay({ action: 'join-queue', userId });

    if (data.error) {
      console.warn('[multiplayer] queue error:', data);
      setIsSearching(false);
      return;
    }

    if (data.status === 'playing' && data.roomCode) {
      // Immediately matched
      onMatched(data.partnerId, data.role, data.roomCode);
      return;
    }

    // Waiting — poll for match
    matchPollRef.current = window.setInterval(async () => {
      if (!mountedRef.current) return;
      const pollData = await relay({ action: 'poll', userId });
      if (pollData.error) return;

      if (pollData.status === 'matched' && pollData.roomCode) {
        onMatched(pollData.partnerId, pollData.role, pollData.roomCode);
      }
    }, 1500);
  }, [relay, userId, onMatched]);

  // ─── In-game actions ───

  const sendMessage = useCallback(
    (content: string) => {
      if (!roomCodeRef.current) return;
      // Fire-and-forget
      relay({ action: 'send', roomCode: roomCodeRef.current, senderId: userId, content });
    },
    [relay, userId],
  );

  const sendTyping = useCallback(() => {
    if (!roomCodeRef.current) return;
    // Debounce: max once per 2 seconds
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    relay({ action: 'typing', roomCode: roomCodeRef.current, userId });
  }, [relay, userId]);

  const sendGameEnd = useCallback(() => {
    if (!roomCodeRef.current) return;
    relay({ action: 'game-end', roomCode: roomCodeRef.current });
  }, [relay]);

  // ─── Disconnect & reset ───

  const disconnect = useCallback(() => {
    if (roomCodeRef.current) {
      relay({ action: 'game-end', roomCode: roomCodeRef.current }).catch(() => {});
    }
    if (gamePollRef.current) clearInterval(gamePollRef.current);
    if (matchPollRef.current) clearInterval(matchPollRef.current);
    gamePollRef.current = null;
    matchPollRef.current = null;
    roomCodeRef.current = null;
    lastMsgIndexRef.current = 0;
    lastTypingSentRef.current = 0;
    setMatchData(null);
    setIsSearching(false);
    setReceivedMessages([]);
    setPartnerTyping(false);
    setGameEnded(false);
  }, [relay]);

  return {
    isSearching,
    matchData,
    receivedMessages,
    partnerTyping,
    gameEnded,
    createPrivateRoom,
    joinPrivateRoom,
    joinGenericQueue,
    sendMessage,
    sendTyping,
    sendGameEnd,
    disconnect,
  };
}
