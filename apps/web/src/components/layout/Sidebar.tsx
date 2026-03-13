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
    href: '/docs',
    label: 'Docs',
    icon: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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
  const { user, isLoggedIn, isAdmin, isCreator, setShowLoginModal, logout, becomeCreator } = useUser();
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
          ? 'bg-orange-500/10 text-orange-500'
          : isLive
            ? 'hover:bg-orange-500/10 hover:text-orange-500'
            : 'opacity-50 hover:opacity-80 hover:bg-orange-500/10 hover:text-orange-500'
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
                ? 'bg-orange-500 text-white'
                : 'bg-orange-500 text-white'
            }`}
          >
            {agent.name[0]?.toUpperCase()}
          </div>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
          isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'
        }`} />
      </div>
      {!collapsed && (
        <>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate leading-tight">{agent.name}</p>
            {isLive && (
              <p className="text-[11px] text-gray-500 truncate leading-tight">
                {agent.category?.name || agent.agentType}
              </p>
            )}
          </div>
          {isLive && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-claw-live" />
              <span className="text-[11px] text-gray-500 font-medium">
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
      } bg-white border-r border-orange-400/60 flex flex-col transition-all duration-200 h-full flex-shrink-0 text-gray-700`}
    >
      {/* Logo */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        {!collapsed ? (
          <Link href="/" onClick={handleLinkClick} className="flex items-center py-1">
            <img src="/liveclaw-logo.png" alt="LiveClaw" className="w-[200px] h-auto" />
          </Link>
        ) : (
          <Link href="/" onClick={handleLinkClick} className="mx-auto">
            <img src="/logo.png" alt="LiveClaw" className="w-7 h-7" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
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
                    ? 'bg-orange-500/10 text-orange-500'
                    : 'text-gray-500 hover:bg-orange-500/10 hover:text-orange-500'
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

      {/* Admin Panel link */}
      {isLoggedIn && isAdmin && (
        <div className="px-1.5 pb-1">
          <Link
            href="/admin"
            onClick={handleLinkClick}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-md transition-colors ${
              collapsed ? 'justify-center' : ''
            } ${
              pathname.startsWith('/admin')
                ? 'bg-orange-500/10 text-orange-500'
                : 'text-gray-500 hover:bg-orange-500/10 hover:text-orange-500'
            }`}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {!collapsed && <span className="text-sm font-medium">Admin</span>}
          </Link>
        </div>
      )}

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

      {/* Start Streaming CTA */}
      {!collapsed && (
        <div className="px-3 py-2">
          <Link
            href="/docs"
            onClick={handleLinkClick}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-orange-500 text-white text-sm font-semibold rounded-md hover:bg-orange-600 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Streaming
          </Link>
        </div>
      )}

      {/* Separator */}
      <div className="border-b border-gray-200 mx-3 my-1" />

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Followed Channels */}
        {isLoggedIn && followedAgents.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-4 mb-1.5 mt-0.5">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
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
              <div className="px-4 mt-3 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
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
              <div className="px-4 mt-3 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Offline
                </span>
              </div>
            )}
            {unfollowedOffline.map((agent) => renderAgent(agent, false))}
          </>
        )}
      </div>

      {/* User section */}
      <div className="p-3 border-t border-gray-200">
        {isLoggedIn ? (
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-2 min-w-0">
                {user!.avatarUrl ? (
                  <img
                    src={user!.avatarUrl}
                    alt={user!.username}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-claw-accent/20 flex items-center justify-center text-claw-accent text-[10px] font-bold flex-shrink-0">
                    {user!.username[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium truncate">{user!.username}</span>
              </div>
            )}
            <div className="flex items-center gap-0.5">
              <Link
                href="/settings"
                onClick={handleLinkClick}
                className="text-xs text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition-colors"
                title="Settings"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition-colors"
                title="Logout"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowLoginModal(true); if (onClose) onClose(); }}
            className={`text-sm font-medium rounded-md transition-colors ${
              collapsed
                ? 'w-full p-1.5 bg-orange-500 text-white hover:bg-orange-600'
                : 'w-full py-2 bg-orange-500 text-white hover:bg-orange-600'
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
        {!collapsed && (
          <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-gray-400">
            <Link href="/terms" onClick={handleLinkClick} className="hover:text-gray-600 transition-colors">
              Terms
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link href="/privacy" onClick={handleLinkClick} className="hover:text-gray-600 transition-colors">
              Privacy
            </Link>
          </div>
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
