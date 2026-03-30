'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Entrainement = {
  id: string;
  statut: 'en_cours' | 'boucle';
  mode: 'autonome' | 'assiste';
  created_at: string;
  nb_exercices: number;
};

export default function SessionPage() {
  const router = useRouter();
  const [entrainements, setEntrainements] = useState<Entrainement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntrainements();
  }, []);

  async function loadEntrainements() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from('entrainement')
      .select('id, statut, mode, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) { setLoading(false); return; }

    // Compter les exercices par entraînement
    const ids = data.map((e: any) => e.id);
    const { data: exos } = await supabase
      .from('exercice')
      .select('entrainement_id')
      .in('entrainement_id', ids);

    const counts: Record<string, number> = {};
    for (const exo of exos ?? []) {
      if (exo.entrainement_id) {
        counts[exo.entrainement_id] = (counts[exo.entrainement_id] ?? 0) + 1;
      }
    }

    setEntrainements(
      data.map((e: any) => ({ ...e, nb_exercices: counts[e.id] ?? 0 }))
    );
    setLoading(false);
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#F5F4EF]">
      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="pt-2">
          <h1 className="text-xl font-bold text-[#1A1A1A]">Entraînement</h1>
          <p className="text-xs text-[#AAAAAA] mt-0.5 capitalize">{today}</p>
        </div>

        {/* ── Deux modes ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Autonome */}
          <button
            onClick={() => router.push('/session/autonome')}
            className="bg-white rounded-2xl border border-[#E8E8E8] p-5 text-left
                       hover:border-[#185FA5] hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E6F1FB] flex items-center justify-center mb-3
                            group-hover:bg-[#185FA5] transition-colors">
              <svg className="w-5 h-5 text-[#185FA5] group-hover:text-white transition-colors"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div className="font-semibold text-sm text-[#1A1A1A]">Autonome</div>
            <div className="text-xs text-[#AAAAAA] mt-0.5 leading-snug">
              Remplis ta grille toi-même
            </div>
          </button>

          {/* Assisté */}
          <button
            onClick={() => router.push('/session/assiste')}
            className="bg-white rounded-2xl border border-[#E8E8E8] p-5 text-left
                       hover:border-[#185FA5] hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E6F1FB] flex items-center justify-center mb-3
                            group-hover:bg-[#185FA5] transition-colors">
              <svg className="w-5 h-5 text-[#185FA5] group-hover:text-white transition-colors"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="font-semibold text-sm text-[#1A1A1A]">Assisté</div>
            <div className="text-xs text-[#AAAAAA] mt-0.5 leading-snug">
              Travaille avec le coach IA
            </div>
          </button>
        </div>

        {/* ── Historique ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">Mes entraînements</h2>

          {loading ? (
            <div className="text-sm text-[#AAAAAA]">Chargement...</div>
          ) : entrainements.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center">
              <div className="text-[#CCC] text-sm">Aucun entraînement pour l'instant.</div>
              <div className="text-[#BBB] text-xs mt-1">Lance ton premier entraînement !</div>
            </div>
          ) : (
            <div className="space-y-2">
              {entrainements.map((e) => {
                const isEnCours = e.statut === 'en_cours';
                const date = new Date(e.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });
                return (
                  <button
                    key={e.id}
                    onClick={() => {
                      if (isEnCours) {
                        router.push(`/session/${e.mode}?entrainement_id=${e.id}`);
                      } else {
                        alert(
                          `Entraînement bouclé — ${date}\n${e.nb_exercices} exercice${e.nb_exercices > 1 ? 's' : ''}`
                        );
                      }
                    }}
                    className={`w-full bg-white rounded-xl border p-4 text-left
                                hover:shadow-sm transition-all ${
                      isEnCours
                        ? 'border-amber-300 hover:border-amber-400'
                        : 'border-[#E8E8E8] hover:border-[#D0D0D0]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[#1A1A1A]">{date}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isEnCours
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-[#EAF3DE] text-[#639922]'
                          }`}>
                            {isEnCours ? 'En cours' : 'Bouclé'}
                          </span>
                        </div>
                        <div className="text-xs text-[#AAAAAA] mt-0.5 flex items-center gap-2">
                          <span className="capitalize">{e.mode}</span>
                          <span>·</span>
                          <span>
                            {e.nb_exercices} exercice{e.nb_exercices > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-[#CCCCCC] shrink-0"
                           fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
