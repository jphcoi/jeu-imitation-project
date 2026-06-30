import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import type { FormEvent } from 'react';

const BG = '#f5f0e8';
const CARD = '#ffffff';
const BORDER = 'rgba(0,0,0,0.08)';
const MUTED = '#78716c';
const TEXT = '#1c1917';
const ACCENT = '#6366f1';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', token, password }),
      });
      const data = await res.json() as { result: string };
      if (data.result === 'success') {
        setDone(true);
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError('Lien invalide ou expiré. Faites une nouvelle demande.');
      }
    } catch {
      setError('Erreur réseau. Réessayez.');
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG }}>
        <p style={{ color: MUTED }}>Lien invalide. <Link to="/forgot-password" style={{ color: ACCENT }}>Nouvelle demande</Link></p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: TEXT }}>Nouveau mot de passe</h1>
          <p className="mt-2 text-sm" style={{ color: MUTED }}>Jeu de l'Imitation — Test de Turing</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {done ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">✅</div>
              <p className="text-sm font-medium" style={{ color: TEXT }}>Mot de passe mis à jour !</p>
              <p className="text-xs" style={{ color: MUTED }}>Redirection vers la connexion…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Nouveau mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  className="retro-input"
                  placeholder="8 caractères minimum"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(null); }}
                  className="retro-input"
                  placeholder="Répétez le mot de passe"
                  required
                />
              </div>
              {error && <p className="text-xs" style={{ color: '#b91c1c' }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: loading ? '#a5b4fc' : ACCENT }}
              >
                {loading ? 'Mise à jour…' : 'Mettre à jour'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
