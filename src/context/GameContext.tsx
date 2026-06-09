import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, Persona, ChatSession, Vote, EnqueteurScore, PersonaScore, GameState } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_PERSONAS } from '../utils/defaultPersonas';

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
  | { type: 'SEED_DEFAULTS' }
  | { type: 'LOAD_STATE'; payload: GameState };

const initialState: GameState = {
  currentUser: null,
  knownUsers: [],
  personas: [],
  sessions: [],
  votes: [],
  enqueteurScores: [],
  personaScores: [],
};

function calculateEnqueteurScores(sessions: ChatSession[], votes: Vote[], knownUsers: User[]): EnqueteurScore[] {
  const scoreMap = new Map<string, EnqueteurScore>();

  votes.forEach(vote => {
    const session = sessions.find(s => s.id === vote.sessionId);
    if (!session || session.status !== 'completed') return;

    // In 'both' mode, vote is correct if they picked either A or B (both are AI)
    // In 'A' or 'B' mode, vote is correct if they picked the right one
    let isCorrect = false;
    if (session.aiIsInChat === 'both') {
      // In solo mode both are AI, so the question is: did they pick the "worse" AI?
      // For scoring, any vote is "correct" since both are AI - give points
      isCorrect = true;
    } else {
      isCorrect = vote.votedChat === session.aiIsInChat;
    }

    if (!scoreMap.has(vote.enqueteurId)) {
      const user = knownUsers.find(u => u.id === vote.enqueteurId);
      scoreMap.set(vote.enqueteurId, {
        userId: vote.enqueteurId,
        pseudo: user?.pseudo || vote.enqueteurId,
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

    // Update both personas used in the session
    [session.personaIdA, session.personaIdB].forEach(pid => {
      const score = scoreMap.get(pid);
      if (score) {
        score.totalSessions++;
      }
    });

    const vote = votes.find(v => v.sessionId === session.id);
    if (vote) {
      const detectedPersonaId = vote.votedChat === 'A' ? session.personaIdA : session.personaIdB;
      const detectedScore = scoreMap.get(detectedPersonaId);
      if (detectedScore) {
        detectedScore.timesDetectedAsAI++;
      }
    }
  });

  scoreMap.forEach(score => {
    score.credibilityIndex = score.totalSessions > 0
      ? ((score.totalSessions - score.timesDetectedAsAI) / score.totalSessions) * 100
      : 100;
  });

  return Array.from(scoreMap.values());
}

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_USER': {
      if (!action.payload) return { ...state, currentUser: null };
      // Add to known users if not already there
      const exists = state.knownUsers.some(u => u.id === action.payload!.id);
      return {
        ...state,
        currentUser: action.payload,
        knownUsers: exists ? state.knownUsers : [...state.knownUsers, action.payload],
      };
    }

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

    case 'ADD_VOTE': {
      const newVotes = [...state.votes, action.payload];
      return {
        ...state,
        votes: newVotes,
        enqueteurScores: calculateEnqueteurScores(state.sessions, newVotes, state.knownUsers),
        personaScores: calculatePersonaScores(state.sessions, newVotes, state.personas),
      };
    }

    case 'UPDATE_SCORES':
      return {
        ...state,
        enqueteurScores: calculateEnqueteurScores(state.sessions, state.votes, state.knownUsers),
        personaScores: calculatePersonaScores(state.sessions, state.votes, state.personas),
      };

    case 'SEED_DEFAULTS': {
      const existingDefaultIds = state.personas.filter(p => p.isDefault).map(p => p.id);
      const newDefaults = DEFAULT_PERSONAS.filter(d => !existingDefaultIds.includes(d.id));
      return {
        ...state,
        personas: [...state.personas, ...newDefaults],
      };
    }

    case 'LOAD_STATE':
      return action.payload;

    default:
      return state;
  }
}

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  login: (pseudo: string, role: 'student' | 'teacher', classId?: string, schoolId?: string) => void;
  logout: () => void;
  createPersona: (persona: Omit<Persona, 'id' | 'createdAt' | 'createdBy'>) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const STORAGE_KEY = 'jeu-imitation-state';

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Load saved state on mount
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
    // Always seed defaults (will skip if already present)
    dispatch({ type: 'SEED_DEFAULTS' });
  }, []);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = (pseudo: string, role: 'student' | 'teacher', classId?: string, schoolId?: string) => {
    const existingUser = state.knownUsers.find(
      u =>
        u.pseudo.toLowerCase() === pseudo.toLowerCase() &&
        u.classId === (classId || undefined) &&
        u.schoolId === (schoolId || undefined)
    );

    if (existingUser) {
      // Always apply the role chosen at login — user may switch between élève and enseignant
      dispatch({ type: 'SET_USER', payload: { ...existingUser, role } });
    } else {
      const user: User = {
        id: uuidv4(),
        pseudo,
        role,
        schoolId,
        classId,
        createdAt: new Date(),
      };
      dispatch({ type: 'SET_USER', payload: user });
    }
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

  return (
    <GameContext.Provider value={{ state, dispatch, login, logout, createPersona }}>
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
