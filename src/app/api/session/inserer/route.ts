import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Score pondéré C/S/R par exercice ──────────────────────────────────────────

type CriteriaScores = Record<string, boolean | null>;

function calculerScore(scores: CriteriaScores): number {
  const moyenne = (vals: (boolean | null)[]) => {
    const actifs = vals.filter((v) => v !== null) as boolean[];
    if (actifs.length === 0) return null;
    return actifs.filter(Boolean).length / actifs.length;
  };

  const C = moyenne([scores.c1, scores.c2, scores.c3, scores.c4]);
  const S = moyenne([scores.s1, scores.s2, scores.s3, scores.s4]);
  const R = moyenne([scores.r1, scores.r2, scores.r3, scores.r4]);

  const vecteurs = [
    { val: C, poids: 50 },
    { val: S, poids: 25 },
    { val: R, poids: 25 },
  ].filter((v) => v.val !== null) as { val: number; poids: number }[];

  if (vecteurs.length === 0) return 0;

  const totalPoids = vecteurs.reduce((s, v) => s + v.poids, 0);
  return Math.round(
    vecteurs.reduce((s, v) => s + v.val * v.poids, 0) / totalPoids * 100
  );
}

// ── Durée texte → minutes ──────────────────────────────────────────────────────

function parseDuree(str: string): number {
  if (!str) return 0;
  const s = str.trim().toLowerCase();
  const hm = s.match(/^(\d+)h(\d+)/);       // "1h30" or "1h30min"
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
  const h = s.match(/^(\d+)h/);             // "1h" or "2h"
  if (h) return parseInt(h[1]) * 60;
  const m = s.match(/^(\d+)min/);           // "30min"
  if (m) return parseInt(m[1]);
  const n = parseInt(s);                    // "45"
  return isNaN(n) ? 0 : n;
}

// ── POST /api/session/inserer ──────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { grille_id }: { grille_id: string } = body;
  if (!grille_id) return NextResponse.json({ error: 'grille_id manquant' }, { status: 400 });

  // 2. Charger la grille (non encore insérée)
  const { data: grille, error: fetchError } = await service
    .from('grille_observation')
    .select('id, data, user_id, entrainement_id, inserted')
    .eq('id', grille_id)
    .eq('inserted', false)
    .single();

  if (fetchError || !grille) {
    return NextResponse.json({ error: 'Grille introuvable ou déjà insérée' }, { status: 404 });
  }
  if (grille.user_id !== user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const grilleData = grille.data ?? {};
  const rawSessions: any[] = grilleData.sessions ?? grilleData.meta?.sessions ?? [];
  const exercices: any[]   = grilleData.exercices ?? [];

  const feuilleMecaId  = exercices.find((e: any) => e.type === 'mecanique')?.feuille_id  ?? null;
  const feuilleChaosId = exercices.find((e: any) => e.type === 'chaotique')?.feuille_id ?? null;

  // S'il n'y a aucune session dans la grille, créer une session fictive
  const sessionsToProcess = rawSessions.length > 0
    ? rawSessions
    : [{ date: new Date().toISOString().slice(0, 10), duree: '0' }];

  const sessionIds: string[] = [];
  let exerciceCount = 0;

  // 3. Pour chaque session → INSERT session + exercices + scores
  for (const rawSession of sessionsToProcess) {
    const dateSession = rawSession.date ?? new Date().toISOString().slice(0, 10);
    const duree       = Math.max(parseDuree(rawSession.duree ?? '0'), 1);

    const { data: sessionRow, error: sessionErr } = await service
      .from('session')
      .insert({
        user_id:              grille.user_id,
        date_session:         dateSession,
        duree,
        feuille_mecanique_id: feuilleMecaId,
        feuille_chaotique_id: feuilleChaosId,
      })
      .select('id')
      .single();

    if (sessionErr || !sessionRow) {
      console.error('[inserer] session insert error:', sessionErr);
      return NextResponse.json({ error: 'Erreur insertion session' }, { status: 500 });
    }

    sessionIds.push(sessionRow.id);

    for (let i = 0; i < exercices.length; i++) {
      const exo = exercices[i];

      const { data: exerciceRow, error: exoErr } = await service
        .from('exercice')
        .insert({
          session_id:       sessionRow.id,
          type:             exo.type,
          reference:        exo.reference ?? `Exo${i + 1}`,
          ordre:            i,
          entrainement_id:  grille.entrainement_id ?? null,
        })
        .select('id')
        .single();

      if (exoErr || !exerciceRow) {
        console.error('[inserer] exercice insert error:', exoErr);
        return NextResponse.json({ error: 'Erreur insertion exercice' }, { status: 500 });
      }

      const v = exo.validated ?? {};
      const { error: scoreErr } = await service
        .from('score_exercice')
        .insert({
          exercice_id: exerciceRow.id,
          reussi:      exo.reussi ?? false,
          c1: v.C1 === true, c2: v.C2 === true, c3: v.C3 === true, c4: v.C4 === true,
          s1: v.S1 === true, s2: v.S2 === true, s3: v.S3 === true, s4: v.S4 === true,
          r1: v.R1 === true, r2: v.R2 === true, r3: v.R3 === true, r4: v.R4 === true,
        });

      if (scoreErr) {
        console.error('[inserer] score_exercice insert error:', scoreErr);
        return NextResponse.json({ error: 'Erreur insertion score' }, { status: 500 });
      }

      exerciceCount++;
    }
  }

  // 4. Marquer la grille comme insérée
  await service
    .from('grille_observation')
    .update({ inserted: true })
    .eq('id', grille_id);

  // 5. Mise à jour de la progression (fire-and-forget)
  const feuilleIds = [feuilleMecaId, feuilleChaosId].filter(Boolean) as string[];
  if (feuilleIds.length > 0) {
    (async () => {
      try {
        const { data: allGrilles } = await service
          .from('grille_observation')
          .select('data')
          .eq('user_id', grille.user_id);

        if (!allGrilles) return;

        for (const feuilleId of feuilleIds) {
          const scores: number[] = [];
          let reussis = 0;

          for (const g of allGrilles) {
            const exos = (g.data?.exercices ?? []).filter((e: any) => e.feuille_id === feuilleId);
            for (const exo of exos) {
              if (exo.type === 'chaotique') {
                const v = exo.validated ?? {};
                scores.push(calculerScore({
                  c1: v.C1 ?? null, c2: v.C2 ?? null, c3: v.C3 ?? null, c4: v.C4 ?? null,
                  s1: v.S1 ?? null, s2: v.S2 ?? null, s3: v.S3 ?? null, s4: v.S4 ?? null,
                  r1: v.R1 ?? null, r2: v.R2 ?? null, r3: v.R3 ?? null, r4: v.R4 ?? null,
                }));
              } else {
                scores.push(exo.reussi === true ? 100 : 0);
              }
              if (exo.reussi === true) reussis++;
            }
          }

          if (scores.length === 0) continue;

          const score_moyen = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

          await service
            .from('progression_feuille')
            .update({
              nb_exercices_valides: reussis,
              score_moyen,
            })
            .eq('user_id', grille.user_id)
            .eq('feuille_id', feuilleId);
        }
      } catch (err) {
        console.error('[inserer] progression update error:', err);
      }
    })();
  }

  return NextResponse.json({ success: true, session_ids: sessionIds, exercice_count: exerciceCount });
}
