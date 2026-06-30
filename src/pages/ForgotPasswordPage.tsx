import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FormEvent } from 'react';

const BG = '#f5f0e8';
const CARD = '#ffffff';
const BORDER = 'rgba(0,0,0,0.08)';
const MUTED = '#78716c';
const TEXT = '#1c1917';
const ACCENT = '#6366f1';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot-password', email: email.trim().toLowerCase() }),
      });
    } catch {
      // always show success to avoid email enumeration
    }
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: TEXT }}>Mot de passe oublié</h1>
          <p className="mt-2 text-sm" style={{ color: MUTED }}>Jeu de l'Imitation — Test de Turing</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <p className="text-sm font-medium" style={{ color: TEXT }}>
                Si un compte existe avec cette adresse, un lien de réinitialisation a été envoyé.
              </p>
              <p className="text-xs" style={{ color: MUTED }}>
                Vérifiez vos spams si vous ne voyez rien dans quelques minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm" style={{ color: MUTED }}>
                Entrez l'adresse email utilisée lors de votre inscription. Vous recevrez un lien pour créer un nouveau mot de passe.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: TEXT }}>Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="retro-input"
                  placeholder="votre@email.fr"
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: loading ? '#a5b4fc' : ACCENT }}
              >
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-sm" style={{ color: MUTED }}>
          <Link to="/login" className="underline" style={{ color: ACCENT }}>Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
