// ── Go Live celebration ──────────────────────────────────────────────
//
// Full-screen celebration overlay shown for 2.5s when stream goes live.
// Mascot bounces in, confetti-like particles, then fades out.

import React, { useEffect, useState } from 'react';
import mascotImg from '../assets/mascot-celebrate.png';

interface GoLiveCelebrationProps {
  agentName: string;
  onComplete: () => void;
}

export function GoLiveCelebration({ agentName, onComplete }: GoLiveCelebrationProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  useEffect(() => {
    // Enter → show
    const t1 = setTimeout(() => setPhase('show'), 100);
    // Show → exit
    const t2 = setTimeout(() => setPhase('exit'), 2000);
    // Exit → complete
    const t3 = setTimeout(onComplete, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === 'exit' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(ellipse at center, rgba(255,107,0,0.08) 0%, rgba(245,245,247,0.98) 70%)',
      }}
    >
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 8,
              height: 4 + Math.random() * 8,
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              backgroundColor: ['#ff6b00', '#ff8533', '#eb0400', '#16a34a', '#f59e0b'][Math.floor(Math.random() * 5)],
              opacity: 0.3 + Math.random() * 0.4,
              animation: `float-particle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Mascot */}
      <div className={`transition-all duration-500 ${phase === 'enter' ? 'scale-0 opacity-0' : 'animate-bounce-in'}`}>
        <img
          src={mascotImg}
          alt="Celebration!"
          className="w-40 h-40 drop-shadow-2xl"
          draggable={false}
        />
      </div>

      {/* Text */}
      <div className={`text-center mt-6 transition-all duration-500 delay-300 ${
        phase === 'enter' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}>
        <h1 className="text-3xl font-bold text-studio-text">
          You're <span className="text-studio-accent">LIVE!</span>
        </h1>
        <p className="text-studio-muted mt-2 text-sm">
          {agentName} is now streaming on LiveClaw
        </p>
      </div>

      {/* Pulsing ring */}
      <div className={`mt-8 w-16 h-16 rounded-full border-2 border-studio-accent animate-pulse-glow transition-all duration-500 delay-500 ${
        phase === 'enter' ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
      }`}>
        <div className="w-full h-full rounded-full bg-studio-accent/10 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-studio-live animate-ping" />
        </div>
      </div>

      {/* CSS for floating particles */}
      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
}
