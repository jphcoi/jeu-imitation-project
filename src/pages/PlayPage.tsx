import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';
import { useTimer } from '../hooks/useTimer';
import { generateAIResponse, createAIMessage } from '../utils/aiResponder';
import type { Message, ChatSession, Persona } from '../types';
import { v4 as uuidv4 } from 'uuid';

type GamePhase = 'select' | 'playing' | 'voting' | 'result';

export function PlayPage() {
  const { state, dispatch } = useGame();
  const { currentUser, personas } = state;

  const [phase, setPhase] = useState<GamePhase>('select');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
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

  const chatARef = useRef<HTMLDivElement>(null);
  const chatBRef = useRef<HTMLDivElement>(null);

  const { timeLeft, isExpired, start, formatTime } = useTimer(300); // 5 minutes

  // Scroll automatique
  useEffect(() => {
    if (chatARef.current) {
      chatARef.current.scrollTop = chatARef.current.scrollHeight;
    }
  }, [messagesA]);

  useEffect(() => {
    if (chatBRef.current) {
      chatBRef.current.scrollTop = chatBRef.current.scrollHeight;
    }
  }, [messagesB]);

  // Fin du timer
  useEffect(() => {
    if (isExpired && phase === 'playing') {
      setPhase('voting');
    }
  }, [isExpired, phase]);

  const startGame = () => {
    if (!selectedPersona) return;

    const aiChat = Math.random() > 0.5 ? 'A' : 'B';

    const newSession: ChatSession = {
      id: uuidv4(),
      enqueteurId: currentUser?.id || '',
      personaId: selectedPersona.id,
      messages: { chatA: [], chatB: [] },
      startTime: new Date(),
      duration: 300,
      status: 'active',
      aiIsInChat: aiChat as 'A' | 'B',
    };

    setSession(newSession);
    dispatch({ type: 'ADD_SESSION', payload: newSession });
    setPhase('playing');
    start();

    // Message d'accueil
    const welcomeA: Message = {
      id: uuidv4(),
      content: aiChat === 'A' ? "Salut ! Prêt à discuter ?" : "Hey ! On commence ?",
      senderId: aiChat === 'A' ? 'ai' : 'human-sim',
      timestamp: new Date(),
      isFromAI: aiChat === 'A',
    };

    const welcomeB: Message = {
      id: uuidv4(),
      content: aiChat === 'B' ? "Salut ! Prêt à discuter ?" : "Coucou ! C'est parti ?",
      senderId: aiChat === 'B' ? 'ai' : 'human-sim',
      timestamp: new Date(),
      isFromAI: aiChat === 'B',
    };

    setTimeout(() => setMessagesA([welcomeA]), 500);
    setTimeout(() => setMessagesB([welcomeB]), 800);
  };

  const sendMessageA = async () => {
    if (!inputA.trim() || !session || !selectedPersona) return;

    const userMessage: Message = {
      id: uuidv4(),
      content: inputA.trim(),
      senderId: currentUser?.id || '',
      timestamp: new Date(),
      isFromAI: false,
    };

    setMessagesA(prev => [...prev, userMessage]);
    setInputA('');
    setTypingA(true);

    // Réponse (IA ou simulation humaine)
    if (session.aiIsInChat === 'A') {
      const response = await generateAIResponse(selectedPersona, messagesA, inputA);
      setTypingA(false);
      setMessagesA(prev => [...prev, createAIMessage(response)]);
    } else {
      // Simulation d'un humain (plus variable dans le temps)
      const delay = 1000 + Math.random() * 4000;
      setTimeout(() => {
        setTypingA(false);
        const responses = [
          "Ouais je vois ce que tu veux dire",
          "Intéressant comme question !",
          "Hmm laisse-moi réfléchir...",
          "Ahah bonne question",
          "C'est marrant que tu demandes ça",
        ];
        const humanResponse: Message = {
          id: uuidv4(),
          content: responses[Math.floor(Math.random() * responses.length)],
          senderId: 'human-sim',
          timestamp: new Date(),
          isFromAI: false,
        };
        setMessagesA(prev => [...prev, humanResponse]);
      }, delay);
    }
  };

  const sendMessageB = async () => {
    if (!inputB.trim() || !session || !selectedPersona) return;

    const userMessage: Message = {
      id: uuidv4(),
      content: inputB.trim(),
      senderId: currentUser?.id || '',
      timestamp: new Date(),
      isFromAI: false,
    };

    setMessagesB(prev => [...prev, userMessage]);
    setInputB('');
    setTypingB(true);

    if (session.aiIsInChat === 'B') {
      const response = await generateAIResponse(selectedPersona, messagesB, inputB);
      setTypingB(false);
      setMessagesB(prev => [...prev, createAIMessage(response)]);
    } else {
      const delay = 1000 + Math.random() * 4000;
      setTimeout(() => {
        setTypingB(false);
        const responses = [
          "Ah oui carrément",
          "Mmh je sais pas trop",
          "Tu penses ?",
          "C'est une bonne remarque",
          "Franchement...",
        ];
        const humanResponse: Message = {
          id: uuidv4(),
          content: responses[Math.floor(Math.random() * responses.length)],
          senderId: 'human-sim',
          timestamp: new Date(),
          isFromAI: false,
        };
        setMessagesB(prev => [...prev, humanResponse]);
      }, delay);
    }
  };

  const submitVote = () => {
    if (!vote || !session) return;

    const isCorrect = vote === session.aiIsInChat;
    let points = 0;

    if (isCorrect) {
      points = 2;
      if (justification.trim().length > 50) {
        points += 1;
      }
    }

    setResult({ correct: isCorrect, points });

    // Enregistrer le vote
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

    // Mettre à jour la session
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
    setSelectedPersona(null);
    setSession(null);
    setMessagesA([]);
    setMessagesB([]);
    setVote(null);
    setJustification('');
    setResult(null);
  };

  // Phase de sélection
  if (phase === 'select') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="scanline"></div>
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="retro-text-cyan hover:glow-text text-lg">
            {'<'} Retour au menu
          </Link>

          <RetroContainer title="🔍 SÉLECTION DU PERSONNA" className="mt-4">
            <p className="text-xl mb-6">
              Choisissez le personna que l'IA incarnera pendant la session :
            </p>

            {personas.length === 0 ? (
              <div className="text-center py-8">
                <p className="retro-text-amber text-xl mb-4">
                  Aucun personna disponible !
                </p>
                <Link to="/personas" className="retro-btn retro-btn-magenta">
                  Créer un personna
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {personas.map(persona => (
                  <div
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona)}
                    className={`retro-card cursor-pointer transition-all ${
                      selectedPersona?.id === persona.id
                        ? 'border-[#00ff41] bg-[rgba(0,255,65,0.1)]'
                        : 'hover:border-[#00ff41]'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl">
                          {persona.name}, {persona.age} ans
                        </h3>
                        <p className="retro-text-amber text-sm mt-1">
                          {persona.description}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {persona.traits.slice(0, 3).map(t => (
                            <span key={t} className="retro-badge text-xs">{t}</span>
                          ))}
                        </div>
                      </div>
                      {selectedPersona?.id === persona.id && (
                        <span className="text-3xl">✓</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedPersona && (
              <button
                onClick={startGame}
                className="retro-btn w-full mt-6"
              >
                ▶ COMMENCER LA SESSION
              </button>
            )}
          </RetroContainer>
        </div>
      </div>
    );
  }

  // Phase de jeu
  if (phase === 'playing') {
    return (
      <div className="min-h-screen p-4">
        <div className="scanline"></div>
        <div className="max-w-7xl mx-auto">
          {/* Timer */}
          <div className="text-center mb-4">
            <div className={`retro-timer ${timeLeft < 60 ? 'warning' : ''}`}>
              ⏱ {formatTime()}
            </div>
            <p className="retro-text-amber text-lg">
              Interrogez les deux interlocuteurs - Un seul est humain !
            </p>
          </div>

          {/* Deux chats côte à côte */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chat A */}
            <RetroContainer title="💬 INTERLOCUTEUR A">
              <div ref={chatARef} className="chat-container mb-4">
                {messagesA.map(msg => (
                  <div
                    key={msg.id}
                    className={`chat-message ${
                      msg.senderId === currentUser?.id
                        ? 'chat-message-sent'
                        : 'chat-message-received'
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
            <RetroContainer title="💬 INTERLOCUTEUR B" className="retro-border-cyan">
              <div ref={chatBRef} className="chat-container mb-4" style={{ borderColor: 'var(--retro-cyan)' }}>
                {messagesB.map(msg => (
                  <div
                    key={msg.id}
                    className={`chat-message ${
                      msg.senderId === currentUser?.id
                        ? 'chat-message-sent'
                        : 'chat-message-received'
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

          {/* Bouton pour terminer plus tôt */}
          <div className="text-center mt-6">
            <button
              onClick={() => setPhase('voting')}
              className="retro-btn retro-btn-amber"
            >
              ✓ J'AI ASSEZ D'INDICES - VOTER
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Phase de vote
  if (phase === 'voting') {
    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="scanline"></div>
        <RetroContainer title="🗳️ VOTE - QUI EST L'IA ?" className="max-w-2xl w-full">
          <p className="text-xl text-center mb-8">
            Sélectionnez l'interlocuteur que vous pensez être l'<span className="retro-text-magenta">Intelligence Artificielle</span> :
          </p>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setVote('A')}
              className={`p-8 border-2 transition-all ${
                vote === 'A'
                  ? 'border-[#00ff41] bg-[rgba(0,255,65,0.2)]'
                  : 'border-gray-600 hover:border-[#00ff41]'
              }`}
            >
              <span className="text-4xl block mb-4">💬</span>
              <span className="text-2xl">INTERLOCUTEUR A</span>
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
              <span className="text-4xl block mb-4">💬</span>
              <span className="text-2xl retro-text-cyan">INTERLOCUTEUR B</span>
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
              placeholder="Expliquez les indices qui vous ont permis de détecter l'IA..."
              rows={4}
            />
            <p className="text-sm retro-text-amber mt-1">
              {justification.length}/50 caractères minimum pour le bonus
            </p>
          </div>

          <button
            onClick={submitVote}
            disabled={!vote}
            className="retro-btn w-full"
          >
            VALIDER MON VOTE
          </button>
        </RetroContainer>
      </div>
    );
  }

  // Phase de résultat
  if (phase === 'result' && result) {
    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="scanline"></div>
        <RetroContainer
          title={result.correct ? "✓ BONNE DÉTECTION !" : "✗ MAUVAISE DÉTECTION"}
          className="max-w-2xl w-full"
        >
          <div className="text-center py-8">
            {result.correct ? (
              <>
                <div className="text-6xl mb-6">🎉</div>
                <p className="text-3xl glow-text mb-4">
                  Félicitations !
                </p>
                <p className="text-xl retro-text-amber mb-6">
                  Vous avez correctement identifié l'IA.
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-6">🤖</div>
                <p className="text-3xl retro-text-magenta mb-4">
                  L'IA vous a dupé !
                </p>
                <p className="text-xl retro-text-amber mb-6">
                  L'IA était dans le chat <span className="glow-text">{session?.aiIsInChat}</span>, pas dans le chat {vote}.
                </p>
              </>
            )}

            <div className="retro-card mb-8">
              <p className="text-4xl font-bold retro-text-amber glow-text">
                +{result.points} POINTS
              </p>
              <div className="mt-4 text-lg">
                {result.correct && <p>✓ Détection correcte : +2 pts</p>}
                {result.points === 3 && <p>✓ Justification argumentée : +1 pt bonus</p>}
                {!result.correct && <p className="retro-text-magenta">Aucun point cette fois</p>}
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={playAgain} className="retro-btn">
                ▶ REJOUER
              </button>
              <Link to="/scores" className="retro-btn retro-btn-amber">
                📊 CLASSEMENTS
              </Link>
              <Link to="/" className="retro-btn retro-btn-cyan">
                🏠 MENU
              </Link>
            </div>
          </div>
        </RetroContainer>
      </div>
    );
  }

  return null;
}
