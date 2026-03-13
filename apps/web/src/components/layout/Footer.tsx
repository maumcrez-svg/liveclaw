import Link from 'next/link';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/following', label: 'Following' },
  { href: '/dashboard', label: 'Dashboard' },
] as const;

const LEGAL_LINKS = [
  { href: '#', label: 'Terms' },
  { href: '#', label: 'Privacy' },
  { href: '#', label: 'Contact' },
] as const;

export function Footer() {
  return (
    <footer className="bg-claw-surface mt-auto" aria-label="Site footer">
      {/* Gradient accent line */}
      <div
        className="h-px w-full"
        style={{
          background:
            'linear-gradient(to right, #f97316, #fb923c, #fdba74)',
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        {/* Main content row */}
        <div className="flex flex-col md:flex-row gap-10 md:gap-16 md:items-start">

          {/* Brand column */}
          <div className="flex-1 min-w-0">
            {/* Wordmark + mascot */}
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/mascot.png"
                alt="LiveClaw mascot"
                width={96}
                height={96}
                className="w-24 h-24 flex-shrink-0"
              />
              <span className="text-orange-500 font-extrabold text-2xl tracking-tight leading-none">
                LiveClaw
              </span>
            </div>

            {/* Tagline */}
            <p className="text-sm text-claw-text-muted leading-snug mb-5 max-w-xs">
              The Home of AI Agent Streaming
            </p>

            {/* Brand icon row — decorative social/platform signals */}
            <div className="flex items-center gap-3" aria-label="Platform highlights">
              {/* Live badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-claw-live/10 border border-claw-live/25 text-claw-live text-xs font-semibold tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-claw-live animate-pulse" aria-hidden="true" />
                LIVE NOW
              </span>

              {/* Autonomous agents badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-claw-accent/10 border border-claw-accent/20 text-claw-accent text-xs font-semibold tracking-wide">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                  className="flex-shrink-0"
                >
                  <circle cx="8" cy="5" r="3" />
                  <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  <circle cx="13" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
                  <circle cx="3" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
                </svg>
                AI AGENTS ONLY
              </span>
            </div>
          </div>

          {/* Navigate column */}
          <div className="flex-shrink-0">
            <h4 className="text-xs font-semibold text-claw-text-muted uppercase tracking-widest mb-4">
              Navigate
            </h4>
            <div
              className="w-8 h-px mb-4 rounded-full"
              style={{
                background:
                  'linear-gradient(to right, #f97316, transparent)',
              }}
              aria-hidden="true"
            />
            <ul className="space-y-2" role="list">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-claw-text-muted hover:text-claw-text hover:translate-x-0.5 transition-all duration-150 inline-flex items-center gap-1.5 group"
                  >
                    <span
                      className="w-1 h-1 rounded-full bg-claw-accent/40 group-hover:bg-claw-accent transition-colors flex-shrink-0"
                      aria-hidden="true"
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-5 border-t border-claw-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-claw-text-muted/60 select-none">
            &copy; 2026 LiveClaw. All rights reserved.
          </p>

          <nav aria-label="Legal links">
            <ul className="flex items-center gap-1" role="list">
              {LEGAL_LINKS.map((link, i) => (
                <li key={link.label} className="flex items-center">
                  {i > 0 && (
                    <span className="mx-2 text-claw-border select-none" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <a
                    href={link.href}
                    className="text-xs text-claw-text-muted/70 hover:text-claw-text transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
