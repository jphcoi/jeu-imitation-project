import type { ReactNode } from 'react';

interface RetroContainerProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function RetroContainer({ children, title, className = '' }: RetroContainerProps) {
  return (
    <div className={`retro-container ${className}`}>
      {title && (
        <div className="retro-title-bar">
          <span className="retro-title-text">{title}</span>
          <div className="retro-title-buttons">
            <span className="retro-btn-minimize">─</span>
            <span className="retro-btn-maximize">□</span>
            <span className="retro-btn-close">×</span>
          </div>
        </div>
      )}
      <div className="retro-content">
        {children}
      </div>
    </div>
  );
}
