import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';

export function HomePage() {
  const { state, logout } = useGame();
  const { currentUser, personas, sessions, enqueteurScores } = state;

  const userScore = enqueteurScores.find(s => s.userId === currentUser?.id);
  const studentNeedsPersona = currentUser?.role === 'student' &&
    !personas.some(p => p.createdBy === currentUser?.id);
  const completedSessions = sessions.filter(s => s.status === 'completed').length;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6">
      <div className="scanline"></div>

      <div className="max-w-4xl mx-auto w-full flex flex-col gap-3 flex-1 min-h-0">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="glow-text" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '14px' }}>
              JEU DE L'IMITATION
            </h1>
            <p className="retro-text-amber mt-1 text-sm">
              {currentUser?.pseudo}
              <span className="retro-text-cyan ml-3">
                [{currentUser?.role === 'teacher' ? 'Enseignant' : 'Élève'}]
              </span>
              {currentUser?.classId && (
                <span className="retro-text-cyan ml-3">— {currentUser.classId}</span>
              )}
            </p>
          </div>
          <button onClick={logout} className="retro-btn retro-btn-amber text-xs py-1 px-3">
            Déconnexion
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <RetroContainer title="SESSIONS">
            <div className="text-center py-1">
              <p className="text-3xl font-bold retro-text-cyan glow-text">{completedSessions}</p>
              <p className="text-sm mt-1">Sessions terminées</p>
            </div>
          </RetroContainer>

          <RetroContainer title="PERSONNAS">
            <div className="text-center py-1">
              <p className="text-3xl font-bold retro-text-magenta glow-text">{personas.length}</p>
              <p className="text-sm mt-1">Personnas créés</p>
            </div>
          </RetroContainer>
        </div>

        {/* Étape 1 */}
        <Link to="/personas" className="block">
          <div className={`retro-card cursor-pointer group transition-all py-3 ${studentNeedsPersona ? 'retro-border-magenta' : 'hover:border-[#ff00ff]'}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <div>
                <p className="retro-text-magenta text-xs mb-0.5">ÉTAPE 1</p>
                <h3 className="text-lg retro-text-magenta group-hover:glow-text transition-all leading-tight">
                  {'>'} CRÉER UN PERSONNAGE
                </h3>
                <p className="retro-text-amber text-sm mt-0.5">
                  {studentNeedsPersona
                    ? "Tu n'as pas encore créé de personnage — commence par ici !"
                    : "Crée ou consulte les personnages de ta classe"}
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* Étape 2 */}
        <Link to="/play" className="block">
          <div className="retro-card hover:border-[#00ff41] transition-all cursor-pointer group py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <p className="retro-text-cyan text-xs mb-0.5">ÉTAPE 2</p>
                <h3 className="text-lg group-hover:glow-text transition-all leading-tight">
                  {'>'} JOUER — ENQUÊTEUR
                </h3>
                <p className="retro-text-amber text-sm mt-0.5">
                  Interrogez deux interlocuteurs et devinez qui est l'IA
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* Points + Classement */}
        <div className="grid grid-cols-2 gap-3">
          <RetroContainer title="MES POINTS">
            <div className="text-center py-1">
              <p className="text-3xl font-bold retro-text-amber glow-text">{userScore?.totalPoints || 0}</p>
              <p className="text-sm mt-1">Points totaux</p>
              <p className="text-xs retro-text-cyan mt-0.5">
                Fiabilité : {userScore?.reliabilityIndex.toFixed(1) || 0}%
              </p>
            </div>
          </RetroContainer>

          <Link to="/scores" className="block">
            <div className="retro-card hover:border-[#ffb000] retro-border-amber transition-all cursor-pointer group h-full py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="text-lg retro-text-amber group-hover:glow-text transition-all leading-tight">
                    {'>'} CLASSEMENTS
                  </h3>
                  <p className="retro-text-cyan text-sm mt-0.5">
                    Scores et statistiques
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Teacher dashboard */}
        {currentUser?.role === 'teacher' && (
          <Link to="/dashboard" className="block">
            <div className="retro-card hover:border-[#00ffff] retro-border-cyan transition-all cursor-pointer group py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h3 className="text-lg retro-text-cyan group-hover:glow-text transition-all leading-tight">
                    {'>'} TABLEAU DE BORD
                  </h3>
                  <p className="retro-text-amber text-sm mt-0.5">Gérez les sessions et analysez les données</p>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Footer */}
        <p className="text-center text-xs retro-text-cyan opacity-50 mt-auto pb-1">
          Test de Turing Éducatif — Projet Pédagogique
        </p>

      </div>

      {/* Rules — visible on scroll */}
      <div className="max-w-4xl mx-auto w-full mt-8 px-4 md:px-6 pb-8">
        <RetroContainer title="RÈGLES DU JEU">
          <div className="space-y-3 text-base">
            <p>
              <span className="retro-text-cyan">1.</span> En tant qu'<span className="retro-text-amber">ENQUÊTEUR</span>, vous dialoguez avec deux interlocuteurs pendant 5 minutes.
            </p>
            <p>
              <span className="retro-text-cyan">2.</span> L'un est un <span className="glow-text">HUMAIN</span>, l'autre une <span className="retro-text-magenta">IA</span> jouant un personnage fictif.
            </p>
            <p>
              <span className="retro-text-cyan">3.</span> Votre mission : <span className="retro-text-amber">identifier qui est qui</span> !
            </p>
            <p>
              <span className="retro-text-cyan">4.</span> <span className="glow-text">+2 points</span> pour une détection correcte, <span className="retro-text-amber">+1 bonus</span> si votre justification est argumentée.
            </p>
          </div>
        </RetroContainer>
      </div>
    </div>
  );
}
