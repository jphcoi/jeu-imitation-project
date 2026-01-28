import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, Persona, ChatSession, Vote, EnqueteurScore, PersonaScore, GameState } from '../types';
import { v4 as uuidv4 } from 'uuid';

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'LOGOUT' }
  | { type: 'ADD_PERSONA'; payload: Persona }
  | { type: 'UPDATE_PERSONA'; payload: Persona }
  | { type: 'DELETE_PERSONA'; payload: string }
  | { type: 'ADD_SESSION'; payload: ChatSession }
  | { type: 'UPDATE_SESSION'; payload: ChatSession }
  | { type: 'ADD_VOTE'; payload: Vote }
  | { type: 'UPDATE_SCORES' }
  | { type: 'LOAD_STATE'; payload: GameState };

const initialState: GameState = {
  currentUser: null,
  personas: [],
  sessions: [],
  votes: [],
  enqueteurScores: [],
  personaScores: [],
};

function calculateEnqueteurScores(sessions: ChatSession[], votes: Vote[], _users: User[]): EnqueteurScore[] {
  const scoreMap = new Map<string, EnqueteurScore>();

  votes.forEach(vote => {
    const session = sessions.find(s => s.id === vote.sessionId);
    if (!session || session.status !== 'completed') return;

    const isCorrect = (vote.votedChat === session.aiIsInChat);

    if (!scoreMap.has(vote.enqueteurId)) {
      scoreMap.set(vote.enqueteurId, {
        userId: vote.enqueteurId,
        pseudo: vote.enqueteurId,
        totalSessions: 0,
        correctDetections: 0,
        bonusPoints: 0,
        totalPoints: 0,
        reliabilityIndex: 0,
      });
    }

    const score = scoreMap.get(vote.enqueteurId)!;
    score.totalSessions++;

    if (isCorrect) {
      score.correctDetections++;
      score.totalPoints += 2;

      if (vote.justification && vote.justification.length > 50) {
        score.bonusPoints++;
        score.totalPoints++;
      }
    }

    score.reliabilityIndex = score.totalSessions > 0
      ? (score.correctDetections / score.totalSessions) * 100
      : 0;
  });

  return Array.from(scoreMap.values());
}

function calculatePersonaScores(sessions: ChatSession[], votes: Vote[], personas: Persona[]): PersonaScore[] {
  const scoreMap = new Map<string, PersonaScore>();

  personas.forEach(persona => {
    scoreMap.set(persona.id, {
      personaId: persona.id,
      personaName: persona.name,
      classId: persona.classId,
      totalSessions: 0,
      timesDetectedAsAI: 0,
      credibilityIndex: 100,
      qualitativeNotes: [],
    });
  });

  sessions.forEach(session => {
    if (session.status !== 'completed') return;

    const score = scoreMap.get(session.personaId);
    if (!score) return;

    score.totalSessions++;

    const vote = votes.find(v => v.sessionId === session.id);
    if (vote && vote.votedChat === session.aiIsInChat) {
      score.timesDetectedAsAI++;
    }

    score.credibilityIndex = score.totalSessions > 0
      ? ((score.totalSessions - score.timesDetectedAsAI) / score.totalSessions) * 100
      : 100;
  });

  return Array.from(scoreMap.values());
}

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, currentUser: action.payload };

    case 'LOGOUT':
      return { ...state, currentUser: null };

    case 'ADD_PERSONA':
      return { ...state, personas: [...state.personas, action.payload] };

    case 'UPDATE_PERSONA':
      return {
        ...state,
        personas: state.personas.map(p =>
          p.id === action.payload.id ? action.payload : p
        ),
      };

    case 'DELETE_PERSONA':
      return {
        ...state,
        personas: state.personas.filter(p => p.id !== action.payload),
      };

    case 'ADD_SESSION':
      return { ...state, sessions: [...state.sessions, action.payload] };

    case 'UPDATE_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.id ? action.payload : s
        ),
      };

    case 'ADD_VOTE':
      const newVotes = [...state.votes, action.payload];
      return {
        ...state,
        votes: newVotes,
        enqueteurScores: calculateEnqueteurScores(state.sessions, newVotes, []),
        personaScores: calculatePersonaScores(state.sessions, newVotes, state.personas),
      };

    case 'UPDATE_SCORES':
      return {
        ...state,
        enqueteurScores: calculateEnqueteurScores(state.sessions, state.votes, []),
        personaScores: calculatePersonaScores(state.sessions, state.votes, state.personas),
      };

    case 'LOAD_STATE':
      return action.payload;

    default:
      return state;
  }
}

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  login: (pseudo: string, role: 'student' | 'teacher', classId?: string) => void;
  logout: () => void;
  createPersona: (persona: Omit<Persona, 'id' | 'createdAt' | 'createdBy'>) => void;
  startSession: (personaId: string) => ChatSession;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const STORAGE_KEY = 'jeu-imitation-state';

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_STATE', payload: parsed });
      } catch (e) {
        console.error('Erreur lors du chargement des données:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = (pseudo: string, role: 'student' | 'teacher', classId?: string) => {
    const user: User = {
      id: uuidv4(),
      pseudo,
      role,
      classId,
      createdAt: new Date(),
    };
    dispatch({ type: 'SET_USER', payload: user });
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  const createPersona = (personaData: Omit<Persona, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!state.currentUser) return;

    const persona: Persona = {
      ...personaData,
      id: uuidv4(),
      createdBy: state.currentUser.id,
      createdAt: new Date(),
    };
    dispatch({ type: 'ADD_PERSONA', payload: persona });
  };

  const startSession = (personaId: string): ChatSession => {
    const session: ChatSession = {
      id: uuidv4(),
      enqueteurId: state.currentUser?.id || '',
      personaId,
      messages: { chatA: [], chatB: [] },
      startTime: new Date(),
      duration: 300,
      status: 'active',
      aiIsInChat: Math.random() > 0.5 ? 'A' : 'B',
    };
    dispatch({ type: 'ADD_SESSION', payload: session });
    return session;
  };

  return (
    <GameContext.Provider value={{ state, dispatch, login, logout, createPersona, startSession }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
