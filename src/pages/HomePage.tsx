import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';

const BG = '#faf7f2';
const CARD = '#ffffff';
const BORDER = 'rgba(0,0,0,0.08)';
const MUTED = '#78716c';
const SUBTLE = '#a8a29e';
const TEXT = '#1c1917';

export function HomePage() {
  const { state, logout } = useGame();
  const { currentUser, personas, sessions, enqueteurScores } = state;

  const sortedEnqueteurs = [...enqueteurScores].sort((a, b) => b.totalPoints - a.totalPoints);
  const userRank = sortedEnqueteurs.findIndex(s => s.userId === currentUser?.id) + 1;
  const userScore = enqueteurScores.find(s => s.userId === currentUser?.id);
  const studentNeedsPersona =
    currentUser?.role === 'student' &&
    !personas.some(p => p.createdBy === currentUser?.id);
  const completedSessions = sessions.filter(s => s.status === 'completed').length;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: BG, color: TEXT, fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ── Header ── */}
      <header
        className="flex justify-between items-center px-8 py-5 shrink-0"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-baseline gap-4">
          <span className="text-2xl font-bold tracking-tight" style={{ color: TEXT }}>
            Jeu de l'Imitation
          </span>
          <span style={{ color: MUTED }} className="text-sm">
            {currentUser?.pseudo}
            {currentUser?.classId && (
              <>
                <span className="mx-2" style={{ color: SUBTLE }}>·</span>
                {currentUser.classId}
              </>
            )}
          </span>
        </div>
        <button
          onClick={logout}
          className="text-sm transition-colors px-3 py-1.5 rounded-lg"
          style={{ color: MUTED, border: `1px solid ${BORDER}` }}
          onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
          onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
        >
          Se déconnecter
        </button>
      </header>

      {/* ── Main grid ── */}
      <main className="flex-1 min-h-0 grid grid-cols-3 gap-px" style={{ background: BORDER }}>

        {/* Left 2/3 — actions */}
        <div className="col-span-2 flex flex-col gap-px" style={{ background: BG }}>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-px shrink-0" style={{ background: BORDER }}>
            <Stat label="Sessions" value={completedSessions} />
            <Stat label="Personnages" value={personas.length} />
            <Stat
              label="Mes points"
              value={userScore?.totalPoints ?? 0}
              sub={`${userScore?.reliabilityIndex.toFixed(0) ?? 0}% fiabilité`}
            />
          </div>

          {/* Step cards */}
          <div className="flex-1 min-h-0 grid grid-rows-2 gap-px" style={{ background: BORDER }}>
            <StepCard
              step="01"
              title="Créer un personnage"
              description="Construis un personnage fictif de lycéen — nom, traits, centres d'intérêt, façon de parler. L'IA l'incarnera pendant le jeu."
              to="/personas"
              accent="#ec4899"
              cta={studentNeedsPersona ? 'Commencer' : 'Voir les personnages'}
              urgent={studentNeedsPersona}
            />
            <StepCard
              step="02"
              title="Jouer"
              description="Interrogez deux interlocuteurs pendant 5 minutes. L'un est humain, l'autre est une IA. Identifiez-la et justifiez votre réponse."
              to="/play"
              accent="#6366f1"
              cta="Lancer une partie"
              urgent={false}
            />
          </div>

          {/* Bottom links */}
          <div className="grid grid-cols-2 gap-px shrink-0" style={{ background: BORDER }}>
            <BottomLink
              to="/scores"
              label="Classements"
              sub={userRank > 0 ? `Votre rang — #${userRank}` : 'Scores et statistiques'}
            />
            {currentUser?.role === 'teacher' && (
              <BottomLink to="/dashboard" label="Tableau de bord" sub="Gérez les sessions" />
            )}
          </div>
        </div>

        {/* Right 1/3 — rules */}
        <aside
          className="flex flex-col p-8 overflow-auto"
          style={{ background: CARD }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: MUTED }}>
            Règles du jeu
          </p>
          <div className="flex-1 space-y-6">
            {[
              "Vous dialoguez en simultané avec deux interlocuteurs pendant 5 minutes.",
              "L'un est un humain, l'autre est une IA qui incarne un personnage fictif créé par vos camarades d'une autre classe.",
              "Votre mission : déterminer lequel est l'IA avant la fin du temps imparti.",
            ].map((text, i) => (
              <div key={i} className="flex gap-4">
                <span
                  className="shrink-0 text-xs font-bold mt-0.5"
                  style={{ color: '#6366f1' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{text}</p>
              </div>
            ))}
            <div className="pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: MUTED }}>Score</p>
              <ul className="space-y-2">
                <li className="flex gap-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                  <span style={{ color: '#6366f1' }}>·</span>
                  +2 pts pour une bonne détection. +1 pt bonus si votre justification dépasse 50 caractères.
                </li>
                <li className="flex gap-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                  <span style={{ color: '#6366f1' }}>·</span>
                  Bonus créateur : si l'IA que vous avez créée déjoue 2 enquêteurs de suite, vous gagnez +2 pts bonus.
                </li>
              </ul>
            </div>
          </div>
          <p className="text-xs mt-8 pt-4" style={{ color: SUBTLE, borderTop: `1px solid ${BORDER}` }}>
            Test de Turing — Projet pédagogique
          </p>
        </aside>
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="px-8 py-5" style={{ background: CARD }}>
      <p className="text-3xl font-bold tabular-nums" style={{ color: TEXT }}>{value}</p>
      <p className="text-sm mt-1" style={{ color: MUTED }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: SUBTLE }}>{sub}</p>}
    </div>
  );
}

function StepCard({ step, title, description, to, accent, cta, urgent }: {
  step: string;
  title: string;
  description: string;
  to: string;
  accent: string;
  cta: string;
  urgent: boolean;
}) {
  return (
    <Link to={to} className="block h-full group" style={{ background: BG }}>
      <div
        className="h-full flex flex-col justify-between p-8 transition-all"
        style={{ borderLeft: `3px solid ${urgent ? accent : 'transparent'}` }}
        onMouseEnter={e => (e.currentTarget.style.borderLeftColor = accent)}
        onMouseLeave={e => (e.currentTarget.style.borderLeftColor = urgent ? accent : 'transparent')}
      >
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>
            Étape {step}
          </p>
          <h2 className="text-2xl font-bold leading-tight mb-3" style={{ color: TEXT }}>{title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: MUTED, maxWidth: '480px' }}>
            {description}
          </p>
        </div>
        <div className="mt-6">
          <span
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition-all"
            style={{ background: `${accent}15`, color: accent }}
          >
            {cta}
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

function BottomLink({ to, label, sub }: { to: string; label: string; sub: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between px-8 py-8 group transition-colors"
      style={{ background: CARD }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f5f0e8')}
      onMouseLeave={e => (e.currentTarget.style.background = CARD)}
    >
      <div>
        <p className="text-base font-bold" style={{ color: TEXT }}>{label}</p>
        <p className="text-xs mt-1" style={{ color: MUTED }}>{sub}</p>
      </div>
      <svg
        className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
        style={{ color: MUTED }}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
