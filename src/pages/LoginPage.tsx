import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';

const BG = '#faf7f2';
const CARD = '#ffffff';
const BORDER = 'rgba(0,0,0,0.08)';
const MUTED = '#78716c';
const TEXT = '#1c1917';
const ACCENT = '#6366f1';

type Role = 'student' | 'teacher' | 'admin';
type Mode = 'login' | 'register';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function LoginPage() {
  const [classCode, setClassCode] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [mode, setMode] = useState<Mode>('login');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, register, loginAsGuest } = useGame();
  const navigate = useNavigate();

  const TEACHER_CODE = import.meta.env.VITE_TEACHER_CODE as string | undefined;
  const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE as string | undefined;

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setMode('login');
    setError(null);
    setSuccessMessage(null);
    setPseudo('');
    setPassword('');
    setEmail('');
    setShowPassword(false);
    setAccessCode('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (role !== 'admin' && !classCode.trim()) {
      setError('Le code de classe est obligatoire.');
      return;
    }

    if (role === 'teacher') {
      if (!accessCode.trim()) { setError("Entrez le code d'accès."); return; }
      if (TEACHER_CODE && accessCode.trim() !== TEACHER_CODE) { setError("Code incorrect. Contactez l'administrateur."); return; }
      await login('Enseignant', 'teacher', undefined, classCode.trim() || undefined);
      navigate('/dashboard');
      return;
    }

    if (role === 'admin') {
      if (!accessCode.trim()) { setError("Entrez le code d'accès."); return; }
      if (ADMIN_CODE && accessCode.trim() !== ADMIN_CODE) { setError('Code incorrect.'); return; }
      await login('Administrateur', 'admin', undefined, classCode.trim() || undefined);
      navigate('/dashboard');
      return;
    }

    if (!pseudo.trim()) { setError('Entrez un pseudo.'); return; }
    if (!password.trim()) { setError('Entrez un mot de passe.'); return; }

    if (mode === 'register') {
      if (password.trim().length < 8) {
        setError('Le mot de passe doit faire au moins 8 caractères.');
        return;
      }
      if (!email.trim()) { setError('Entrez votre adresse email.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Adresse email invalide.');
        return;
      }
      setLoading(true);
      const result = await register(pseudo.trim(), password.trim(), classCode.trim() || undefined, email.trim());
      setLoading(false);
      if (result === 'already_exists') {
        setError('Ce pseudo existe déjà dans cette classe. Connectez-vous.');
        setMode('login');
        setPassword('');
        return;
      }
      setMode('login');
      setPassword('');
      setEmail('');
      setShowPassword(false);
      setSuccessMessage('Compte créé ! Entrez maintenant votre mot de passe pour vous connecter.');
      return;
    }

    // Login
    setLoading(true);
    const result = await login(pseudo.trim(), 'student', password.trim(), classCode.trim() || undefined);
    setLoading(false);
    if (result === 'not_found') {
      setError(`Pseudo introuvable dans la classe "${classCode.trim() || '(aucune)'}". Vérifiez le code de classe et le pseudo.`);
      return;
    }
    if (result === 'wrong_password') {
      setError('Mot de passe incorrect.');
      return;
    }
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
                Code de classe{role !== 'admin' && <span style={{ color: '#dc2626' }}> *</span>}
              </label>
              <input
                type="text"
                value={classCode}
                onChange={e => { setClassCode(e.target.value.toUpperCase()); setError(null); setSuccessMessage(null); }}
                className="retro-input"
                placeholder={role === 'admin' ? 'Optionnel' : 'Ex: TERMINALE S1'}
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
                    onChange={e => { setPseudo(e.target.value); setError(null); setSuccessMessage(null); }}
                    className="retro-input"
                    placeholder="Votre pseudo..."
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Adresse email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(null); }}
                      className="retro-input"
                      placeholder="votre@email.fr"
                    />
                    <p className="mt-1.5 text-xs" style={{ color: MUTED }}>
                      Utilisée uniquement pour récupérer votre mot de passe.
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium" style={{ color: TEXT }}>Mot de passe</label>
                    {mode === 'login' && (
                      <Link to="/forgot-password" className="text-xs underline" style={{ color: ACCENT }}>
                        Mot de passe oublié ?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(null); setSuccessMessage(null); }}
                      className="retro-input pr-10"
                      placeholder={mode === 'register' ? '8 caractères minimum' : '••••••••'}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
                      style={{ color: MUTED }}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
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

            {/* Success banner */}
            {successMessage && (
              <div className="rounded-xl px-4 py-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <p className="text-xs font-medium" style={{ color: '#15803d' }}>{successMessage}</p>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="rounded-xl px-4 py-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <p className="text-xs font-medium" style={{ color: '#b91c1c' }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: loading ? '#a5b4fc' : ACCENT }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#4f46e5'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = ACCENT; }}
            >
              {loading ? 'Vérification…' : mode === 'register' ? 'Créer mon compte' : 'Connexion'}
            </button>

            {/* Register / Login toggle — students only */}
            {role === 'student' && (
              <p className="text-center text-sm" style={{ color: MUTED }}>
                {mode === 'login' ? (
                  <>
                    Pas encore de compte ?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('register'); setError(null); setSuccessMessage(null); setPassword(''); }}
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
                      onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); setPassword(''); }}
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

        <p className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { loginAsGuest(); navigate('/'); }}
            className="text-xs underline opacity-50 hover:opacity-80 transition-opacity"
            style={{ color: MUTED }}
          >
            Continuer en tant qu'invité
          </button>
        </p>

        <p className="mt-4 text-center text-xs leading-relaxed" style={{ color: MUTED }}>
          "La question n'est pas si les machines peuvent penser, mais si vous pouvez les reconnaître."
        </p>
      </div>
    </div>
  );
}
