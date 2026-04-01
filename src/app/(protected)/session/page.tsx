'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

type Entrainement = {
  id: string;
  statut: 'en_cours' | 'boucle';
  created_at: string;
  nb_exercices: number;
};

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
    const { data: grilles } = await supabase
      .from('grille_observation')
      .select('entrainement_id, data')
      .in('entrainement_id', ids);

    const counts: Record<string, number> = {};
    for (const g of grilles ?? []) {
      if (g.entrainement_id) {
        const exos = g.data?.exercices ?? [];
        counts[g.entrainement_id] = (counts[g.entrainement_id] ?? 0) + exos.length;
      }
    }

    setEntrainements(data.map((e: any) => ({ ...e, nb_exercices: counts[e.id] ?? 0 })));
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
                              {new Date(e.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'long', year: 'numeric',
                              })}
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
                  {boucles.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => router.push(`/entrainement/${e.id}`)}
                      className="w-full bg-white rounded-xl border border-[#E8E8E8]
                                 hover:border-[#185FA5] p-4 text-left hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#1A1A1A]">
                              {new Date(e.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'long', year: 'numeric',
                              })}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                                            bg-[#EAF3DE] text-[#639922]">Bouclé</span>
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
