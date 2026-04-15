'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useSecretKey } from '@/hooks/useSecretKey';
import { SecretKeyModal } from '@/components/SecretKeyModal';

// ── Types ──────────────────────────────────────────────────────────────────────

type EntCard = {
  id: string;
  feuille_id: string | null;
  feuille_titre: string | null;
  reference: string | null;
  statut: 'en_cours' | 'termine' | 'reporte' | 'abandonne';
  created_at: string;
  score_global: number | null;
  nb_sessions: number;
  duree_totale: number;
};

type FeuilleActive = {
  id: string;
  titre: string;
  type: string;
};

const STATUT_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  en_cours:  { label: 'En cours',  bg: 'bg-amber-50',    text: 'text-amber-600',  border: 'border-amber-300'  },
  termine:   { label: 'Terminé',   bg: 'bg-[#EAF3DE]',   text: 'text-[#639922]',  border: 'border-[#C8E0A8]'  },
  reporte:   { label: 'Reporté',   bg: 'bg-[#F3F3F3]',   text: 'text-[#999]',     border: 'border-[#E8E8E8]'  },
  abandonne: { label: 'Abandonné', bg: 'bg-red-50',       text: 'text-red-500',    border: 'border-red-200'    },
};

function formatTemps(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function SessionPage() {
  const router = useRouter();
  const { requireKey, showKeyModal, submitKey, dismissKeyModal } = useSecretKey();
  const [cards, setCards]         = useState<EntCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [feuilles, setFeuilles]   = useState<FeuilleActive[]>([]);
  const [feuilleId, setFeuilleId] = useState('');
  const [reference, setReference] = useState('');
  const [creating, setCreating]   = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => { loadCards(); }, []);

  async function loadCards() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const userId = session.user.id;

    const { data: ents } = await supabase
      .from('entrainement')
      .select('id, feuille_id, reference, statut, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!ents || ents.length === 0) { setLoading(false); return; }

    const ids = ents.map((e: any) => e.id);
    const feuilleIds = [...new Set(ents.map((e: any) => e.feuille_id).filter(Boolean))] as string[];

    // Titres des feuilles
    const titreMap: Record<string, string> = {};
    if (feuilleIds.length > 0) {
      const { data: noeuds } = await supabase
        .from('noeud')
        .select('id, titre')
        .in('id', feuilleIds);
      for (const n of noeuds ?? []) titreMap[n.id] = n.titre;
    }

    // Observations liées
    const { data: obs } = await supabase
      .from('observation')
      .select('entrainement_id_final, score_global')
      .in('entrainement_id_final', ids);
    const obsMap: Record<string, number | null> = {};
    for (const o of obs ?? []) {
      if (o.entrainement_id_final) obsMap[o.entrainement_id_final] = o.score_global;
    }

    // Statistiques des sessions
    const { data: sessions } = await supabase
      .from('session')
      .select('entrainement_id, duree')
      .in('entrainement_id', ids);
    const sessStats: Record<string, { count: number; duree: number }> = {};
    for (const id of ids) sessStats[id] = { count: 0, duree: 0 };
    for (const s of sessions ?? []) {
      if (!s.entrainement_id || !sessStats[s.entrainement_id]) continue;
      sessStats[s.entrainement_id].count++;
      if (s.duree) sessStats[s.entrainement_id].duree += s.duree;
    }

    setCards(ents.map((e: any) => ({
      id:           e.id,
      feuille_id:   e.feuille_id ?? null,
      feuille_titre: e.feuille_id ? (titreMap[e.feuille_id] ?? null) : null,
      reference:    e.reference ?? null,
      statut:       e.statut as EntCard['statut'],
      created_at:   e.created_at,
      score_global: obsMap[e.id] ?? null,
      nb_sessions:  sessStats[e.id]?.count ?? 0,
      duree_totale: sessStats[e.id]?.duree ?? 0,
    })));
    setLoading(false);
  }

  async function openModal() {
    setModalError(null);
    setReference('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Ne lister que les feuilles marquées en_cours = true pour cet utilisateur
    const { data: progs } = await supabase
      .from('progression_feuille')
      .select('feuille_id')
      .eq('user_id', session.user.id)
      .eq('en_cours', true)
      .eq('est_termine', false);

    const feuilleIds = (progs ?? []).map((p: any) => p.feuille_id).filter(Boolean);

    if (feuilleIds.length === 0) {
      setFeuilles([]);
      setFeuilleId('');
      setShowModal(true);
      return;
    }

    const { data: noeuds } = await supabase
      .from('noeud')
      .select('id, titre, type')
      .in('id', feuilleIds)
      .order('titre', { ascending: true });
    const list = (noeuds ?? []) as FeuilleActive[];
    setFeuilles(list);
    if (list.length > 0) setFeuilleId(list[0].id);
    setShowModal(true);
  }

  async function handleCreate() {
    if (!feuilleId) return;
    setCreating(true);
    setModalError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      // Max 1 en_cours
      const { data: existing } = await supabase
        .from('entrainement')
        .select('id')
        .eq('user_id', userId)
        .eq('statut', 'en_cours')
        .limit(1);
      if (existing && existing.length > 0) {
        setShowModal(false);
        router.push(`/entrainement/${existing[0].id}`);
        return;
      }

      const { data: ent, error } = await supabase
        .from('entrainement')
        .insert({ user_id: userId, feuille_id: feuilleId, reference: reference || null, statut: 'en_cours' })
        .select('id')
        .single();
      if (error || !ent) { setModalError('Erreur lors de la création.'); return; }

      // Observation vide
      const { error: obsError } = await supabase.from('observation').insert({
        id: Date.now().toString(),
        entrainement_id_final: ent.id,
        user_id:   userId,
        feuille_id: feuilleId,
        data:      { validated: {}, crosses: {} },
        score_global: null,
        nb_erreurs: 0,
        bilan:     null,
        closed:    false,
      });
      console.log('[handleCreate] obs insert error:', obsError);

      // Marquer la feuille comme en cours dans la progression
      await supabase
        .from('progression_feuille')
        .upsert(
          { user_id: userId, feuille_id: feuilleId, en_cours: true },
          { onConflict: 'user_id,feuille_id' }
        );

      setShowModal(false);
      router.push(`/entrainement/${ent.id}`);
    } finally {
      setCreating(false);
    }
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#F5F4EF]">
      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold text-[#1A1A1A]">Entraînements</h1>
            <p className="text-xs text-[#AAAAAA] mt-0.5 capitalize">{today}</p>
          </div>
          <button
            onClick={() => requireKey(openModal)}
            className="px-4 py-2 rounded-xl bg-[#185FA5] text-white text-sm font-semibold
                       hover:bg-[#1450A0] transition-colors shrink-0"
          >
            + Nouvel entraînement
          </button>
        </div>

        {/* ── Liste ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="text-sm text-[#AAAAAA]">Chargement...</div>
        ) : cards.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center">
            <div className="text-[#CCC] text-sm">Aucun entraînement pour l'instant.</div>
            <div className="text-[#BBB] text-xs mt-1">Crée ton premier entraînement !</div>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => {
              const cfg = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.en_cours;
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/entrainement/${c.id}`)}
                  className={`w-full bg-white rounded-xl border ${cfg.border}
                               hover:shadow-sm p-4 text-left transition-all`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#1A1A1A] truncate">
                        {c.feuille_titre ?? '—'}
                      </div>
                      {c.reference && (
                        <div className="text-xs text-[#888] mt-0.5">{c.reference}</div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Score',    value: c.score_global !== null ? String(c.score_global) : '—' },
                      { label: 'Sessions', value: c.nb_sessions > 0 ? String(c.nb_sessions) : '—' },
                      { label: 'Durée',    value: c.duree_totale > 0 ? formatTemps(c.duree_totale) : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[#F5F4EF] rounded-lg px-2.5 py-2">
                        <div className="text-[11px] text-[#AAAAAA] leading-tight">{label}</div>
                        <div className="text-base font-medium mt-0.5 text-[#1A1A1A]">{value}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Modal clé secrète ───────────────────────────────────── */}
      {showKeyModal && (
        <SecretKeyModal onSubmit={submitKey} onDismiss={dismissKeyModal} />
      )}

      {/* ── Modal création ──────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-[#1A1A1A]">Nouvel entraînement</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wide">Feuille</label>
                <select
                  value={feuilleId}
                  onChange={(e) => setFeuilleId(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 bg-[#F9F9F9] border border-[#E8E8E8] rounded-xl
                             text-sm focus:outline-none focus:border-[#185FA5] transition-colors"
                >
                  {feuilles.length === 0 && <option value="">Aucune feuille active</option>}
                  {feuilles.map((f) => (
                    <option key={f.id} value={f.id}>{f.titre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wide">Référence</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Exo1"
                  className="mt-1 w-full px-3 py-2.5 bg-[#F9F9F9] border border-[#E8E8E8] rounded-xl
                             text-sm focus:outline-none focus:border-[#185FA5] transition-colors"
                />
              </div>
              {modalError && <p className="text-xs text-red-500">{modalError}</p>}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                           font-semibold text-sm hover:bg-[#F5F5F5] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !feuilleId}
                className="flex-1 py-2.5 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                           hover:bg-[#1450A0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? '…' : 'Démarrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
