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

  // ── 5. Prochain exercice pour chaque feuille + roue en cours (en parallèle) ──
  const [feuillesList, openRoueResult] = await Promise.all([
    Promise.all(
      (noeuds ?? []).map(async (noeud) => {
        // Compte les exercices déjà enregistrés dans grille_observation pour cette feuille
        const { data: grilles } = await service
          .from('grille_observation')
          .select('data')
          .eq('user_id', user.id);

        let nbExistants = 0;
        for (const g of grilles ?? []) {
          const exercices = (g.data?.exercices ?? []) as { feuille_id?: string }[];
          nbExistants += exercices.filter((e) => e.feuille_id === noeud.id).length;
        }
        const prochain_exercice = nbExistants + 1;

        return {
          id: noeud.id,
          titre: noeud.titre,
          type: noeud.type as 'mecanique' | 'chaotique',
          pdf_url: noeud.pdf_url ?? null,
          prochain_exercice,
        };
      })
    ),
    // Roue ouverte pour cet élève (user_id prof, meta.user_id = élève)
    service
      .from('grille_observation')
      .select('id, data')
      .filter("data->meta->>user_id", 'eq', user.id)
      .eq('closed', false)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  // ── 6. Enrichir les feuilles avec roue_en_cours si applicable ─────────
  const roue = openRoueResult.data?.[0] ?? null;

  const feuilles = feuillesList.map((f) => {
    if (!roue) return f;
    const exo = (roue.data?.exercices ?? []).find(
      (e: any) => e.feuille_id === f.id
    );
    if (!exo) return f;
    return {
      ...f,
      roue_en_cours: {
        roue_id: roue.id as string,
        reference: (exo.reference ?? '') as string,
        validated: (exo.validated ?? null) as Record<string, boolean> | null,
        type: (exo.type ?? 'mecanique') as 'mecanique' | 'chaotique',
      },
    };
  });

  return NextResponse.json({
    feuilles,
    profil: { full_name: profile?.full_name ?? '' },
  });
}
