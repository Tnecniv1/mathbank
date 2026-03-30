'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/auth');
      router.refresh();
      window.location.href = '/auth';
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
      style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
    >
      Se déconnecter
    </button>
  );
}
