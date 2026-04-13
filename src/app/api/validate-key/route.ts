import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { key } = body ?? {};

  if (!key || key !== process.env.SECRET_KEY) {
    return NextResponse.json({ error: 'Clé incorrecte' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
