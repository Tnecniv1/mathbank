'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

type EntStats = {
  nb_sessions: number;
  temps_total_min: number;
  score_pct: number | null;
  score_brut: number | null;
};

type Entrainement = {
  id: string;
  statut: 'en_cours' | 'boucle';
  created_at: string;
  nb_exercices: number;
  stats: EntStats | null;
  date_min: string | null;
  date_max: string | null;
};

const CRITERES = ['C1','C2','C3','C4','S1','S2','S3','S4','R1','R2','R3','R4'];

function formatPlage(min: string | null, max: string | null, fallback: string): string {
  if (!min) return fallback;
  const dMin = new Date(min);
  if (!max || min === max) {
    return dMin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const dMax = new Date(max);
  const start = dMin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const end   = dMax.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${start} — ${end}`;
}

function formatTemps(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function SessionPage() {
  const router = useRouter();
  const [entrainements, setEntrainements] = useState<Entrainement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [creating, setCreating]           = useState(false);

  useEffect(() => { loadEntrainements(); }, []);

  async function loadEntrainements() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from('entrainement')
      .select('id, statut, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) { setLoading(false); return; }

    const ids = data.map((e: any) => e.id);

    const [{ data: grilles }, { data: sessionsData }] = await Promise.all([
      supabase.from('grille_observation').select('entrainement_id, data').in('entrainement_id', ids),
      supabase.from('session').select('entrainement_id, duree, date_session').in('entrainement_id', ids),
    ]);

    // ── Comptage exercices (roues) ────────────────────────────────────────────
    const counts: Record<string, number> = {};
    for (const g of grilles ?? []) {
      if (g.entrainement_id) {
        const exos = g.data?.exercices ?? [];
        counts[g.entrainement_id] = (counts[g.entrainement_id] ?? 0) + exos.length;
      }
    }

    // ── Stats sessions ────────────────────────────────────────────────────────
    const statsMap: Record<string, EntStats> = {};
    for (const id of ids) statsMap[id] = { nb_sessions: 0, temps_total_min: 0, score_pct: null, score_brut: null };

    for (const s of sessionsData ?? []) {
      if (!s.entrainement_id || !statsMap[s.entrainement_id]) continue;
      statsMap[s.entrainement_id].nb_sessions++;
      const raw = s.duree;
      const mins = typeof raw === 'number' ? raw : parseInt(String(raw ?? '0'));
      if (!isNaN(mins)) statsMap[s.entrainement_id].temps_total_min += mins;
    }

    // ── Score global et score brut (critères validés) ────────────────────────
    const scoreAcc: Record<string, { valides: number; evalues: number; brut: number; hasData: boolean }> = {};
    for (const id of ids) scoreAcc[id] = { valides: 0, evalues: 0, brut: 0, hasData: false };

    for (const g of grilles ?? []) {
      if (!g.entrainement_id || !scoreAcc[g.entrainement_id]) continue;
      for (const exo of g.data?.exercices ?? []) {
        let exoValides = 0, exoEvalues = 0;
        for (const k of CRITERES) {
          const v = exo.validated?.[k];
          if (v === true || v === null) {
            exoEvalues++;
            if (v === true) exoValides++;
          }
        }
        if (exoEvalues > 0) {
          scoreAcc[g.entrainement_id].valides  += exoValides;
          scoreAcc[g.entrainement_id].evalues  += exoEvalues;
          scoreAcc[g.entrainement_id].brut     += Math.round((exoValides / exoEvalues) * 100);
          scoreAcc[g.entrainement_id].hasData   = true;
        }
      }
    }

    for (const id of ids) {
      const { valides, evalues, brut, hasData } = scoreAcc[id];
      if (evalues > 0) statsMap[id].score_pct = Math.round((valides / evalues) * 100);
      if (hasData)    statsMap[id].score_brut = brut;
    }

    // ── Plage de dates par entraînement ──────────────────────────────────────
    const dateMinMap: Record<string, string> = {};
    const dateMaxMap: Record<string, string> = {};
    for (const s of sessionsData ?? []) {
      if (!s.entrainement_id || !s.date_session) continue;
      const id = s.entrainement_id;
      const d  = s.date_session as string;
      if (!dateMinMap[id] || d < dateMinMap[id]) dateMinMap[id] = d;
      if (!dateMaxMap[id] || d > dateMaxMap[id]) dateMaxMap[id] = d;
    }

    setEntrainements(data.map((e: any) => ({
      ...e,
      nb_exercices: counts[e.id] ?? 0,
      stats: statsMap[e.id] ?? null,
      date_min: dateMinMap[e.id] ?? null,
      date_max: dateMaxMap[e.id] ?? null,
    })));
    setLoading(false);
  }

  async function handleNouvelEntrainement() {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('entrainement')
        .insert({ user_id: session.user.id, statut: 'en_cours' })
        .select('id')
        .single();
      if (error || !data) { console.error('[session] create error:', error); return; }
      router.push(`/entrainement/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const enCours = entrainements.filter((e) => e.statut === 'en_cours');
  const boucles = entrainements.filter((e) => e.statut === 'boucle');

  return (
    <div className="min-h-screen bg-[#F5F4EF]">
      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold text-[#1A1A1A]">Entraînement</h1>
            <p className="text-xs text-[#AAAAAA] mt-0.5 capitalize">{today}</p>
          </div>
          <button
            onClick={handleNouvelEntrainement}
            disabled={creating}
            className="px-4 py-2 rounded-xl bg-[#185FA5] text-white text-sm font-semibold
                       hover:bg-[#1450A0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {creating ? '…' : '+ Nouvel entraînement'}
          </button>
        </div>

        {/* ── Entraînements en cours ──────────────────────────────── */}
        {loading ? (
          <div className="text-sm text-[#AAAAAA]">Chargement...</div>
        ) : (
          <>
            {enCours.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">En cours</h2>
                <div className="space-y-2">
                  {enCours.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => router.push(`/entrainement/${e.id}`)}
                      className="w-full bg-white rounded-xl border border-amber-300
                                 hover:border-amber-400 p-4 text-left hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#1A1A1A]">
                              {formatPlage(e.date_min, e.date_max,
                                new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                              )}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                                            bg-amber-50 text-amber-600">En cours</span>
                          </div>
                          <div className="text-xs text-[#AAAAAA] mt-0.5">
                            {e.nb_exercices} exercice{e.nb_exercices !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-[#CCCCCC] shrink-0"
                             fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {boucles.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">Historique</h2>
                <div className="space-y-2">
                  {boucles.map((e) => {
                    const st = e.stats;
                    const scoreBrut = st?.score_brut;
                    const scoreColor =
                      scoreBrut === null || scoreBrut === undefined ? 'text-[#AAAAAA]' :
                      scoreBrut > 200 ? 'text-[#639922]' :
                      scoreBrut > 100 ? 'text-amber-500' :
                                        'text-[#AAAAAA]';
                    return (
                      <button
                        key={e.id}
                        onClick={() => router.push(`/entrainement/${e.id}`)}
                        className="w-full bg-white rounded-xl border border-[#E8E8E8]
                                   hover:border-[#185FA5] p-4 text-left hover:shadow-sm transition-all"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-sm font-medium text-[#1A1A1A]">
                              {formatPlage(e.date_min, e.date_max,
                                new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                              )}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                                            bg-[#EAF3DE] text-[#639922]">Bouclé</span>
                          </div>
                          <svg className="w-4 h-4 text-[#CCCCCC] shrink-0"
                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        {/* Métriques */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Sessions',    value: st ? String(st.nb_sessions) : '—', color: 'text-[#1A1A1A]' },
                            { label: 'Durée',       value: st && st.temps_total_min > 0 ? formatTemps(st.temps_total_min) : '—', color: 'text-[#1A1A1A]' },
                            { label: 'Score brut',  value: scoreBrut !== null && scoreBrut !== undefined ? String(scoreBrut) : '—', color: scoreColor },
                          ].map(({ label, value, color }) => (
                            <div key={label}
                              className="bg-[#F5F4EF] rounded-lg px-2.5 py-2">
                              <div className="text-[11px] text-[#AAAAAA] leading-tight">{label}</div>
                              <div className={`text-base font-medium mt-0.5 ${color}`}>{value}</div>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {entrainements.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center">
                <div className="text-[#CCC] text-sm">Aucun entraînement pour l'instant.</div>
                <div className="text-[#BBB] text-xs mt-1">Crée ton premier entraînement !</div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
