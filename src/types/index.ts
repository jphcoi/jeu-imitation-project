export interface User {
  id: string;
  pseudo: string;
  role: 'student' | 'teacher' | 'admin';
  schoolId?: string;
  classId?: string;
  email?: string;
  password?: string;
  isGuest?: boolean;
  createdAt: Date;
}

export interface Persona {
  id: string;
  name: string;
  age: number;
  description: string;
  traits: string[];
  interests: string[];
  speakingStyle: string;
  createdBy: string;
  classId: string;
  createdAt: Date;
  isDefault?: boolean;
  credibilityScore?: number;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: Date;
  isFromAI: boolean;
}

export type GameMode = 'solo' | 'multiplayer';

export interface ChatSession {
  id: string;
  enqueteurId: string;
  humanResponderId?: string;
  personaIdA: string; // Persona used by chat A (AI)
  personaIdB: string; // Persona used by chat B (AI or human)
  gameMode: GameMode;
  messages: {
    chatA: Message[];
    chatB: Message[];
  };
  startTime: Date;
  endTime?: Date;
  duration: number; // en secondes, max 300 (5 min)
  status: 'waiting' | 'active' | 'voting' | 'completed';
  aiIsInChat: 'A' | 'B' | 'both'; // Where is the AI
  humanChat?: 'A' | 'B'; // Which chat the human player is in (multiplayer only)
}

export interface Vote {
  id: string;
  sessionId: string;
  enqueteurId: string;
  votedChat: 'A' | 'B'; // Le chat que l'enquêteur pense être l'IA
  justification: string;
  isCorrect?: boolean;
  timestamp: Date;
}

export interface EnqueteurScore {
  userId: string;
  pseudo: string;
  totalSessions: number;
  correctDetections: number;
  bonusPoints: number;
  creatorBonusPoints: number; // bonus earned from own personas fooling enquêteurs 3× in a row
  totalPoints: number;
  reliabilityIndex: number;
}

export interface PersonaScore {
  personaId: string;
  personaName: string;
  classId: string;
  totalSessions: number;
  timesDetectedAsAI: number;
  credibilityIndex: number;
  consecutiveWins: number;       // current unbroken win streak
  bonusPointsEarned: number;     // total bonus points this persona earned for its creator
  qualitativeNotes: string[];
}

export interface WaitingRoom {
  id: string;
  code: string;
  hostId: string;
  hostPseudo: string;
  guestId?: string;
  guestPseudo?: string;
  personaIdA: string;
  personaIdB: string;
  status: 'waiting' | 'ready' | 'started' | 'expired';
  createdAt: Date;
}

export interface GameState {
  currentUser: User | null;
  knownUsers: User[]; // For persistent login
  personas: Persona[];
  sessions: ChatSession[];
  votes: Vote[];
  enqueteurScores: EnqueteurScore[];
  personaScores: PersonaScore[];
  apiUsage: { promptTokens: number; completionTokens: number };
}
