'use client';

import React, { use, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { WheelForm, Exercice, EMPTY_CROSSES } from '@/components/WheelForm';

// ── Types ──────────────────────────────────────────────────────────────────────

type Feuille = {
  id: string;
  titre: string;
  type: 'mecanique' | 'chaotique';
  pdf_url: string | null;
  prochain_exercice: number;
};

type SessionContext = {
  feuilles: Feuille[];
  profil: { full_name: string };
};

type Session = { id: string; date: string; duree: string };

type RoueRow = {
  id: string;
  closed: boolean;
  updated_at: string;
  data: { exercices?: Exercice[]; meta?: { sessions?: Session[] } };
};

// ── Liste des exercices ────────────────────────────────────────────────────────

function ExoList({
  exercices,
  onSelect,
  onRemove,
  feuilleMeca,
  feuilleChaos,
  onAddRoue,
  onBoucler,
  sessions,
  onSessionsChange,
}: {
  exercices: Exercice[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  feuilleMeca: Feuille | null;
  feuilleChaos: Feuille | null;
  onAddRoue: (type: 'mecanique' | 'chaotique') => void;
  onBoucler: () => void;
  sessions: Session[];
  onSessionsChange: (s: Session[]) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const hasExoEnCours = exercices.some(
    (e) => e.reussi !== true && e.reussi !== false && e.validated?.B1 === undefined,
  );

  const handleAddRoue = () => {
    if (feuilleMeca && feuilleChaos) {
      setShowPicker((v) => !v);
    } else if (feuilleMeca) {
      onAddRoue('mecanique');
    } else if (feuilleChaos) {
      onAddRoue('chaotique');
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {exercices.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E8E8] px-5 py-10 text-center">
          <p className="text-sm text-[#CCCCCC]">Aucun exercice pour l'instant.</p>
          <p className="text-xs text-[#DDDDDD] mt-1">Ajoute une roue ci-dessous.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exercices.map((exo) => (
            <div
              key={exo.id}
              className="w-full bg-white rounded-xl border border-[#E8E8E8] flex items-center
                         hover:border-[#185FA5] hover:shadow-sm transition-all"
            >
              <button
                onClick={() => onSelect(exo.id)}
                className="flex-1 px-4 py-3 text-left min-w-0"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-white text-[10px] font-bold
                                    flex items-center justify-center shrink-0 ${
                    exo.type === 'mecanique' ? 'bg-[#185FA5]' : 'bg-[#534AB7]'
                  }`}>
                    {exo.type === 'mecanique' ? 'M' : 'C'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1A1A1A]">{exo.reference}</div>
                    <div className="text-xs text-[#AAAAAA] truncate">{exo.feuille_titre}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                    exo.reussi === true  ? 'bg-[#EAF3DE] text-[#639922]' :
                    exo.reussi === false ? 'bg-red-50 text-red-500' :
                                           'bg-[#F3F3F3] text-[#999]'
                  }`}>
                    {exo.reussi === true ? '✓ Réussi' : exo.reussi === false ? '✗ Échoué' : 'En cours'}
                  </span>
                </div>
              </button>
              <button
                onClick={() => onRemove(exo.id)}
                className="shrink-0 px-3 py-3 text-[#CCCCCC] hover:text-red-400 transition-colors
                           text-lg leading-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}


      <div>
        <button
          onClick={handleAddRoue}
          disabled={hasExoEnCours || (!feuilleMeca && !feuilleChaos)}
          title={hasExoEnCours ? 'Un exercice est déjà en cours' : undefined}
          className="w-full py-2.5 rounded-xl border-2 border-[#185FA5] text-[#185FA5] font-semibold
                     text-sm hover:bg-[#E6F1FB] transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Roue
        </button>

        {showPicker && (
          <div className="mt-2 bg-white rounded-xl border border-[#E8E8E8] shadow-sm overflow-hidden">
            {feuilleMeca && (
              <button
                onClick={() => { setShowPicker(false); onAddRoue('mecanique'); }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#F5F5F5] transition-colors
                           flex items-center gap-3 border-b border-[#F0F0F0]"
              >
                <span className="w-5 h-5 rounded-full bg-[#185FA5] text-white text-[9px] font-bold
                                 flex items-center justify-center shrink-0">M</span>
                <span className="font-medium text-[#1A1A1A]">{feuilleMeca.titre}</span>
                <span className="text-[#AAAAAA] text-xs ml-auto">Mécanique</span>
              </button>
            )}
            {feuilleChaos && (
              <button
                onClick={() => { setShowPicker(false); onAddRoue('chaotique'); }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#F5F5F5] transition-colors
                           flex items-center gap-3"
              >
                <span className="w-5 h-5 rounded-full bg-[#534AB7] text-white text-[9px] font-bold
                                 flex items-center justify-center shrink-0">C</span>
                <span className="font-medium text-[#1A1A1A]">{feuilleChaos.titre}</span>
                <span className="text-[#AAAAAA] text-xs ml-auto">Chaotique</span>
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Hub des roues ─────────────────────────────────────────────────────────────

function RoueHub({
  allRoues,
  feuilleMeca,
  feuilleChaos,
  onReprendre,
  onNouvelle,
}: {
  allRoues:     RoueRow[];
  feuilleMeca:  Feuille | null;
  feuilleChaos: Feuille | null;
  onReprendre:  (row: RoueRow) => void;
  onNouvelle:   (type: 'mecanique' | 'chaotique') => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const openRoue    = allRoues.find((r) => !r.closed) ?? null;
  const closedRoues = allRoues.filter((r) => r.closed);
  const hasOpen     = !!openRoue;

  const handleNouvelle = () => {
    if (hasOpen) return;
    if (feuilleMeca && feuilleChaos) { setShowPicker((v) => !v); }
    else if (feuilleMeca)            { onNouvelle('mecanique'); }
    else if (feuilleChaos)           { onNouvelle('chaotique'); }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const nbExos = (r: RoueRow) => (r.data.exercices ?? []).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Roue en cours */}
      {openRoue && (
        <div className="bg-white rounded-xl border border-[#185FA5] px-4 py-4
                        flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold text-[#185FA5] uppercase tracking-wide mb-1">
              En cours
            </div>
            <div className="text-sm font-medium text-[#1A1A1A]">
              {nbExos(openRoue)} exercice{nbExos(openRoue) !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-[#AAAAAA]">{fmt(openRoue.updated_at)}</div>
          </div>
          <button
            onClick={() => onReprendre(openRoue)}
            className="px-4 py-2 rounded-lg bg-[#185FA5] text-white text-sm font-semibold
                       hover:bg-[#0E4A8A] transition-colors shrink-0"
          >
            Reprendre →
          </button>
        </div>
      )}

      {/* Roues bouclées */}
      {closedRoues.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wide px-1">
            Bouclées
          </div>
          {closedRoues.map((r) => (
            <div key={r.id}
              className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3
                         flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-[#1A1A1A]">
                  {nbExos(r)} exercice{nbExos(r) !== 1 ? 's' : ''}
                </div>
                <div className="text-xs text-[#AAAAAA]">{fmt(r.updated_at)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                                 bg-[#EAF3DE] text-[#639922]">
                  Bouclée
                </span>
                {nbExos(r) > 0 && (
                  <button
                    onClick={() => onReprendre(r)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E8E8E8] text-[#555]
                               text-xs font-semibold hover:border-[#999] transition-colors"
                  >
                    Voir →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* État vide */}
      {!openRoue && closedRoues.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E8E8E8] px-5 py-10 text-center">
          <p className="text-sm text-[#CCCCCC]">Aucune session pour l'instant.</p>
          <p className="text-xs text-[#DDDDDD] mt-1">Démarre une nouvelle roue ci-dessous.</p>
        </div>
      )}

      {/* Nouvelle roue */}
      <div>
        <button
          onClick={handleNouvelle}
          disabled={hasOpen || (!feuilleMeca && !feuilleChaos)}
          title={hasOpen ? 'Une roue est déjà en cours' : undefined}
          className="w-full py-2.5 rounded-xl border-2 border-[#185FA5] text-[#185FA5] font-semibold
                     text-sm hover:bg-[#E6F1FB] transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Nouvelle roue
        </button>
        {showPicker && !hasOpen && (
          <div className="mt-2 bg-white rounded-xl border border-[#E8E8E8] shadow-sm overflow-hidden">
            {feuilleMeca && (
              <button
                onClick={() => { setShowPicker(false); onNouvelle('mecanique'); }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#F5F5F5] transition-colors
                           flex items-center gap-3 border-b border-[#F0F0F0]"
              >
                <span className="w-5 h-5 rounded-full bg-[#185FA5] text-white text-[9px] font-bold
                                 flex items-center justify-center shrink-0">M</span>
                <span className="font-medium text-[#1A1A1A]">{feuilleMeca.titre}</span>
                <span className="text-[#AAAAAA] text-xs ml-auto">Mécanique</span>
              </button>
            )}
            {feuilleChaos && (
              <button
                onClick={() => { setShowPicker(false); onNouvelle('chaotique'); }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#F5F5F5] transition-colors
                           flex items-center gap-3"
              >
                <span className="w-5 h-5 rounded-full bg-[#534AB7] text-white text-[9px] font-bold
                                 flex items-center justify-center shrink-0">C</span>
                <span className="font-medium text-[#1A1A1A]">{feuilleChaos.titre}</span>
                <span className="text-[#AAAAAA] text-xs ml-auto">Chaotique</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AutonomePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const entrainementId = use(params).id;

  const [ctx, setCtx]               = useState<SessionContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError]     = useState<string | null>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [exercices, setExercices]   = useState<Exercice[]>([]);
  const [activeExoId, setActiveExoId] = useState<string | null>(null);
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [bouclageLoading, setBouclageLoading] = useState(false);
  const [bouclageError, setBouclageError]     = useState<string | null>(null);
  const [allRoues, setAllRoues]               = useState<RoueRow[]>([]);
  const [roueeActive, setRoueeActive]         = useState(false);
  const [roueeReadonly, setRoueeReadonly]     = useState(false);

  // ── Persistance ───────────────────────────────────────────────────────────────
  const sessionIdRef = useRef<string | null>(null);   // session DB id en cours
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionsRef  = useRef<Session[]>([]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  const feuilleMeca  = ctx?.feuilles.find((f) => f.type === 'mecanique') ?? null;
  const feuilleChaos = ctx?.feuilles.find((f) => f.type === 'chaotique') ?? null;
  const activeExo    = exercices.find((e) => e.id === activeExoId) ?? null;

  const today    = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().slice(0, 10);

  // ── Upsert observation (une ligne par exercice) ───────────────────────────────
  const saveToSupabase = useCallback(async (
    exos: Exercice[],
    _sess: Session[],
    closed: boolean,
  ): Promise<void> => {
    const sid = sessionIdRef.current;
    if (!userId || !sid) return;
    const CRITERES = ['C1','C2','C3','C4','S1','S2','S3','S4','R1','R2','R3','R4'];
    for (const exo of exos) {
      const validated = exo.validated ?? {};
      const crosses   = exo.crosses   ?? {};
      let trueCount = 0, evalCount = 0;
      for (const k of CRITERES) {
        const v = validated[k];
        if (v === true || v === null) { evalCount++; if (v === true) trueCount++; }
      }
      const score_global = evalCount > 0 ? Math.round(trueCount / evalCount * 100) : null;
      const nb_erreurs   = Object.values(crosses).reduce((s: number, arr: unknown[]) => s + arr.length, 0);
      const bilan        = (validated.B1 as boolean | null | undefined) ?? null;
      const { error } = await supabase.from('observation').upsert({
        id:           exo.id,
        user_id:      userId,
        session_id:   sid,
        feuille_id:   exo.feuille_id,
        mode:         'autonome',
        reference:    exo.reference,
        type:         exo.type,
        reussi:       exo.reussi,
        data:         { validated: exo.validated, crosses: exo.crosses },
        closed,
        score_global,
        nb_erreurs,
        bilan,
        updated_at:   new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }
  }, [userId]);

  // Debounce 2 s — identique à grille-roue.html scheduleSave
  const scheduleAutoSave = useCallback((exos: Exercice[], sess: Session[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToSupabase(exos, sess, false).catch(console.error);
    }, 2000);
  }, [saveToSupabase]);

  // ── Init ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserId(session.user.id);

      try {
        const data: SessionContext = await fetch('/api/session/context').then((r) => r.json());
        setCtx(data);
      } catch (err: any) {
        setCtxError(err.message ?? 'Erreur de chargement');
      }

      // ── Charger toutes les roues (sessions autonomes + observations) ─────────
      try {
        const { data: sessRows } = await supabase
          .from('session')
          .select('id, closed, created_at')
          .eq('entrainement_id', entrainementId)
          .order('created_at', { ascending: false });

        if (sessRows && sessRows.length > 0) {
          const sessIds = sessRows.map((s) => s.id as string);
          const { data: obsRows } = await supabase
            .from('observation')
            .select('id, session_id, feuille_id, type, reference, reussi, data')
            .in('session_id', sessIds);

          const obsMap: Record<string, Exercice[]> = {};
          for (const obs of obsRows ?? []) {
            if (!obsMap[obs.session_id]) obsMap[obs.session_id] = [];
            obsMap[obs.session_id].push({
              id:            obs.id,
              type:          obs.type as 'mecanique' | 'chaotique',
              feuille_id:    obs.feuille_id ?? '',
              feuille_titre: '',
              reference:     obs.reference ?? '',
              reussi:        obs.reussi ?? null,
              mecaList:      [],
              validated:     obs.data?.validated ?? {},
              crosses:       obs.data?.crosses ?? {},
            });
          }

          const roues = sessRows.map((s) => ({
            id:         s.id as string,
            closed:     (s.closed as boolean) ?? false,
            updated_at: s.created_at as string,
            data:       { exercices: obsMap[s.id as string] ?? [] },
          }));
          setAllRoues(roues);
          console.log('[autonome] sessRows:', JSON.stringify(sessRows));
          console.log('[autonome] obsRows:', JSON.stringify(obsRows));
          console.log('[autonome] allRoues:', JSON.stringify(roues));
        }
      } catch {
        // Pas de roues — démarrage vide normal
      }

      setCtxLoading(false);
    };
    init();
  }, [entrainementId]);

  // ── Lire session_id depuis l'URL ──────────────────────────────────────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session_id');
    if (!id) return;
    const verify = async () => {
      const { data: sessCheck } = await supabase
        .from('session')
        .select('id')
        .eq('id', id)
        .single();
      if (sessCheck) {
        setSessionId(id);
        sessionIdRef.current = id;
      }
      // Si sessCheck est null, on n'initialise pas sessionIdRef — le hub permettra de choisir la bonne session
    };
    verify();
  }, []);

  // ── Exercices ─────────────────────────────────────────────────────────────────
  const addExercice = useCallback(async (type: 'mecanique' | 'chaotique') => {
    const feuille = type === 'mecanique' ? feuilleMeca : feuilleChaos;
    if (!feuille) return;
    const sameType = exercices.filter((e) => e.type === type).length;
    const newExo: Exercice = {
      id:            Date.now().toString(),
      type,
      feuille_id:    feuille.id,
      feuille_titre: feuille.titre,
      reference:     `Exo${feuille.prochain_exercice + sameType}`,
      reussi:        null,
      mecaList:      [],
      validated:     {},
      crosses:       Object.fromEntries(Object.keys(EMPTY_CROSSES).map((k) => [k, []])),
    };
    const next = [...exercices, newExo];
    setExercices(next);
    setActiveExoId(newExo.id);
    setRoueeActive(true);
    setRoueeReadonly(false);
    scheduleAutoSave(next, sessionsRef.current);
  }, [exercices, feuilleMeca, feuilleChaos, scheduleAutoSave]);

  const updateExercice = useCallback((id: string, patch: Partial<Exercice>) => {
    const next = exercices.map((e) => e.id === id ? { ...e, ...patch } : e);
    setExercices(next);
    scheduleAutoSave(next, sessionsRef.current);
  }, [exercices, scheduleAutoSave]);

  // ── CORRECTION 3 : suppression d'exercice ────────────────────────────────────
  const removeExercice = useCallback((id: string) => {
    setExercices((prev) => {
      const next = prev.filter((e) => e.id !== id);
      scheduleAutoSave(next, sessionsRef.current);
      return next;
    });
    setActiveExoId((cur) => cur === id ? null : cur);
  }, [scheduleAutoSave]);

  // ── Charger une roue existante ───────────────────────────────────────────────
  const loadRoue = useCallback((row: RoueRow) => {
    // row.id est le session_id dans le nouveau design
    setSessionId(row.id);
    sessionIdRef.current = row.id;
    const exos = (row.data.exercices ?? []) as Exercice[];
    setExercices(exos);
    setRoueeActive(true);
    setRoueeReadonly(row.closed);
    if (exos.length > 0) setActiveExoId(exos[0].id);
  }, []);

  // ── Sessions avec sauvegarde ──────────────────────────────────────────────────
  const handleSessionsChange = useCallback((s: Session[]) => {
    setSessions(s);
    sessionsRef.current = s;
    setExercices((prev) => { scheduleAutoSave(prev, s); return prev; });
  }, [scheduleAutoSave]);

  // ── Actions contextuelles — exercice individuel ───────────────────────────────
  const bouclerExo = useCallback(() => {
    if (!activeExo) return;
    const b1 = activeExo.validated?.B1;
    const reussi = b1 === true ? true : b1 === null ? false : null;
    updateExercice(activeExo.id, { reussi });
    setActiveExoId(null);
  }, [activeExo, updateExercice]);

  const reporterExo = useCallback(() => {
    setActiveExoId(null);
    setRoueeReadonly(false);
  }, []);

  const abandonnerExo = useCallback(() => {
    if (!activeExo) return;
    removeExercice(activeExo.id);
  }, [activeExo, removeExercice]);

  // ── Choix de mode avant de créer une roue ────────────────────────────────────
  const handleNouvelleRoue = useCallback((type: 'mecanique' | 'chaotique') => {
    addExercice(type);
  }, [addExercice]);

  // ── Boucler ───────────────────────────────────────────────────────────────────
  const boucler = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // Si aucune observation liée à cette session, supprimer la session et retourner
    if (sessionIdRef.current) {
      const { count } = await supabase
        .from('observation')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionIdRef.current);
      if ((count ?? 0) === 0) {
        await supabase.from('session').delete().eq('id', sessionIdRef.current);
        router.push(`/entrainement/${entrainementId}`);
        return;
      }
    }

    // Annuler le debounce en cours et sauvegarder immédiatement avec closed=true
    setBouclageLoading(true);
    setBouclageError(null);
    try {
      await saveToSupabase(exercices, sessionsRef.current, true);
    } catch (err: any) {
      setBouclageError(err.message ?? 'Erreur de sauvegarde');
      setBouclageLoading(false);
      return;
    }
    if (sessionId) {
      await supabase.from('session').update({ closed: true }).eq('id', sessionId);
    }
    router.push(`/entrainement/${entrainementId}`);
  };

  // ── Loading / Error ───────────────────────────────────────────────────────────
  if (ctxLoading) return (
    <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center">
      <span className="text-sm text-[#999]">Chargement…</span>
    </div>
  );

  if (ctxError) return (
    <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm text-center">
        <p className="text-red-700 text-sm">{ctxError}</p>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F4EF] flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-[#E8E8E8] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={activeExo ? () => setActiveExoId(null) : () => router.push(`/entrainement/${entrainementId}`)}
              className="text-sm text-[#185FA5] font-medium shrink-0 hover:underline"
            >
              {activeExo ? '← Liste' : '← Retour'}
            </button>
            <div className="min-w-0">
              <div className="text-[11px] text-[#AAAAAA] leading-tight">{today} · Autonome</div>
              <div className="text-sm font-semibold text-[#1A1A1A] truncate">
                {activeExo
                  ? `${activeExo.type === 'mecanique' ? 'Mécanique' : 'Chaotique'} · ${activeExo.reference}`
                  : 'Grille d\'observation'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bouclageError && (
              <span className="text-[10px] text-red-500 max-w-[120px] leading-tight">
                {bouclageError}
              </span>
            )}
            {activeExo && roueeReadonly ? (
              <button
                onClick={reporterExo}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#E8E8E8] text-[#555]
                           text-xs font-semibold hover:border-[#999] transition-colors"
              >
                ← Retour
              </button>
            ) : activeExo ? (
              <>
                <button
                  onClick={bouclerExo}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold
                             hover:bg-green-700 transition-colors"
                >
                  Boucler
                </button>
                <button
                  onClick={reporterExo}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#E8E8E8] text-[#555]
                             text-xs font-semibold hover:border-[#999] transition-colors"
                >
                  Reporter
                </button>
                <button
                  onClick={abandonnerExo}
                  className="px-3 py-1.5 rounded-lg text-red-400 text-xs font-semibold
                             hover:text-red-600 transition-colors"
                >
                  Abandonner
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={boucler}
                  disabled={bouclageLoading}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold
                             hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bouclageLoading ? '…' : 'Terminer'}
                </button>
                <button
                  onClick={() => router.push(`/entrainement/${entrainementId}`)}
                  className="text-xs text-[#AAAAAA] hover:text-[#555] transition-colors"
                >
                  Reporter
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto">
        {activeExo ? (
          <WheelForm exo={activeExo} onChange={updateExercice} onClose={() => setActiveExoId(null)} readonly={roueeReadonly} />
        ) : roueeActive ? (
          <ExoList
            exercices={exercices}
            onSelect={setActiveExoId}
            onRemove={removeExercice}
            feuilleMeca={feuilleMeca}
            feuilleChaos={feuilleChaos}
            onAddRoue={addExercice}
            onBoucler={boucler}
            sessions={sessions}
            onSessionsChange={handleSessionsChange}
          />
        ) : (
          <RoueHub
            allRoues={allRoues}
            feuilleMeca={feuilleMeca}
            feuilleChaos={feuilleChaos}
            onReprendre={loadRoue}
            onNouvelle={handleNouvelleRoue}
          />
        )}
      </div>

    </div>
  );
}
