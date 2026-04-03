import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Service-role client : bypass RLS pour toutes les lectures
const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // ── 1. Auth ───────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  // ── 2. Profil ─────────────────────────────────────────────────────────
  const { data: profile } = await service
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .single();

  // ── 3. Feuilles actives depuis progression_feuille ────────────────────
  const { data: progressions } = await service
    .from('progression_feuille')
    .select('feuille_id')
    .eq('user_id', user.id)
    .eq('en_cours', true)
    .eq('est_termine', false);

  const feuillesActives = progressions?.map((p) => p.feuille_id) ?? [];

  if (feuillesActives.length === 0) {
    return NextResponse.json({
      feuilles: [],
      profil: { full_name: profile?.full_name ?? '' },
    });
  }

  // ── 4. Infos des nœuds (titre, type, pdf_url) ─────────────────────────
  const { data: noeuds } = await service
    .from('noeud')
    .select('id, titre, type, pdf_url')
    .in('id', feuillesActives);

  // ── 5. Prochain exercice + roue en cours par feuille ────────────────────
  const feuilles = await Promise.all(
    (noeuds ?? []).map(async (noeud) => {
      const [countResult, openObsResult] = await Promise.all([
        service
          .from('observation')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('feuille_id', noeud.id),
        service
          .from('observation')
          .select('id, data, reference, type')
          .eq('user_id', user.id)
          .eq('feuille_id', noeud.id)
          .eq('closed', false)
          .order('updated_at', { ascending: false })
          .limit(1),
      ]);

      const prochain_exercice = (countResult.count ?? 0) + 1;
      const obsRow = openObsResult.data?.[0] ?? null;

      const entry: Record<string, unknown> = {
        id: noeud.id,
        titre: noeud.titre,
        type: noeud.type as 'mecanique' | 'chaotique',
        pdf_url: noeud.pdf_url ?? null,
        prochain_exercice,
      };

      if (obsRow) {
        entry.roue_en_cours = {
          roue_id:   obsRow.id as string,
          reference: (obsRow.reference ?? '') as string,
          validated: (obsRow.data?.validated ?? null) as Record<string, boolean> | null,
          type:      (obsRow.type ?? 'mecanique') as 'mecanique' | 'chaotique',
        };
      }

      return entry;
    })
  );

  return NextResponse.json({
    feuilles,
    profil: { full_name: profile?.full_name ?? '' },
  });
}
