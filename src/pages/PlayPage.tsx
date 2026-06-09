import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';
import { useTimer } from '../hooks/useTimer';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { generateAIResponse, createAIMessage } from '../utils/aiResponder';
import type { Message, ChatSession, Persona, GameMode } from '../types';
import type { MultiplayerRole } from '../hooks/useMultiplayer';
import { v4 as uuidv4 } from 'uuid';

type GamePhase = 'select' | 'waiting' | 'playing' | 'voting' | 'result';
type WaitingMode = 'generic' | 'private';

/** Simulate realistic typing delay for a teenager (3-6 chars/sec + thinking time) */
function computeTypingDelay(responseText: string): number {
  const charCount = responseText.length;
  const thinkTime = 1500 + Math.random() * 2500;
  const charsPerSec = 3 + Math.random() * 3;
  const typingTime = (charCount / charsPerSec) * 1000;
  return Math.min(Math.max(thinkTime + typingTime, 2000), 12000);
}

export function PlayPage() {
  const { state, dispatch } = useGame();
  const { currentUser, personas } = state;
  const location = useLocation();

  const [phase, setPhase] = useState<GamePhase>('select');
  const [personaA, setPersonaA] = useState<Persona | null>(null);
  const [personaB, setPersonaB] = useState<Persona | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>('solo');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messagesA, setMessagesA] = useState<Message[]>([]);
  const [messagesB, setMessagesB] = useState<Message[]>([]);
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [typingA, setTypingA] = useState(false);
  const [typingB, setTypingB] = useState(false);
  const [vote, setVote] = useState<'A' | 'B' | null>(null);
  const [justification, setJustification] = useState('');
  const [result, setResult] = useState<{ correct: boolean; points: number } | null>(null);

  // Multiplayer role & enquêté state
  const [role, setRole] = useState<'enqueteur' | 'enquete' | null>(null);
  const [enqueteMessages, setEnqueteMessages] = useState<Message[]>([]);
  const [enqueteInput, setEnqueteInput] = useState('');
  const enqueteChatRef = useRef<HTMLDivElement>(null);
  const processedMsgCountRef = useRef(0);

  // Waiting room
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [waitingMode, setWaitingMode] = useState<WaitingMode>('generic');
  const [waitingCountdown, setWaitingCountdown] = useState(60);
  const [waitingElapsed, setWaitingElapsed] = useState(0);
  const waitingIntervalRef = useRef<number | null>(null);

  const chatARef = useRef<HTMLDivElement>(null);
  const chatBRef = useRef<HTMLDivElement>(null);

  const { timeLeft, isExpired, start, formatTime } = useTimer(300);

  // Personas from other classes only (for fair cross-class play)
  const playablePersonas = personas.filter(p => p.classId !== currentUser?.classId);
  // Fallback to all personas if no cross-class ones exist yet
  const availablePersonas = playablePersonas.length > 0 ? playablePersonas : personas;

  // Multiplayer hook
  const multiplayer = useMultiplayer(currentUser?.id || '');

  // Refs for values used inside effects to avoid stale closures
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const roleRef = useRef(role);
  roleRef.current = role;

  // ==================== EFFECTS ====================

  // Handle arrival from lobby with a pre-matched room
  useEffect(() => {
    const ls = location.state as { fromLobby?: boolean; roomCode?: string; role?: string; partnerId?: string } | null;
    if (!ls?.fromLobby || !ls.roomCode || !ls.role || !ls.partnerId) return;
    setPhase('waiting');
    multiplayer.rejoinRoom(ls.roomCode, ls.role as MultiplayerRole, ls.partnerId);
    // Clear state so a page refresh doesn't re-trigger
    window.history.replaceState({}, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll chats
  useEffect(() => {
    if (chatARef.current) chatARef.current.scrollTop = chatARef.current.scrollHeight;
  }, [messagesA]);
  useEffect(() => {
    if (chatBRef.current) chatBRef.current.scrollTop = chatBRef.current.scrollHeight;
  }, [messagesB]);
  useEffect(() => {
    if (enqueteChatRef.current) enqueteChatRef.current.scrollTop = enqueteChatRef.current.scrollHeight;
  }, [enqueteMessages]);

  // Timer expired → voting (enquêteur only)
  useEffect(() => {
    if (isExpired && phase === 'playing' && role !== 'enquete') {
      setPhase('voting');
    }
  }, [isExpired, phase, role]);

  // Timer expired → game over for enquêté
  useEffect(() => {
    if (isExpired && phase === 'playing' && role === 'enquete') {
      setPhase('result');
    }
  }, [isExpired, phase, role]);

  // Cleanup waiting interval on unmount
  useEffect(() => {
    return () => {
      if (waitingIntervalRef.current) clearInterval(waitingIntervalRef.current);
    };
  }, []);

  // ─── Multiplayer: match found → start game ───
  useEffect(() => {
    if (!multiplayer.matchData || phase !== 'waiting') return;

    const { role: assignedRole } = multiplayer.matchData;
    setRole(assignedRole);

    // Stop fallback countdown
    if (waitingIntervalRef.current) {
      clearInterval(waitingIntervalRef.current);
      waitingIntervalRef.current = null;
    }

    if (assignedRole === 'enqueteur') {
      startMultiplayerGame();
    } else {
      // Enquêté: simple interface, just start the timer
      setPhase('playing');
      start();
      setEnqueteMessages([{
        id: uuidv4(),
        content: "Un enquêteur va vous poser des questions. Répondez naturellement, comme si vous étiez un humain ordinaire !",
        senderId: 'system',
        timestamp: new Date(),
        isFromAI: false,
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer.matchData]);

  // ─── Multiplayer: process incoming messages ───
  useEffect(() => {
    const msgs = multiplayer.receivedMessages;
    if (msgs.length <= processedMsgCountRef.current) return;

    const newMsgs = msgs.slice(processedMsgCountRef.current);
    processedMsgCountRef.current = msgs.length;

    for (const msg of newMsgs) {
      const currentRole = roleRef.current;
      const currentSession = sessionRef.current;

      if (currentRole === 'enqueteur' && currentSession) {
        // Message from the human partner → add to the human chat
        const newMessage: Message = {
          id: msg.id,
          content: msg.content,
          senderId: 'human-player',
          timestamp: new Date(msg.timestamp),
          isFromAI: false,
        };
        if (currentSession.humanChat === 'A') {
          setTypingA(false);
          setMessagesA(prev => [...prev, newMessage]);
        } else {
          setTypingB(false);
          setMessagesB(prev => [...prev, newMessage]);
        }
      } else if (currentRole === 'enquete') {
        // Message from the enquêteur → add to the enquêté's chat
        const newMessage: Message = {
          id: msg.id,
          content: msg.content,
          senderId: 'enqueteur',
          timestamp: new Date(msg.timestamp),
          isFromAI: false,
        };
        setEnqueteMessages(prev => [...prev, newMessage]);
      }
    }
  }, [multiplayer.receivedMessages.length]);

  // ─── Multiplayer: partner typing indicator (for enquêteur) ───
  useEffect(() => {
    if (role !== 'enqueteur' || !session) return;
    if (session.humanChat === 'A') {
      setTypingA(multiplayer.partnerTyping);
    } else {
      setTypingB(multiplayer.partnerTyping);
    }
  }, [multiplayer.partnerTyping, role, session]);

  // ─── Multiplayer: notify partner when enquêteur transitions to voting ───
  useEffect(() => {
    if (phase === 'voting' && multiplayer.matchData && role === 'enqueteur') {
      multiplayer.sendGameEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── Multiplayer: game ended by partner (for enquêté) ───
  useEffect(() => {
    if (multiplayer.gameEnded && role === 'enquete' && phase === 'playing') {
      setPhase('result');
    }
  }, [multiplayer.gameEnded, role, phase]);

  // ==================== HELPERS ====================

  const getRandomPersona = useCallback((excludeId?: string) => {
    // Prefer personas from a different class than the current player
    const crossClass = personas.filter(
      p => p.id !== excludeId && p.classId !== currentUser?.classId
    );
    const pool = crossClass.length > 0
      ? crossClass
      : personas.filter(p => p.id !== excludeId);
    return pool[Math.floor(Math.random() * pool.length)] || personas[0];
  }, [personas, currentUser?.classId]);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  // ==================== START GAME ====================

  const startSoloGame = () => {
    if (!personaA) return;
    const pB = personaB || getRandomPersona(personaA.id);
    setPersonaB(pB);
    setRole(null);

    const newSession: ChatSession = {
      id: uuidv4(),
      enqueteurId: currentUser?.id || '',
      personaIdA: personaA.id,
      personaIdB: pB.id,
      gameMode: 'solo',
      messages: { chatA: [], chatB: [] },
      startTime: new Date(),
      duration: 300,
      status: 'active',
      aiIsInChat: 'both',
    };

    setSession(newSession);
    dispatch({ type: 'ADD_SESSION', payload: newSession });
    setPhase('playing');
    start();

    setTimeout(() => setMessagesA([{
      id: uuidv4(), content: "Salut ! Prêt à discuter ?",
      senderId: 'ai-a', timestamp: new Date(), isFromAI: true,
    }]), 500);
    setTimeout(() => setMessagesB([{
      id: uuidv4(), content: "Hey ! C'est parti ?",
      senderId: 'ai-b', timestamp: new Date(), isFromAI: true,
    }]), 800);
  };

  const startMultiplayerGame = () => {
    const pA = personaA || getRandomPersona();
    const pB = personaB || getRandomPersona(pA.id);
    if (!personaA) setPersonaA(pA);
    if (!personaB) setPersonaB(pB);

    const aiChat = Math.random() > 0.5 ? 'A' : 'B';

    const newSession: ChatSession = {
      id: uuidv4(),
      enqueteurId: currentUser?.id || '',
      personaIdA: pA.id,
      personaIdB: pB.id,
      gameMode: 'multiplayer',
      messages: { chatA: [], chatB: [] },
      startTime: new Date(),
      duration: 300,
      status: 'active',
      aiIsInChat: aiChat as 'A' | 'B',
      humanChat: aiChat === 'A' ? 'B' : 'A',
    };

    setSession(newSession);
    dispatch({ type: 'ADD_SESSION', payload: newSession });
    if (waitingIntervalRef.current) clearInterval(waitingIntervalRef.current);
    setPhase('playing');
    start();

    // Both chats get a greeting at random delays to avoid tells
    const delayA = 800 + Math.random() * 2000;
    const delayB = 800 + Math.random() * 2000;
    setTimeout(() => setMessagesA([{
      id: uuidv4(), content: "Salut ! Prêt à discuter ?",
      senderId: 'interlocutor-a', timestamp: new Date(), isFromAI: aiChat === 'A',
    }]), delayA);
    setTimeout(() => setMessagesB([{
      id: uuidv4(), content: "Hey ! C'est parti ?",
      senderId: 'interlocutor-b', timestamp: new Date(), isFromAI: aiChat === 'B',
    }]), delayB);
  };

  // ==================== WAITING ROOM ====================

  const startWaitingRoom = (mode: WaitingMode = 'generic') => {
    if (!personaA) return;
    const pB = personaB || getRandomPersona(personaA.id);
    setPersonaB(pB);

    const code = mode === 'private' ? generateRoomCode() : 'PUBLIC';
    setRoomCode(code);
    setWaitingMode(mode);
    setPhase('waiting');
    setWaitingCountdown(60);
    setWaitingElapsed(0);

    // Start multiplayer matchmaking
    if (mode === 'private') {
      multiplayer.createPrivateRoom(code);
    } else {
      multiplayer.joinGenericQueue(currentUser?.schoolId, currentUser?.classId);
    }

    // Fallback countdown
    waitingIntervalRef.current = window.setInterval(() => {
      setWaitingCountdown(prev => {
        if (prev <= 1) {
          if (waitingIntervalRef.current) clearInterval(waitingIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
      setWaitingElapsed(prev => prev + 1);
    }, 1000);
  };

  // When countdown reaches 0, fall back to solo
  useEffect(() => {
    if (waitingCountdown === 0 && phase === 'waiting') {
      multiplayer.disconnect();
      startSoloGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingCountdown, phase]);

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    if (!personaA) setPersonaA(getRandomPersona());

    const code = joinCode.trim().toUpperCase();
    setRoomCode(code);
    setPhase('waiting');
    setWaitingCountdown(60);
    setWaitingElapsed(0);

    multiplayer.joinPrivateRoom(code);

    waitingIntervalRef.current = window.setInterval(() => {
      setWaitingCountdown(prev => {
        if (prev <= 1) {
          if (waitingIntervalRef.current) clearInterval(waitingIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
      setWaitingElapsed(prev => prev + 1);
    }, 1000);
  };

  // ==================== SEND MESSAGES ====================

  const sendMessageA = async () => {
    if (!inputA.trim() || !session) return;

    const userMessage: Message = {
      id: uuidv4(), content: inputA.trim(),
      senderId: currentUser?.id || '', timestamp: new Date(), isFromAI: false,
    };
    setMessagesA(prev => [...prev, userMessage]);
    const question = inputA.trim();
    setInputA('');

    const isAI = session.aiIsInChat === 'A' || session.aiIsInChat === 'both';

    if (isAI && personaA) {
      // AI response with realistic typing delay
      setTypingA(true);
      const response = await generateAIResponse(personaA, messagesA, question);
      const delay = computeTypingDelay(response);
      await new Promise(resolve => setTimeout(resolve, delay));
      setTypingA(false);
      setMessagesA(prev => [...prev, createAIMessage(response)]);
    } else if (multiplayer.matchData) {
      // Real human partner via BroadcastChannel
      multiplayer.sendMessage(question);
      // Typing indicator will come from partner's TYPING events
    }
  };

  const sendMessageB = async () => {
    if (!inputB.trim() || !session) return;

    const userMessage: Message = {
      id: uuidv4(), content: inputB.trim(),
      senderId: currentUser?.id || '', timestamp: new Date(), isFromAI: false,
    };
    setMessagesB(prev => [...prev, userMessage]);
    const question = inputB.trim();
    setInputB('');

    const isAI = session.aiIsInChat === 'B' || session.aiIsInChat === 'both';

    if (isAI && personaB) {
      setTypingB(true);
      const response = await generateAIResponse(personaB, messagesB, question);
      const delay = computeTypingDelay(response);
      await new Promise(resolve => setTimeout(resolve, delay));
      setTypingB(false);
      setMessagesB(prev => [...prev, createAIMessage(response)]);
    } else if (multiplayer.matchData) {
      multiplayer.sendMessage(question);
    }
  };

  // Enquêté sends a message back to the enquêteur
  const sendEnqueteMessage = () => {
    if (!enqueteInput.trim()) return;
    const content = enqueteInput.trim();

    const msg: Message = {
      id: uuidv4(), content,
      senderId: currentUser?.id || 'enquete',
      timestamp: new Date(), isFromAI: false,
    };
    setEnqueteMessages(prev => [...prev, msg]);
    setEnqueteInput('');

    // Relay to the enquêteur
    multiplayer.sendMessage(content);
  };

  // ==================== VOTE ====================

  const submitVote = () => {
    if (!vote || !session) return;

    let isCorrect = false;
    if (session.aiIsInChat === 'both') {
      isCorrect = true;
    } else {
      isCorrect = vote === session.aiIsInChat;
    }

    let points = 0;
    if (isCorrect) {
      points = 2;
      if (justification.trim().length > 50) points += 1;
    }

    setResult({ correct: isCorrect, points });

    dispatch({
      type: 'ADD_VOTE',
      payload: {
        id: uuidv4(), sessionId: session.id,
        enqueteurId: currentUser?.id || '', votedChat: vote,
        justification: justification.trim(), isCorrect, timestamp: new Date(),
      },
    });

    dispatch({
      type: 'UPDATE_SESSION',
      payload: {
        ...session, status: 'completed', endTime: new Date(),
        messages: { chatA: messagesA, chatB: messagesB },
      },
    });

    // Notify partner that game ended
    if (multiplayer.matchData) {
      multiplayer.sendGameEnd();
    }

    setPhase('result');
  };

  const playAgain = () => {
    multiplayer.disconnect();
    processedMsgCountRef.current = 0;
    setPhase('select');
    setPersonaA(null);
    setPersonaB(null);
    setSession(null);
    setMessagesA([]);
    setMessagesB([]);
    setVote(null);
    setJustification('');
    setResult(null);
    setRoomCode('');
    setJoinCode('');
    setGameMode('solo');
    setRole(null);
    setEnqueteMessages([]);
    setEnqueteInput('');
  };

  // ==================== RENDER: SELECT PHASE ====================

  if (phase === 'select') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="scanline"></div>
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="retro-text-cyan hover:glow-text text-lg">
            {'<'} Retour au menu
          </Link>

          {/* Game mode selection */}
          <RetroContainer title="MODE DE JEU" className="mt-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setGameMode('solo')}
                className={`p-6 border-2 transition-all text-left ${
                  gameMode === 'solo'
                    ? 'border-[#00ff41] bg-[rgba(0,255,65,0.1)]'
                    : 'border-gray-600 hover:border-[#00ff41]'
                }`}
              >
                <p className="text-2xl mb-2">SOLO (2 IAs)</p>
                <p className="retro-text-amber text-sm">
                  Affrontez deux IAs avec des personas différents. Disponible immédiatement.
                </p>
                {gameMode === 'solo' && <span className="text-xl mt-2 block">Sélectionné</span>}
              </button>
              <button
                onClick={() => setGameMode('multiplayer')}
                className={`p-6 border-2 transition-all text-left ${
                  gameMode === 'multiplayer'
                    ? 'border-[#00ffff] bg-[rgba(0,255,255,0.1)]'
                    : 'border-gray-600 hover:border-[#00ffff]'
                }`}
              >
                <p className="text-2xl retro-text-cyan mb-2">MULTI (IA + Humain)</p>
                <p className="retro-text-amber text-sm">
                  Salle d'attente pour jouer avec un autre élève.
                  Un joueur sera enquêteur, l'autre répondra.
                  Fallback 2 IAs si personne ne rejoint.
                </p>
                {gameMode === 'multiplayer' && <span className="text-xl mt-2 block retro-text-cyan">Sélectionné</span>}
              </button>
            </div>
          </RetroContainer>

          {/* Persona selection */}
          <RetroContainer title="CHOISISSEZ LES PERSONAS" className="mb-6">
            {gameMode === 'multiplayer' && (
              <p className="retro-text-amber text-sm mb-4">
                Les personas sont utilisés si vous devenez enquêteur. Si vous devenez enquêté, vous répondrez avec votre propre personnalité.
              </p>
            )}

            <p className="text-lg mb-4">
              <span className="retro-text-amber">Persona A</span> (chat vert) :
              {personaA && <span className="ml-2 glow-text">{personaA.name}</span>}
            </p>

            {availablePersonas.length === 0 ? (
              <div className="text-center py-8">
                <p className="retro-text-amber text-xl mb-4">Aucun persona disponible !</p>
                <Link to="/personas" className="retro-btn retro-btn-magenta">Créer un persona</Link>
              </div>
            ) : (
              <>
                {playablePersonas.length === 0 && personas.length > 0 && (
                  <p className="retro-text-amber text-xs mb-3 opacity-70">
                    Aucun personnage d'une autre classe disponible — affichage de tous les personnages.
                  </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {availablePersonas.map(persona => (
                    <div
                      key={persona.id}
                      onClick={() => {
                        setPersonaA(persona);
                        if (personaB?.id === persona.id) setPersonaB(null);
                      }}
                      className={`retro-card cursor-pointer transition-all p-3 ${
                        personaA?.id === persona.id
                          ? 'border-[#00ff41] bg-[rgba(0,255,65,0.15)]'
                          : 'hover:border-[#00ff41]'
                      }`}
                    >
                      <p className="text-lg">{persona.name}, {persona.age} ans</p>
                      <p className="retro-text-amber text-xs mt-1 truncate">{persona.description}</p>
                      {persona.isDefault && <span className="text-xs retro-text-cyan">[par défaut]</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="text-lg mb-4">
              <span className="retro-text-cyan">Persona B</span> (chat cyan) :
              {personaB ? (
                <span className="ml-2 retro-text-cyan glow-text">{personaB.name}</span>
              ) : (
                <span className="ml-2 text-sm opacity-70">(aléatoire si non choisi)</span>
              )}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availablePersonas.filter(p => p.id !== personaA?.id).map(persona => (
                <div
                  key={persona.id}
                  onClick={() => setPersonaB(persona)}
                  className={`retro-card cursor-pointer transition-all p-3 ${
                    personaB?.id === persona.id
                      ? 'border-[#00ffff] bg-[rgba(0,255,255,0.15)]'
                      : 'hover:border-[#00ffff]'
                  }`}
                >
                  <p className="text-lg">{persona.name}, {persona.age} ans</p>
                  <p className="retro-text-amber text-xs mt-1 truncate">{persona.description}</p>
                  {persona.isDefault && <span className="text-xs retro-text-cyan">[par défaut]</span>}
                </div>
              ))}
            </div>
          </RetroContainer>

          {/* Multiplayer options */}
          {gameMode === 'multiplayer' && (
            <RetroContainer title="REJOINDRE OU CRÉER UNE SALLE" className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => setWaitingMode('generic')}
                  className={`p-4 border-2 transition-all text-left ${
                    waitingMode === 'generic'
                      ? 'border-[#00ff41] bg-[rgba(0,255,65,0.1)]'
                      : 'border-gray-600 hover:border-[#00ff41]'
                  }`}
                >
                  <p className="text-xl mb-1">FILE GÉNÉRIQUE</p>
                  <p className="retro-text-amber text-sm">
                    File d'attente publique. Le premier joueur disponible sera jumelé avec vous.
                  </p>
                  {waitingMode === 'generic' && <span className="text-lg mt-1 block">Sélectionné</span>}
                </button>

                <button
                  onClick={() => setWaitingMode('private')}
                  className={`p-4 border-2 transition-all text-left ${
                    waitingMode === 'private'
                      ? 'border-[#00ffff] bg-[rgba(0,255,255,0.1)]'
                      : 'border-gray-600 hover:border-[#00ffff]'
                  }`}
                >
                  <p className="text-xl retro-text-cyan mb-1">SALLE PRIVÉE</p>
                  <p className="retro-text-amber text-sm">
                    Créer une salle avec un code ou rejoindre une salle existante.
                  </p>
                  {waitingMode === 'private' && <span className="text-lg mt-1 block retro-text-cyan">Sélectionné</span>}
                </button>
              </div>

              {waitingMode === 'private' && (
                <div className="mt-4">
                  <p className="mb-2 retro-text-amber">Entrez un code pour rejoindre une salle existante :</p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="retro-input flex-1"
                      placeholder="Code de la salle (ex: AB12CD)"
                      maxLength={6}
                    />
                    <button
                      onClick={joinRoom}
                      disabled={joinCode.length !== 6}
                      className="retro-btn retro-btn-cyan"
                    >
                      Rejoindre
                    </button>
                  </div>
                  <p className="text-sm retro-text-cyan mt-2">
                    Ou cliquez ci-dessous pour créer une nouvelle salle.
                  </p>
                </div>
              )}
            </RetroContainer>
          )}

          {/* Start button */}
          {personaA && (
            <button
              onClick={gameMode === 'solo' ? startSoloGame : () => startWaitingRoom(waitingMode)}
              className="retro-btn w-full"
            >
              {gameMode === 'solo'
                ? '> LANCER LA PARTIE (2 IAs)'
                : waitingMode === 'generic'
                  ? '> REJOINDRE LA FILE D\'ATTENTE'
                  : '> CRÉER UNE SALLE PRIVÉE'
              }
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==================== RENDER: WAITING ROOM ====================

  if (phase === 'waiting') {
    const isPrivate = waitingMode === 'private';
    const progressPct = (waitingElapsed / 60) * 100;

    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="scanline"></div>
        <RetroContainer
          title={isPrivate ? "SALLE PRIVÉE" : "FILE D'ATTENTE PUBLIQUE"}
          className="max-w-lg w-full"
        >
          <div className="text-center py-6">
            {isPrivate ? (
              <>
                <p className="text-lg mb-4">
                  Partagez ce code avec un autre élève :
                </p>
                <div className="retro-card p-8 mb-6">
                  <p className="text-5xl tracking-widest glow-text" style={{ fontFamily: "'Press Start 2P', cursive" }}>
                    {roomCode}
                  </p>
                </div>
                <p className="text-sm retro-text-amber mb-4">
                  L'autre joueur doit entrer ce code dans "Rejoindre une salle".
                </p>
              </>
            ) : (
              <>
                <p className="text-lg mb-4">
                  Vous êtes dans la <span className="glow-text">file d'attente publique</span>.
                </p>
                <p className="retro-text-amber mb-6">
                  Dès qu'un autre élève rejoint, la partie démarrera automatiquement.
                </p>
              </>
            )}

            <div className="typing-indicator justify-center mb-4">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>

            <p className="retro-text-amber text-xl mb-2">
              En attente d'un joueur...
            </p>

            {/* Progress bar */}
            <div className="w-full h-3 border border-[#00ff41] mb-2 mt-4">
              <div
                className="h-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  background: waitingCountdown < 15 ? 'var(--retro-magenta)' : 'var(--retro-green)',
                }}
              />
            </div>

            <p className="text-sm mb-4">
              Fallback <span className="retro-text-cyan">2 IAs</span> dans{' '}
              <span className={waitingCountdown < 15 ? 'retro-text-magenta' : 'glow-text'}>
                {waitingCountdown}s
              </span>
            </p>

            <div className="flex gap-4 justify-center mt-6 flex-wrap">
              <button onClick={() => { multiplayer.disconnect(); startSoloGame(); }} className="retro-btn">
                Commencer maintenant (2 IAs)
              </button>
              <button
                onClick={() => {
                  if (waitingIntervalRef.current) clearInterval(waitingIntervalRef.current);
                  multiplayer.disconnect();
                  playAgain();
                }}
                className="retro-btn retro-btn-amber"
              >
                Annuler
              </button>
            </div>
          </div>
        </RetroContainer>
      </div>
    );
  }

  // ==================== RENDER: PLAYING (ENQUÊTÉ) ====================

  if (phase === 'playing' && role === 'enquete') {
    const isGameOver = multiplayer.gameEnded || isExpired;

    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="scanline"></div>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-4">
            <div className={`retro-timer ${timeLeft < 60 ? 'warning' : ''}`}>
              {formatTime()}
            </div>
            <p className="retro-text-cyan text-xl mt-2">
              Vous êtes l'ENQUÊTÉ(E)
            </p>
            <p className="text-sm retro-text-amber mt-1">
              Un enquêteur vous pose des questions. Répondez naturellement pour le convaincre que vous êtes humain !
            </p>
          </div>

          <RetroContainer title="CONVERSATION AVEC L'ENQUÊTEUR">
            <div ref={enqueteChatRef} className="chat-container mb-4">
              {enqueteMessages.map(msg => {
                const isMine = msg.senderId === (currentUser?.id || 'enquete');
                const isSystem = msg.senderId === 'system';
                return (
                  <div
                    key={msg.id}
                    className={`chat-message ${
                      isSystem
                        ? 'text-center retro-text-amber opacity-80'
                        : isMine
                          ? 'chat-message-sent'
                          : 'chat-message-received'
                    }`}
                  >
                    {!isSystem && !isMine && (
                      <span className="text-xs retro-text-amber block mb-1">Enquêteur</span>
                    )}
                    <p className="text-lg">{msg.content}</p>
                  </div>
                );
              })}
              {multiplayer.partnerTyping && (
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              )}
            </div>

            {isGameOver ? (
              <div className="text-center py-4 retro-text-amber">
                La conversation est terminée.
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={enqueteInput}
                  onChange={(e) => {
                    setEnqueteInput(e.target.value);
                    multiplayer.sendTyping();
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && sendEnqueteMessage()}
                  className="retro-input flex-1"
                  placeholder="Tapez votre réponse..."
                />
                <button
                  onClick={sendEnqueteMessage}
                  className="retro-btn"
                  disabled={!enqueteInput.trim()}
                >
                  Envoyer
                </button>
              </div>
            )}
          </RetroContainer>
        </div>
      </div>
    );
  }

  // ==================== RENDER: PLAYING (ENQUÊTEUR / SOLO) ====================

  if (phase === 'playing') {
    const isSolo = session?.aiIsInChat === 'both';
    const modeLabel = isSolo
      ? 'Mode Solo - Les deux sont des IAs'
      : 'Mode Multi - Un humain, une IA';

    return (
      <div className="min-h-screen p-4">
        <div className="scanline"></div>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <div className={`retro-timer ${timeLeft < 60 ? 'warning' : ''}`}>
              {formatTime()}
            </div>
            <p className="retro-text-amber text-lg">{modeLabel}</p>
            {role === 'enqueteur' && (
              <p className="text-sm retro-text-cyan mt-1">
                Vous êtes l'ENQUÊTEUR. Un interlocuteur est humain, l'autre est une IA. Trouvez lequel !
              </p>
            )}
            {!role && (
              <p className="text-sm retro-text-cyan mt-1">
                Trouvez laquelle des deux IAs est la plus convaincante — ou repérez l'humain !
              </p>
            )}
          </div>

          {/* Two chats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chat A */}
            <RetroContainer title={`INTERLOCUTEUR A — ${personaA?.name || '?'}`}>
              <div ref={chatARef} className="chat-container mb-4">
                {messagesA.map(msg => (
                  <div
                    key={msg.id}
                    className={`chat-message ${
                      msg.senderId === currentUser?.id ? 'chat-message-sent' : 'chat-message-received'
                    }`}
                  >
                    <p className="text-lg">{msg.content}</p>
                  </div>
                ))}
                {typingA && (
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputA}
                  onChange={(e) => setInputA(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessageA()}
                  className="retro-input flex-1"
                  placeholder="Posez votre question..."
                  disabled={isExpired}
                />
                <button
                  onClick={sendMessageA}
                  className="retro-btn"
                  disabled={!inputA.trim() || isExpired}
                >
                  Envoyer
                </button>
              </div>
            </RetroContainer>

            {/* Chat B */}
            <RetroContainer title={`INTERLOCUTEUR B — ${personaB?.name || '?'}`} className="retro-border-cyan">
              <div ref={chatBRef} className="chat-container mb-4" style={{ borderColor: 'var(--retro-cyan)' }}>
                {messagesB.map(msg => (
                  <div
                    key={msg.id}
                    className={`chat-message ${
                      msg.senderId === currentUser?.id ? 'chat-message-sent' : 'chat-message-received'
                    }`}
                    style={msg.senderId !== currentUser?.id ? { borderColor: 'var(--retro-cyan)', color: 'var(--retro-cyan)' } : {}}
                  >
                    <p className="text-lg">{msg.content}</p>
                  </div>
                ))}
                {typingB && (
                  <div className="typing-indicator">
                    <div className="typing-dot" style={{ background: 'var(--retro-cyan)' }}></div>
                    <div className="typing-dot" style={{ background: 'var(--retro-cyan)' }}></div>
                    <div className="typing-dot" style={{ background: 'var(--retro-cyan)' }}></div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputB}
                  onChange={(e) => setInputB(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessageB()}
                  className="retro-input flex-1"
                  style={{ borderColor: 'var(--retro-cyan)', color: 'var(--retro-cyan)' }}
                  placeholder="Posez votre question..."
                  disabled={isExpired}
                />
                <button
                  onClick={sendMessageB}
                  className="retro-btn retro-btn-cyan"
                  disabled={!inputB.trim() || isExpired}
                >
                  Envoyer
                </button>
              </div>
            </RetroContainer>
          </div>

          <div className="text-center mt-6">
            <button onClick={() => setPhase('voting')} className="retro-btn retro-btn-amber">
              J'AI ASSEZ D'INDICES — VOTER
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: VOTING ====================

  if (phase === 'voting') {
    const isSolo = session?.aiIsInChat === 'both';

    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="scanline"></div>
        <RetroContainer title="VOTE — QUI EST L'IA ?" className="max-w-2xl w-full">
          <p className="text-xl text-center mb-4">
            {isSolo ? (
              <>Laquelle des deux IAs vous a semblé la <span className="retro-text-magenta">moins humaine</span> ?</>
            ) : (
              <>Quel interlocuteur est l'<span className="retro-text-magenta">IA</span> ?</>
            )}
          </p>

          {isSolo && (
            <p className="text-center text-sm retro-text-amber mb-6">
              (Les deux interlocuteurs étaient des IAs avec des personas différents)
            </p>
          )}

          <div className="grid grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setVote('A')}
              className={`p-8 border-2 transition-all ${
                vote === 'A'
                  ? 'border-[#00ff41] bg-[rgba(0,255,65,0.2)]'
                  : 'border-gray-600 hover:border-[#00ff41]'
              }`}
            >
              <span className="text-3xl block mb-2">A</span>
              <span className="text-xl">INTERLOCUTEUR A</span>
              <span className="block text-sm retro-text-amber mt-1">{personaA?.name}</span>
              {vote === 'A' && <span className="block mt-2 text-3xl">*</span>}
            </button>

            <button
              onClick={() => setVote('B')}
              className={`p-8 border-2 transition-all ${
                vote === 'B'
                  ? 'border-[#00ffff] bg-[rgba(0,255,255,0.2)]'
                  : 'border-gray-600 hover:border-[#00ffff]'
              }`}
            >
              <span className="text-3xl block mb-2">B</span>
              <span className="text-xl retro-text-cyan">INTERLOCUTEUR B</span>
              <span className="block text-sm retro-text-amber mt-1">{personaB?.name}</span>
              {vote === 'B' && <span className="block mt-2 text-3xl retro-text-cyan">*</span>}
            </button>
          </div>

          <div className="mb-6">
            <label className="block mb-2 text-lg">
              {'>'} Justifiez votre choix (bonus +1 point si argumenté) :
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="retro-textarea"
              placeholder="Expliquez les indices qui vous ont permis de repérer l'IA..."
              rows={4}
            />
            <p className="text-sm retro-text-amber mt-1">
              {justification.length}/50 caractères minimum pour le bonus
            </p>
          </div>

          <button onClick={submitVote} disabled={!vote} className="retro-btn w-full">
            VALIDER MON VOTE
          </button>
        </RetroContainer>
      </div>
    );
  }

  // ==================== RENDER: RESULT (ENQUÊTÉ) ====================

  if (phase === 'result' && role === 'enquete') {
    const myMessageCount = enqueteMessages.filter(
      m => m.senderId === (currentUser?.id || 'enquete')
    ).length;

    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="scanline"></div>
        <RetroContainer title="PARTIE TERMINÉE" className="max-w-2xl w-full">
          <div className="text-center py-8">
            <div className="text-6xl mb-6">
              {isExpired ? '---' : ''}
            </div>
            <p className="text-2xl retro-text-cyan mb-4">
              {multiplayer.gameEnded
                ? "L'enquêteur a fait son choix !"
                : "Temps écoulé !"
              }
            </p>
            <p className="text-lg retro-text-amber mb-2">
              Vous étiez l'enquêté(e).
            </p>
            <p className="text-lg mb-6">
              Vous avez échangé <span className="glow-text">{myMessageCount}</span> messages avec l'enquêteur.
            </p>
            <p className="retro-text-amber text-sm mb-8">
              L'enquêteur devait deviner si vous étiez humain ou IA.
              Avez-vous été convaincant(e) ?
            </p>

            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={playAgain} className="retro-btn">REJOUER</button>
              <Link to="/" className="retro-btn retro-btn-cyan">MENU</Link>
            </div>
          </div>
        </RetroContainer>
      </div>
    );
  }

  // ==================== RENDER: RESULT (ENQUÊTEUR / SOLO) ====================

  if (phase === 'result' && result) {
    const isSolo = session?.aiIsInChat === 'both';

    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="scanline"></div>
        <RetroContainer
          title={result.correct ? "BONNE DÉTECTION !" : "MAUVAISE DÉTECTION"}
          className="max-w-2xl w-full"
        >
          <div className="text-center py-8">
            {isSolo ? (
              <>
                <p className="text-2xl retro-text-amber mb-4">
                  Les deux étaient des IAs !
                </p>
                <p className="text-lg mb-2">
                  Interlocuteur A jouait <span className="glow-text">{personaA?.name}</span>
                </p>
                <p className="text-lg mb-6">
                  Interlocuteur B jouait <span className="retro-text-cyan glow-text">{personaB?.name}</span>
                </p>
              </>
            ) : result.correct ? (
              <>
                <p className="text-3xl glow-text mb-4">Félicitations !</p>
                <p className="text-xl retro-text-amber mb-6">
                  Vous avez correctement identifié l'IA (interlocuteur {session?.aiIsInChat}).
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl retro-text-magenta mb-4">L'IA vous a dupé !</p>
                <p className="text-xl retro-text-amber mb-6">
                  L'IA était l'interlocuteur <span className="glow-text">{session?.aiIsInChat}</span>, pas {vote}.
                </p>
              </>
            )}

            <div className="retro-card mb-8">
              <p className="text-4xl font-bold retro-text-amber glow-text">
                +{result.points} POINTS
              </p>
              <div className="mt-4 text-lg">
                {result.points >= 2 && <p>Détection correcte : +2 pts</p>}
                {result.points === 3 && <p>Justification argumentée : +1 pt bonus</p>}
                {!result.correct && <p className="retro-text-magenta">Aucun point cette fois</p>}
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={playAgain} className="retro-btn">REJOUER</button>
              <Link to="/scores" className="retro-btn retro-btn-amber">CLASSEMENTS</Link>
              <Link to="/" className="retro-btn retro-btn-cyan">MENU</Link>
            </div>
          </div>
        </RetroContainer>
      </div>
    );
  }

  return null;
}
