import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const feuille_id = searchParams.get('feuille_id');
  if (!feuille_id) return NextResponse.json({ error: 'feuille_id requis' }, { status: 400 });

  const { data, error } = await supabase
    .from('conversation_history')
    .select('id, exercice_numero, terminee, messages, created_at')
    .eq('user_id', user.id)
    .eq('feuille_id', feuille_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
