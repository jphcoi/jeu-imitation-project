import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';

const RELAY_URL = '/api/relay';

type LobbyStatus = 'joining' | 'waiting' | 'matched' | 'error';

export function LobbyPage() {
  const { state } = useGame();
  const { currentUser } = state;
  const navigate = useNavigate();

  const [status, setStatus] = useState<LobbyStatus>('joining');
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const relay = useCallback(async (body: Record<string, unknown>) => {
    try {
      const res = await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch {
      return { error: true };
    }
  }, []);

  const handleMatch = useCallback(
    (roomCode: string, role: string, partnerId: string) => {
      if (!mountedRef.current) return;
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus('matched');
      setTimeout(() => {
        navigate('/play', { state: { fromLobby: true, roomCode, role, partnerId } });
      }, 1200);
    },
    [navigate],
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!currentUser?.sessionCode) {
      navigate('/');
      return;
    }

    const join = async () => {
      const data = await relay({
        action: 'join-session',
        userId: currentUser.id,
        sessionCode: currentUser.sessionCode,
        schoolId: currentUser.schoolId,
        classId: currentUser.classId,
      });

      if (!mountedRef.current) return;

      if (data.error) {
        setStatus('error');
        return;
      }

      if (data.status === 'playing') {
        handleMatch(data.roomCode, data.role, data.partnerId);
        return;
      }

      setStatus('waiting');

      timerRef.current = window.setInterval(() => {
        if (mountedRef.current) setElapsed(s => s + 1);
      }, 1000);

      pollRef.current = window.setInterval(async () => {
        if (!mountedRef.current) return;
        const pollData = await relay({ action: 'poll', userId: currentUser.id });
        if (pollData.error) return;
        if (pollData.status === 'matched' && pollData.roomCode) {
          handleMatch(pollData.roomCode, pollData.role, pollData.partnerId);
        }
      }, 2000);
    };

    join();

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="scanline"></div>
      <RetroContainer title="CONNEXION EN COURS" className="w-full max-w-lg">
        <div className="text-center py-8">

          {status === 'matched' ? (
            <>
              <p className="text-4xl glow-text mb-4">✓</p>
              <p className="text-2xl glow-text mb-2">Partenaire trouvé !</p>
              <p className="retro-text-amber">Lancement de la partie...</p>
            </>
          ) : status === 'error' ? (
            <>
              <p className="text-2xl retro-text-magenta mb-4">Erreur de connexion</p>
              <p className="retro-text-amber mb-6">Le serveur multijoueur est indisponible.</p>
              <button onClick={() => navigate('/')} className="retro-btn">Retour au menu</button>
            </>
          ) : (
            <>
              <p className="text-lg retro-text-cyan mb-2">
                Session : <span className="glow-text">{currentUser?.sessionCode}</span>
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

              <p className="text-xl mb-2">
                {status === 'joining'
                  ? 'Connexion au serveur...'
                  : 'Recherche d\'un partenaire d\'un autre établissement...'}
              </p>

              {status === 'waiting' && (
                <>
                  <p className="retro-text-amber text-sm mb-6">
                    En attente qu'un élève d'une autre école rejoigne la session <span className="glow-text">{currentUser?.sessionCode}</span>.
                  </p>
                  <div className="retro-card inline-block px-8 py-3 mb-6">
                    <p className="text-3xl retro-text-cyan" style={{ fontFamily: "'Press Start 2P', cursive" }}>
                      {timeStr}
                    </p>
                  </div>
                  <p className="text-xs opacity-50 mb-6">
                    L'enseignant de l'autre école doit partager le code <span className="glow-text">{currentUser?.sessionCode}</span> avec ses élèves.
                  </p>
                  <button
                    onClick={() => navigate('/')}
                    className="retro-btn retro-btn-amber"
                  >
                    Annuler
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </RetroContainer>
    </div>
  );
}
