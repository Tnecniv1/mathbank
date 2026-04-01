'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

type Entrainement = {
  id: string;
  statut: 'en_cours' | 'boucle';
  created_at: string;
};

type ExoData = {
  id: string;
  type: 'mecanique' | 'chaotique';
  reference: string;
  reussi: boolean | null;
};

type SessionData = {
  id: string;
  created_at: string;
  duree: number | null;
  mode: 'autonome' | 'assiste' | null;
  nb_exercices: number;
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EntrainementPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: entrainementId } = use(params);

  const [entrainement, setEntrainement] = useState<Entrainement | null>(null);
  const [allExos, setAllExos]           = useState<ExoData[]>([]);
  const [allSessions, setAllSessions]   = useState<SessionData[]>([]);
  const [loading, setLoading]           = useState(true);
  const [userId, setUserId]             = useState<string | null>(null);

  // Formulaire nouvelle session
  const todayISO = new Date().toISOString().slice(0, 10);
  const [mode, setMode]           = useState<'autonome' | 'assiste'>('autonome');
  const [dateSession, setDateSession] = useState(todayISO);
  const [duree, setDuree]         = useState<number>(30);
  const [starting, setStarting]         = useState(false);
  const [boucling, setBoucling]         = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editDuree, setEditDuree]       = useState<string>('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id ?? null;
    setUserId(uid);

    const entResult = await supabase
      .from('entrainement')
      .select('id, statut, created_at')
      .eq('id', entrainementId)
      .single();
    if (entResult.data) setEntrainement(entResult.data as Entrainement);

    const { data: sessData } = await supabase
      .from('session')
      .select('id, created_at, duree, mode, exercice(id)')
      .eq('entrainement_id', entrainementId)
      .order('created_at', { ascending: false });

    setAllSessions(
      (sessData ?? []).map((s: any) => ({
        id:           s.id,
        created_at:   s.created_at,
        duree:        s.duree ?? null,
        mode:         s.mode ?? null,
        nb_exercices: (s.exercice ?? []).length,
      }))
    );

    const sessionIds = (sessData ?? []).map((s: any) => s.id);
    if (sessionIds.length > 0) {
      const { data: exoData } = await supabase
        .from('exercice')
        .select('id, type, reference, score_exercice(reussi)')
        .in('session_id', sessionIds)
        .order('ordre');
      setAllExos(
        (exoData ?? []).map((e: any) => ({
          id:       e.id,
          type:     e.type as 'mecanique' | 'chaotique',
          reference: e.reference,
          reussi:   e.score_exercice?.[0]?.reussi ?? null,
        }))
      );
    }

    setLoading(false);
  }

  async function handleDemarrer() {
    if (!userId || !dateSession) return;
    setStarting(true);
    try {
      const { data, error } = await supabase
        .from('session')
        .insert({
          entrainement_id: entrainementId,
          user_id:         userId,
          date_session:    dateSession,
          duree:           duree || 0,
          mode,
          closed:          false,
        })
        .select('id')
        .single();
      if (error || !data) {
        console.error('[demarrer] session insert error:', error);
        return;
      }
      router.push(`/entrainement/${entrainementId}/${mode}?session_id=${data.id}`);
    } finally {
      setStarting(false);
    }
  }

  async function handleSaveDuree(sessionId: string) {
    const val = parseInt(editDuree) || 0;
    await supabase.from('session').update({ duree: val }).eq('id', sessionId);
    setAllSessions((prev) =>
      prev.map((s) => s.id === sessionId ? { ...s, duree: val } : s)
    );
    setEditingSessionId(null);
  }

  async function handleBoucler() {
    setBoucling(true);
    await supabase
      .from('entrainement')
      .update({ statut: 'boucle', updated_at: new Date().toISOString() })
      .eq('id', entrainementId);
    setEntrainement((e) => (e ? { ...e, statut: 'boucle' } : e));
    setBoucling(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center">
        <span className="text-sm text-[#999]">Chargement…</span>
      </div>
    );
  }

  const isEnCours = entrainement?.statut === 'en_cours';
  const date = entrainement
    ? new Date(entrainement.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-[#F5F4EF]">
      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => router.push('/session')}
            className="text-sm text-[#185FA5] font-medium hover:underline shrink-0"
          >
            ← Retour
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[#1A1A1A] truncate">Entraînement du {date}</h1>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
            isEnCours ? 'bg-amber-50 text-amber-600' : 'bg-[#EAF3DE] text-[#639922]'
          }`}>
            {isEnCours ? 'En cours' : 'Bouclé'}
          </span>
        </div>

        {/* ── Nouvelle session (en cours seulement) ──────────────── */}
        {isEnCours && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Nouvelle session</h2>

            {/* Date + Durée */}
            <div className="flex gap-2">
              <input
                type="date"
                value={dateSession}
                onChange={(e) => setDateSession(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#F9F9F9] border border-[#E8E8E8] rounded-xl
                           text-sm focus:outline-none focus:border-[#185FA5] transition-colors"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  value={duree}
                  min={0}
                  onChange={(e) => setDuree(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-2 bg-[#F9F9F9] border border-[#E8E8E8] rounded-xl
                             text-sm text-center focus:outline-none focus:border-[#185FA5] transition-colors"
                />
                <span className="text-xs text-[#AAAAAA]">min</span>
              </div>
            </div>

            {/* Mode */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('autonome')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  mode === 'autonome'
                    ? 'bg-[#185FA5] text-white border-[#185FA5]'
                    : 'bg-white text-[#555] border-[#E8E8E8] hover:border-[#185FA5]'
                }`}
              >
                Autonome
              </button>
              <button
                onClick={() => setMode('assiste')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  mode === 'assiste'
                    ? 'bg-[#185FA5] text-white border-[#185FA5]'
                    : 'bg-white text-[#555] border-[#E8E8E8] hover:border-[#185FA5]'
                }`}
              >
                Assisté
              </button>
            </div>

            {/* Démarrer */}
            <button
              onClick={handleDemarrer}
              disabled={starting || !dateSession}
              className="w-full py-3 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                         hover:bg-[#1450A0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? 'Démarrage…' : 'Démarrer →'}
            </button>
          </div>
        )}

        {/* ── Sessions passées ────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">Sessions passées</h2>
          {allSessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center">
              <div className="text-[#CCC] text-sm">Aucune session enregistrée pour cet entraînement.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {allSessions.map((s) => (
                <div key={s.id} className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3">
                  {editingSessionId === s.id ? (
                    /* ── Mode édition ── */
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#1A1A1A] shrink-0">Durée :</span>
                      <input
                        type="number"
                        value={editDuree}
                        min={0}
                        autoFocus
                        onChange={(e) => setEditDuree(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDuree(s.id);
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                        className="w-20 px-2 py-1 bg-[#F9F9F9] border border-[#185FA5] rounded-lg
                                   text-sm text-center focus:outline-none"
                      />
                      <span className="text-xs text-[#AAAAAA]">min</span>
                      <button
                        onClick={() => handleSaveDuree(s.id)}
                        className="ml-1 text-green-600 hover:text-green-800 font-bold text-base leading-none"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingSessionId(null)}
                        className="text-[#AAAAAA] hover:text-[#555] font-bold text-base leading-none"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    /* ── Mode lecture ── */
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1A1A1A]">
                          {new Date(s.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </div>
                        <div className="text-xs text-[#AAAAAA] mt-0.5">
                          {s.nb_exercices} exercice{s.nb_exercices !== 1 ? 's' : ''}
                          {s.duree ? ` · ${s.duree} min` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.mode && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            s.mode === 'autonome'
                              ? 'bg-[#E6F1FB] text-[#185FA5]'
                              : 'bg-[#F0EEFF] text-[#534AB7]'
                          }`}>
                            {s.mode === 'autonome' ? 'Autonome' : 'Assisté'}
                          </span>
                        )}
                        <button
                          onClick={() => { setEditingSessionId(s.id); setEditDuree(String(s.duree ?? '')); }}
                          className="text-[#CCCCCC] hover:text-[#555] transition-colors text-base leading-none"
                          title="Modifier la durée"
                        >
                          ✎
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Boucler ─────────────────────────────────────────────── */}
        {isEnCours && (
          <button
            onClick={handleBoucler}
            disabled={boucling}
            className="w-full py-3 rounded-xl bg-[#2C1810] text-[#FDFAF6] font-semibold text-sm
                       hover:bg-[#3D2418] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {boucling ? 'Bouclage…' : 'Boucler l\'entraînement'}
          </button>
        )}

      </div>
    </div>
  );
}
