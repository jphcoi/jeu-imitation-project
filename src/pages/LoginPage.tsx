import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RetroContainer } from '../components/RetroContainer';

export function LoginPage() {
  const [pseudo, setPseudo] = useState('');
  const [classId, setClassId] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const { login } = useGame();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pseudo.trim()) {
      login(pseudo.trim(), role, classId.trim() || undefined);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="scanline"></div>

      <RetroContainer title="CONNEXION - JEU DE L'IMITATION" className="w-full max-w-md">
        <div className="text-center mb-8">
          <pre className="text-xs leading-tight mb-4 retro-text-amber">
{`
    ████████╗██╗   ██╗██████╗ ██╗███╗   ██╗ ██████╗
    ╚══██╔══╝██║   ██║██╔══██╗██║████╗  ██║██╔════╝
       ██║   ██║   ██║██████╔╝██║██╔██╗ ██║██║  ███╗
       ██║   ██║   ██║██╔══██╗██║██║╚██╗██║██║   ██║
       ██║   ╚██████╔╝██║  ██║██║██║ ╚████║╚██████╔╝
       ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝
`}
          </pre>
          <p className="text-xl glow-text">
            Bienvenue, Détective.
          </p>
          <p className="text-sm retro-text-amber mt-2">
            Saurez-vous distinguer l'humain de la machine ?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2 text-lg">
              {'>'} PSEUDONYME :
            </label>
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              className="retro-input"
              placeholder="Entrez votre pseudo..."
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block mb-2 text-lg">
              {'>'} CLASSE / GROUPE :
            </label>
            <input
              type="text"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="retro-input"
              placeholder="Ex: 1ère-S2, TermG..."
            />
          </div>

          <div>
            <label className="block mb-2 text-lg">
              {'>'} RÔLE :
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={role === 'student'}
                  onChange={() => setRole('student')}
                  className="w-4 h-4 accent-[#00ff41]"
                />
                <span className="text-lg">Élève</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="teacher"
                  checked={role === 'teacher'}
                  onChange={() => setRole('teacher')}
                  className="w-4 h-4 accent-[#00ff41]"
                />
                <span className="text-lg">Enseignant</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="retro-btn w-full mt-6"
            disabled={!pseudo.trim()}
          >
            [ ENTRER ]
          </button>
        </form>

        <div className="mt-8 text-center text-sm retro-text-cyan">
          <p>Version 1.0 - Test de Turing Éducatif</p>
          <p className="mt-1 opacity-70">
            "La question n'est pas si les machines peuvent penser,
            <br />mais si vous pouvez les reconnaître."
          </p>
        </div>
      </RetroContainer>
    </div>
  );
}
