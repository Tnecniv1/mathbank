'use client';

import React, { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { WheelForm, Exercice } from '@/components/WheelForm';

// ── Types ──────────────────────────────────────────────────────────────────────

type Statut = 'en_cours' | 'termine' | 'reporte' | 'abandonne';

type Entrainement = {
  id: string;
  feuille_id: string | null;
  reference: string | null;
  statut: Statut;
  created_at: string;
};

type SessionData = {
  id: string;
  date_session: string;
  duree: number | null;
};

const CRITERES = ['C1','C2','C3','C4','S1','S2','S3','S4','R1','R2','R3','R4'];

const STATUT_CONFIG: Record<Statut, { label: string; bg: string; text: string }> = {
  en_cours:  { label: 'En cours',  bg: 'bg-amber-50',  text: 'text-amber-600' },
  termine:   { label: 'Terminé',   bg: 'bg-[#EAF3DE]', text: 'text-[#639922]' },
  reporte:   { label: 'Reporté',   bg: 'bg-[#F3F3F3]', text: 'text-[#999]' },
  abandonne: { label: 'Abandonné', bg: 'bg-red-50',     text: 'text-red-500' },
};

function formatTemps(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EntrainementPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: entrainementId } = use(params);

  const [entrainement, setEntrainement] = useState<Entrainement | null>(null);
  const [feuilleTitre, setFeuilleTitre] = useState('');
  const [feuilleType, setFeuilleType]   = useState<'mecanique' | 'chaotique'>('chaotique');
  const [obsId, setObsId]               = useState<string | null>(null);
  const [exo, setExo]                   = useState<Exercice | null>(null);
  const [sessions, setSessions]         = useState<SessionData[]>([]);
  const [loading, setLoading]           = useState(true);
  const [userId, setUserId]             = useState<string | null>(null);

  // Refs for debounced save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exoRef       = useRef<Exercice | null>(null);
  useEffect(() => { exoRef.current = exo; }, [exo]);

  // Session modal
  const todayISO = new Date().toISOString().slice(0, 10);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [newDate, setNewDate]   = useState(todayISO);
  const [newDuree, setNewDuree] = useState(30);
  const [addingSession, setAddingSession] = useState(false);

  // Session inline edit / delete
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editDuree, setEditDuree]   = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Statut actions
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadData(mounted);
    return () => { mounted = false; };
  }, []);

  async function loadData(mounted: boolean) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!mounted) return;
    setUserId(session?.user?.id ?? null);

    // Entrainement
    const { data: ent } = await supabase
      .from('entrainement')
      .select('id, feuille_id, reference, statut, created_at')
      .eq('id', entrainementId)
      .single();
    if (!mounted) return;
    if (!ent) { setLoading(false); return; }
    setEntrainement(ent as Entrainement);

    // Feuille titre + type
    if (ent.feuille_id) {
      const { data: noeud } = await supabase
        .from('noeud')
        .select('titre, type')
        .eq('id', ent.feuille_id)
        .single();
      if (!mounted) return;
      if (noeud) {
        setFeuilleTitre(noeud.titre ?? '');
        if (noeud.type === 'mecanique' || noeud.type === 'chaotique') {
          setFeuilleType(noeud.type as 'mecanique' | 'chaotique');
        }
      }
    }

    // Observation
    const { data: obs, error: obsError } = await supabase
      .from('observation')
      .select('id, data, score_global, nb_erreurs, bilan, closed')
      .eq('entrainement_id_final', entrainementId)
      .single();
    console.log('[entrainement] obs result:', obs, obsError);
    if (!mounted) return;
    if (obs) {
      setObsId(obs.id);
      const built: Exercice = {
        id:            obs.id,
        type:          (ent.feuille_id ? feuilleType : 'chaotique'),
        feuille_id:    ent.feuille_id ?? '',
        feuille_titre: '',
        reference:     ent.reference ?? '',
        reussi:        null,
        mecaList:      [],
        validated:     obs.data?.validated ?? {},
        crosses:       obs.data?.crosses   ?? {},
      };
      setExo(built);
      exoRef.current = built;
    }

    // Sessions
    const { data: sess } = await supabase
      .from('session')
      .select('id, date_session, duree')
      .eq('entrainement_id', entrainementId)
      .order('date_session', { ascending: false });
    if (!mounted) return;
    setSessions((sess ?? []) as SessionData[]);

    setLoading(false);
  }

  // Sync feuilleTitre + feuilleType into exo after async load
  useEffect(() => {
    setExo((prev) =>
      prev ? { ...prev, feuille_titre: feuilleTitre, type: feuilleType } : prev
    );
  }, [feuilleTitre, feuilleType]);

  // ── WheelForm ───────────────────────────────────────────────────────────────

  const handleWheelChange = useCallback((id: string, patch: Partial<Exercice>) => {
    setExo((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      exoRef.current = next;
      return next;
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const current = exoRef.current;
      if (!current) return;
      const validated = current.validated ?? {};
      const crosses   = current.crosses   ?? {};
      let trueCount = 0, evalCount = 0;
      for (const k of CRITERES) {
        const v = validated[k];
        if (v === true || v === false) { evalCount++; if (v === true) trueCount++; }
      }
      const score_global = evalCount > 0 ? Math.round(trueCount / evalCount * 100) : null;
      const nb_erreurs   = Object.values(crosses).reduce((s: number, arr: unknown[]) => s + arr.length, 0);
      const bilan        = (validated.B1 as boolean | null | undefined) ?? null;
      await supabase.from('observation').update({
        data:         { validated, crosses },
        score_global,
        nb_erreurs,
        bilan,
        updated_at:   new Date().toISOString(),
      }).eq('entrainement_id_final', entrainementId);
    }, 1500);
  }, [entrainementId]);

  // ── Statut actions ──────────────────────────────────────────────────────────

  async function handleStatut(statut: 'termine' | 'reporte' | 'abandonne') {
    setActioning(true);
    try {
      await supabase
        .from('entrainement')
        .update({ statut, updated_at: new Date().toISOString() })
        .eq('id', entrainementId);
      await supabase
        .from('observation')
        .update({ closed: true })
        .eq('entrainement_id_final', entrainementId);

      if (statut === 'termine' && userId && entrainement?.feuille_id) {
        const feuille_id = entrainement.feuille_id;
        const { data: obsRows } = await supabase
          .from('observation')
          .select('closed, score_global')
          .eq('user_id', userId)
          .eq('feuille_id', feuille_id);
        if (obsRows) {
          const nb_valides = obsRows.filter((r) => r.closed === true).length;
          const scores = obsRows.map((r) => r.score_global).filter((s): s is number => s !== null && s !== undefined);
          const score_moy = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
          await supabase
            .from('progression_feuille')
            .update({ nb_exercices_valides: nb_valides, score_moyen: score_moy })
            .eq('user_id', userId)
            .eq('feuille_id', feuille_id);
        }
      }

      setEntrainement((e) => e ? { ...e, statut } : e);
    } finally {
      setActioning(false);
    }
  }

  // ── Sessions ────────────────────────────────────────────────────────────────

  async function handleAddSession() {
    if (!userId || !newDate) return;
    setAddingSession(true);
    try {
      const { data, error } = await supabase
        .from('session')
        .insert({ entrainement_id: entrainementId, user_id: userId, date_session: newDate, duree: newDuree || 0 })
        .select('id, date_session, duree')
        .single();
      if (error || !data) return;
      setSessions((prev) => [data as SessionData, ...prev]);
      setShowSessionModal(false);
      setNewDate(todayISO);
      setNewDuree(30);
    } finally {
      setAddingSession(false);
    }
  }

  async function handleDeleteSession(id: string) {
    await supabase.from('session').delete().eq('id', id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
  }

  async function handleSaveDuree(id: string) {
    const val = parseInt(editDuree) || 0;
    await supabase.from('session').update({ duree: val }).eq('id', id);
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, duree: val } : s));
    setEditingId(null);
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center">
        <span className="text-sm text-[#999]">Chargement…</span>
      </div>
    );
  }

  const statut    = entrainement?.statut ?? 'en_cours';
  const cfg       = STATUT_CONFIG[statut] ?? STATUT_CONFIG.en_cours;
  const isEnCours = statut === 'en_cours';

  return (
    <div className="min-h-screen bg-[#F5F4EF]">
      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 pt-2">
          <button
            onClick={() => router.push('/session')}
            className="text-sm text-[#185FA5] font-medium hover:underline shrink-0 mt-1"
          >
            ← Retour
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-[#1A1A1A] truncate">
                {feuilleTitre || '—'}
              </h1>
              {entrainement?.reference && (
                <span className="text-sm text-[#888] shrink-0">{entrainement.reference}</span>
              )}
            </div>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* ── Boutons d'action (en_cours seulement) ──────────────── */}
        {isEnCours && (
          <div className="flex gap-2">
            <button
              onClick={() => handleStatut('termine')}
              disabled={actioning}
              className="flex-1 py-2.5 rounded-xl bg-[#639922] text-white font-semibold text-sm
                         hover:bg-[#527A1B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Terminer
            </button>
            <button
              onClick={() => handleStatut('reporte')}
              disabled={actioning}
              className="flex-1 py-2.5 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                         font-semibold text-sm hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reporter
            </button>
            <button
              onClick={() => handleStatut('abandonne')}
              disabled={actioning}
              className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-500
                         font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Abandonner
            </button>
          </div>
        )}

        {/* ── Sessions ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Sessions</h2>
            <button
              onClick={() => setShowSessionModal(true)}
              className="text-xs font-semibold text-[#185FA5] hover:underline"
            >
              + Ajouter une session
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-6 text-center">
              <div className="text-[#CCC] text-sm">Aucune session enregistrée.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#1A1A1A] shrink-0">Durée :</span>
                      <input
                        type="number"
                        value={editDuree}
                        min={0}
                        autoFocus
                        onChange={(e) => setEditDuree(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')  handleSaveDuree(s.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-20 px-2 py-1 bg-[#F9F9F9] border border-[#185FA5] rounded-lg
                                   text-sm text-center focus:outline-none"
                      />
                      <span className="text-xs text-[#AAAAAA]">min</span>
                      <button
                        onClick={() => handleSaveDuree(s.id)}
                        className="text-green-600 hover:text-green-800 font-bold text-base leading-none"
                      >✓</button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-[#AAAAAA] hover:text-[#555] font-bold text-base leading-none"
                      >✕</button>
                    </div>
                  ) : deletingId === s.id ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[#1A1A1A] flex-1">Supprimer cette session ?</span>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold
                                   hover:bg-red-600 transition-colors"
                      >Oui</button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1 rounded-lg bg-white border border-[#E8E8E8] text-[#555]
                                   text-xs font-semibold hover:border-[#999] transition-colors"
                      >Non</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1A1A1A]">
                          {new Date(s.date_session + 'T00:00:00').toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </div>
                        {s.duree ? (
                          <div className="text-xs text-[#AAAAAA] mt-0.5">{formatTemps(s.duree)}</div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { setEditingId(s.id); setEditDuree(String(s.duree ?? '')); }}
                          className="text-[#CCCCCC] hover:text-[#555] transition-colors text-base leading-none"
                          title="Modifier la durée"
                        >✎</button>
                        <button
                          onClick={() => setDeletingId(s.id)}
                          className="text-[#CCCCCC] hover:text-red-400 transition-colors text-sm leading-none"
                          title="Supprimer la session"
                        >✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Roue ────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">Roue</h2>
          {exo ? (
            <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
              <WheelForm
                exo={exo}
                onChange={isEnCours ? handleWheelChange : () => {}}
                readonly={!isEnCours}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-6 text-center">
              <div className="text-[#CCC] text-sm">Aucune observation liée.</div>
            </div>
          )}
        </div>

      </div>

      {/* ── Modal ajout session ──────────────────────────────────── */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-[#1A1A1A]">Ajouter une session</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wide">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 bg-[#F9F9F9] border border-[#E8E8E8] rounded-xl
                             text-sm focus:outline-none focus:border-[#185FA5] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wide">Durée (minutes)</label>
                <input
                  type="number"
                  value={newDuree}
                  min={0}
                  onChange={(e) => setNewDuree(parseInt(e.target.value) || 0)}
                  className="mt-1 w-full px-3 py-2.5 bg-[#F9F9F9] border border-[#E8E8E8] rounded-xl
                             text-sm focus:outline-none focus:border-[#185FA5] transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowSessionModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                           font-semibold text-sm hover:bg-[#F5F5F5] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAddSession}
                disabled={addingSession || !newDate}
                className="flex-1 py-2.5 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                           hover:bg-[#1450A0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingSession ? '…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
