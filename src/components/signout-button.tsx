'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Déconnexion Supabase
      await supabase.auth.signOut();
      
      // Forcer la suppression du cache et redirection
      router.push('/auth');
      router.refresh();
      
      // Recharger la page pour nettoyer complètement
      window.location.href = '/auth';
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition-colors"
    >
      Se déconnecter
    </button>
  );
}