// src/lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Instance singleton du client Supabase
 * Garantit qu'une seule instance existe dans toute l'application
 */
let clientInstance: SupabaseClient | null = null;

/**
 * Récupère ou crée l'instance unique du client Supabase
 * @returns {SupabaseClient} L'instance du client Supabase
 */
export function getSupabase(): SupabaseClient {
  // Si l'instance n'existe pas encore, on la crée
  if (!clientInstance) {
    clientInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  
  return clientInstance;
}

/**
 * Export par défaut pour compatibilité avec le code existant
 * Utilise le même pattern singleton
 */
export const supabase = getSupabase();