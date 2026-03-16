export type AlertType = 'follow' | 'subscription' | 'donation';

export interface StreamAlert {
  id: string;
  type: AlertType;
  username: string;
  tier?: string;
  amount?: number;
  currency?: string;
  message?: string;
  timestamp: string;
}

export interface AlertConfig {
  enabled: boolean;
  duration: number; // ms
  volume: number; // 0–1
  asset: string; // image path
}

export const ALERT_CONFIGS: Record<AlertType, AlertConfig> = {
  follow: {
    enabled: true,
    duration: 4000,
    asset: '/alerts/follow.png',
    volume: 0.5,
  },
  subscription: {
    enabled: true,
    duration: 5000,
    asset: '/alerts/subscriber.png',
    volume: 0.6,
  },
  donation: {
    enabled: true,
    duration: 6000,
    asset: '/alerts/donation.png',
    volume: 0.7,
  },
};

// ---------------------------------------------------------------------------
// Procedural audio via Web Audio API — no external files required
// ---------------------------------------------------------------------------

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

/** Plays a sine-wave note. Returns when the note is done (or immediately on error). */
function playNote(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function playAlertSound(type: AlertType, volume: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const v = Math.max(0, Math.min(1, volume));

  try {
    if (type === 'follow') {
      // Quick ascending two-note chime (C5 → E5)
      playNote(ctx, 523.25, now, 0.25, v * 0.6, 'sine');
      playNote(ctx, 659.25, now + 0.18, 0.35, v * 0.7, 'sine');
    } else if (type === 'subscription') {
      // Richer ascending chord (C5 → E5 → G5)
      playNote(ctx, 523.25, now, 0.3, v * 0.5, 'sine');
      playNote(ctx, 659.25, now + 0.15, 0.3, v * 0.55, 'sine');
      playNote(ctx, 783.99, now + 0.3, 0.45, v * 0.65, 'sine');
      // Subtle harmonic shimmer
      playNote(ctx, 1046.5, now + 0.3, 0.25, v * 0.2, 'triangle');
    } else if (type === 'donation') {
      // Coin-like metallic burst + sparkle tail
      playNote(ctx, 1200, now, 0.08, v * 0.7, 'square');
      playNote(ctx, 1500, now + 0.06, 0.06, v * 0.5, 'square');
      playNote(ctx, 1800, now + 0.1, 0.05, v * 0.4, 'square');
      // Sparkle
      playNote(ctx, 2400, now + 0.14, 0.15, v * 0.25, 'sine');
      playNote(ctx, 3200, now + 0.2, 0.12, v * 0.15, 'sine');
      // Warm resolution note
      playNote(ctx, 783.99, now + 0.22, 0.4, v * 0.45, 'sine');
    }
  } catch {
    // Web Audio can fail silently in some browser contexts — that's fine
  }
}
