'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FollowButtonProps {
  agentId: string;
  followerCount: number;
}

export function FollowButton({ agentId, followerCount: initialCount }: FollowButtonProps) {
  const { user, isLoggedIn, setShowLoginModal } = useUser();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/follows/check?userId=${user.id}&agentId=${agentId}`)
      .then((r) => r.json())
      .then((data) => setFollowing(data.following))
      .catch(() => {});
  }, [user, agentId]);

  const toggle = useCallback(async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setLoading(true);
    try {
      if (following) {
        await fetch(`${API_URL}/follows`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user!.id, agentId }),
        });
        setFollowing(false);
        setCount((c) => Math.max(0, c - 1));
        toast.success('Unfollowed');
      } else {
        await fetch(`${API_URL}/follows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user!.id, agentId }),
        });
        setFollowing(true);
        setCount((c) => c + 1);
        toast.success('Following!');
      }
    } catch {
      toast.error('Failed to update follow status');
    }
    setLoading(false);
  }, [following, isLoggedIn, user, agentId, setShowLoginModal]);

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
        following
          ? 'bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-red-900/20 hover:text-red-400 hover:border-red-800/50'
          : 'bg-orange-500 border border-orange-600 text-white hover:bg-orange-600 shadow-sm shadow-orange-900/30'
      } disabled:opacity-50`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill={following ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {following ? 'Following' : 'Follow'}
      <span className="text-white/70 text-xs font-normal">{count}</span>
    </button>
  );
}
