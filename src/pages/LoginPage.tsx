import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

const BG = '#faf7f2';
const CARD = '#ffffff';
const BORDER = 'rgba(0,0,0,0.08)';
const MUTED = '#78716c';
const TEXT = '#1c1917';
const ACCENT = '#6366f1';

export function LoginPage() {
  const [pseudo, setPseudo] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const { login } = useGame();
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pseudo.trim()) {
      login(pseudo.trim(), role, classId.trim() || undefined, schoolId.trim() || undefined);
      navigate(role === 'student' ? '/lobby' : '/');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: TEXT }}>Jeu de l'Imitation</h1>
          <p className="mt-2 text-sm" style={{ color: MUTED }}>Test de Turing — Projet pédagogique</p>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Pseudonyme</label>
              <input
                type="text"
                value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                className="retro-input"
                placeholder="Votre pseudo..."
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Code établissement</label>
              <input
                type="text"
                value={schoolId}
                onChange={e => setSchoolId(e.target.value.toUpperCase())}
                className="retro-input"
                placeholder="Ex: LYCEE-PARIS-01"
              />
              <p className="mt-1.5 text-xs" style={{ color: MUTED }}>
                Donné par votre enseignant. Permet de jouer avec d'autres établissements.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Classe / Groupe</label>
              <input
                type="text"
                value={classId}
                onChange={e => setClassId(e.target.value)}
                className="retro-input"
                placeholder="Ex: 1ère-S2, TermG..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: TEXT }}>Rôle</label>
              <div className="flex gap-6">
                {(['student', 'teacher'] as const).map(r => (
                  <label key={r} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="sr-only"
                    />
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: role === r ? ACCENT : MUTED,
                        background: role === r ? ACCENT : 'transparent',
                      }}
                    >
                      {role === r && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <span className="text-sm" style={{ color: role === r ? TEXT : MUTED }}>
                      {r === 'student' ? 'Élève' : 'Enseignant'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!pseudo.trim()}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: ACCENT }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#4f46e5'; }}
              onMouseLeave={e => (e.currentTarget.style.background = ACCENT)}
            >
              Connexion
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed" style={{ color: MUTED }}>
          "La question n'est pas si les machines peuvent penser, mais si vous pouvez les reconnaître."
        </p>
      </div>
    </div>
  );
}
