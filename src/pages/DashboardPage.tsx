import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';

export function DashboardPage() {
  const { state } = useGame();
  const { sessions, votes, personas, enqueteurScores, personaScores } = state;

  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'personas' | 'export'>('overview');

  const completedSessions = sessions.filter(s => s.status === 'completed');
  const totalVotes = votes.length;
  const correctVotes = votes.filter(v => v.isCorrect).length;
  const avgReliability = enqueteurScores.length > 0
    ? enqueteurScores.reduce((acc, s) => acc + s.reliabilityIndex, 0) / enqueteurScores.length
    : 0;
  const avgCredibility = personaScores.length > 0
    ? personaScores.reduce((acc, s) => acc + s.credibilityIndex, 0) / personaScores.length
    : 0;

  const exportData = () => {
    const data = {
      exportDate: new Date().toISOString(),
      statistics: {
        totalSessions: completedSessions.length,
        totalVotes,
        correctVotes,
        avgReliability,
        avgCredibility,
      },
      enqueteurScores,
      personaScores,
      sessions: completedSessions.map(s => ({
        id: s.id,
        personaId: s.personaId,
        startTime: s.startTime,
        endTime: s.endTime,
        aiWasIn: s.aiIsInChat,
        messageCountA: s.messages.chatA.length,
        messageCountB: s.messages.chatB.length,
      })),
      votes: votes.map(v => ({
        sessionId: v.sessionId,
        votedChat: v.votedChat,
        isCorrect: v.isCorrect,
        justificationLength: v.justification.length,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jeu-imitation-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['Pseudo', 'Sessions', 'Détections correctes', 'Points', 'Bonus', 'Fiabilité %'];
    const rows = enqueteurScores.map(s => [
      s.pseudo,
      s.totalSessions,
      s.correctDetections,
      s.totalPoints,
      s.bonusPoints,
      s.reliabilityIndex.toFixed(1),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enqueteurs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="scanline"></div>

      <div className="max-w-7xl mx-auto">
        <Link to="/" className="retro-text-cyan hover:glow-text text-lg">
          {'<'} Retour au menu
        </Link>

        <h1 className="text-2xl mt-4 mb-6 glow-text" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '16px' }}>
          📊 TABLEAU DE BORD ENSEIGNANT
        </h1>

        {/* Navigation par onglets */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['overview', 'sessions', 'personas', 'export'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`retro-btn ${activeTab === tab ? '' : 'opacity-50'}`}
            >
              {tab === 'overview' && '📈 Vue d\'ensemble'}
              {tab === 'sessions' && '💬 Sessions'}
              {tab === 'personas' && '🎭 Personnas'}
              {tab === 'export' && '📥 Export'}
            </button>
          ))}
        </div>

        {/* Onglet Vue d'ensemble */}
        {activeTab === 'overview' && (
          <>
            {/* Statistiques globales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <RetroContainer title="SESSIONS">
                <div className="text-center">
                  <p className="text-4xl font-bold glow-text">{completedSessions.length}</p>
                  <p className="text-sm retro-text-amber mt-1">terminées</p>
                </div>
              </RetroContainer>

              <RetroContainer title="VOTES">
                <div className="text-center">
                  <p className="text-4xl font-bold retro-text-cyan glow-text">{totalVotes}</p>
                  <p className="text-sm retro-text-amber mt-1">
                    {correctVotes} corrects ({totalVotes > 0 ? ((correctVotes / totalVotes) * 100).toFixed(0) : 0}%)
                  </p>
                </div>
              </RetroContainer>

              <RetroContainer title="FIABILITÉ MOY.">
                <div className="text-center">
                  <p className="text-4xl font-bold retro-text-amber glow-text">{avgReliability.toFixed(0)}%</p>
                  <p className="text-sm retro-text-cyan mt-1">Rᵢ moyen</p>
                </div>
              </RetroContainer>

              <RetroContainer title="CRÉDIBILITÉ MOY.">
                <div className="text-center">
                  <p className="text-4xl font-bold retro-text-magenta glow-text">{avgCredibility.toFixed(0)}%</p>
                  <p className="text-sm retro-text-cyan mt-1">IC moyen</p>
                </div>
              </RetroContainer>
            </div>

            {/* Graphique simplifié */}
            <RetroContainer title="📊 DISTRIBUTION DES SCORES" className="mb-8">
              <div className="space-y-4">
                <div>
                  <p className="mb-2">Répartition des détections :</p>
                  <div className="flex h-8 w-full border border-[#00ff41]">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${totalVotes > 0 ? (correctVotes / totalVotes) * 100 : 0}%`,
                        background: 'var(--retro-green)',
                      }}
                    />
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${totalVotes > 0 ? ((totalVotes - correctVotes) / totalVotes) * 100 : 0}%`,
                        background: 'var(--retro-magenta)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="glow-text">✓ Correctes ({correctVotes})</span>
                    <span className="retro-text-magenta">✗ Incorrectes ({totalVotes - correctVotes})</span>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="mb-2">Scores des enquêteurs (top 10) :</p>
                  <div className="space-y-2">
                    {enqueteurScores
                      .sort((a, b) => b.totalPoints - a.totalPoints)
                      .slice(0, 10)
                      .map((score, i) => (
                        <div key={score.userId} className="flex items-center gap-2">
                          <span className="w-8">#{i + 1}</span>
                          <span className="w-32 truncate">{score.pseudo}</span>
                          <div className="flex-1 h-4 border border-[#00ff41]">
                            <div
                              className="h-full"
                              style={{
                                width: `${(score.totalPoints / Math.max(...enqueteurScores.map(s => s.totalPoints), 1)) * 100}%`,
                                background: 'var(--retro-green)',
                              }}
                            />
                          </div>
                          <span className="w-12 text-right">{score.totalPoints} pts</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </RetroContainer>
          </>
        )}

        {/* Onglet Sessions */}
        {activeTab === 'sessions' && (
          <RetroContainer title="💬 HISTORIQUE DES SESSIONS">
            {completedSessions.length === 0 ? (
              <p className="text-center py-8 retro-text-amber">Aucune session terminée</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#00ff41]">
                      <th className="p-3">ID</th>
                      <th className="p-3">Personna</th>
                      <th className="p-3">IA dans</th>
                      <th className="p-3">Messages</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Résultat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedSessions.map(session => {
                      const vote = votes.find(v => v.sessionId === session.id);
                      const persona = personas.find(p => p.id === session.personaId);
                      return (
                        <tr key={session.id} className="border-b border-gray-700">
                          <td className="p-3 font-mono text-sm">{session.id.slice(0, 8)}...</td>
                          <td className="p-3 retro-text-magenta">{persona?.name || '-'}</td>
                          <td className="p-3">Chat {session.aiIsInChat}</td>
                          <td className="p-3">
                            A: {session.messages.chatA.length} / B: {session.messages.chatB.length}
                          </td>
                          <td className="p-3 text-sm">
                            {new Date(session.startTime).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="p-3">
                            {vote ? (
                              vote.isCorrect ? (
                                <span className="glow-text">✓ Correcte</span>
                              ) : (
                                <span className="retro-text-magenta">✗ Incorrecte</span>
                              )
                            ) : (
                              <span className="retro-text-amber">En attente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </RetroContainer>
        )}

        {/* Onglet Personnas */}
        {activeTab === 'personas' && (
          <RetroContainer title="🎭 ANALYSE DES PERSONNAS">
            {personaScores.length === 0 ? (
              <p className="text-center py-8 retro-text-amber">Aucun personna évalué</p>
            ) : (
              <div className="space-y-6">
                {personaScores.map(score => {
                  const persona = personas.find(p => p.id === score.personaId);
                  return (
                    <div key={score.personaId} className="retro-card">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-2xl retro-text-magenta">{score.personaName}</h3>
                          <p className="retro-text-amber">{persona?.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold retro-text-cyan glow-text">
                            {score.credibilityIndex.toFixed(0)}%
                          </p>
                          <p className="text-sm">Crédibilité IC</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl">{score.totalSessions}</p>
                          <p className="text-sm retro-text-amber">Sessions</p>
                        </div>
                        <div>
                          <p className="text-2xl retro-text-magenta">{score.timesDetectedAsAI}</p>
                          <p className="text-sm retro-text-amber">Détecté comme IA</p>
                        </div>
                        <div>
                          <p className="text-2xl glow-text">{score.totalSessions - score.timesDetectedAsAI}</p>
                          <p className="text-sm retro-text-amber">Passé pour humain</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="retro-progress">
                          <div
                            className="retro-progress-bar"
                            style={{
                              width: `${score.credibilityIndex}%`,
                              background: score.credibilityIndex > 50 ? 'var(--retro-cyan)' : 'var(--retro-magenta)',
                            }}
                          />
                        </div>
                      </div>

                      {persona && (
                        <div className="mt-4 text-sm">
                          <span className="retro-text-cyan">Traits :</span> {persona.traits.join(', ')}
                          <br />
                          <span className="retro-text-cyan">Intérêts :</span> {persona.interests.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </RetroContainer>
        )}

        {/* Onglet Export */}
        {activeTab === 'export' && (
          <RetroContainer title="📥 EXPORT DES DONNÉES">
            <div className="space-y-6">
              <p className="text-lg">
                Exportez les données de l'expérimentation pour analyse externe.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="retro-card">
                  <h3 className="text-xl mb-4">📄 Export JSON (complet)</h3>
                  <p className="text-sm retro-text-amber mb-4">
                    Contient toutes les données : sessions, votes, scores, statistiques.
                    Idéal pour une analyse approfondie.
                  </p>
                  <button onClick={exportData} className="retro-btn w-full">
                    Télécharger JSON
                  </button>
                </div>

                <div className="retro-card">
                  <h3 className="text-xl mb-4">📊 Export CSV (enquêteurs)</h3>
                  <p className="text-sm retro-text-amber mb-4">
                    Tableau des scores des enquêteurs.
                    Compatible Excel/Google Sheets.
                  </p>
                  <button onClick={exportCSV} className="retro-btn retro-btn-cyan w-full">
                    Télécharger CSV
                  </button>
                </div>
              </div>

              <div className="retro-card retro-border-amber">
                <h3 className="text-xl retro-text-amber mb-4">⚠️ Conformité RGPD</h3>
                <p className="text-sm">
                  Les données exportées sont anonymisées (pseudonymes uniquement).
                  Aucune donnée personnelle identifiable n'est incluse.
                  Les données sont stockées localement sur votre appareil (localStorage).
                </p>
              </div>
            </div>
          </RetroContainer>
        )}
      </div>
    </div>
  );
}
