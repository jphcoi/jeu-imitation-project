import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';

export function HomePage() {
  const { state, logout } = useGame();
  const { currentUser, personas, sessions, enqueteurScores } = state;

  const userScore = enqueteurScores.find(s => s.userId === currentUser?.id);
  const completedSessions = sessions.filter(s => s.status === 'completed').length;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="scanline"></div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl glow-text" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '20px' }}>
              JEU DE L'IMITATION
            </h1>
            <p className="retro-text-amber mt-2 text-xl">
              Connecté : {currentUser?.pseudo}
              <span className="retro-text-cyan ml-4">
                [{currentUser?.role === 'teacher' ? 'Enseignant' : 'Élève'}]
              </span>
            </p>
          </div>
          <button onClick={logout} className="retro-btn retro-btn-amber">
            Déconnexion
          </button>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <RetroContainer title="MES STATS">
            <div className="text-center">
              <p className="text-4xl font-bold retro-text-amber glow-text">
                {userScore?.totalPoints || 0}
              </p>
              <p className="text-lg mt-2">Points totaux</p>
              <p className="text-sm retro-text-cyan mt-1">
                Fiabilité : {userScore?.reliabilityIndex.toFixed(1) || 0}%
              </p>
            </div>
          </RetroContainer>

          <RetroContainer title="SESSIONS">
            <div className="text-center">
              <p className="text-4xl font-bold retro-text-cyan glow-text">
                {completedSessions}
              </p>
              <p className="text-lg mt-2">Sessions terminées</p>
              <p className="text-sm retro-text-amber mt-1">
                {sessions.filter(s => s.status === 'active').length} en cours
              </p>
            </div>
          </RetroContainer>

          <RetroContainer title="PERSONNAS">
            <div className="text-center">
              <p className="text-4xl font-bold retro-text-magenta glow-text">
                {personas.length}
              </p>
              <p className="text-lg mt-2">Personnas créés</p>
              <p className="text-sm retro-text-amber mt-1">
                disponibles pour le jeu
              </p>
            </div>
          </RetroContainer>
        </div>

        {/* Menu principal */}
        <RetroContainer title="MENU PRINCIPAL" className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            <Link to="/play" className="block">
              <div className="retro-card hover:border-[#00ff41] transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🔍</span>
                  <div>
                    <h3 className="text-2xl group-hover:glow-text transition-all">
                      {'>'} JOUER - ENQUÊTEUR
                    </h3>
                    <p className="retro-text-amber text-lg mt-1">
                      Interrogez deux interlocuteurs et devinez qui est l'IA
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/personas" className="block">
              <div className="retro-card hover:border-[#ff00ff] retro-border-magenta transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🎭</span>
                  <div>
                    <h3 className="text-2xl retro-text-magenta group-hover:glow-text transition-all">
                      {'>'} CRÉER UN PERSONNA
                    </h3>
                    <p className="retro-text-amber text-lg mt-1">
                      Concevez une identité fictive pour l'IA
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/scores" className="block">
              <div className="retro-card hover:border-[#ffb000] retro-border-amber transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🏆</span>
                  <div>
                    <h3 className="text-2xl retro-text-amber group-hover:glow-text transition-all">
                      {'>'} CLASSEMENTS
                    </h3>
                    <p className="retro-text-cyan text-lg mt-1">
                      Consultez les scores et statistiques
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            {currentUser?.role === 'teacher' && (
              <Link to="/dashboard" className="block">
                <div className="retro-card hover:border-[#00ffff] retro-border-cyan transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">📊</span>
                    <div>
                      <h3 className="text-2xl retro-text-cyan group-hover:glow-text transition-all">
                        {'>'} TABLEAU DE BORD
                      </h3>
                      <p className="retro-text-amber text-lg mt-1">
                        Gérez les sessions et analysez les données
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </RetroContainer>

        {/* Instructions */}
        <RetroContainer title="RÈGLES DU JEU">
          <div className="space-y-4 text-lg">
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

        {/* Footer */}
        <div className="text-center mt-8 text-sm retro-text-cyan opacity-70">
          <p>Test de Turing Éducatif - Projet Pédagogique</p>
        </div>
      </div>
    </div>
  );
}
