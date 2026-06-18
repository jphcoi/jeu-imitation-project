import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { PersonaPage } from './pages/PersonaPage';
import { PlayPage } from './pages/PlayPage';
import { ScoresPage } from './pages/ScoresPage';
import { DashboardPage } from './pages/DashboardPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useGame();

  if (!state.currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { state } = useGame();

  if (!state.currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (state.currentUser.role !== 'teacher' && state.currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { state } = useGame();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          state.currentUser ? <Navigate to="/" replace /> : <LoginPage />
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {(state.currentUser?.role === 'teacher' || state.currentUser?.role === 'admin') ? <Navigate to="/dashboard" replace /> : <HomePage />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/lobby"
        element={
          <ProtectedRoute>
            <LobbyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/personas"
        element={
          <ProtectedRoute>
            <PersonaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/play"
        element={
          <ProtectedRoute>
            <PlayPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scores"
        element={
          <ProtectedRoute>
            <ScoresPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <TeacherRoute>
            <DashboardPage />
          </TeacherRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <div className="crt-effect">
          <AppRoutes />
        </div>
      </GameProvider>
    </BrowserRouter>
  );
}

export default App;
