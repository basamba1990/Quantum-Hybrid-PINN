'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Réveiller les serveurs backend au moment du login
      if (event === 'SIGNED_IN' && process.env.NEXT_PUBLIC_API_URL) {
        console.log('User signed in, waking up backend services...');
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`).catch(() => {});
        // Si vous avez un deuxième serveur (API vs Backend)
        if (process.env.NEXT_PUBLIC_BACKEND_URL) {
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/health`).catch(() => {});
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    user,
    loading,
    signOut: () => supabase.auth.signOut(),
  };
}
