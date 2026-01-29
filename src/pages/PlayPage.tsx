import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';
import { useTimer } from '../hooks/useTimer';
import { generateAIResponse, createAIMessage } from '../utils/aiResponder';
import type { Message, ChatSession, Persona, GameMode } from '../types';
import { v4 as uuidv4 } from 'uuid';

type GamePhase = 'select' | 'waiting' | 'playing' | 'voting' | 'result';

export function PlayPage() {
  const { state, dispatch } = useGame();
  const { currentUser, personas } = state;

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

  // Waiting room
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [waitingCountdown, setWaitingCountdown] = useState(30);
  const waitingIntervalRef = useRef<number | null>(null);

  const chatARef = useRef<HTMLDivElement>(null);
  const chatBRef = useRef<HTMLDivElement>(null);

  const { timeLeft, isExpired, start, formatTime } = useTimer(300);

  // Auto-scroll chats
  useEffect(() => {
    if (chatARef.current) chatARef.current.scrollTop = chatARef.current.scrollHeight;
  }, [messagesA]);

  useEffect(() => {
    if (chatBRef.current) chatBRef.current.scrollTop = chatBRef.current.scrollHeight;
  }, [messagesB]);

  // Timer expired
  useEffect(() => {
    if (isExpired && phase === 'playing') setPhase('voting');
  }, [isExpired, phase]);

  // Auto-assign random second persona if not selected
  const getRandomPersona = useCallback((excludeId?: string) => {
    const available = personas.filter(p => p.id !== excludeId);
    return available[Math.floor(Math.random() * available.length)] || personas[0];
  }, [personas]);

  // Generate room code
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // ==================== START GAME ====================

  const startSoloGame = () => {
    if (!personaA) return;
    const pB = personaB || getRandomPersona(personaA.id);
    setPersonaB(pB);

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

    // Welcome messages from both AIs
    setTimeout(() => setMessagesA([{
      id: uuidv4(),
      content: "Salut ! Prêt à discuter ?",
      senderId: 'ai-a',
      timestamp: new Date(),
      isFromAI: true,
    }]), 500);

    setTimeout(() => setMessagesB([{
      id: uuidv4(),
      content: "Hey ! C'est parti ?",
      senderId: 'ai-b',
      timestamp: new Date(),
      isFromAI: true,
    }]), 800);
  };

  const startWaitingRoom = () => {
    if (!personaA) return;
    const pB = personaB || getRandomPersona(personaA.id);
    setPersonaB(pB);

    const code = generateRoomCode();
    setRoomCode(code);
    setPhase('waiting');
    setWaitingCountdown(30);

    // Start countdown - if no one joins, start solo game
    waitingIntervalRef.current = window.setInterval(() => {
      setWaitingCountdown(prev => {
        if (prev <= 1) {
          if (waitingIntervalRef.current) clearInterval(waitingIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // When countdown reaches 0, start solo
  useEffect(() => {
    if (waitingCountdown === 0 && phase === 'waiting') {
      startSoloGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingCountdown, phase]);

  // Cleanup waiting interval
  useEffect(() => {
    return () => {
      if (waitingIntervalRef.current) clearInterval(waitingIntervalRef.current);
    };
  }, []);

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    // In a full implementation, this would call the matchmaking API
    // For now, start a multiplayer-simulated game
    if (!personaA) {
      setPersonaA(getRandomPersona());
    }
    startMultiplayerGame();
  };

  const startMultiplayerGame = () => {
    const pA = personaA || getRandomPersona();
    const pB = personaB || getRandomPersona(pA.id);
    if (!personaA) setPersonaA(pA);
    if (!personaB) setPersonaB(pB);

    // In multiplayer, one chat is AI, one is "human"
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

    const welcomeA: Message = {
      id: uuidv4(),
      content: aiChat === 'A' ? "Salut ! Prêt à discuter ?" : "Hey ! On commence ?",
      senderId: aiChat === 'A' ? 'ai-a' : 'human-player',
      timestamp: new Date(),
      isFromAI: aiChat === 'A',
    };
    const welcomeB: Message = {
      id: uuidv4(),
      content: aiChat === 'B' ? "Salut ! Prêt à discuter ?" : "Coucou ! C'est parti ?",
      senderId: aiChat === 'B' ? 'ai-b' : 'human-player',
      timestamp: new Date(),
      isFromAI: aiChat === 'B',
    };

    setTimeout(() => setMessagesA([welcomeA]), 500);
    setTimeout(() => setMessagesB([welcomeB]), 800);
  };

  // ==================== SEND MESSAGES ====================

  const sendMessageA = async () => {
    if (!inputA.trim() || !session) return;

    const userMessage: Message = {
      id: uuidv4(),
      content: inputA.trim(),
      senderId: currentUser?.id || '',
      timestamp: new Date(),
      isFromAI: false,
    };

    setMessagesA(prev => [...prev, userMessage]);
    const question = inputA.trim();
    setInputA('');
    setTypingA(true);

    const isAI = session.aiIsInChat === 'A' || session.aiIsInChat === 'both';
    const persona = personaA;

    if (isAI && persona) {
      const response = await generateAIResponse(persona, messagesA, question);
      setTypingA(false);
      setMessagesA(prev => [...prev, createAIMessage(response)]);
    } else {
      // Simulated human response (for multiplayer placeholder)
      const delay = 1500 + Math.random() * 3500;
      setTimeout(() => {
        setTypingA(false);
        const responses = [
          "Ouais je vois ce que tu veux dire",
          "Intéressant comme question !",
          "Hmm laisse-moi réfléchir...",
          "Ahah bonne question",
          "C'est marrant que tu demandes ça",
          "En vrai je sais pas trop",
          "Pourquoi tu demandes ça ?",
        ];
        const humanResponse: Message = {
          id: uuidv4(),
          content: responses[Math.floor(Math.random() * responses.length)],
          senderId: 'human-player',
          timestamp: new Date(),
          isFromAI: false,
        };
        setMessagesA(prev => [...prev, humanResponse]);
      }, delay);
    }
  };

  const sendMessageB = async () => {
    if (!inputB.trim() || !session) return;

    const userMessage: Message = {
      id: uuidv4(),
      content: inputB.trim(),
      senderId: currentUser?.id || '',
      timestamp: new Date(),
      isFromAI: false,
    };

    setMessagesB(prev => [...prev, userMessage]);
    const question = inputB.trim();
    setInputB('');
    setTypingB(true);

    const isAI = session.aiIsInChat === 'B' || session.aiIsInChat === 'both';
    const persona = personaB;

    if (isAI && persona) {
      const response = await generateAIResponse(persona, messagesB, question);
      setTypingB(false);
      setMessagesB(prev => [...prev, createAIMessage(response)]);
    } else {
      const delay = 1500 + Math.random() * 3500;
      setTimeout(() => {
        setTypingB(false);
        const responses = [
          "Ah oui carrément",
          "Mmh je sais pas trop",
          "Tu penses ?",
          "C'est une bonne remarque",
          "Franchement...",
          "Bah écoute oui pourquoi pas",
          "Je suis pas sûr de comprendre",
        ];
        const humanResponse: Message = {
          id: uuidv4(),
          content: responses[Math.floor(Math.random() * responses.length)],
          senderId: 'human-player',
          timestamp: new Date(),
          isFromAI: false,
        };
        setMessagesB(prev => [...prev, humanResponse]);
      }, delay);
    }
  };

  // ==================== VOTE ====================

  const submitVote = () => {
    if (!vote || !session) return;

    let isCorrect = false;
    if (session.aiIsInChat === 'both') {
      // Both are AI - always correct (the point is the experience)
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
        id: uuidv4(),
        sessionId: session.id,
        enqueteurId: currentUser?.id || '',
        votedChat: vote,
        justification: justification.trim(),
        isCorrect,
        timestamp: new Date(),
      },
    });

    dispatch({
      type: 'UPDATE_SESSION',
      payload: {
        ...session,
        status: 'completed',
        endTime: new Date(),
        messages: { chatA: messagesA, chatB: messagesB },
      },
    });

    setPhase('result');
  };

  const playAgain = () => {
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
          <RetroContainer title="⚙️ MODE DE JEU" className="mt-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setGameMode('solo')}
                className={`p-6 border-2 transition-all text-left ${
                  gameMode === 'solo'
                    ? 'border-[#00ff41] bg-[rgba(0,255,65,0.1)]'
                    : 'border-gray-600 hover:border-[#00ff41]'
                }`}
              >
                <p className="text-2xl mb-2">🤖 SOLO (2 IAs)</p>
                <p className="retro-text-amber text-sm">
                  Affrontez deux IAs avec des personas différents. Disponible immédiatement.
                </p>
                {gameMode === 'solo' && <span className="text-xl mt-2 block">✓ Sélectionné</span>}
              </button>
              <button
                onClick={() => setGameMode('multiplayer')}
                className={`p-6 border-2 transition-all text-left ${
                  gameMode === 'multiplayer'
                    ? 'border-[#00ffff] bg-[rgba(0,255,255,0.1)]'
                    : 'border-gray-600 hover:border-[#00ffff]'
                }`}
              >
                <p className="text-2xl retro-text-cyan mb-2">👥 MULTI (IA + Humain)</p>
                <p className="retro-text-amber text-sm">
                  Salle d'attente pour jouer avec un autre élève. Si personne ne rejoint en 30s, la partie commence avec 2 IAs.
                </p>
                {gameMode === 'multiplayer' && <span className="text-xl mt-2 block retro-text-cyan">✓ Sélectionné</span>}
              </button>
            </div>
          </RetroContainer>

          {/* Persona selection */}
          <RetroContainer title="🎭 CHOISISSEZ LES PERSONAS" className="mb-6">
            <p className="text-lg mb-4">
              <span className="retro-text-amber">Persona A</span> (chat vert) :
              {personaA && <span className="ml-2 glow-text">{personaA.name}</span>}
            </p>

            {personas.length === 0 ? (
              <div className="text-center py-8">
                <p className="retro-text-amber text-xl mb-4">Aucun persona disponible !</p>
                <Link to="/personas" className="retro-btn retro-btn-magenta">Créer un persona</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {personas.map(persona => (
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
              {personas.filter(p => p.id !== personaA?.id).map(persona => (
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

          {/* Join room (multiplayer) */}
          {gameMode === 'multiplayer' && (
            <RetroContainer title="🔗 REJOINDRE UNE SALLE" className="mb-6">
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
            </RetroContainer>
          )}

          {/* Start button */}
          {personaA && (
            <button
              onClick={gameMode === 'solo' ? startSoloGame : startWaitingRoom}
              className="retro-btn w-full"
            >
              {gameMode === 'solo'
                ? '▶ LANCER LA PARTIE (2 IAs)'
                : '▶ CRÉER UNE SALLE D\'ATTENTE'
              }
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==================== RENDER: WAITING ROOM ====================

  if (phase === 'waiting') {
    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="scanline"></div>
        <RetroContainer title="⏳ SALLE D'ATTENTE" className="max-w-lg w-full">
          <div className="text-center py-6">
            <p className="text-lg mb-6">
              Partagez ce code avec un autre élève pour qu'il rejoigne :
            </p>

            <div className="retro-card p-8 mb-6">
              <p className="text-5xl tracking-widest glow-text" style={{ fontFamily: "'Press Start 2P', cursive" }}>
                {roomCode}
              </p>
            </div>

            <div className="typing-indicator justify-center mb-6">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>

            <p className="retro-text-amber text-xl mb-2">
              En attente d'un joueur...
            </p>

            <p className="text-lg mb-6">
              La partie démarre automatiquement avec <span className="retro-text-cyan">2 IAs</span> dans :
            </p>

            <p className={`retro-timer ${waitingCountdown < 10 ? 'warning' : ''}`}>
              {waitingCountdown}s
            </p>

            <div className="flex gap-4 justify-center mt-6">
              <button
                onClick={startSoloGame}
                className="retro-btn"
              >
                ▶ Commencer maintenant (2 IAs)
              </button>
              <button
                onClick={() => {
                  if (waitingIntervalRef.current) clearInterval(waitingIntervalRef.current);
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

  // ==================== RENDER: PLAYING ====================

  if (phase === 'playing') {
    const modeLabel = session?.aiIsInChat === 'both'
      ? '🤖 Mode Solo - Les deux sont des IAs'
      : '👥 Mode Multi - Un humain, une IA';

    return (
      <div className="min-h-screen p-4">
        <div className="scanline"></div>
        <div className="max-w-7xl mx-auto">
          {/* Timer + mode */}
          <div className="text-center mb-4">
            <div className={`retro-timer ${timeLeft < 60 ? 'warning' : ''}`}>
              ⏱ {formatTime()}
            </div>
            <p className="retro-text-amber text-lg">{modeLabel}</p>
            <p className="text-sm retro-text-cyan mt-1">
              Trouvez laquelle des deux IAs est la plus convaincante — ou repérez l'humain !
            </p>
          </div>

          {/* Two chats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chat A */}
            <RetroContainer title={`💬 INTERLOCUTEUR A — ${personaA?.name || '?'}`}>
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
                  ➤
                </button>
              </div>
            </RetroContainer>

            {/* Chat B */}
            <RetroContainer title={`💬 INTERLOCUTEUR B — ${personaB?.name || '?'}`} className="retro-border-cyan">
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
                  ➤
                </button>
              </div>
            </RetroContainer>
          </div>

          <div className="text-center mt-6">
            <button onClick={() => setPhase('voting')} className="retro-btn retro-btn-amber">
              ✓ J'AI ASSEZ D'INDICES — VOTER
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
        <RetroContainer title="🗳️ VOTE — QUI EST L'IA ?" className="max-w-2xl w-full">
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
              <span className="text-4xl block mb-2">💬</span>
              <span className="text-xl">INTERLOCUTEUR A</span>
              <span className="block text-sm retro-text-amber mt-1">{personaA?.name}</span>
              {vote === 'A' && <span className="block mt-2 text-3xl">✓</span>}
            </button>

            <button
              onClick={() => setVote('B')}
              className={`p-8 border-2 transition-all ${
                vote === 'B'
                  ? 'border-[#00ffff] bg-[rgba(0,255,255,0.2)]'
                  : 'border-gray-600 hover:border-[#00ffff]'
              }`}
            >
              <span className="text-4xl block mb-2">💬</span>
              <span className="text-xl retro-text-cyan">INTERLOCUTEUR B</span>
              <span className="block text-sm retro-text-amber mt-1">{personaB?.name}</span>
              {vote === 'B' && <span className="block mt-2 text-3xl retro-text-cyan">✓</span>}
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

  // ==================== RENDER: RESULT ====================

  if (phase === 'result' && result) {
    const isSolo = session?.aiIsInChat === 'both';

    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="scanline"></div>
        <RetroContainer
          title={result.correct ? "✓ BONNE DÉTECTION !" : "✗ MAUVAISE DÉTECTION"}
          className="max-w-2xl w-full"
        >
          <div className="text-center py-8">
            {isSolo ? (
              <>
                <div className="text-6xl mb-6">🤖🤖</div>
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
                <div className="text-6xl mb-6">🎉</div>
                <p className="text-3xl glow-text mb-4">Félicitations !</p>
                <p className="text-xl retro-text-amber mb-6">
                  Vous avez correctement identifié l'IA ({session?.aiIsInChat}).
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-6">🤖</div>
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
                {result.points >= 2 && <p>✓ Détection : +2 pts</p>}
                {result.points === 3 && <p>✓ Justification argumentée : +1 pt bonus</p>}
                {!result.correct && <p className="retro-text-magenta">Aucun point cette fois</p>}
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={playAgain} className="retro-btn">▶ REJOUER</button>
              <Link to="/scores" className="retro-btn retro-btn-amber">📊 CLASSEMENTS</Link>
              <Link to="/" className="retro-btn retro-btn-cyan">🏠 MENU</Link>
            </div>
          </div>
        </RetroContainer>
      </div>
    );
  }

  return null;
}
