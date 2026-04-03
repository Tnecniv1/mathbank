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

  const { data: progressions } = await service
    .from('progression_feuille')
    .select('feuille_id')
    .eq('user_id', user.id)
    .eq('en_cours', true);

  const feuilleIds = (progressions ?? []).map((p: any) => p.feuille_id as string);

  if (feuilleIds.length === 0) {
    return NextResponse.json({ feuilles: [] });
  }

  const { data: noeuds } = await service
    .from('noeud')
    .select('id, titre, type')
    .in('id', feuilleIds);

  return NextResponse.json({
    feuilles: (noeuds ?? []).map((n: any) => ({
      id:    n.id    as string,
      titre: n.titre as string,
      type:  n.type  as string,
    })),
  });
}
