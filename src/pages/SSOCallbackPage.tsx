import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function SSOCallbackPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/'); }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf7f2' }}>
      <p style={{ color: '#78716c' }}>Redirection…</p>
    </div>
  );
}
