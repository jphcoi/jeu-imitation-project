import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useMultiplayer } from '../hooks/useMultiplayer';

const BG = '#faf7f2';
const CARD = '#ffffff';
const BORDER = 'rgba(0,0,0,0.08)';
const PANEL = '#f5f0e8';
const MUTED = '#78716c';
const TEXT = '#1c1917';

export function LobbyPage() {
  const { state } = useGame();
  const { currentUser } = state;
  const navigate = useNavigate();
  const multiplayer = useMultiplayer(currentUser?.id || '');

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    timerRef.current = window.setInterval(() => setElapsed(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (joinedRef.current || !currentUser) return;
    joinedRef.current = true;
    multiplayer.joinGenericQueue(currentUser.schoolId, currentUser.classId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

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
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="w-full max-w-sm">
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="flex justify-center gap-2 mb-8">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>

          <h1 className="text-lg font-bold mb-1" style={{ color: TEXT }}>Recherche d'un partenaire</h1>
          <p className="text-sm mb-1" style={{ color: MUTED }}>{currentUser?.pseudo}</p>
          {(currentUser?.schoolId || currentUser?.classId) && (
            <p className="text-xs mb-6" style={{ color: MUTED }}>
              {[currentUser?.schoolId, currentUser?.classId].filter(Boolean).join(' · ')}
            </p>
          )}

          <div
            className="inline-block px-8 py-4 rounded-xl mb-6"
            style={{ background: PANEL, border: `1px solid ${BORDER}` }}
          >
            <p className="text-3xl font-bold tabular-nums tracking-widest" style={{ color: '#6366f1' }}>
              {timeStr}
            </p>
          </div>

          <p className="text-xs mb-8" style={{ color: MUTED }}>
            La partie démarrera automatiquement dès qu'un élève d'un autre établissement sera disponible.
          </p>

          <button
            onClick={handleCancel}
            className="px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: PANEL, border: `1px solid ${BORDER}`, color: MUTED }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
