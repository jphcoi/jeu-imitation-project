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

type Role = 'student' | 'teacher' | 'admin';
type Mode = 'login' | 'register';

export function LoginPage() {
  const [classCode, setClassCode] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [mode, setMode] = useState<Mode>('login');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { login, register } = useGame();
  const navigate = useNavigate();

  const TEACHER_CODE = import.meta.env.VITE_TEACHER_CODE as string | undefined;
  const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE as string | undefined;

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setMode('login');
    setError(null);
    setPseudo('');
    setPassword('');
    setAccessCode('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role === 'teacher') {
      if (!accessCode.trim()) { setError("Entrez le code d'accès."); return; }
      if (TEACHER_CODE && accessCode.trim() !== TEACHER_CODE) { setError('Code incorrect. Contactez l\'administrateur.'); return; }
      login('Enseignant', 'teacher', undefined, classCode.trim() || undefined);
      navigate('/dashboard');
      return;
    }

    if (role === 'admin') {
      if (!accessCode.trim()) { setError("Entrez le code d'accès."); return; }
      if (ADMIN_CODE && accessCode.trim() !== ADMIN_CODE) { setError('Code incorrect.'); return; }
      login('Administrateur', 'admin', undefined, classCode.trim() || undefined);
      navigate('/dashboard');
      return;
    }

    if (!pseudo.trim()) { setError('Entrez un pseudo.'); return; }
    if (!password.trim()) { setError('Entrez un mot de passe.'); return; }

    if (mode === 'register') {
      const result = register(pseudo.trim(), password.trim(), classCode.trim() || undefined);
      if (result === 'already_exists') {
        setError('Ce pseudo existe déjà dans cette classe. Connectez-vous.');
        return;
      }
      navigate('/');
      return;
    }

    const result = login(pseudo.trim(), 'student', password.trim(), classCode.trim() || undefined);
    if (result === 'not_found') { setError('Compte introuvable. Créez votre compte d\'abord.'); return; }
    if (result === 'wrong_password') { setError('Mot de passe incorrect.'); return; }
    navigate('/');
  };

  const roles: { value: Role; label: string }[] = [
    { value: 'student', label: 'Élève' },
    { value: 'teacher', label: 'Enseignant' },
    { value: 'admin', label: 'Administrateur' },
  ];

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

        <div className="rounded-2xl p-8" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* CLASS CODE */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: MUTED }}>
                Code de classe
              </label>
              <input
                type="text"
                value={classCode}
                onChange={e => setClassCode(e.target.value.toUpperCase())}
                className="retro-input"
                placeholder="Ex: TERMINALE-S1"
                autoFocus
              />
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: MUTED }}>
                Je suis…
              </label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => handleRoleChange(r.value)}
                    className="rounded-xl py-3 px-2 text-center transition-all"
                    style={{
                      background: role === r.value ? `${ACCENT}10` : '#faf7f2',
                      border: `2px solid ${role === r.value ? ACCENT : BORDER}`,
                    }}
                  >
                    <span className="text-sm font-semibold" style={{ color: role === r.value ? ACCENT : TEXT }}>
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Student fields */}
            {role === 'student' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Pseudo</label>
                  <input
                    type="text"
                    value={pseudo}
                    onChange={e => { setPseudo(e.target.value); setError(null); }}
                    className="retro-input"
                    placeholder="Votre pseudo..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    className="retro-input"
                    placeholder={mode === 'register' ? 'Ex: 01012005' : '••••••••'}
                  />
                  {mode === 'register' && (
                    <p className="mt-1.5 text-xs" style={{ color: MUTED }}>
                      Conseil : utilisez votre date de naissance (ex&nbsp;: 01012005) pour ne pas l'oublier.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Teacher access code */}
            {role === 'teacher' && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>
                  Code d'accès enseignant
                </label>
                <input
                  type="password"
                  value={accessCode}
                  onChange={e => { setAccessCode(e.target.value); setError(null); }}
                  className="retro-input"
                  placeholder="Entrez le code..."
                />
              </div>
            )}

            {/* Admin access code */}
            {role === 'admin' && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>
                  Code d'accès administrateur
                </label>
                <input
                  type="password"
                  value={accessCode}
                  onChange={e => { setAccessCode(e.target.value); setError(null); }}
                  className="retro-input"
                  placeholder="Entrez le code..."
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs" style={{ color: '#b91c1c' }}>{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: ACCENT }}
              onMouseEnter={e => (e.currentTarget.style.background = '#4f46e5')}
              onMouseLeave={e => (e.currentTarget.style.background = ACCENT)}
            >
              {mode === 'register' ? 'Créer mon compte' : 'Connexion'}
            </button>

            {/* Register / Login toggle — students only */}
            {role === 'student' && (
              <p className="text-center text-sm" style={{ color: MUTED }}>
                {mode === 'login' ? (
                  <>
                    Vous n'avez pas encore de compte ?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('register'); setError(null); }}
                      className="font-medium underline"
                      style={{ color: ACCENT }}
                    >
                      Créer son compte
                    </button>
                  </>
                ) : (
                  <>
                    Déjà un compte ?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(null); }}
                      className="font-medium underline"
                      style={{ color: ACCENT }}
                    >
                      Se connecter
                    </button>
                  </>
                )}
              </p>
            )}

          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed" style={{ color: MUTED }}>
          "La question n'est pas si les machines peuvent penser, mais si vous pouvez les reconnaître."
        </p>
      </div>
    </div>
  );
}
