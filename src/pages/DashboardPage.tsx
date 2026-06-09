import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';

const BG = '#0f172a';
const CARD = '#1e293b';
const PANEL = '#243044';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = '#6b7280';
const ACCENT = '#6366f1';

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
      statistics: { totalSessions: completedSessions.length, totalVotes, correctVotes, avgReliability, avgCredibility },
      enqueteurScores,
      personaScores,
      sessions: completedSessions.map(s => ({
        id: s.id,
        personaIdA: s.personaIdA,
        personaIdB: s.personaIdB,
        gameMode: s.gameMode,
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
      s.pseudo, s.totalSessions, s.correctDetections, s.totalPoints, s.bonusPoints, s.reliabilityIndex.toFixed(1),
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

  const TABS = [
    { id: 'overview', label: 'Vue d\'ensemble' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'personas', label: 'Personnas' },
    { id: 'export', label: 'Export' },
  ] as const;

  return (
    <div
      className="min-h-screen"
      style={{ background: BG, color: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/"
            className="text-sm transition-colors"
            style={{ color: MUTED }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            ← Retour
          </Link>
          <span style={{ color: MUTED }}>·</span>
          <h1 className="text-xl font-bold text-white">Tableau de bord</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: CARD }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? PANEL : 'transparent',
                color: activeTab === tab.id ? '#f9fafb' : MUTED,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-8 rounded-2xl overflow-hidden" style={{ background: BORDER }}>
              {[
                { label: 'Sessions terminées', value: completedSessions.length, color: '#f9fafb' },
                { label: 'Votes', value: `${correctVotes}/${totalVotes}`, color: '#06b6d4' },
                { label: 'Fiabilité moy.', value: `${avgReliability.toFixed(0)}%`, color: '#f59e0b' },
                { label: 'Crédibilité moy.', value: `${avgCredibility.toFixed(0)}%`, color: '#ec4899' },
              ].map(({ label, value, color }) => (
                <div key={label} className="px-6 py-5" style={{ background: CARD }}>
                  <p className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Distribution chart */}
            <div className="rounded-2xl p-6 mb-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: MUTED }}>
                Distribution des scores
              </p>

              <div className="mb-6">
                <p className="text-sm mb-2" style={{ color: MUTED }}>Répartition des détections</p>
                <div className="flex h-6 rounded-full overflow-hidden" style={{ background: BG }}>
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${totalVotes > 0 ? (correctVotes / totalVotes) * 100 : 0}%`,
                      background: ACCENT,
                    }}
                  />
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${totalVotes > 0 ? ((totalVotes - correctVotes) / totalVotes) * 100 : 0}%`,
                      background: '#ec4899',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-2" style={{ color: MUTED }}>
                  <span style={{ color: ACCENT }}>Correctes ({correctVotes})</span>
                  <span style={{ color: '#ec4899' }}>Incorrectes ({totalVotes - correctVotes})</span>
                </div>
              </div>

              <div>
                <p className="text-sm mb-3" style={{ color: MUTED }}>Top enquêteurs</p>
                <div className="space-y-2">
                  {enqueteurScores
                    .sort((a, b) => b.totalPoints - a.totalPoints)
                    .slice(0, 10)
                    .map((score, i) => (
                      <div key={score.userId} className="flex items-center gap-3">
                        <span className="w-7 text-xs tabular-nums" style={{ color: MUTED }}>#{i + 1}</span>
                        <span className="w-28 truncate text-sm text-white">{score.pseudo}</span>
                        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: BG }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(score.totalPoints / Math.max(...enqueteurScores.map(s => s.totalPoints), 1)) * 100}%`,
                              background: ACCENT,
                            }}
                          />
                        </div>
                        <span className="w-14 text-right text-xs tabular-nums" style={{ color: MUTED }}>{score.totalPoints} pts</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sessions */}
        {activeTab === 'sessions' && (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <div className="px-6 py-4" style={{ background: CARD, borderBottom: `1px solid ${BORDER}` }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
                Historique des sessions
              </p>
            </div>
            {completedSessions.length === 0 ? (
              <p className="px-6 py-8 text-sm" style={{ color: MUTED, background: BG }}>Aucune session terminée</p>
            ) : (
              <div className="overflow-x-auto" style={{ background: BG }}>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['ID', 'Personna', 'IA dans', 'Messages', 'Date', 'Résultat'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {completedSessions.map(session => {
                      const vote = votes.find(v => v.sessionId === session.id);
                      const personaA = personas.find(p => p.id === session.personaIdA);
                      const personaB = personas.find(p => p.id === session.personaIdB);
                      return (
                        <tr key={session.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td className="px-5 py-3 font-mono text-xs" style={{ color: MUTED }}>{session.id.slice(0, 8)}…</td>
                          <td className="px-5 py-3" style={{ color: '#ec4899' }}>{personaA?.name || '?'} / {personaB?.name || '?'}</td>
                          <td className="px-5 py-3" style={{ color: MUTED }}>Chat {session.aiIsInChat}</td>
                          <td className="px-5 py-3" style={{ color: MUTED }}>A:{session.messages.chatA.length} / B:{session.messages.chatB.length}</td>
                          <td className="px-5 py-3" style={{ color: MUTED }}>{new Date(session.startTime).toLocaleDateString('fr-FR')}</td>
                          <td className="px-5 py-3">
                            {vote ? (
                              vote.isCorrect
                                ? <span style={{ color: ACCENT }}>✓ Correcte</span>
                                : <span style={{ color: '#ec4899' }}>✗ Incorrecte</span>
                            ) : (
                              <span style={{ color: '#f59e0b' }}>En attente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Personas */}
        {activeTab === 'personas' && (
          <div>
            {personaScores.length === 0 ? (
              <p className="py-8 text-sm" style={{ color: MUTED }}>Aucun personna évalué</p>
            ) : (
              <div className="space-y-4">
                {personaScores.map(score => {
                  const persona = personas.find(p => p.id === score.personaId);
                  return (
                    <div key={score.personaId} className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-base font-bold" style={{ color: '#ec4899' }}>{score.personaName}</h3>
                          {persona?.description && (
                            <p className="text-sm mt-0.5" style={{ color: MUTED }}>{persona.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold tabular-nums" style={{ color: '#06b6d4' }}>
                            {score.credibilityIndex.toFixed(0)}%
                          </p>
                          <p className="text-xs" style={{ color: MUTED }}>Crédibilité IC</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center mb-4">
                        {[
                          { value: score.totalSessions, label: 'Sessions', color: '#f9fafb' },
                          { value: score.timesDetectedAsAI, label: 'Détecté comme IA', color: '#ec4899' },
                          { value: score.totalSessions - score.timesDetectedAsAI, label: 'Passé pour humain', color: ACCENT },
                        ].map(({ value, label, color }) => (
                          <div key={label}>
                            <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
                            <p className="text-xs mt-0.5" style={{ color: MUTED }}>{label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: BG }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${score.credibilityIndex}%`,
                            background: score.credibilityIndex > 50 ? '#06b6d4' : '#ec4899',
                          }}
                        />
                      </div>

                      {persona && (
                        <p className="text-xs mt-3" style={{ color: MUTED }}>
                          <span style={{ color: '#06b6d4' }}>Traits :</span> {persona.traits.join(', ')}
                          {' · '}
                          <span style={{ color: '#06b6d4' }}>Intérêts :</span> {persona.interests.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Export */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <h3 className="text-sm font-bold text-white mb-2">Export JSON (complet)</h3>
                <p className="text-xs mb-4" style={{ color: MUTED }}>
                  Toutes les données : sessions, votes, scores, statistiques. Idéal pour une analyse approfondie.
                </p>
                <button
                  onClick={exportData}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                  style={{ background: ACCENT }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#4f46e5')}
                  onMouseLeave={e => (e.currentTarget.style.background = ACCENT)}
                >
                  Télécharger JSON
                </button>
              </div>

              <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <h3 className="text-sm font-bold text-white mb-2">Export CSV (enquêteurs)</h3>
                <p className="text-xs mb-4" style={{ color: MUTED }}>
                  Tableau des scores des enquêteurs. Compatible Excel / Google Sheets.
                </p>
                <button
                  onClick={exportCSV}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: '#06b6d4' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#06b6d4')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
                >
                  Télécharger CSV
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid rgba(245,158,11,0.3)` }}>
              <h3 className="text-sm font-bold mb-2" style={{ color: '#f59e0b' }}>Conformité RGPD</h3>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                Les données exportées sont anonymisées (pseudonymes uniquement).
                Aucune donnée personnelle identifiable n'est incluse.
                Les données sont stockées localement sur votre appareil (localStorage).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
