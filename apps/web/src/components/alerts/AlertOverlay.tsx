'use client';

/**
 * AlertOverlay
 *
 * Renders a stream alert HUD over the video player area.
 * The HUD PNGs are transparent overlays with a baked-in golden banner.
 * Dynamic text (username, amount) is layered on top via absolute positioning.
 *
 * Coordinate system (relative to the displayed image):
 *  - The PNGs are displayed at width=460px, aspect ratio preserved.
 *  - Text bands are positioned as percentages so they scale naturally.
 *
 * Usage:
 *   <AlertOverlay currentAlert={currentAlert} phase={phase} onDismiss={dismiss} />
 */

import { useCallback } from 'react';
import { StreamAlert, AlertType } from '@/lib/alerts';
import { AlertPhase } from '@/hooks/useAlertQueue';

interface AlertOverlayProps {
  currentAlert: StreamAlert | null;
  phase: AlertPhase;
  onDismiss?: () => void;
}

// Text positioning (% of rendered image height from top) for each alert type.
// These values are tuned for the mascot HUD assets where the golden banner
// sits in the lower ~25% of the image.
const TEXT_LAYOUT: Record<
  AlertType,
  { username: { top: string }; amount?: { top: string } }
> = {
  follow: {
    username: { top: '56%' },
  },
  subscription: {
    username: { top: '56%' },
  },
  donation: {
    username: { top: '50%' },
    amount: { top: '68%' },
  },
};

function formatAmount(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function phaseClass(phase: AlertPhase): string {
  if (phase === 'enter') return 'alert-enter';
  if (phase === 'hold') return 'alert-hold';
  if (phase === 'exit') return 'alert-exit';
  return '';
}

export function AlertOverlay({ currentAlert, phase, onDismiss }: AlertOverlayProps) {
  if (!currentAlert || phase === 'idle') return null;

  const layout = TEXT_LAYOUT[currentAlert.type];
  const animClass = phaseClass(phase);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    // If the asset fails to load, hide the broken image element gracefully.
    (e.target as HTMLImageElement).style.visibility = 'hidden';
  }, []);

  return (
    /*
     * Positioned absolutely inside the player wrapper (which must be `relative`).
     * Sits at top-center, slightly inset from the top edge.
     */
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        className={`relative ${animClass}`}
        style={{ width: 460 }}
      >
        {/* HUD asset */}
        <img
          src={`/alerts/${currentAlert.type === 'subscription' ? 'subscriber' : currentAlert.type}.png`}
          alt=""
          role="presentation"
          draggable={false}
          onError={handleImageError}
          className="w-full h-auto block"
          style={{ maxWidth: 460 }}
        />

        {/* Dynamic text layer — absolutely positioned over the image */}
        <div className="absolute inset-0 flex flex-col" aria-label={`Alert: ${currentAlert.username}`}>
          {/* Username banner */}
          <div
            className="absolute left-0 right-0 flex items-center justify-center"
            style={{ top: layout.username.top }}
          >
            <span
              className="font-black tracking-wide"
              style={{
                fontSize: 'clamp(18px, 4.5cqw, 28px)',
                color: '#fff',
                textShadow:
                  '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 8px rgba(0,0,0,0.7)',
                letterSpacing: '0.06em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                maxWidth: '75%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
                transform: 'rotate(-4deg)',
              }}
            >
              {currentAlert.username}
            </span>
          </div>

          {/* Amount banner (donation only) */}
          {currentAlert.type === 'donation' && layout.amount && currentAlert.amount != null && (
            <div
              className="absolute left-0 right-0 flex items-center justify-center"
              style={{ top: layout.amount.top }}
            >
              <span
                className="font-black tracking-wide"
                style={{
                  fontSize: 'clamp(14px, 4.2cqw, 22px)',
                  color: '#1a3a00',
                  textShadow: '0 1px 0 rgba(160,255,120,0.5)',
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
                }}
              >
                {formatAmount(currentAlert.amount, currentAlert.currency)}
              </span>
            </div>
          )}
        </div>

        {/* Click-to-dismiss (pointer-events back on for optional dismiss) */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/40 text-white/70 hover:bg-black/70 hover:text-white flex items-center justify-center text-[10px] font-bold transition-colors pointer-events-auto focus:outline-none"
            title="Dismiss alert"
            aria-label="Dismiss alert"
            style={{ lineHeight: 1 }}
          >
            x
          </button>
        )}
      </div>
    </div>
  );
}
