import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';

export function ScoresPage() {
  const { state } = useGame();
  const { currentUser, enqueteurScores, personaScores, personas } = state;

  const sortedEnqueteurs = [...enqueteurScores].sort((a, b) => b.totalPoints - a.totalPoints);
  const sortedPersonas = [...personaScores].sort((a, b) => b.credibilityIndex - a.credibilityIndex);

  const userRank = sortedEnqueteurs.findIndex(s => s.userId === currentUser?.id) + 1;
  const userScore = sortedEnqueteurs.find(s => s.userId === currentUser?.id);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="scanline"></div>

      <div className="max-w-6xl mx-auto">
        <Link to="/" className="retro-text-cyan hover:glow-text text-lg">
          {'<'} Retour au menu
        </Link>

        <h1 className="text-2xl mt-4 mb-8 glow-text" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '16px' }}>
          🏆 CLASSEMENTS
        </h1>

        {/* Stats personnelles */}
        {userScore && (
          <RetroContainer title="📊 VOS STATISTIQUES" className="mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-5xl font-bold retro-text-amber glow-text">
                  #{userRank || '-'}
                </p>
                <p className="text-lg mt-2">Classement</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold glow-text">
                  {userScore.totalPoints}
                </p>
                <p className="text-lg mt-2">Points totaux</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold retro-text-cyan glow-text">
                  {userScore.correctDetections}/{userScore.totalSessions}
                </p>
                <p className="text-lg mt-2">Détections</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold retro-text-magenta glow-text">
                  {userScore.reliabilityIndex.toFixed(0)}%
                </p>
                <p className="text-lg mt-2">Fiabilité (Rᵢ)</p>
              </div>
            </div>
          </RetroContainer>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Classement Enquêteurs */}
          <RetroContainer title="🔍 TOP ENQUÊTEURS">
            {sortedEnqueteurs.length === 0 ? (
              <p className="text-center py-8 retro-text-amber">
                Aucune session terminée
              </p>
            ) : (
              <div className="space-y-3">
                {sortedEnqueteurs.slice(0, 10).map((score, index) => (
                  <div
                    key={score.userId}
                    className={`flex items-center justify-between p-3 ${
                      score.userId === currentUser?.id
                        ? 'bg-[rgba(0,255,65,0.1)] border border-[#00ff41]'
                        : 'retro-card'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`text-2xl font-bold ${
                        index === 0 ? 'retro-text-amber' :
                        index === 1 ? 'text-gray-400' :
                        index === 2 ? 'text-orange-600' : ''
                      }`}>
                        #{index + 1}
                      </span>
                      <div>
                        <p className="text-xl">
                          {score.pseudo}
                          {score.userId === currentUser?.id && (
                            <span className="retro-text-cyan ml-2">(vous)</span>
                          )}
                        </p>
                        <p className="text-sm retro-text-amber">
                          {score.correctDetections}/{score.totalSessions} détections
                          • Rᵢ: {score.reliabilityIndex.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold glow-text">
                        {score.totalPoints}
                      </p>
                      <p className="text-sm">pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </RetroContainer>

          {/* Classement Personnas */}
          <RetroContainer title="🎭 MEILLEURS PERSONNAS (Crédibilité)">
            {sortedPersonas.length === 0 ? (
              <p className="text-center py-8 retro-text-amber">
                Aucun personna évalué
              </p>
            ) : (
              <div className="space-y-3">
                {sortedPersonas.slice(0, 10).map((score, index) => {
                  personas.find(p => p.id === score.personaId);
                  return (
                    <div
                      key={score.personaId}
                      className="retro-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className={`text-2xl font-bold ${
                            index === 0 ? 'retro-text-magenta' :
                            index === 1 ? 'text-gray-400' :
                            index === 2 ? 'text-orange-600' : ''
                          }`}>
                            #{index + 1}
                          </span>
                          <div>
                            <p className="text-xl retro-text-magenta">
                              {score.personaName}
                            </p>
                            <p className="text-sm retro-text-amber">
                              {score.totalSessions} sessions
                              • {score.timesDetectedAsAI} détections
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold retro-text-cyan glow-text">
                            {score.credibilityIndex.toFixed(0)}%
                          </p>
                          <p className="text-sm retro-text-cyan">IC</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="retro-progress">
                          <div
                            className="retro-progress-bar"
                            style={{
                              width: `${score.credibilityIndex}%`,
                              background: 'var(--retro-cyan)'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </RetroContainer>
        </div>

        {/* Légende */}
        <div className="mt-8 retro-card">
          <h3 className="text-xl mb-4">📖 LÉGENDE</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
            <div>
              <p><span className="retro-text-amber">Points</span> : +2 par détection correcte, +1 bonus pour justification argumentée</p>
              <p className="mt-2"><span className="retro-text-cyan">Rᵢ (Fiabilité)</span> : % de détections correctes</p>
            </div>
            <div>
              <p><span className="retro-text-magenta">IC (Crédibilité)</span> : % de fois où le personna n'a PAS été détecté comme IA</p>
              <p className="mt-2">Plus l'IC est élevé, plus le personna est crédible !</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
