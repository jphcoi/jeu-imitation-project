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
      navigate(role === 'student' ? '/' : '/dashboard');
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
              <label className="block text-sm font-medium mb-3" style={{ color: TEXT }}>Je suis…</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'student' as const, label: 'Élève', desc: 'Accès au jeu' },
                  { value: 'teacher' as const, label: 'Enseignant', desc: 'Tableau de bord' },
                ] as const).map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      background: role === r.value ? `${ACCENT}08` : '#faf7f2',
                      border: `2px solid ${role === r.value ? ACCENT : BORDER}`,
                    }}
                  >
                    <p className="text-sm font-semibold" style={{ color: role === r.value ? ACCENT : TEXT }}>{r.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: MUTED }}>{r.desc}</p>
                  </button>
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
