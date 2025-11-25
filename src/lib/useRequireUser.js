'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useRequireUser() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? window.localStorage.getItem('journeylens:user')
      : null;

    if (!stored) {
      router.replace('/');
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setUser(parsed);
    } catch (err) {
      console.error('Failed to parse stored user', err);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  return { user, loading };
}
