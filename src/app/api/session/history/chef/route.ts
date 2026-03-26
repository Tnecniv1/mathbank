import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // 1. Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const target_user_id = searchParams.get('user_id');
  const feuille_id     = searchParams.get('feuille_id'); // optionnel
  if (!target_user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

  // 2. Vérifier que l'appelant est chef d'une équipe dont target_user_id est membre
  const { data: chefEquipes } = await service
    .from('equipe')
    .select('id')
    .eq('chef_id', user.id);

  if (!chefEquipes || chefEquipes.length === 0) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const equipeIds = chefEquipes.map((e: { id: string }) => e.id);

  const { data: membreCheck } = await service
    .from('membre_equipe')
    .select('id')
    .eq('user_id', target_user_id)
    .in('equipe_id', equipeIds)
    .limit(1);

  if (!membreCheck || membreCheck.length === 0) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // 3. Récupérer l'historique (service role, bypass RLS)
  let query = service
    .from('conversation_history')
    .select('id, exercice_numero, messages, created_at, feuille_id')
    .eq('user_id', target_user_id)
    .order('created_at', { ascending: false });

  if (feuille_id) query = query.eq('feuille_id', feuille_id);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json([]);

  // 4. Joindre les titres de feuilles
  const feuilleIds = [...new Set(rows.map((r: { feuille_id: string }) => r.feuille_id))];
  const { data: noeuds } = await service
    .from('noeud')
    .select('id, titre')
    .in('id', feuilleIds);

  const titreByFeuilleId: Record<string, string> = {};
  (noeuds ?? []).forEach((n: { id: string; titre: string }) => {
    titreByFeuilleId[n.id] = n.titre;
  });

  return NextResponse.json(rows.map((r: {
    id: string;
    exercice_numero: number;
    messages: unknown;
    created_at: string;
    feuille_id: string;
  }) => ({
    id:              r.id,
    exercice_numero: r.exercice_numero,
    messages:        r.messages,
    created_at:      r.created_at,
    feuille_id:      r.feuille_id,
    feuille_titre:   titreByFeuilleId[r.feuille_id] ?? '—',
  })));
}
