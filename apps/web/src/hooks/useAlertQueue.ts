'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { StreamAlert, ALERT_CONFIGS } from '@/lib/alerts';
import { playAlertSound } from '@/lib/alerts';

export type AlertPhase = 'enter' | 'hold' | 'exit' | 'idle';

export function useAlertQueue() {
  const queueRef = useRef<StreamAlert[]>([]);
  const [currentAlert, setCurrentAlert] = useState<StreamAlert | null>(null);
  const [phase, setPhase] = useState<AlertPhase>('idle');
  // Track whether we're mid-sequence to avoid double-starting
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const processNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      setCurrentAlert(null);
      setPhase('idle');
      activeRef.current = false;
      return;
    }

    const next = queueRef.current.shift()!;
    const config = ALERT_CONFIGS[next.type];

    if (!config?.enabled) {
      // Skip disabled types and try the next one immediately
      processNext();
      return;
    }

    activeRef.current = true;
    setCurrentAlert(next);
    setPhase('enter');

    // Play sound on enter
    try {
      playAlertSound(next.type, config.volume);
    } catch {
      // Ignore audio errors
    }

    // enter phase: 350ms → hold
    timerRef.current = setTimeout(() => {
      setPhase('hold');

      // hold phase: duration → exit
      timerRef.current = setTimeout(() => {
        setPhase('exit');

        // exit phase: 350ms → gap → next
        timerRef.current = setTimeout(() => {
          // 500ms gap between alerts
          timerRef.current = setTimeout(() => {
            processNext();
          }, 500);
        }, 350);
      }, config.duration);
    }, 350);
  }, []);

  const enqueue = useCallback(
    (alert: StreamAlert) => {
      queueRef.current.push(alert);
      if (!activeRef.current) {
        // Small debounce to batch rapid-fire events
        timerRef.current = setTimeout(() => processNext(), 100);
      }
    },
    [processNext],
  );

  const dismiss = useCallback(() => {
    clearTimer();
    setPhase('exit');
    timerRef.current = setTimeout(() => {
      processNext();
    }, 350);
  }, [processNext]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  return { currentAlert, phase, enqueue, dismiss };
}
