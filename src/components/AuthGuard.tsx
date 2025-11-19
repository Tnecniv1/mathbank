'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

/**
 * Composant pour protéger les pages authentifiées
 * Enveloppe les pages qui nécessitent une connexion
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Pas de session, rediriger vers /auth
        router.push('/auth');
        return;
      }

      setAuthenticated(true);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/auth');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-slate-600 dark:text-slate-400">
          Vérification de l'authentification...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null; // Redirection en cours
  }

  return <>{children}</>;
}