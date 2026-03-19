'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

export function AuthAutoOpen() {
  const searchParams = useSearchParams();
  const { isLoggedIn, setShowLoginModal } = useUser();

  useEffect(() => {
    if (searchParams.get('auth') === 'true' && !isLoggedIn) {
      setShowLoginModal(true);
      // Clean up the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [searchParams, isLoggedIn, setShowLoginModal]);

  return null;
}
