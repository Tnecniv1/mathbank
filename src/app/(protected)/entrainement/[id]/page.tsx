'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { WheelForm, Exercice } from '@/components/WheelForm';

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
  date_session: string | null;
};

type RoueObsData = {
  id: string;
  closed: boolean;
  updated_at: string;
  exercices: Exercice[];
};

type FeuilleActive = {
  id: string;
  titre: string;
  type: 'mecanique' | 'chaotique';
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EntrainementPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: entrainementId } = use(params);

  const [entrainement, setEntrainement] = useState<Entrainement | null>(null);
  const [allExos, setAllExos]           = useState<ExoData[]>([]);
  const [allSessions, setAllSessions]   = useState<SessionData[]>([]);
  const [totalExoAutonome, setTotalExoAutonome] = useState(0);
  const [allRoues, setAllRoues]                 = useState<RoueObsData[]>([]);
  const [expandedExoId, setExpandedExoId]       = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [userId, setUserId]             = useState<string | null>(null);

  // Formulaire nouvelle session
  const todayISO = new Date().toISOString().slice(0, 10);
  const [mode, setMode]           = useState<'autonome' | 'assiste'>('autonome');
  const [dateSession, setDateSession] = useState(todayISO);
  const [duree, setDuree]         = useState<number>(30);
  const [starting, setStarting]         = useState(false);
  const [boucling, setBoucling]         = useState(false);
  const [feuillesActives, setFeuillesActives] = useState<FeuilleActive[]>([]);
  const [selectedFeuilleId, setSelectedFeuilleId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editDuree, setEditDuree]       = useState<string>('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadData(mounted);
    return () => { mounted = false; };
  }, []);

  async function loadData(mounted: boolean) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!mounted) return;
    const uid = session?.user?.id ?? null;
    setUserId(uid);

    const entResult = await supabase
      .from('entrainement')
      .select('id, statut, created_at')
      .eq('id', entrainementId)
      .single();
    if (!mounted) return;
    if (entResult.data) setEntrainement(entResult.data as Entrainement);

    const { data: sessData } = await supabase
      .from('session')
      .select('id, created_at, duree, mode, date_session, exercice(id)')
      .eq('entrainement_id', entrainementId)
      .order('created_at', { ascending: false });
    if (!mounted) return;

    setAllSessions(
      (sessData ?? []).map((s: any) => ({
        id:           s.id,
        created_at:   s.created_at,
        duree:        s.duree ?? null,
        mode:         s.mode ?? null,
        nb_exercices: (s.exercice ?? []).length,
        date_session: s.date_session ?? null,
      }))
    );

    const { data: roueeData } = await supabase
      .from('grille_observation')
      .select('id, closed, updated_at, data')
      .eq('entrainement_id', entrainementId)
      .order('updated_at', { ascending: false });
    if (!mounted) return;

    const parsedRoues: RoueObsData[] = (roueeData ?? []).map((r: any) => ({
      id:         r.id,
      closed:     r.closed ?? false,
      updated_at: r.updated_at,
      exercices:  (r.data?.exercices ?? []).map((e: any) => ({
        id:            e.id,
        type:          e.type as 'mecanique' | 'chaotique',
        feuille_id:    e.feuille_id ?? '',
        feuille_titre: e.feuille_titre ?? '',
        reference:     e.reference ?? '',
        reussi:        e.reussi ?? null,
        mecaList:      e.mecaList ?? [],
        validated:     e.validated ?? {},
        crosses:       e.crosses ?? {},
      })),
    }));

    // Résolution des titres de feuilles depuis la table noeud
    const feuilleIds = [...new Set(
      parsedRoues.flatMap((r) => r.exercices.map((e) => e.feuille_id).filter(Boolean))
    )];
    const titreMap: Record<string, string> = {};
    if (feuilleIds.length > 0) {
      const { data: noeuds } = await supabase
        .from('noeud')
        .select('id, titre')
        .in('id', feuilleIds);
      if (!mounted) return;
      (noeuds ?? []).forEach((n: any) => { titreMap[n.id] = n.titre; });
    }
    const routesWithTitres = parsedRoues.map((r) => ({
      ...r,
      exercices: r.exercices.map((e) => ({
        ...e,
        feuille_titre: titreMap[e.feuille_id] ?? e.feuille_titre ?? e.feuille_id,
      })),
    }));

    setAllRoues(routesWithTitres);
    setTotalExoAutonome(routesWithTitres.reduce((acc, r) => acc + r.exercices.length, 0));

    const sessionIds = (sessData ?? []).map((s: any) => s.id);
    if (sessionIds.length > 0) {
      const { data: exoData } = await supabase
        .from('exercice')
        .select('id, type, reference, score_exercice(reussi)')
        .in('session_id', sessionIds)
        .order('ordre');
      if (!mounted) return;
      setAllExos(
        (exoData ?? []).map((e: any) => ({
          id:       e.id,
          type:     e.type as 'mecanique' | 'chaotique',
          reference: e.reference,
          reussi:   e.score_exercice?.[0]?.reussi ?? null,
        }))
      );
    }

    if (uid && mounted) {
      const { data: progs } = await supabase
        .from('progression_feuille')
        .select('feuille_id, noeud:noeud!feuille_id(id, titre, type)')
        .eq('user_id', uid)
        .eq('en_cours', true)
        .eq('est_termine', false);
      if (mounted) {
        const fa: FeuilleActive[] = (progs ?? [])
          .filter((p: any) => p.noeud)
          .map((p: any) => ({
            id:    p.noeud.id,
            titre: p.noeud.titre,
            type:  p.noeud.type as 'mecanique' | 'chaotique',
          }));
        setFeuillesActives(fa);
        if (fa.length === 1) setSelectedFeuilleId(fa[0].id);
      }
    }

    setLoading(false);
  }

  async function handleDemarrer() {
    if (!userId || !dateSession) return;
    if (mode === 'assiste' && feuillesActives.length >= 2 && !selectedFeuilleId) return;
    setStarting(true);
    try {
      const feuille = mode === 'assiste'
        ? feuillesActives.find((f) => f.id === selectedFeuilleId) ?? null
        : null;
      const sessionPayload: Record<string, unknown> = {
        entrainement_id: entrainementId,
        user_id:         userId,
        date_session:    dateSession,
        duree:           duree || 0,
        mode,
        closed:          false,
      };
      if (feuille) {
        if (feuille.type === 'mecanique') sessionPayload.feuille_mecanique_id = feuille.id;
        else                              sessionPayload.feuille_chaotique_id  = feuille.id;
      }
      const { data, error } = await supabase
        .from('session')
        .insert(sessionPayload)
        .select('id')
        .single();
      if (error || !data) {
        console.error('[demarrer] session insert error:', JSON.stringify(error));
        return;
      }
      router.push(`/entrainement/${entrainementId}/${mode}?session_id=${data.id}`);
    } finally {
      setStarting(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    await supabase.from('session').delete().eq('id', sessionId);
    setAllSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setDeletingSessionId(null);
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

  const sessionDates = allSessions.map((s) => s.date_session).filter(Boolean) as string[];
  const dateMin = sessionDates.length > 0 ? sessionDates.reduce((a, b) => (a < b ? a : b)) : null;
  const dateMax = sessionDates.length > 0 ? sessionDates.reduce((a, b) => (a > b ? a : b)) : null;
  const fallbackDate = entrainement
    ? new Date(entrainement.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const date = (() => {
    if (!dateMin) return fallbackDate;
    const dMin = new Date(dateMin);
    if (!dateMax || dateMin === dateMax) {
      return dMin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const dMax = new Date(dateMax);
    const start = dMin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const end   = dMax.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${start} — ${end}`;
  })();

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

            {/* Sélecteur de feuille (mode assisté, 2+ feuilles actives) */}
            {mode === 'assiste' && feuillesActives.length >= 2 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#555]">Feuille à travailler</p>
                <div className="flex gap-2">
                  {feuillesActives.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFeuilleId(f.id)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors text-left ${
                        selectedFeuilleId === f.id
                          ? f.type === 'mecanique'
                            ? 'bg-[#185FA5] text-white border-[#185FA5]'
                            : 'bg-[#534AB7] text-white border-[#534AB7]'
                          : 'bg-white text-[#555] border-[#E8E8E8] hover:border-[#185FA5]'
                      }`}
                    >
                      <span className="block font-bold">{f.type === 'mecanique' ? 'M' : 'C'}</span>
                      <span className="truncate block">{f.titre}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Démarrer */}
            <button
              onClick={handleDemarrer}
              disabled={starting || !dateSession || (mode === 'assiste' && feuillesActives.length >= 2 && !selectedFeuilleId)}
              className="w-full py-3 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                         hover:bg-[#1450A0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? 'Démarrage…' : 'Démarrer →'}
            </button>
          </div>
        )}

        {/* ── Sessions passées ────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">
            Sessions passées
            {totalExoAutonome > 0 && (
              <span className="ml-2 text-xs font-normal text-[#AAAAAA]">
                · {totalExoAutonome} exercice{totalExoAutonome !== 1 ? 's' : ''} (roues)
              </span>
            )}
          </h2>
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
                  ) : deletingSessionId === s.id ? (
                    /* ── Confirmation suppression ── */
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[#1A1A1A] flex-1">Supprimer cette session ?</span>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold
                                   hover:bg-red-600 transition-colors"
                      >
                        Oui
                      </button>
                      <button
                        onClick={() => setDeletingSessionId(null)}
                        className="px-3 py-1 rounded-lg bg-white border border-[#E8E8E8] text-[#555]
                                   text-xs font-semibold hover:border-[#999] transition-colors"
                      >
                        Non
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
                        {s.duree ? (
                          <div className="text-xs text-[#AAAAAA] mt-0.5">{s.duree} min</div>
                        ) : null}
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
                        <button
                          onClick={() => setDeletingSessionId(s.id)}
                          className="text-[#CCCCCC] hover:text-red-400 transition-colors text-sm leading-none"
                          title="Supprimer la session"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Roues ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">Roues</h2>
          {allRoues.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center">
              <div className="text-[#CCC] text-sm">Aucune roue enregistrée.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {allRoues.flatMap((r) => r.exercices.map((exo) => ({ ...exo, roueClosed: r.closed }))).map((exo) => {
                const CRITERES = ['C1','C2','C3','C4','S1','S2','S3','S4','R1','R2','R3','R4'];
                let valides = 0, evalues = 0;
                for (const k of CRITERES) {
                  const v = exo.validated?.[k];
                  if (v === true || v === null) {
                    evalues++;
                    if (v === true) valides++;
                  }
                }
                const score = evalues > 0 ? Math.round((valides / evalues) * 100) : null;
                const isOpen = expandedExoId === exo.id;
                return (
                  <div key={exo.id} className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
                    <button
                      onClick={() => setExpandedExoId(isOpen ? null : exo.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#FAFAFA] transition-colors"
                    >
                      <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold
                                        flex items-center justify-center shrink-0 ${
                        exo.type === 'mecanique' ? 'bg-[#185FA5]' : 'bg-[#534AB7]'
                      }`}>
                        {exo.type === 'mecanique' ? 'M' : 'C'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[#1A1A1A] truncate">
                          {exo.feuille_titre || exo.feuille_id || '—'}
                        </div>
                        <div className="text-xs text-[#AAAAAA] mt-0.5">{exo.reference}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        exo.roueClosed ? 'bg-[#1A1A1A] text-white' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {exo.roueClosed ? 'Bouclée' : 'En cours'}
                      </span>
                      {score !== null ? (
                        <span className={`text-sm font-bold shrink-0 ${
                          score === 100 ? 'text-[#639922]' : score >= 50 ? 'text-amber-500' : 'text-[#999]'
                        }`}>
                          {score}%
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-[#CCCCCC] shrink-0">—</span>
                      )}
                      <span className="text-[#CCCCCC] text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#F0F0F0] px-2 pt-2 pb-1">
                        <WheelForm exo={exo} readonly={true} onChange={() => {}} onClose={() => {}} />
                      </div>
                    )}
                  </div>
                );
              })}
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
