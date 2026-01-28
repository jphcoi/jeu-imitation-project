export interface User {
  id: string;
  pseudo: string;
  role: 'student' | 'teacher';
  classId?: string;
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
  credibilityScore?: number;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: Date;
  isFromAI: boolean;
}

export interface ChatSession {
  id: string;
  enqueteurId: string;
  humanResponderId?: string;
  personaId: string;
  messages: {
    chatA: Message[];
    chatB: Message[];
  };
  startTime: Date;
  endTime?: Date;
  duration: number; // en secondes, max 300 (5 min)
  status: 'waiting' | 'active' | 'voting' | 'completed';
  aiIsInChat: 'A' | 'B'; // Dans quel chat est l'IA
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
  bonusPoints: number; // Points bonus pour justifications argumentées
  totalPoints: number;
  reliabilityIndex: number; // Indice de fiabilité Rᵢ
}

export interface PersonaScore {
  personaId: string;
  personaName: string;
  classId: string;
  totalSessions: number;
  timesDetectedAsAI: number;
  credibilityIndex: number; // Score IC
  qualitativeNotes: string[];
}

export interface GameState {
  currentUser: User | null;
  personas: Persona[];
  sessions: ChatSession[];
  votes: Vote[];
  enqueteurScores: EnqueteurScore[];
  personaScores: PersonaScore[];
}
