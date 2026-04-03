import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: rows, error } = await service
    .from('observation')
    .select('id, data, feuille_id, reference, type, reussi, created_at')
    .eq('user_id', user.id)
    .eq('closed', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[roue-en-cours] query error:', error);
    return NextResponse.json({ roue_id: null });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ roue_id: null });
  }

  const obs = rows[0];
  const exercices = [{
    feuille_id: obs.feuille_id ?? null,
    reference:  obs.reference ?? '',
    type:       (obs.type ?? 'mecanique') as 'mecanique' | 'chaotique',
    validated:  obs.data?.validated ?? null,
    reussi:     obs.reussi ?? null,
  }];

  return NextResponse.json({ roue_id: obs.id, exercices });
}
