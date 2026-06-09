import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';
import { v4 as uuidv4 } from 'uuid';
import type { Persona } from '../types';

const PERSONA_CHAT_URL = import.meta.env.PROD
  ? '/api/persona-chat'
  : (import.meta.env.VITE_API_URL?.replace('/chat', '/persona-chat') || '/api/persona-chat');

// ─── Chatbot helpers ───────────────────────────────────────────────────────

interface ConversationMessage {
  id: string;
  content: string;
  isFromUser: boolean;
}

const OPENING_MESSAGE =
  "Salut ! Je suis là pour t'aider à créer un personnage fictif pour le Jeu de l'Imitation. " +
  "Ce personnage sera joué par une IA, et les autres élèves devront deviner si c'est une IA ou un humain — " +
  "donc plus il est réaliste, mieux c'est ! " +
  "Pour commencer : comment s'appelle ton personnage ?";

// ─── Manual form helpers ───────────────────────────────────────────────────

const TRAIT_SUGGESTIONS = [
  'timide', 'extraverti', 'curieux', 'réservé', 'bavard',
  'sportif', 'créatif', 'studieux', 'rêveur', 'pragmatique',
  'optimiste', 'réaliste', 'enthousiaste', 'calme', 'énergique',
];

const INTEREST_SUGGESTIONS = [
  'jeux vidéo', 'musique', 'lecture', 'sport', 'cinéma',
  'séries', 'dessin', 'photographie', 'cuisine', 'mode',
  'sciences', 'histoire', 'voyages', 'animaux', 'technologie',
  'manga', 'danse', 'théâtre', 'écriture', 'jardinage',
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

// ─── Main component ────────────────────────────────────────────────────────

type Tab = 'chatbot' | 'manual' | 'list';

export function PersonaPage() {
  const { state, createPersona, dispatch } = useGame();
  const { currentUser, personas } = state;

  const [tab, setTab] = useState<Tab>('chatbot');
  // All personas from the same class (visible to classmates)
  const classPersonas = personas.filter(p => p.classId === (currentUser?.classId || 'default'));
  const myPersonas = classPersonas.filter(p => p.createdBy === currentUser?.id);

  const deletePersona = (id: string) => {
    if (confirm('Supprimer ce personnage ?')) {
      dispatch({ type: 'DELETE_PERSONA', payload: id });
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="scanline"></div>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link to="/" className="retro-text-cyan hover:glow-text text-lg">
              {'<'} Retour au menu
            </Link>
            <h1 className="text-2xl mt-2 glow-text" style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '16px' }}>
              CREATION DE PERSONNAGE
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <button
            onClick={() => setTab('chatbot')}
            className={`retro-btn ${tab === 'chatbot' ? '' : 'retro-btn-amber'}`}
          >
            Chatbot
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`retro-btn ${tab === 'manual' ? '' : 'retro-btn-amber'}`}
          >
            Formulaire
          </button>
          <button
            onClick={() => setTab('list')}
            className={`retro-btn ${tab === 'list' ? '' : 'retro-btn-amber'}`}
          >
            Personnages de la classe ({classPersonas.length})
          </button>
        </div>

        {tab === 'chatbot' && (
          <ChatbotCreator
            classId={currentUser?.classId || 'default'}
            onSaved={() => setTab('list')}
            createPersona={createPersona}
          />
        )}

        {tab === 'manual' && (
          <ManualCreator
            classId={currentUser?.classId || 'default'}
            onSaved={() => setTab('list')}
            createPersona={createPersona}
          />
        )}

        {tab === 'list' && (
          <RetroContainer title="PERSONNAGES DE LA CLASSE">
            {classPersonas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xl retro-text-amber mb-4">Aucun personnage créé dans ta classe</p>
                <p className="text-lg mb-4">Utilise le chatbot ou le formulaire pour créer le premier !</p>
                <button onClick={() => setTab('chatbot')} className="retro-btn retro-btn-magenta">
                  Créer un personnage
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {classPersonas.map(persona => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    onDelete={persona.createdBy === currentUser?.id ? () => deletePersona(persona.id) : undefined}
                  />
                ))}
              </div>
            )}
          </RetroContainer>
        )}
      </div>
    </div>
  );
}

// ─── Chatbot creator ────────────────────────────────────────────────────────

function ChatbotCreator({
  classId,
  onSaved,
  createPersona,
}: {
  classId: string;
  onSaved: () => void;
  createPersona: (p: Omit<Persona, 'id' | 'createdAt' | 'createdBy'>) => void;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([
    { id: uuidv4(), content: OPENING_MESSAGE, isFromUser: false },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canFinish, setCanFinish] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState<Omit<Persona, 'id' | 'createdAt' | 'createdBy' | 'classId'> | null>(null);
  const [saved, setSaved] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isLoading]);

  const userMessageCount = messages.filter(m => m.isFromUser).length;
  useEffect(() => {
    if (userMessageCount >= 5 && !canFinish) setCanFinish(true);
  }, [userMessageCount, canFinish]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ConversationMessage = { id: uuidv4(), content: text, isFromUser: true };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(PERSONA_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          conversationHistory: updated.map(m => ({ content: m.content, isFromUser: m.isFromUser })),
          userMessage: text,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: uuidv4(),
        content: res.ok ? data.response : "Désolé, je n'arrive pas à répondre. Réessaie !",
        isFromUser: false,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        content: "Problème de connexion. Vérifie et réessaie.",
        isFromUser: false,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const finishCreation = async () => {
    setIsExtracting(true);
    setExtracted(null);
    try {
      const res = await fetch(PERSONA_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'extract',
          conversationHistory: messages.map(m => ({ content: m.content, isFromUser: m.isFromUser })),
        }),
      });
      const data = await res.json();
      const raw = data.response.replace(/```json?/gi, '').replace(/```/g, '').trim();
      setExtracted(JSON.parse(raw));
    } catch {
      alert("Erreur lors de la génération du personnage. Continue la conversation et réessaie.");
    } finally {
      setIsExtracting(false);
    }
  };

  const savePersona = () => {
    if (!extracted) return;
    createPersona({ ...extracted, classId });
    setSaved(true);
    setMessages([{ id: uuidv4(), content: OPENING_MESSAGE, isFromUser: false }]);
    setExtracted(null);
    setCanFinish(false);
    onSaved();
  };

  return (
    <>
      {saved && (
        <div className="retro-card retro-border-amber mb-4 text-center">
          <p className="retro-text-amber text-lg">Personnage sauvegardé !</p>
        </div>
      )}

      {extracted ? (
        <RetroContainer title="CONFIRMER LE PERSONNAGE" className="mb-6">
          <div className="space-y-3 text-lg">
            <p><span className="retro-text-cyan">Prénom :</span> {extracted.name}</p>
            <p><span className="retro-text-cyan">Âge :</span> {extracted.age} ans</p>
            <p><span className="retro-text-cyan">Description :</span> {extracted.description}</p>
            <p>
              <span className="retro-text-cyan">Traits :</span>{' '}
              {extracted.traits.map(t => <span key={t} className="retro-badge mr-1">{t}</span>)}
            </p>
            <p>
              <span className="retro-text-cyan">Intérêts :</span>{' '}
              {extracted.interests.map(i => <span key={i} className="retro-badge retro-text-magenta mr-1">{i}</span>)}
            </p>
            <p><span className="retro-text-cyan">Style :</span> {extracted.speakingStyle}</p>
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={savePersona} className="retro-btn flex-1">Sauvegarder</button>
            <button onClick={() => setExtracted(null)} className="retro-btn retro-btn-amber">
              Modifier (continuer)
            </button>
          </div>
        </RetroContainer>
      ) : (
        <RetroContainer title="CREATION PAR CHATBOT">
          <div
            ref={chatRef}
            className="chat-container mb-4"
            style={{ minHeight: '300px', maxHeight: '400px', overflowY: 'auto' }}
          >
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`chat-message mb-2 ${msg.isFromUser ? 'chat-message-sent' : 'chat-message-received'}`}
              >
                {!msg.isFromUser && (
                  <span className="text-xs retro-text-amber block mb-1">Assistant</span>
                )}
                <p className="text-lg whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            {isLoading && (
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              className="retro-input flex-1"
              placeholder="Décris ton personnage..."
              disabled={isLoading}
            />
            <button onClick={sendMessage} className="retro-btn" disabled={!input.trim() || isLoading}>
              Envoyer
            </button>
          </div>

          {canFinish ? (
            <button
              onClick={finishCreation}
              className="retro-btn retro-btn-magenta w-full"
              disabled={isExtracting}
            >
              {isExtracting ? 'Génération du personnage...' : "J'ai terminé — Créer le personnage"}
            </button>
          ) : (
            <p className="text-sm retro-text-amber text-center opacity-70">
              Continue la conversation — le bouton de finalisation apparaîtra bientôt.
            </p>
          )}
        </RetroContainer>
      )}
    </>
  );
}

// ─── Manual form creator ────────────────────────────────────────────────────

function ManualCreator({
  classId,
  onSaved,
  createPersona,
}: {
  classId: string;
  onSaved: () => void;
  createPersona: (p: Omit<Persona, 'id' | 'createdAt' | 'createdBy'>) => void;
}) {
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
      classId,
    });
    setName(''); setAge(16); setDescription('');
    setTraits([]); setInterests([]); setSpeakingStyle('');
    onSaved();
  };

  const toggleTrait = (t: string) =>
    setTraits(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const toggleInterest = (i: string) =>
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

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

  return (
    <RetroContainer title="CREATION MANUELLE">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-lg">{'>'} Prénom :</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="retro-input"
              placeholder="Ex: Naïma, Lucas, Chloé..."
              required
            />
          </div>
          <div>
            <label className="block mb-2 text-lg">{'>'} Âge (14-19) :</label>
            <input
              type="number"
              value={age}
              onChange={e => setAge(parseInt(e.target.value))}
              className="retro-input"
              min={14}
              max={19}
            />
          </div>
        </div>

        <div>
          <label className="block mb-2 text-lg">{'>'} Description :</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="retro-textarea"
            placeholder="Ex: Lycéen en première, passionné de musique..."
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
                  traits.includes(trait) ? 'bg-[#00ff41] text-black' : 'hover:border-[#00ff41]'
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
              onChange={e => setCustomTrait(e.target.value)}
              className="retro-input flex-1"
              placeholder="Trait personnalisé..."
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTrait())}
            />
            <button type="button" onClick={addCustomTrait} className="retro-btn">+</button>
          </div>
          {traits.filter(t => !TRAIT_SUGGESTIONS.includes(t)).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {traits.filter(t => !TRAIT_SUGGESTIONS.includes(t)).map(trait => (
                <span key={trait} className="retro-badge bg-[#00ff41] text-black">
                  {trait} <button type="button" onClick={() => toggleTrait(trait)}>×</button>
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
              onChange={e => setCustomInterest(e.target.value)}
              className="retro-input flex-1"
              placeholder="Intérêt personnalisé..."
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomInterest())}
            />
            <button type="button" onClick={addCustomInterest} className="retro-btn retro-btn-magenta">+</button>
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
            onChange={e => setSpeakingStyle(e.target.value)}
            className="retro-textarea"
            placeholder="Décrivez comment ce personnage s'exprime..."
          />
        </div>

        {name && (
          <div className="retro-card retro-border-amber">
            <p className="retro-text-amber mb-2">Aperçu :</p>
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
            Créer le personnage
          </button>
        </div>
      </form>
    </RetroContainer>
  );
}

// ─── Persona card ───────────────────────────────────────────────────────────

function PersonaCard({ persona, onDelete }: { persona: Persona; onDelete?: () => void }) {
  return (
    <div className="retro-card">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl glow-text">{persona.name}, {persona.age} ans</h3>
          <p className="retro-text-amber mt-2">{persona.description}</p>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="retro-btn retro-btn-amber text-sm">×</button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {persona.traits.map(trait => (
          <span key={trait} className="retro-badge text-sm">{trait}</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {persona.interests.map(interest => (
          <span key={interest} className="retro-badge retro-text-magenta text-sm">{interest}</span>
        ))}
      </div>
      {persona.speakingStyle && (
        <p className="mt-3 text-sm retro-text-cyan">Style : {persona.speakingStyle}</p>
      )}
    </div>
  );
}
