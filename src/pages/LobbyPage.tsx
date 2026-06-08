import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';
import { useMultiplayer } from '../hooks/useMultiplayer';

export function LobbyPage() {
  const { state } = useGame();
  const { currentUser } = state;
  const navigate = useNavigate();
  const multiplayer = useMultiplayer(currentUser?.id || '');

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);
  const joinedRef = useRef(false);

  // Start timer
  useEffect(() => {
    timerRef.current = window.setInterval(() => setElapsed(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Join the cross-school queue once
  useEffect(() => {
    if (joinedRef.current || !currentUser) return;
    joinedRef.current = true;
    multiplayer.joinGenericQueue(currentUser.schoolId, currentUser.classId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // When matched, go to play
  useEffect(() => {
    if (!multiplayer.matchData) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const { roomCode, role, partnerId } = multiplayer.matchData;
    navigate('/play', { state: { fromLobby: true, roomCode, role, partnerId } });
  }, [multiplayer.matchData, navigate]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleCancel = () => {
    multiplayer.disconnect();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="scanline"></div>
      <RetroContainer title="RECHERCHE D'UN PARTENAIRE" className="w-full max-w-lg">
        <div className="text-center py-8">

          <p className="text-lg retro-text-cyan mb-1">
            Bonjour, <span className="glow-text">{currentUser?.pseudo}</span>
          </p>
          {currentUser?.schoolId && (
            <p className="text-sm retro-text-amber mb-1">
              Établissement : {currentUser.schoolId}
            </p>
          )}
          {currentUser?.classId && (
            <p className="text-sm retro-text-amber mb-6">
              Classe : {currentUser.classId}
            </p>
          )}

          <div className="typing-indicator justify-center mb-6">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>

          <p className="text-xl mb-3">
            Recherche d'un élève d'un autre établissement...
          </p>

          <div className="retro-card inline-block px-8 py-3 mb-6">
            <p className="text-3xl retro-text-cyan" style={{ fontFamily: "'Press Start 2P', cursive" }}>
              {timeStr}
            </p>
          </div>

          <p className="text-xs retro-text-amber opacity-60 mb-8">
            La partie démarrera automatiquement dès qu'un élève d'un autre établissement sera disponible.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <button onClick={handleCancel} className="retro-btn retro-btn-amber">
              Annuler
            </button>
          </div>
        </div>
      </RetroContainer>
    </div>
  );
}
