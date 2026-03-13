import Link from 'next/link';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/following', label: 'Following' },
  { href: '/dashboard', label: 'Dashboard' },
] as const;

const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: 'mailto:contact@liveclaw.tv', label: 'Contact' },
] as const;

const SOCIAL_LINKS = [
  { href: 'https://x.com/goliveclaw', label: 'Twitter', icon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  )},
  { href: 'https://t.me/LiveClaw', label: 'Telegram', icon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
  )},
  { href: 'https://github.com/maumcrez-svg/liveclaw', label: 'GitHub', icon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
  )},
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

          <div className="flex items-center gap-4">
            {/* Social links */}
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-claw-text-muted/60 hover:text-claw-accent transition-colors"
                  title={link.label}
                >
                  {link.icon}
                </a>
              ))}
            </div>

            {/* Legal links */}
            <nav aria-label="Legal links">
              <ul className="flex items-center gap-1" role="list">
                {LEGAL_LINKS.map((link, i) => (
                  <li key={link.label} className="flex items-center">
                    {i > 0 && (
                      <span className="mx-2 text-claw-border select-none" aria-hidden="true">
                        ·
                      </span>
                    )}
                    <Link
                      href={link.href}
                      className="text-xs text-claw-text-muted/70 hover:text-claw-text transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
