import type { Persona, Message } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DELAY_MIN = 800;
const DELAY_MAX = 3000;

const FILLER_PHRASES = [
  "Hmm, laisse-moi réfléchir...",
  "Alors...",
  "Euh, comment dire...",
  "Ben...",
  "En fait...",
  "Tu vois...",
  "Genre...",
];

const CASUAL_ENDINGS = [
  " lol",
  " mdr",
  " haha",
  " 😊",
  " 😅",
  "",
  "",
  "",
];

const TYPO_CHARS: Record<string, string[]> = {
  'a': ['q', 'z', 's'],
  'e': ['r', 'z', 'd'],
  'i': ['u', 'o', 'k'],
  'o': ['i', 'p', 'l'],
  'u': ['y', 'i', 'j'],
};

function addTypo(text: string, probability: number = 0.1): string {
  if (Math.random() > probability) return text;

  const chars = text.split('');
  const idx = Math.floor(Math.random() * chars.length);
  const char = chars[idx].toLowerCase();

  if (TYPO_CHARS[char]) {
    chars[idx] = TYPO_CHARS[char][Math.floor(Math.random() * TYPO_CHARS[char].length)];
  }

  return chars.join('');
}

function addCasualStyle(text: string): string {
  let result = text;

  if (Math.random() > 0.7) {
    result = result.charAt(0).toLowerCase() + result.slice(1);
  }

  if (Math.random() > 0.6 && !result.endsWith('?') && !result.endsWith('!')) {
    result = result.replace(/\.$/, '') + CASUAL_ENDINGS[Math.floor(Math.random() * CASUAL_ENDINGS.length)];
  }

  return result;
}

function generateContextualResponse(persona: Persona, question: string): string {
  const q = question.toLowerCase();

  if (q.includes('âge') || q.includes('age') || q.includes('ans')) {
    return `J'ai ${persona.age} ans`;
  }

  if (q.includes('prénom') || q.includes('appelle') || q.includes('nom')) {
    return `Moi c'est ${persona.name}`;
  }

  if (q.includes('passion') || q.includes('aime') || q.includes('hobby') || q.includes('temps libre')) {
    const interest = persona.interests[Math.floor(Math.random() * persona.interests.length)];
    const responses = [
      `J'adore ${interest}, j'y passe beaucoup de temps`,
      `En ce moment je suis à fond dans ${interest}`,
      `${interest}, c'est vraiment mon truc`,
      `Je kiffe ${interest} depuis longtemps`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (q.includes('école') || q.includes('cours') || q.includes('matière') || q.includes('lycée')) {
    const responses = [
      "Ça dépend des jours, y'a des cours qui me saoulent",
      "C'est ok, rien d'extraordinaire",
      "J'aime bien certaines matières, d'autres moins",
      "Le lycée c'est le lycée quoi",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (q.includes('week') || q.includes('samedi') || q.includes('dimanche') || q.includes('vacances')) {
    const interest = persona.interests[Math.floor(Math.random() * persona.interests.length)];
    const responses = [
      `En général je fais du ${interest} ou je traîne avec des potes`,
      `Ça dépend, des fois je reste chez moi, des fois je sors`,
      `J'essaie de profiter pour faire ce que j'aime`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (q.includes('musique') || q.includes('écoute') || q.includes('artiste')) {
    const responses = [
      "J'écoute un peu de tout, ça dépend de mon humeur",
      "En ce moment je suis sur du rap français surtout",
      "Pas de style particulier, je découvre des trucs sur Spotify",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (q.includes('film') || q.includes('série') || q.includes('netflix')) {
    const responses = [
      "Je regarde pas mal de trucs sur Netflix",
      "J'aime bien les séries, les films ça dépend",
      "En ce moment je suis sur une série trop bien",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (q.includes('comment ça va') || q.includes('ça va') || q.includes('tu vas')) {
    const responses = [
      "Ça va tranquille, et toi ?",
      "Ouais ça va, un peu fatigué",
      "Bien bien, et toi alors ?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (q.includes('pourquoi') || q.includes('comment')) {
    return `Bonne question... Je sais pas trop en fait, c'est comme ça`;
  }

  if (q.includes('robot') || q.includes('ia') || q.includes('intelligence artificielle') || q.includes('humain')) {
    const responses = [
      "Hein ? Pourquoi tu me demandes ça ?",
      "Euh non je suis un humain normal mdr",
      "C'est quoi cette question bizarre",
      "Tu me prends pour un robot ? 😅",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  const genericResponses = [
    "Pas trop en fait",
    "Ça dépend des fois",
    "Ouais je vois ce que tu veux dire",
    "Hmm je sais pas trop",
    "Bof, moyen",
    "C'est compliqué à expliquer",
    persona.description,
  ];

  return genericResponses[Math.floor(Math.random() * genericResponses.length)];
}

export async function generateAIResponse(
  persona: Persona,
  _conversationHistory: Message[],
  lastQuestion: string
): Promise<string> {
  const delay = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
  await new Promise(resolve => setTimeout(resolve, delay));

  let response = generateContextualResponse(persona, lastQuestion);

  if (Math.random() > 0.7) {
    const filler = FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)];
    response = filler + " " + response;
  }

  response = addCasualStyle(response);
  response = addTypo(response, 0.15);

  return response;
}

export function createAIMessage(content: string): Message {
  return {
    id: uuidv4(),
    content,
    senderId: 'ai',
    timestamp: new Date(),
    isFromAI: true,
  };
}
