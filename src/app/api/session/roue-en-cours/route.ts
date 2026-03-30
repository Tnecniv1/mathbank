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

  // user_id dans grille_observation = prof ; l'élève est dans data->meta->user_id
  const { data: rows, error } = await service
    .from('grille_observation')
    .select('id, data, created_at')
    .filter("data->meta->>user_id", 'eq', user.id)
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

  const roue = rows[0];
  const exercices = (roue.data?.exercices ?? []).map((e: any) => ({
    feuille_id: e.feuille_id ?? null,
    reference: e.reference ?? '',
    type: (e.type ?? 'mecanique') as 'mecanique' | 'chaotique',
    validated: e.validated ?? null,
    reussi: e.reussi ?? null,
  }));

  return NextResponse.json({ roue_id: roue.id, exercices });
}
