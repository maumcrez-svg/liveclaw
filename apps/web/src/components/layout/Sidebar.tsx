'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { SearchBar } from './SearchBar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    exact: true,
  },
  {
    href: '/browse',
    label: 'Browse',
    icon: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    href: '/following',
    label: 'Following',
    icon: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    authRequired: true,
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
    authRequired: true,
  },
];

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, isLoggedIn, isCreator, setShowLoginModal, logout, becomeCreator } = useUser();
  const [agents, setAgents] = useState<any[]>([]);
  const [followedAgentIds, setFollowedAgentIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch(`${API_URL}/agents`);
        if (res.ok) setAgents(await res.json());
      } catch {}
    }
    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) {
      setFollowedAgentIds(new Set());
      return;
    }
    async function fetchFollows() {
      try {
        const res = await fetch(`${API_URL}/follows/user/${user!.id}`);
        if (res.ok) {
          const follows = await res.json();
          setFollowedAgentIds(new Set(follows.map((f: any) => f.agentId)));
        }
      } catch {}
    }
    fetchFollows();
    const interval = setInterval(fetchFollows, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const liveAgents = agents.filter((a) => a.status === 'live');
  const offlineAgents = agents.filter((a) => a.status !== 'live');
  const followedAgents = agents.filter((a) => followedAgentIds.has(a.id));
  const unfollowedLive = liveAgents.filter((a) => !followedAgentIds.has(a.id));
  const unfollowedOffline = offlineAgents.filter((a) => !followedAgentIds.has(a.id));

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const isNavActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const isChannelActive = (slug: string) => pathname === `/${slug}`;

  const renderAgent = (agent: any, isLive: boolean) => (
    <Link
      key={agent.id}
      href={`/${agent.slug}`}
      onClick={handleLinkClick}
      className={`flex items-center gap-2.5 px-3 py-1.5 transition-colors rounded-md mx-1.5 ${
        isChannelActive(agent.slug)
          ? 'bg-claw-card text-claw-text'
          : isLive
            ? 'hover:bg-claw-card/70'
            : 'opacity-50 hover:opacity-80 hover:bg-claw-card/40'
      }`}
    >
      <div className="relative flex-shrink-0">
        {agent.avatarUrl ? (
          <img
            src={agent.avatarUrl}
            alt={agent.name}
            className={`w-7 h-7 rounded-full object-cover ${!isLive ? 'grayscale' : ''}`}
          />
        ) : (
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              isLive
                ? 'bg-claw-accent/20 text-claw-accent'
                : 'bg-claw-card text-claw-text-muted'
            }`}
          >
            {agent.name[0]?.toUpperCase()}
          </div>
        )}
        {isLive && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-claw-live rounded-full border-2 border-claw-surface" />
        )}
      </div>
      {!collapsed && (
        <>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate leading-tight">{agent.name}</p>
            {isLive && (
              <p className="text-[11px] text-claw-text-muted truncate leading-tight">
                {agent.category?.name || agent.agentType}
              </p>
            )}
          </div>
          {isLive && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-claw-live" />
              <span className="text-[11px] text-claw-text-muted font-medium">
                {typeof agent.currentViewers === 'number'
                  ? agent.currentViewers.toLocaleString()
                  : '0'}
              </span>
            </div>
          )}
        </>
      )}
    </Link>
  );

  const sidebarContent = (
    <aside
      className={`${
        collapsed ? 'w-[50px]' : 'w-[240px]'
      } bg-claw-surface border-r border-claw-border flex flex-col transition-all duration-200 h-full flex-shrink-0`}
    >
      {/* Logo */}
      <div className="p-3 border-b border-claw-border flex items-center justify-between">
        {!collapsed ? (
          <Link href="/" onClick={handleLinkClick} className="flex items-center gap-2">
            <img src="/logo.png" alt="LiveClaw" className="w-7 h-7" />
            <span className="font-bold text-lg text-claw-accent tracking-tight">LiveClaw</span>
          </Link>
        ) : (
          <Link href="/" onClick={handleLinkClick} className="mx-auto">
            <img src="/logo.png" alt="LiveClaw" className="w-7 h-7" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-claw-text-muted hover:text-claw-text p-1 rounded hover:bg-claw-card transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-2">
          <SearchBar onNavigate={handleLinkClick} />
        </div>
      )}

      {/* Navigation */}
      <div className="py-1.5 px-1.5">
        {navItems
          .filter((item) => {
            if (item.authRequired && !isLoggedIn) return false;
            return true;
          })
          .map((item) => {
            const active = isNavActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-md transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'bg-claw-accent/10 text-claw-accent'
                    : 'text-claw-text-muted hover:bg-claw-card hover:text-claw-text'
                }`}
              >
                {item.icon}
                {!collapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
      </div>

      {/* Become a Creator CTA */}
      {isLoggedIn && !isCreator && !collapsed && (
        <div className="px-3 py-2">
          <button
            onClick={() => becomeCreator()}
            className="w-full py-2 px-3 bg-claw-accent/10 text-claw-accent text-sm font-medium rounded-md hover:bg-claw-accent/20 transition-colors text-left"
          >
            Become a Creator
          </button>
        </div>
      )}

      {/* Separator */}
      <div className="border-b border-claw-border mx-3 my-1" />

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Followed Channels */}
        {isLoggedIn && followedAgents.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-4 mb-1.5 mt-0.5">
                <span className="text-[11px] font-semibold text-claw-text-muted uppercase tracking-wider">
                  Followed Channels
                </span>
              </div>
            )}
            {followedAgents.map((agent) =>
              renderAgent(agent, agent.status === 'live'),
            )}
          </>
        )}

        {/* Live Channels (unfollowed) */}
        {unfollowedLive.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-4 mt-3 mb-1.5">
                <span className="text-[11px] font-semibold text-claw-text-muted uppercase tracking-wider">
                  Live Channels
                </span>
              </div>
            )}
            {unfollowedLive.map((agent) => renderAgent(agent, true))}
          </>
        )}

        {/* Offline (unfollowed) */}
        {unfollowedOffline.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-4 mt-3 mb-1.5">
                <span className="text-[11px] font-semibold text-claw-text-muted uppercase tracking-wider">
                  Offline
                </span>
              </div>
            )}
            {unfollowedOffline.map((agent) => renderAgent(agent, false))}
          </>
        )}
      </div>

      {/* User section */}
      <div className="p-3 border-t border-claw-border">
        {isLoggedIn ? (
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-claw-accent/20 flex items-center justify-center text-claw-accent text-[10px] font-bold flex-shrink-0">
                  {user!.username[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium truncate">{user!.username}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="text-xs text-claw-text-muted hover:text-claw-text p-1 rounded hover:bg-claw-card transition-colors"
              title="Logout"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setShowLoginModal(true); if (onClose) onClose(); }}
            className={`text-sm font-medium rounded-md transition-colors ${
              collapsed
                ? 'w-full p-1.5 bg-claw-accent/10 text-claw-accent hover:bg-claw-accent/20'
                : 'w-full py-2 bg-claw-accent/10 text-claw-accent hover:bg-claw-accent/20'
            }`}
          >
            {collapsed ? (
              <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            ) : (
              'Log In'
            )}
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
