import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';
import type { Persona } from '../types';

const TRAIT_SUGGESTIONS = [
  'timide', 'extraverti', 'curieux', 'réservé', 'bavard',
  'sportif', 'créatif', 'studieux', 'rêveur', 'pragmatique',
  'optimiste', 'réaliste', 'enthousiaste', 'calme', 'énergique'
];

const INTEREST_SUGGESTIONS = [
  'jeux vidéo', 'musique', 'lecture', 'sport', 'cinéma',
  'séries', 'dessin', 'photographie', 'cuisine', 'mode',
  'sciences', 'histoire', 'voyages', 'animaux', 'technologie',
  'manga', 'danse', 'théâtre', 'écriture', 'jardinage'
];

const STYLE_SUGGESTIONS = [
  'utilise beaucoup de "genre" et "trop"',
  'parle avec des abréviations (mdr, tkt, stp...)',
  'pose souvent des questions en retour',
  'utilise peu d\'émojis',
  'fait des phrases courtes',
  'utilise un vocabulaire soutenu',
  'hésite souvent (euh, hm, ben...)',
  'change parfois de sujet',
];

export function PersonaPage() {
  const { state, createPersona, dispatch } = useGame();
  const { currentUser, personas } = state;

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState(16);
  const [description, setDescription] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [speakingStyle, setSpeakingStyle] = useState('');
  const [customTrait, setCustomTrait] = useState('');
  const [customInterest, setCustomInterest] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || traits.length === 0 || interests.length === 0) return;

    createPersona({
      name: name.trim(),
      age,
      description: description.trim(),
      traits,
      interests,
      speakingStyle: speakingStyle.trim(),
      classId: currentUser?.classId || 'default',
    });

    // Reset form
    setName('');
    setAge(16);
    setDescription('');
    setTraits([]);
    setInterests([]);
    setSpeakingStyle('');
    setShowForm(false);
  };

  const toggleTrait = (trait: string) => {
    setTraits(prev =>
      prev.includes(trait)
        ? prev.filter(t => t !== trait)
        : [...prev, trait]
    );
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomTrait = () => {
    if (customTrait.trim() && !traits.includes(customTrait.trim())) {
      setTraits(prev => [...prev, customTrait.trim()]);
      setCustomTrait('');
    }
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim())) {
      setInterests(prev => [...prev, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  const deletePersona = (id: string) => {
    if (confirm('Supprimer ce personna ?')) {
      dispatch({ type: 'DELETE_PERSONA', payload: id });
    }
  };

  const myPersonas = personas.filter(p => p.createdBy === currentUser?.id);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="scanline"></div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link to="/" className="retro-text-cyan hover:glow-text text-lg">
              {'<'} Retour au menu
            </Link>
            <h1 className="text-2xl mt-2 glow-text" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '16px' }}>
              🎭 CRÉATION DE PERSONNAS
            </h1>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="retro-btn retro-btn-magenta"
            >
              + Nouveau
            </button>
          )}
        </div>

        {/* Formulaire de création */}
        {showForm && (
          <RetroContainer title="NOUVEAU PERSONNA" className="mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block mb-2 text-lg">{'>'} Prénom :</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="retro-input"
                    placeholder="Ex: Naïma, Lucas, Chloé..."
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 text-lg">{'>'} Âge :</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value))}
                    className="retro-input"
                    min={14}
                    max={19}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2 text-lg">{'>'} Description courte :</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="retro-textarea"
                  placeholder="Ex: Lycéenne en première S, passionnée de couture et de mode..."
                />
              </div>

              <div>
                <label className="block mb-2 text-lg">
                  {'>'} Traits de caractère ({traits.length} sélectionnés) :
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {TRAIT_SUGGESTIONS.map(trait => (
                    <button
                      key={trait}
                      type="button"
                      onClick={() => toggleTrait(trait)}
                      className={`retro-badge cursor-pointer transition-all ${
                        traits.includes(trait)
                          ? 'bg-[#00ff41] text-black'
                          : 'hover:border-[#00ff41]'
                      }`}
                    >
                      {trait}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTrait}
                    onChange={(e) => setCustomTrait(e.target.value)}
                    className="retro-input flex-1"
                    placeholder="Ajouter un trait personnalisé..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTrait())}
                  />
                  <button type="button" onClick={addCustomTrait} className="retro-btn">
                    +
                  </button>
                </div>
                {traits.filter(t => !TRAIT_SUGGESTIONS.includes(t)).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {traits.filter(t => !TRAIT_SUGGESTIONS.includes(t)).map(trait => (
                      <span key={trait} className="retro-badge bg-[#00ff41] text-black">
                        {trait} <button onClick={() => toggleTrait(trait)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-2 text-lg">
                  {'>'} Centres d'intérêt ({interests.length} sélectionnés) :
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {INTEREST_SUGGESTIONS.map(interest => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`retro-badge cursor-pointer transition-all ${
                        interests.includes(interest)
                          ? 'bg-[#ff00ff] text-black'
                          : 'retro-text-magenta hover:border-[#ff00ff]'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInterest}
                    onChange={(e) => setCustomInterest(e.target.value)}
                    className="retro-input flex-1"
                    placeholder="Ajouter un intérêt personnalisé..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomInterest())}
                  />
                  <button type="button" onClick={addCustomInterest} className="retro-btn retro-btn-magenta">
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-lg">{'>'} Style de langage :</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {STYLE_SUGGESTIONS.map(style => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setSpeakingStyle(style)}
                      className={`retro-badge cursor-pointer transition-all text-sm ${
                        speakingStyle === style
                          ? 'bg-[#00ffff] text-black'
                          : 'retro-text-cyan hover:border-[#00ffff]'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
                <textarea
                  value={speakingStyle}
                  onChange={(e) => setSpeakingStyle(e.target.value)}
                  className="retro-textarea"
                  placeholder="Décrivez comment ce personnage s'exprime..."
                />
              </div>

              {/* Aperçu */}
              {name && (
                <div className="retro-card retro-border-amber">
                  <p className="retro-text-amber mb-2">📋 APERÇU DU PROMPT :</p>
                  <p className="text-lg">
                    "{name}, {age} ans. {description}
                    {traits.length > 0 && ` Personnalité : ${traits.join(', ')}.`}
                    {interests.length > 0 && ` Passions : ${interests.join(', ')}.`}
                    {speakingStyle && ` Style : ${speakingStyle}.`}"
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="retro-btn flex-1"
                  disabled={!name.trim() || traits.length === 0 || interests.length === 0}
                >
                  Créer le Personna
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="retro-btn retro-btn-amber"
                >
                  Annuler
                </button>
              </div>
            </form>
          </RetroContainer>
        )}

        {/* Liste des personnas */}
        <RetroContainer title="MES PERSONNAS">
          {myPersonas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xl retro-text-amber mb-4">Aucun personna créé</p>
              <p className="text-lg">
                Créez votre premier personna pour commencer !
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myPersonas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onDelete={() => deletePersona(persona.id)}
                />
              ))}
            </div>
          )}
        </RetroContainer>

        {/* Tous les personnas disponibles */}
        {personas.length > myPersonas.length && (
          <RetroContainer title="AUTRES PERSONNAS DISPONIBLES" className="mt-8">
            <div className="space-y-4">
              {personas
                .filter(p => p.createdBy !== currentUser?.id)
                .map((persona) => (
                  <PersonaCard key={persona.id} persona={persona} />
                ))}
            </div>
          </RetroContainer>
        )}
      </div>
    </div>
  );
}

function PersonaCard({ persona, onDelete }: { persona: Persona; onDelete?: () => void }) {
  return (
    <div className="retro-card">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl glow-text">
            {persona.name}, {persona.age} ans
          </h3>
          <p className="retro-text-amber mt-2">{persona.description}</p>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="retro-btn retro-btn-amber text-sm"
          >
            ×
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {persona.traits.map(trait => (
          <span key={trait} className="retro-badge text-sm">
            {trait}
          </span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {persona.interests.map(interest => (
          <span key={interest} className="retro-badge retro-text-magenta text-sm">
            {interest}
          </span>
        ))}
      </div>

      {persona.speakingStyle && (
        <p className="mt-3 text-sm retro-text-cyan">
          💬 {persona.speakingStyle}
        </p>
      )}

      {persona.credibilityScore !== undefined && (
        <div className="mt-3">
          <div className="retro-progress">
            <div
              className="retro-progress-bar"
              style={{ width: `${persona.credibilityScore}%` }}
            />
          </div>
          <p className="text-sm mt-1">
            Score de crédibilité : {persona.credibilityScore.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
}
