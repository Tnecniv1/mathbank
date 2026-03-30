'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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

type Validated = Record<string, boolean>;

type Exercice = {
  id: string;
  type: 'mecanique' | 'chaotique';
  feuille_id: string;
  feuille_titre: string;
  reference: string;
  reussi: boolean | null;
  validated: Validated;
};

// ── Critères chaotiques ────────────────────────────────────────────────────────

const CRITERES = [
  {
    section: 'Compréhension', key: 'C',
    items: [
      { id: 'C1', label: 'Reformuler le problème, définir l\'objectif' },
      { id: 'C2', label: 'Observer ce qu\'on sait et ne sait pas' },
      { id: 'C3', label: 'Démarrer quelque part, converger par itération' },
      { id: 'C4', label: 'Développer une intuition, image mentale' },
    ],
  },
  {
    section: 'Savoir', key: 'S',
    items: [
      { id: 'S1', label: 'Construire un raisonnement logique' },
      { id: 'S2', label: 'Décrire en langage mathématique' },
      { id: 'S3', label: 'Trouver les algorithmes, les exécuter' },
      { id: 'S4', label: 'Calculer sans erreur, vérifier' },
    ],
  },
  {
    section: 'Rédaction', key: 'R',
    items: [
      { id: 'R1', label: 'Respecter la structure et conventions' },
      { id: 'R2', label: 'Décrire le raisonnement, prouver par calculs' },
      { id: 'R3', label: 'Décrire clairement les gestes' },
      { id: 'R4', label: 'Faire des dessins pour expliquer' },
    ],
  },
  {
    section: 'Bilan', key: 'B',
    items: [
      { id: 'B1', label: 'Est-ce que le problème a été résolu ?' },
    ],
  },
];

const EMPTY_VALIDATED: Validated = {
  C1: false, C2: false, C3: false, C4: false,
  S1: false, S2: false, S3: false, S4: false,
  R1: false, R2: false, R3: false, R4: false,
  B1: false,
};

// ── Sous-composant : liste ─────────────────────────────────────────────────────

function ExoList({
  exercices,
  onSelect,
  onAddMeca,
  onAddChaos,
  onBoucler,
}: {
  exercices: Exercice[];
  onSelect: (id: string) => void;
  onAddMeca: (() => void) | null;
  onAddChaos: (() => void) | null;
  onBoucler: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Liste */}
      {exercices.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E8E8] px-5 py-10 text-center">
          <p className="text-sm text-[#CCCCCC]">Aucun exercice pour l'instant.</p>
          <p className="text-xs text-[#DDDDDD] mt-1">Ajoute une roue mécanique ou chaotique ci-dessous.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exercices.map((exo) => (
            <button
              key={exo.id}
              onClick={() => onSelect(exo.id)}
              className="w-full bg-white rounded-xl border border-[#E8E8E8] px-4 py-3 text-left
                         hover:border-[#185FA5] hover:shadow-sm transition-all"
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
          ))}
        </div>
      )}

      {/* Boutons d'ajout */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onAddMeca ?? undefined}
          disabled={!onAddMeca}
          className="py-2.5 rounded-xl border-2 border-[#185FA5] text-[#185FA5] font-semibold
                     text-sm hover:bg-[#E6F1FB] transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Roue (M)
        </button>
        <button
          onClick={onAddChaos ?? undefined}
          disabled={!onAddChaos}
          className="py-2.5 rounded-xl border-2 border-[#534AB7] text-[#534AB7] font-semibold
                     text-sm hover:bg-[#EEEDFB] transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Roue (C)
        </button>
      </div>

      {/* Boucler la feuille */}
      {exercices.length > 0 && (
        <button
          onClick={onBoucler}
          className="w-full py-3 rounded-xl bg-[#2C1810] text-[#FDFAF6] font-semibold text-sm
                     hover:bg-[#3D2418] transition-colors"
        >
          Boucler la feuille
        </button>
      )}
    </div>
  );
}

// ── Sous-composant : formulaire exercice ───────────────────────────────────────

function ExoForm({
  exo,
  onChange,
  onClose,
}: {
  exo: Exercice;
  onChange: (id: string, patch: Partial<Exercice>) => void;
  onClose: () => void;
}) {
  const [reference, setReference] = useState(exo.reference);

  useEffect(() => { setReference(exo.reference); }, [exo.id]);

  const commitReference = () => {
    if (reference !== exo.reference) onChange(exo.id, { reference });
  };

  const toggleReussi = (val: boolean) => {
    onChange(exo.id, { reussi: exo.reussi === val ? null : val });
  };

  const toggleCritere = (key: string) => {
    onChange(exo.id, {
      validated: { ...exo.validated, [key]: !exo.validated[key] },
    });
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Référence */}
      <div>
        <label className="text-xs font-semibold text-[#555] uppercase tracking-wide block mb-1.5">
          Référence
        </label>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          onBlur={commitReference}
          className="w-full px-3 py-2.5 bg-white border border-[#E8E8E8] rounded-xl text-sm
                     focus:outline-none focus:border-[#185FA5] transition-colors"
        />
      </div>

      {/* Résultat */}
      <div>
        <label className="text-xs font-semibold text-[#555] uppercase tracking-wide block mb-1.5">
          Résultat
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => toggleReussi(true)}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              exo.reussi === true
                ? 'bg-[#EAF3DE] text-[#639922] border-[#A3C76A]'
                : 'bg-white text-[#999] border-[#E8E8E8] hover:border-[#A3C76A]'
            }`}
          >
            ✓ Réussi
          </button>
          <button
            onClick={() => toggleReussi(false)}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              exo.reussi === false
                ? 'bg-red-50 text-red-500 border-red-300'
                : 'bg-white text-[#999] border-[#E8E8E8] hover:border-red-300'
            }`}
          >
            ✗ Échoué
          </button>
        </div>
      </div>

      {/* Critères (chaotique uniquement) */}
      {exo.type === 'chaotique' && CRITERES.map((section) => (
        <div key={section.key}>
          <div className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide mb-2">
            {section.section}
          </div>
          <div className="space-y-1.5">
            {section.items.map((item) => {
              const on = exo.validated?.[item.id] === true;
              return (
                <button
                  key={item.id}
                  onClick={() => toggleCritere(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                               text-xs transition-all border ${
                    on
                      ? 'bg-[#EAF3DE] border-[#A3C76A] text-[#3A6A10]'
                      : 'bg-white border-[#E8E8E8] text-[#555] hover:border-[#CCCCCC]'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center
                                    text-[9px] font-bold shrink-0 ${
                    on ? 'bg-[#639922] text-white' : 'bg-[#F0F0F0] text-[#999]'
                  }`}>
                    {on ? '✓' : item.id}
                  </span>
                  <span className="flex-1 leading-snug">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Retour */}
      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                   font-semibold text-sm hover:bg-[#F5F5F5] transition-colors"
      >
        ← Retour à la liste
      </button>

    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AutonomePage() {
  const router = useRouter();

  const [ctx, setCtx]               = useState<SessionContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError]     = useState<string | null>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [entrainementId, setEntrainementId] = useState<string | null>(null);
  const [exercices, setExercices]   = useState<Exercice[]>([]);
  const [activeExoId, setActiveExoId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | null>(null);

  const sessionId  = useRef<string>(Date.now().toString());
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const feuilleMeca  = ctx?.feuilles.find((f) => f.type === 'mecanique') ?? null;
  const feuilleChaos = ctx?.feuilles.find((f) => f.type === 'chaotique') ?? null;
  const activeExo    = exercices.find((e) => e.id === activeExoId) ?? null;

  const today    = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().slice(0, 10);

  // ── Charger userId + contexte ──────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserId(session.user.id);
      try {
        const data: SessionContext = await fetch('/api/session/context').then((r) => r.json());
        setCtx(data);
      } catch (err: any) {
        setCtxError(err.message ?? 'Erreur de chargement');
      } finally {
        setCtxLoading(false);
      }
    };
    init();
  }, []);

  // ── Lire ?entrainement_id ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('entrainement_id');
    if (id) setEntrainementId(id);
  }, [userId]);

  // ── Créer entrainement (lazy) ──────────────────────────────────────────────
  const ensureEntrainement = useCallback(async (): Promise<string | null> => {
    if (entrainementId) return entrainementId;
    if (!userId) return null;
    const { data, error } = await supabase
      .from('entrainement')
      .insert({ user_id: userId, statut: 'en_cours', mode: 'autonome' })
      .select('id')
      .single();
    if (!error && data) { setEntrainementId(data.id); return data.id; }
    console.error('[autonome] create entrainement error:', error);
    return null;
  }, [entrainementId, userId]);

  // ── Sauvegarder grille_observation ────────────────────────────────────────
  const saveGrille = useCallback((exos: Exercice[], eid: string | null, closed = false) => {
    if (!userId) return;
    const payload = {
      id:           sessionId.current,
      user_id:      userId,
      closed,
      inserted:     false,
      entrainement_id: eid ?? null,
      data: {
        id:   sessionId.current,
        meta: {
          user_id: userId,
          feuille: exos[0]?.feuille_titre ?? '',
          sessions: [{ date: todayISO, duree: '0' }],
          nom: '', prenom: '', note: '',
        },
        exercices: exos,
        entrainement_id: eid ?? null,
        closed,
        inserted: false,
      },
    };
    supabase.from('grille_observation').upsert(payload).then(({ error }) => {
      if (error) console.error('[autonome] save error:', error);
      else {
        setSaveStatus('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveStatus(null), 2500);
      }
    });
  }, [userId, todayISO]);

  const scheduleSave = useCallback((exos: Exercice[], eid: string | null) => {
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveGrille(exos, eid), 1000);
  }, [saveGrille]);

  // ── Ajouter un exercice ────────────────────────────────────────────────────
  const addExercice = async (type: 'mecanique' | 'chaotique') => {
    const feuille = type === 'mecanique' ? feuilleMeca : feuilleChaos;
    if (!feuille) return;
    const eid = await ensureEntrainement();
    const sameType = exercices.filter((e) => e.type === type).length;
    const newExo: Exercice = {
      id:            Date.now().toString(),
      type,
      feuille_id:    feuille.id,
      feuille_titre: feuille.titre,
      reference:     `Exo${feuille.prochain_exercice + sameType}`,
      reussi:        null,
      validated:     type === 'chaotique' ? { ...EMPTY_VALIDATED } : {},
    };
    const next = [...exercices, newExo];
    setExercices(next);
    setActiveExoId(newExo.id);
    scheduleSave(next, eid);
  };

  // ── Mettre à jour un exercice ──────────────────────────────────────────────
  const updateExercice = useCallback((id: string, patch: Partial<Exercice>) => {
    setExercices((prev) => {
      const next = prev.map((e) => e.id === id ? { ...e, ...patch } : e);
      scheduleSave(next, entrainementId);
      return next;
    });
  }, [scheduleSave, entrainementId]);

  // ── Boucler ────────────────────────────────────────────────────────────────
  const boucler = async () => {
    const eid = entrainementId ?? await ensureEntrainement();
    saveGrille(exercices, eid, true);
    if (eid) {
      await supabase
        .from('entrainement')
        .update({ statut: 'boucle', updated_at: new Date().toISOString() })
        .eq('id', eid);
    }
    router.push('/session');
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F4EF] flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8E8E8] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={activeExo ? () => setActiveExoId(null) : () => router.push('/session')}
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
            {saveStatus === 'saving' && <span className="text-[10px] text-[#AAAAAA] hidden sm:inline">Sauvegarde…</span>}
            {saveStatus === 'saved'  && <span className="text-[10px] text-green-500 hidden sm:inline">✓ Sauvegardé</span>}
            <button
              onClick={boucler}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold
                         hover:bg-green-700 transition-colors"
            >
              Boucler
            </button>
            <button
              onClick={() => router.push('/session')}
              className="text-xs text-[#AAAAAA] hover:text-[#555] transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>

      {/* ── Corps ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeExo ? (
          <ExoForm
            exo={activeExo}
            onChange={updateExercice}
            onClose={() => setActiveExoId(null)}
          />
        ) : (
          <ExoList
            exercices={exercices}
            onSelect={setActiveExoId}
            onAddMeca={feuilleMeca ? () => addExercice('mecanique') : null}
            onAddChaos={feuilleChaos ? () => addExercice('chaotique') : null}
            onBoucler={boucler}
          />
        )}
      </div>
    </div>
  );
}
