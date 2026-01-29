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

interface ChannelMessage {
  type: string;
  senderId: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Hook for cross-tab multiplayer via BroadcastChannel.
 * Works between tabs/windows of the same origin (same browser, same domain).
 *
 * Flow:
 *  1. Player creates/joins a room (private code or generic lobby)
 *  2. When two players match, roles are assigned randomly
 *  3. During game, chat messages and typing indicators are relayed
 *  4. When the enquêteur votes, GAME_END is sent
 */
export function useMultiplayer(userId: string) {
  const [isSearching, setIsSearching] = useState(false);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [receivedMessages, setReceivedMessages] = useState<ReceivedMessage[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  const lobbyRef = useRef<BroadcastChannel | null>(null);
  const roomRef = useRef<BroadcastChannel | null>(null);
  const gameRef = useRef<BroadcastChannel | null>(null);
  const announceRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const matchedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      lobbyRef.current?.close();
      roomRef.current?.close();
      gameRef.current?.close();
      if (announceRef.current) clearInterval(announceRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // ─── Game channel (used after matching) ───

  const setupGameChannel = useCallback((roomCode: string) => {
    gameRef.current?.close();
    const ch = new BroadcastChannel(`jeu-imitation-game-${roomCode}`);
    gameRef.current = ch;

    ch.onmessage = (ev: MessageEvent<ChannelMessage>) => {
      const msg = ev.data;
      if (msg.senderId === userId) return;

      switch (msg.type) {
        case 'CHAT_MESSAGE':
          setReceivedMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              content: (msg.payload as { content: string }).content,
              timestamp: msg.timestamp,
            },
          ]);
          setPartnerTyping(false);
          break;

        case 'TYPING':
          setPartnerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 4000);
          break;

        case 'GAME_END':
          setGameEnded(true);
          break;
      }
    };
  }, [userId]);

  // Helper: finalise a match
  const finaliseMatch = useCallback(
    (partnerId: string, role: MultiplayerRole, roomCode: string) => {
      matchedRef.current = true;
      setMatchData({ partnerId, role, roomCode });
      setIsSearching(false);
      setupGameChannel(roomCode);

      // Close lobby / room channels
      lobbyRef.current?.close();
      lobbyRef.current = null;
      roomRef.current?.close();
      roomRef.current = null;
      if (announceRef.current) {
        clearInterval(announceRef.current);
        announceRef.current = null;
      }
    },
    [setupGameChannel],
  );

  // ─── Create private room ───

  const createPrivateRoom = useCallback(
    (roomCode: string) => {
      roomRef.current?.close();
      matchedRef.current = false;
      const ch = new BroadcastChannel(`jeu-imitation-room-${roomCode}`);
      roomRef.current = ch;
      setIsSearching(true);

      ch.onmessage = (ev: MessageEvent<ChannelMessage>) => {
        const msg = ev.data;
        if (msg.senderId === userId || matchedRef.current) return;

        if (msg.type === 'JOIN_ROOM') {
          const iAmEnqueteur = Math.random() > 0.5;
          const myRole: MultiplayerRole = iAmEnqueteur ? 'enqueteur' : 'enquete';
          const partnerRole: MultiplayerRole = iAmEnqueteur ? 'enquete' : 'enqueteur';

          ch.postMessage({
            type: 'GAME_STARTING',
            senderId: userId,
            payload: { role: partnerRole, roomCode },
            timestamp: Date.now(),
          });

          finaliseMatch(msg.senderId, myRole, roomCode);
        }
      };

      // Announce room exists (so late joiners detect it)
      ch.postMessage({ type: 'ROOM_READY', senderId: userId, timestamp: Date.now() });
    },
    [userId, finaliseMatch],
  );

  // ─── Join private room ───

  const joinPrivateRoom = useCallback(
    (roomCode: string) => {
      roomRef.current?.close();
      matchedRef.current = false;
      const ch = new BroadcastChannel(`jeu-imitation-room-${roomCode}`);
      roomRef.current = ch;
      setIsSearching(true);

      ch.onmessage = (ev: MessageEvent<ChannelMessage>) => {
        const msg = ev.data;
        if (msg.senderId === userId || matchedRef.current) return;

        if (msg.type === 'GAME_STARTING') {
          const p = msg.payload as { role: MultiplayerRole; roomCode: string };
          finaliseMatch(msg.senderId, p.role, p.roomCode);
        }
      };

      ch.postMessage({ type: 'JOIN_ROOM', senderId: userId, timestamp: Date.now() });
    },
    [userId, finaliseMatch],
  );

  // ─── Generic lobby queue ───

  const joinGenericQueue = useCallback(() => {
    lobbyRef.current?.close();
    matchedRef.current = false;
    const ch = new BroadcastChannel('jeu-imitation-lobby');
    lobbyRef.current = ch;
    setIsSearching(true);

    ch.onmessage = (ev: MessageEvent<ChannelMessage>) => {
      const msg = ev.data;
      if (msg.senderId === userId || matchedRef.current) return;

      if (msg.type === 'LOOKING_FOR_GAME') {
        // I found someone → I become host
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const iAmEnqueteur = Math.random() > 0.5;
        const myRole: MultiplayerRole = iAmEnqueteur ? 'enqueteur' : 'enquete';
        const partnerRole: MultiplayerRole = iAmEnqueteur ? 'enquete' : 'enqueteur';

        ch.postMessage({
          type: 'MATCH_FOUND',
          senderId: userId,
          payload: { targetId: msg.senderId, role: partnerRole, roomCode },
          timestamp: Date.now(),
        });

        finaliseMatch(msg.senderId, myRole, roomCode);
      }

      if (msg.type === 'MATCH_FOUND') {
        const p = msg.payload as { targetId: string; role: MultiplayerRole; roomCode: string };
        if (p.targetId === userId) {
          finaliseMatch(msg.senderId, p.role, p.roomCode);
        }
      }
    };

    // Announce availability immediately + every 2s
    const announce = () => {
      try {
        ch.postMessage({
          type: 'LOOKING_FOR_GAME',
          senderId: userId,
          timestamp: Date.now(),
        });
      } catch {
        /* channel closed */
      }
    };
    announce();
    announceRef.current = window.setInterval(announce, 2000);
  }, [userId, finaliseMatch]);

  // ─── In-game actions ───

  const sendMessage = useCallback(
    (content: string) => {
      gameRef.current?.postMessage({
        type: 'CHAT_MESSAGE',
        senderId: userId,
        payload: { content },
        timestamp: Date.now(),
      });
    },
    [userId],
  );

  const sendTyping = useCallback(() => {
    gameRef.current?.postMessage({
      type: 'TYPING',
      senderId: userId,
      timestamp: Date.now(),
    });
  }, [userId]);

  const sendGameEnd = useCallback(() => {
    gameRef.current?.postMessage({
      type: 'GAME_END',
      senderId: userId,
      timestamp: Date.now(),
    });
  }, [userId]);

  // ─── Full disconnect & reset ───

  const disconnect = useCallback(() => {
    try { gameRef.current?.postMessage({ type: 'GAME_END', senderId: userId, timestamp: Date.now() }); } catch { /* */ }
    gameRef.current?.close();
    lobbyRef.current?.close();
    roomRef.current?.close();
    gameRef.current = null;
    lobbyRef.current = null;
    roomRef.current = null;
    if (announceRef.current) clearInterval(announceRef.current);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    matchedRef.current = false;
    setMatchData(null);
    setIsSearching(false);
    setReceivedMessages([]);
    setPartnerTyping(false);
    setGameEnded(false);
  }, [userId]);

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
