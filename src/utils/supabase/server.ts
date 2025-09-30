// src/utils/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        set: (n, v, o?: any) => { try { cookieStore.set(n, v, o); } catch {} },
        remove: (n, o?: any) => { try { cookieStore.set(n, '', { ...o, maxAge: 0 }); } catch {} },
      },
    }
  );
}
