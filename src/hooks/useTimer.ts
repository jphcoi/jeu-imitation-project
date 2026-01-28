import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerReturn {
  timeLeft: number;
  isRunning: boolean;
  isExpired: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  formatTime: () => string;
}

export function useTimer(initialSeconds: number = 300): UseTimerReturn {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return clearTimer;
  }, [isRunning, clearTimer]);

  const start = useCallback(() => {
    if (timeLeft > 0) {
      setIsRunning(true);
    }
  }, [timeLeft]);

  const pause = useCallback(() => {
    setIsRunning(false);
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    setIsRunning(false);
    clearTimer();
    setTimeLeft(initialSeconds);
  }, [initialSeconds, clearTimer]);

  const formatTime = useCallback((): string => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  return {
    timeLeft,
    isRunning,
    isExpired: timeLeft === 0,
    start,
    pause,
    reset,
    formatTime,
  };
}
