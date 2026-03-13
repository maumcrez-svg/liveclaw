'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

export default function AgentDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { agentSlug: string };
}) {
  const pathname = usePathname();
  const { isLoggedIn } = useUser();
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    api(`/agents/${params.agentSlug}/private`)
      .then((a) => setAgentName(a.name))
      .catch(() => {});
  }, [isLoggedIn, params.agentSlug]);

  const basePath = `/dashboard/${params.agentSlug}`;

  const links = [
    { href: basePath, label: 'Overview', icon: ChartIcon },
    { href: `${basePath}/stream`, label: 'Stream', icon: PlayIcon },
    { href: `${basePath}/settings`, label: 'Settings', icon: GearIcon },
    { href: `${basePath}/earnings`, label: 'Earnings', icon: DollarIcon },
    { href: `${basePath}/moderation`, label: 'Moderation', icon: ShieldIcon },
    { href: `/${params.agentSlug}`, label: 'View Channel', icon: ExternalIcon, external: true },
  ];

  const isActive = (href: string, external?: boolean) => {
    if (external) return false;
    if (href === basePath) return pathname === basePath;
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Mobile: horizontal tab bar */}
      <div className="md:hidden flex overflow-x-auto border-b border-claw-border bg-claw-surface flex-shrink-0">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive(link.href, link.external)
                ? 'border-claw-accent text-claw-accent'
                : 'border-transparent text-claw-text-muted hover:text-claw-text'
            }`}
          >
            <link.icon className="w-4 h-4" />
            {link.label}
          </Link>
        ))}
      </div>

      {/* Desktop: sub-sidebar */}
      <div className="hidden md:flex flex-col w-[200px] bg-claw-surface border-r border-claw-border flex-shrink-0">
        {/* Agent name header */}
        <div className="p-4 border-b border-claw-border">
          <Link href="/dashboard" className="text-xs text-claw-text-muted hover:text-claw-text transition-colors">
            &larr; All Agents
          </Link>
          {agentName && (
            <p className="text-sm font-semibold mt-1 truncate">{agentName}</p>
          )}
        </div>

        <nav className="flex-1 py-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                isActive(link.href, link.external)
                  ? 'bg-claw-card text-claw-accent font-medium'
                  : 'text-claw-text-muted hover:bg-claw-card hover:text-claw-text'
              }`}
            >
              <link.icon className="w-4 h-4 flex-shrink-0" />
              {link.label}
              {link.external && (
                <svg className="w-3 h-3 ml-auto opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
