'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

type Etape = 1 | 2 | 3;

type FeuilleDispo = {
  id: string;
  titre: string;
};

type SessionCreee = {
  id: string;
  date_session: string;
  duree: number;
  feuille_mecanique_id: string | null;
  feuille_mecanique_titre: string | null;
  feuille_chaotique_id: string | null;
  feuille_chaotique_titre: string | null;
};

type ExerciceLocal = {
  id: string;
  type: 'mecanique' | 'chaotique';
  reference: string;
  ordre: number;
  reussi: boolean | null;
  c1: boolean; c2: boolean; c3: boolean; c4: boolean;
  s1: boolean; s2: boolean; s3: boolean; s4: boolean;
  r1: boolean; r2: boolean; r3: boolean; r4: boolean;
  correction: boolean;
};

type ChaosForm = {
  reference: string;
  c1: boolean; c2: boolean; c3: boolean; c4: boolean;
  s1: boolean; s2: boolean; s3: boolean; s4: boolean;
  r1: boolean; r2: boolean; r3: boolean; r4: boolean;
  correction: boolean;
};

type ExerciceHistorique = {
  id: string;
  scoreId: string | null;
  type: 'mecanique' | 'chaotique';
  reference: string;
  ordre: number;
  reussi: boolean | null;
  score: number;
  c1: boolean; c2: boolean; c3: boolean; c4: boolean;
  s1: boolean; s2: boolean; s3: boolean; s4: boolean;
  r1: boolean; r2: boolean; r3: boolean; r4: boolean;
  correction: boolean;
};

type SessionHistorique = {
  id: string;
  date_session: string;
  duree: number;
  feuille_mecanique_id: string | null;
  feuille_chaotique_id: string | null;
  exercices: ExerciceHistorique[];
  nb_meca: number;
  nb_chaos: number;
  score_moy_meca: number | null;
  score_moy_chaos: number | null;
};

type RoueApercu = {
  nbSessions: number;
  mecaniques: { reference: string; reussi: boolean }[];
  exo: string | null;
  score: number | null;
  bools: { c1: boolean; c2: boolean; c3: boolean; c4: boolean;
           s1: boolean; s2: boolean; s3: boolean; s4: boolean;
           r1: boolean; r2: boolean; r3: boolean; r4: boolean } | null;
  rawSessions: { date: string; duree: string }[];
};

type RoueSucces = { nb: number; exo: string | null; score: number | null; nbMeca: number };

type RoueDB = {
  id: string;
  data: any;
  updated_at: string;
};

// ─── Grilles ────────────────────────────────────────────────────────────────

const GRILLE_C = [
  { key: 'c1' as const, label: 'Reformuler le problème, le définir précisément' },
  { key: 'c2' as const, label: "Observer ce que l'on sait, et ce que l'on ne sait pas" },
  { key: 'c3' as const, label: 'Démarrer quelque part, et converger par itération' },
  { key: 'c4' as const, label: 'Comprendre profondément le problème, proposer des images' },
];

const GRILLE_S = [
  { key: 's1' as const, label: 'Construire un raisonnement logique, nécessaire et suffisant' },
  { key: 's2' as const, label: 'Trouver les algorithmes pertinents, les exécuter correctement' },
  { key: 's3' as const, label: "Calculer sans faire d'erreur" },
  { key: 's4' as const, label: 'Vérifier son brouillon, et le mettre à l\'épreuve' },
];

const GRILLE_R = [
  { key: 'r1' as const, label: 'Respecter la structure, la langue et les conventions' },
  { key: 'r2' as const, label: 'Proposer des exemples, des images et explications élégantes' },
  { key: 'r3' as const, label: "Décrire l'ensemble du raisonnement, le prouver par les calculs" },
  { key: 'r4' as const, label: 'Beau' },
];

// ─── Calcul score chaotique ─────────────────────────────────────────────────

function calcScoreChaotique(f: { c1: boolean; c2: boolean; c3: boolean; c4: boolean; s1: boolean; s2: boolean; s3: boolean; s4: boolean; r1: boolean; r2: boolean; r3: boolean; r4: boolean; correction: boolean }): number {
  const comp   = ([f.c1, f.c2, f.c3, f.c4].filter(Boolean).length / 4) * 100;
  const savoir = ([f.s1, f.s2, f.s3, f.s4].filter(Boolean).length / 4) * 100;
  const red    = ([f.r1, f.r2, f.r3, f.r4].filter(Boolean).length / 4) * 100;
  return (50 * comp + 25 * savoir + 25 * red) / 100 * (1 + (f.correction ? 0.3 : 0));
}

function emptyChaosForm(): ChaosForm {
  return {
    reference: '',
    c1: false, c2: false, c3: false, c4: false,
    s1: false, s2: false, s3: false, s4: false,
    r1: false, r2: false, r3: false, r4: false,
    correction: false,
  };
}

// ─── Composant grille lecture seule ─────────────────────────────────────────

function GrilleSectionLecture({
  titre,
  items,
  values,
}: {
  titre: string;
  items: readonly { key: string; label: string }[];
  values: Record<string, boolean>;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-1">{titre}</div>
      {items.map(({ key, label }) => (
        <div key={key} className="flex items-start gap-2">
          <span className={`mt-0.5 w-4 h-4 shrink-0 flex items-center justify-center rounded text-xs font-bold ${
            values[key] ? 'bg-status-success/30 text-status-success' : 'bg-cream-200 text-ink-muted'
          }`}>
            {values[key] ? '✓' : '✗'}
          </span>
          <span className={`text-xs leading-tight ${values[key] ? 'text-ink' : 'text-ink-muted'}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Composant grille cases à cocher ────────────────────────────────────────

function GrilleSection({
  titre,
  items,
  values,
  onChange,
}: {
  titre: string;
  items: readonly { key: string; label: string }[];
  values: Record<string, boolean>;
  onChange: (key: string, val: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-1">{titre}</div>
      {items.map(({ key, label }) => (
        <label
          key={key}
          className="flex items-start gap-2 cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={values[key] || false}
            onChange={e => onChange(key, e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent"
          />
          <span className="text-xs text-ink group-hover:text-accent transition-colors leading-tight">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function SessionsPage() {
  const searchParams = useSearchParams();
  const membreParamId = searchParams.get('membre');
  const isChefMode = !!membreParamId;

  const today = new Date().toISOString().split('T')[0];

  const [etape, setEtape]     = useState<Etape>(1);
  const [saving, setSaving]   = useState(false);
  const [authUserId, setAuthUserId] = useState('');
  const [membreNom, setMembreNom]   = useState('');

  // Étape 1 — formulaire
  const [dateSession, setDateSession]     = useState(today);
  const [duree, setDuree]                 = useState(60);
  const [feuilleMecaId, setFeuilleMecaId] = useState('');
  const [feuilleChaosId, setFeuilleChaosId] = useState('');
  const [feuilles, setFeuilles]           = useState<{ meca: FeuilleDispo[]; chaos: FeuilleDispo[] }>({ meca: [], chaos: [] });

  // Session créée
  const [session, setSession] = useState<SessionCreee | null>(null);

  // Historique — navigation
  const [historique, setHistorique]               = useState<SessionHistorique[]>([]);
  const [loadingHistorique, setLoadingHistorique] = useState(false);
  const [sessionOuverte, setSessionOuverte]       = useState<string | null>(null);

  // Historique — édition session
  const [sessionEnEdition, setSessionEnEdition]   = useState<string | null>(null);
  const [editDateSession, setEditDateSession]     = useState('');
  const [editDuree, setEditDuree]                 = useState(60);
  const [editFeuilleMecaId, setEditFeuilleMecaId] = useState('');
  const [editFeuilleChaosId, setEditFeuilleChaosId] = useState('');

  // Historique — vue/édition exercice
  const [exerciceVu, setExerciceVu]               = useState<string | null>(null);
  const [exerciceEnEdition, setExerciceEnEdition] = useState<string | null>(null);
  const [editMecaRef, setEditMecaRef]             = useState('');
  const [editMecaReussi, setEditMecaReussi]       = useState<boolean | null>(null);
  const [editChaosForm, setEditChaosForm]         = useState<ChaosForm>(emptyChaosForm());

  // Étape 2 — exercices
  const [exercices, setExercices]   = useState<ExerciceLocal[]>([]);
  const [formOuvert, setFormOuvert] = useState<'mecanique' | 'chaotique' | null>(null);

  // Formulaire mécanique inline
  const [mecaRef, setMecaRef]       = useState('');
  const [mecaReussi, setMecaReussi] = useState<boolean | null>(null);

  // Formulaire chaotique inline
  const [chaosForm, setChaosForm] = useState<ChaosForm>(emptyChaosForm());

  // Sélection roue (mode chef)
  const [rouesDB, setRouesDB]             = useState<RoueDB[]>([]);
  const [rouesLoading, setRouesLoading]   = useState(false);
  const [roueApercu, setRoueApercu]       = useState<RoueApercu | null>(null);
  const [roueSucces, setRoueSucces]       = useState<RoueSucces | null>(null);
  const [roueErreur, setRoueErreur]       = useState('');
  const [roueImporting, setRoueImporting] = useState(false);

  // ─── Chargement des feuilles disponibles ─────────────────────────────────

  const targetUserId = membreParamId ?? authUserId;

  useEffect(() => {
    async function init() {
      const { data: { session: auth } } = await supabase.auth.getSession();
      if (!auth?.user) return;
      setAuthUserId(auth.user.id);
      const tid = membreParamId ?? auth.user.id;
      if (membreParamId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', membreParamId)
          .maybeSingle();
        setMembreNom(prof?.full_name ?? membreParamId);
      }
      chargerFeuilles(tid);
      chargerHistorique(tid);
      if (membreParamId) chargerRoues();
    }
    init();
  }, []);

  async function chargerFeuilles(uid: string) {
    const { data: membre } = await supabase
      .from('membre_equipe')
      .select('id')
      .eq('user_id', uid)
      .maybeSingle();

    if (membre) {
      // Membre d'une équipe : uniquement les feuilles autorisées
      const { data: autorisees } = await supabase
        .from('feuilles_autorisees')
        .select('feuille_id')
        .eq('membre_id', membre.id);

      const feuilleIds = (autorisees || []).map((a: any) => a.feuille_id).filter(Boolean);

      if (feuilleIds.length > 0) {
        const { data: feuillesData } = await supabase
          .from('feuille_entrainement')
          .select('id, titre, type')
          .in('id', feuilleIds)
          .order('ordre');

        const meca  = (feuillesData || []).filter((f: any) => f.type === 'mecanique').map((f: any) => ({ id: f.id, titre: f.titre }));
        const chaos = (feuillesData || []).filter((f: any) => f.type === 'chaotique').map((f: any) => ({ id: f.id, titre: f.titre }));

        setFeuilles({ meca, chaos });
        if (meca.length  > 0) setFeuilleMecaId(meca[0].id);
        if (chaos.length > 0) setFeuilleChaosId(chaos[0].id);
      }
    } else {
      // Pas dans une équipe : toutes les feuilles
      const { data: feuillesData } = await supabase
        .from('feuille_entrainement')
        .select('id, titre, type')
        .order('ordre');

      const meca  = (feuillesData || []).filter((f: any) => f.type === 'mecanique').map((f: any) => ({ id: f.id, titre: f.titre }));
      const chaos = (feuillesData || []).filter((f: any) => f.type === 'chaotique').map((f: any) => ({ id: f.id, titre: f.titre }));

      setFeuilles({ meca, chaos });
    }
  }

  // ─── Charger l'historique ─────────────────────────────────────────────────

  async function chargerHistorique(uid: string) {
    setLoadingHistorique(true);

    const { data, error } = await supabase
      .from('session')
      .select(`
        id, date_session, duree, feuille_mecanique_id, feuille_chaotique_id,
        exercice (
          id, type, reference, ordre,
          score_exercice ( id, reussi, c1, c2, c3, c4, s1, s2, s3, s4, r1, r2, r3, r4, correction )
        )
      `)
      .eq('user_id', uid)
      .order('date_session', { ascending: false })
      .order('created_at', { ascending: false });

    setLoadingHistorique(false);

    if (error || !data) return;

    const parsed: SessionHistorique[] = data.map((s: any) => {
      const exs: ExerciceHistorique[] = (s.exercice || [])
        .sort((a: any, b: any) => a.ordre - b.ordre)
        .map((ex: any) => {
          const sc = ex.score_exercice?.[0];
          const reussi = ex.type === 'mecanique' ? (sc?.reussi ?? null) : null;
          const score  = ex.type === 'mecanique'
            ? (reussi ? 100 : 0)
            : sc ? Math.round(calcScoreChaotique(sc)) : 0;
          return {
            id: ex.id, scoreId: sc?.id ?? null, type: ex.type,
            reference: ex.reference, ordre: ex.ordre, reussi, score,
            c1: sc?.c1 ?? false, c2: sc?.c2 ?? false, c3: sc?.c3 ?? false, c4: sc?.c4 ?? false,
            s1: sc?.s1 ?? false, s2: sc?.s2 ?? false, s3: sc?.s3 ?? false, s4: sc?.s4 ?? false,
            r1: sc?.r1 ?? false, r2: sc?.r2 ?? false, r3: sc?.r3 ?? false, r4: sc?.r4 ?? false,
            correction: sc?.correction ?? false,
          };
        });

      const mecas  = exs.filter(e => e.type === 'mecanique');
      const chaoss = exs.filter(e => e.type === 'chaotique');

      return {
        id:                   s.id,
        date_session:         s.date_session,
        duree:                s.duree,
        feuille_mecanique_id: s.feuille_mecanique_id,
        feuille_chaotique_id: s.feuille_chaotique_id,
        exercices:            exs,
        nb_meca:              mecas.length,
        nb_chaos:             chaoss.length,
        score_moy_meca:  mecas.length  > 0 ? Math.round(mecas.reduce((a, e)  => a + e.score, 0) / mecas.length)  : null,
        score_moy_chaos: chaoss.length > 0 ? Math.round(chaoss.reduce((a, e) => a + e.score, 0) / chaoss.length) : null,
      };
    });

    setHistorique(parsed);
  }

  // ─── Étape 1 → 2 : créer la session ──────────────────────────────────────

  async function creerSession() {
    const { data: { session: auth } } = await supabase.auth.getSession();
    if (!auth?.user) return;

    setSaving(true);
    let newSessionId: string | null = null;

    if (isChefMode) {
      const { data, error } = await supabase.rpc('insert_session_chef', {
        p_membre_user_id:       membreParamId,
        p_date:                 dateSession,
        p_duree:                duree,
        p_feuille_mecanique_id: feuilleMecaId || null,
        p_feuille_chaotique_id: feuilleChaosId || null,
      });
      if (error || !data) {
        setSaving(false);
        alert('Erreur lors de la création de la session');
        return;
      }
      newSessionId = data as string;
    } else {
      const { data, error } = await supabase
        .from('session')
        .insert({
          user_id:              auth.user.id,
          date_session:         dateSession,
          duree,
          feuille_mecanique_id: feuilleMecaId || null,
          feuille_chaotique_id: feuilleChaosId || null,
        })
        .select()
        .single();
      if (error || !data) {
        setSaving(false);
        alert('Erreur lors de la création de la session');
        return;
      }
      newSessionId = data.id;
    }

    setSaving(false);
    setSession({
      id:                      newSessionId!,
      date_session:            dateSession,
      duree,
      feuille_mecanique_id:    feuilleMecaId || null,
      feuille_mecanique_titre: feuilles.meca.find(f => f.id === feuilleMecaId)?.titre || null,
      feuille_chaotique_id:    feuilleChaosId || null,
      feuille_chaotique_titre: feuilles.chaos.find(f => f.id === feuilleChaosId)?.titre || null,
    });
    setEtape(2);
  }

  // ─── Ajouter exercice mécanique ───────────────────────────────────────────

  async function ajouterMecanique() {
    if (!session || mecaReussi === null) return;

    setSaving(true);
    const ordre = exercices.filter(e => e.type === 'mecanique').length + 1;
    const ref   = mecaRef.trim() || `Ex${ordre}`;

    let exerciceId: string | null = null;

    if (isChefMode) {
      const { data, error } = await supabase.rpc('insert_exercice_chef', {
        p_session_id: session.id, p_type: 'mecanique', p_reference: ref, p_ordre: ordre,
      });
      if (error || !data) {
        setSaving(false);
        alert("Erreur lors de l'ajout de l'exercice");
        return;
      }
      exerciceId = data as string;
      await supabase.rpc('insert_score_exercice_chef', {
        p_exercice_id: exerciceId,
        p_reussi: mecaReussi,
        p_c1: false, p_c2: false, p_c3: false, p_c4: false,
        p_s1: false, p_s2: false, p_s3: false, p_s4: false,
        p_r1: false, p_r2: false, p_r3: false, p_r4: false,
        p_correction: false,
      });
    } else {
      const { data: exData, error } = await supabase
        .from('exercice')
        .insert({ session_id: session.id, type: 'mecanique', reference: ref, ordre })
        .select('id')
        .single();
      if (error || !exData) {
        setSaving(false);
        alert("Erreur lors de l'ajout de l'exercice");
        return;
      }
      exerciceId = exData.id;
      await supabase.from('score_exercice').insert({
        exercice_id: exData.id,
        reussi:      mecaReussi,
      });
    }

    setExercices(prev => [...prev, {
      id:        exerciceId!,
      type:      'mecanique',
      reference: ref,
      ordre,
      reussi:    mecaReussi,
      c1: false, c2: false, c3: false, c4: false,
      s1: false, s2: false, s3: false, s4: false,
      r1: false, r2: false, r3: false, r4: false,
      correction: false,
    }]);

    setMecaRef('');
    setMecaReussi(null);
    setFormOuvert(null);
    setSaving(false);
  }

  // ─── Ajouter exercice chaotique ───────────────────────────────────────────

  async function ajouterChaotique() {
    if (!session) return;

    setSaving(true);
    const ordre = exercices.filter(e => e.type === 'chaotique').length + 1;
    const ref   = chaosForm.reference.trim() || `Ex${ordre}`;

    let exerciceId: string | null = null;

    if (isChefMode) {
      const { data, error } = await supabase.rpc('insert_exercice_chef', {
        p_session_id: session.id, p_type: 'chaotique', p_reference: ref, p_ordre: ordre,
      });
      if (error || !data) {
        setSaving(false);
        alert("Erreur lors de l'ajout de l'exercice");
        return;
      }
      exerciceId = data as string;
      await supabase.rpc('insert_score_exercice_chef', {
        p_exercice_id: exerciceId,
        p_reussi: false,
        p_c1: chaosForm.c1, p_c2: chaosForm.c2, p_c3: chaosForm.c3, p_c4: chaosForm.c4,
        p_s1: chaosForm.s1, p_s2: chaosForm.s2, p_s3: chaosForm.s3, p_s4: chaosForm.s4,
        p_r1: chaosForm.r1, p_r2: chaosForm.r2, p_r3: chaosForm.r3, p_r4: chaosForm.r4,
        p_correction: chaosForm.correction,
      });
    } else {
      const { data: exData, error } = await supabase
        .from('exercice')
        .insert({ session_id: session.id, type: 'chaotique', reference: ref, ordre })
        .select('id')
        .single();
      if (error || !exData) {
        setSaving(false);
        alert("Erreur lors de l'ajout de l'exercice");
        return;
      }
      exerciceId = exData.id;
      await supabase.from('score_exercice').insert({
        exercice_id: exData.id,
        c1: chaosForm.c1, c2: chaosForm.c2, c3: chaosForm.c3, c4: chaosForm.c4,
        s1: chaosForm.s1, s2: chaosForm.s2, s3: chaosForm.s3, s4: chaosForm.s4,
        r1: chaosForm.r1, r2: chaosForm.r2, r3: chaosForm.r3, r4: chaosForm.r4,
        correction: chaosForm.correction,
      });
    }

    setExercices(prev => [...prev, {
      id:        exerciceId!,
      type:      'chaotique',
      reference: ref,
      ordre,
      reussi:    null,
      ...chaosForm,
    }]);

    setChaosForm(emptyChaosForm());
    setFormOuvert(null);
    setSaving(false);
  }

  // ─── Basculer formulaire inline ───────────────────────────────────────────

  function toggleForm(type: 'mecanique' | 'chaotique') {
    if (formOuvert === type) {
      setFormOuvert(null);
    } else {
      setFormOuvert(type);
      if (type === 'mecanique') { setMecaRef(''); setMecaReussi(null); }
      if (type === 'chaotique') setChaosForm(emptyChaosForm());
    }
  }

  // ─── Mettre à jour un champ du formulaire chaotique ──────────────────────

  function setChaosField(key: string, val: boolean) {
    setChaosForm(prev => ({ ...prev, [key]: val }));
  }

  function setEditChaosField(key: string, val: boolean) {
    setEditChaosForm(prev => ({ ...prev, [key]: val }));
  }

  // ─── Ouvrir édition session ───────────────────────────────────────────────

  function ouvrirEditionSession(s: SessionHistorique) {
    setSessionEnEdition(s.id);
    setEditDateSession(s.date_session);
    setEditDuree(s.duree);
    setEditFeuilleMecaId(s.feuille_mecanique_id || '');
    setEditFeuilleChaosId(s.feuille_chaotique_id || '');
    setExerciceVu(null);
    setExerciceEnEdition(null);
  }

  async function sauvegarderSession(sessionId: string) {
    setSaving(true);
    await supabase.from('session').update({
      date_session:         editDateSession,
      duree:                editDuree,
      feuille_mecanique_id: editFeuilleMecaId || null,
      feuille_chaotique_id: editFeuilleChaosId || null,
    }).eq('id', sessionId);
    setSaving(false);
    setSessionEnEdition(null);
    chargerHistorique(targetUserId);
  }

  // ─── Ouvrir édition exercice ──────────────────────────────────────────────

  function ouvrirEditionExercice(ex: ExerciceHistorique) {
    setExerciceVu(null);
    setExerciceEnEdition(ex.id);
    if (ex.type === 'mecanique') {
      setEditMecaRef(ex.reference);
      setEditMecaReussi(ex.reussi);
    } else {
      setEditChaosForm({
        reference:  ex.reference,
        c1: ex.c1, c2: ex.c2, c3: ex.c3, c4: ex.c4,
        s1: ex.s1, s2: ex.s2, s3: ex.s3, s4: ex.s4,
        r1: ex.r1, r2: ex.r2, r3: ex.r3, r4: ex.r4,
        correction: ex.correction,
      });
    }
  }

  async function sauvegarderExercice(ex: ExerciceHistorique) {
    setSaving(true);
    if (ex.type === 'mecanique') {
      const ref = editMecaRef.trim() || ex.reference;
      await Promise.all([
        supabase.from('exercice').update({ reference: ref }).eq('id', ex.id),
        ex.scoreId
          ? supabase.from('score_exercice').update({ reussi: editMecaReussi }).eq('id', ex.scoreId)
          : null,
      ].filter(Boolean));
    } else {
      const ref = editChaosForm.reference.trim() || ex.reference;
      await Promise.all([
        supabase.from('exercice').update({ reference: ref }).eq('id', ex.id),
        ex.scoreId
          ? supabase.from('score_exercice').update({
              c1: editChaosForm.c1, c2: editChaosForm.c2, c3: editChaosForm.c3, c4: editChaosForm.c4,
              s1: editChaosForm.s1, s2: editChaosForm.s2, s3: editChaosForm.s3, s4: editChaosForm.s4,
              r1: editChaosForm.r1, r2: editChaosForm.r2, r3: editChaosForm.r3, r4: editChaosForm.r4,
              correction: editChaosForm.correction,
            }).eq('id', ex.scoreId)
          : null,
      ].filter(Boolean));
    }
    setSaving(false);
    setExerciceEnEdition(null);
    chargerHistorique(targetUserId);
  }

  // ─── Statistiques récapitulatif ───────────────────────────────────────────

  // ─── Sélection roue depuis Supabase ──────────────────────────────────────

  function parseDate(d: string): string {
    if (d.includes('-')) return d; // déjà YYYY-MM-DD
    const [dd, mm, yy] = d.split('/');
    const year = yy.length === 4 ? parseInt(yy, 10) : 2000 + parseInt(yy, 10);
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  async function chargerRoues() {
    setRouesLoading(true);
    const { data } = await supabase
      .from('grille_observation')
      .select('id, data, updated_at')
      .eq('closed', true)
      .order('updated_at', { ascending: false });
    setRouesDB(data || []);
    setRouesLoading(false);
  }

  function selectionnerRoue(roue: RoueDB) {
    setRoueErreur('');
    setRoueApercu(null);
    const json = roue.data;
    const sessions = json.meta?.sessions;
    if (!Array.isArray(sessions) || sessions.length === 0) {
      setRoueErreur('Données manquantes : meta.sessions');
      return;
    }

    let mecaniques: { reference: string; reussi: boolean }[] = [];
    let exo: string | null = null;
    let score: number | null = null;
    let bools: RoueApercu['bools'] = null;

    if (Array.isArray(json.exercices)) {
      // ── Nouveau format ──
      const exosMeca = json.exercices.filter((e: any) => e.type === 'mecanique');
      mecaniques = exosMeca.flatMap((e: any) =>
        Array.isArray(e.observations)
          ? e.observations.map((o: any) => ({ reference: String(o.reference ?? ''), reussi: !!o.reussi }))
          : []
      );

      const exoChaotique = json.exercices.find((e: any) => e.type === 'chaotique');
      const validated = exoChaotique?.validated;
      const hasChaotique = validated && Object.keys(validated).length > 0;
      if (hasChaotique) {
        exo = exoChaotique.reference || json.meta?.exo || null;
        if (!exo) { setRoueErreur('Référence manquante dans l\'exercice chaotique'); return; }
        const v = validated;
        bools = {
          c1: !!(v.C1), c2: !!(v.C2), c3: !!(v.C3), c4: !!(v.C4),
          s1: !!(v.S1), s2: !!(v.S2), s3: !!(v.S3), s4: !!(v.S4),
          r1: !!(v.R1), r2: !!(v.R2), r3: !!(v.R3), r4: !!(v.R4),
        };
        const comp   = ([bools.c1, bools.c2, bools.c3, bools.c4].filter(Boolean).length / 4) * 100;
        const savoir = ([bools.s1, bools.s2, bools.s3, bools.s4].filter(Boolean).length / 4) * 100;
        const red    = ([bools.r1, bools.r2, bools.r3, bools.r4].filter(Boolean).length / 4) * 100;
        score = (50 * comp + 25 * savoir + 25 * red) / 100;
      }
    } else {
      // ── Ancien format ──
      mecaniques =
        Array.isArray(json.mecanique) && json.mecanique.length > 0
          ? json.mecanique.map((m: any) => ({ reference: String(m.reference), reussi: !!m.reussi }))
          : [];

      const validated = json.validated;
      const hasChaotique = validated && Object.keys(validated).length > 0;
      if (hasChaotique) {
        exo = json.meta?.exo ?? null;
        if (!exo) { setRoueErreur('meta.exo manquant dans cette roue'); return; }
        const v = validated;
        bools = {
          c1: !!(v.C1), c2: !!(v.C2), c3: !!(v.C3), c4: !!(v.C4),
          s1: !!(v.S1), s2: !!(v.S2), s3: !!(v.S3), s4: !!(v.S4),
          r1: !!(v.R1), r2: !!(v.R2), r3: !!(v.R3), r4: !!(v.R4),
        };
        const comp   = ([bools.c1, bools.c2, bools.c3, bools.c4].filter(Boolean).length / 4) * 100;
        const savoir = ([bools.s1, bools.s2, bools.s3, bools.s4].filter(Boolean).length / 4) * 100;
        const red    = ([bools.r1, bools.r2, bools.r3, bools.r4].filter(Boolean).length / 4) * 100;
        score = (50 * comp + 25 * savoir + 25 * red) / 100;
      }
    }

    if (mecaniques.length === 0 && !hasChaotique) {
      setRoueErreur('Aucun exercice trouvé dans cette roue');
      return;
    }

    setRoueApercu({ nbSessions: sessions.length, mecaniques, exo, score, bools, rawSessions: sessions });
  }

  async function confirmerImportRoue() {
    if (!roueApercu || !membreParamId) return;
    setRoueImporting(true);
    const { rawSessions, mecaniques, exo, score, bools } = roueApercu;
    const feuilleMeca  = mecaniques.length > 0 ? (feuilles.meca[0]?.id ?? null) : null;
    const feuilleChaos = bools ? (feuilles.chaos[0]?.id ?? null) : null;

    // Sessions vides (toutes sauf la dernière)
    for (let i = 0; i < rawSessions.length - 1; i++) {
      const s = rawSessions[i];
      await supabase.rpc('insert_session_chef', {
        p_membre_user_id:       membreParamId,
        p_date:                 parseDate(s.date),
        p_duree:                parseInt(s.duree) || 0,
        p_feuille_mecanique_id: null,
        p_feuille_chaotique_id: feuilleChaos,
      });
    }

    // Dernière session avec exercices
    const last = rawSessions[rawSessions.length - 1];
    const { data: sessionId } = await supabase.rpc('insert_session_chef', {
      p_membre_user_id:       membreParamId,
      p_date:                 parseDate(last.date),
      p_duree:                parseInt(last.duree) || 0,
      p_feuille_mecanique_id: feuilleMeca,
      p_feuille_chaotique_id: feuilleChaos,
    });

    if (sessionId) {
      let ordreCount = 1;

      // Exercices mécaniques
      for (const m of mecaniques) {
        const { data: exerciceId } = await supabase.rpc('insert_exercice_chef', {
          p_session_id: sessionId as string,
          p_type:       'mecanique',
          p_reference:  m.reference,
          p_ordre:      ordreCount++,
        });
        if (exerciceId) {
          await supabase.rpc('insert_score_exercice_chef', {
            p_exercice_id: exerciceId as string,
            p_reussi:      m.reussi,
            p_c1: false, p_c2: false, p_c3: false, p_c4: false,
            p_s1: false, p_s2: false, p_s3: false, p_s4: false,
            p_r1: false, p_r2: false, p_r3: false, p_r4: false,
            p_correction: false,
          });
        }
      }

      // Exercice chaotique
      if (exo && bools) {
        const { data: exerciceId } = await supabase.rpc('insert_exercice_chef', {
          p_session_id: sessionId as string,
          p_type:       'chaotique',
          p_reference:  exo,
          p_ordre:      ordreCount,
        });
        if (exerciceId) {
          await supabase.rpc('insert_score_exercice_chef', {
            p_exercice_id: exerciceId as string,
            p_reussi:      false,
            p_c1: bools.c1, p_c2: bools.c2, p_c3: bools.c3, p_c4: bools.c4,
            p_s1: bools.s1, p_s2: bools.s2, p_s3: bools.s3, p_s4: bools.s4,
            p_r1: bools.r1, p_r2: bools.r2, p_r3: bools.r3, p_r4: bools.r4,
            p_correction: false,
          });
        }
      }
    }

    setRoueImporting(false);
    setRoueSucces({ nb: rawSessions.length, exo, score, nbMeca: mecaniques.length });
    setRoueApercu(null);
    chargerHistorique(targetUserId);
  }

  const mecas  = exercices.filter(e => e.type === 'mecanique');
  const chaoss = exercices.filter(e => e.type === 'chaotique');

  const scoreMoyenMeca  = mecas.length  > 0 ? Math.round(mecas.reduce((a, e)  => a + (e.reussi ? 100 : 0), 0) / mecas.length)  : null;
  const scoreMoyenChaos = chaoss.length > 0 ? Math.round(chaoss.reduce((a, e) => a + calcScoreChaotique(e),  0) / chaoss.length) : null;

  const scoreChaosCourant = Math.round(calcScoreChaotique(chaosForm));

  // ─── Supprimer la session en cours (étape 2) ─────────────────────────────

  async function supprimerSessionEnCours() {
    if (!session) return;
    if (!confirm('Annuler et supprimer cette session et tous ses exercices ?')) return;
    if (isChefMode) {
      await supabase.rpc('delete_session_chef', { p_session_id: session.id });
    } else {
      await supabase.from('session').delete().eq('id', session.id);
    }
    reset();
  }

  // ─── Supprimer une session de l'historique ────────────────────────────────

  async function supprimerSession(sessionId: string) {
    if (!confirm('Supprimer cette session et tous ses exercices ?')) return;
    if (isChefMode) {
      await supabase.rpc('delete_session_chef', { p_session_id: sessionId });
    } else {
      await supabase.from('session').delete().eq('id', sessionId);
    }
    chargerHistorique(targetUserId);
  }

  // ─── Reset complet ────────────────────────────────────────────────────────

  function reset() {
    setEtape(1);
    setSession(null);
    setExercices([]);
    setFormOuvert(null);
    setMecaRef('');
    setMecaReussi(null);
    setChaosForm(emptyChaosForm());
    setDateSession(today);
    setDuree(60);
    setFeuilleMecaId(feuilles.meca[0]?.id || '');
    setFeuilleChaosId(feuilles.chaos[0]?.id || '');
    chargerHistorique(targetUserId);
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  const selectClass = 'w-full px-3 py-2 rounded-lg border border-border bg-cream-50 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent';
  const inputClass  = 'w-full px-3 py-2 rounded-lg border border-border bg-cream-50 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent';
  const labelClass  = 'block text-xs font-medium text-ink mb-1';

  return (
    <div className="min-h-screen bg-cream-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header + indicateur d'étapes */}
        <div>
          {isChefMode && membreNom && (
            <div className="px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-800">
              📝 Vous insérez une session au nom de {membreNom}
            </div>
          )}
          <h1 className="text-2xl font-bold text-ink mb-4">Nouvelle session</h1>
          <div className="flex items-center gap-2">
            {([1, 2, 3] as Etape[]).map((n, i) => (
              <React.Fragment key={n}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  etape === n
                    ? 'bg-accent text-ink'
                    : etape > n
                    ? 'bg-status-success/20 text-status-success'
                    : 'bg-cream-200 text-ink-muted'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    etape === n ? 'bg-cream-50/20' : etape > n ? 'bg-status-success text-ink' : 'bg-cream-50'
                  }`}>
                    {etape > n ? '✓' : n}
                  </span>
                  {n === 1 ? 'Créer' : n === 2 ? 'Exercices' : 'Récap'}
                </div>
                {i < 2 && <div className="flex-1 h-px bg-border" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Sélection roue — mode chef uniquement */}
        {isChefMode && etape === 1 && (
          <div className="bg-cream-50 border border-border rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-ink mb-4">📥 Insérer une roue</p>

            {/* Liste de roues */}
            {!roueApercu && !roueSucces && (
              <div className="space-y-2">
                {rouesLoading && (
                  <p className="text-sm text-ink-muted text-center py-6">Chargement des roues…</p>
                )}
                {!rouesLoading && rouesDB.length === 0 && (
                  <p className="text-sm text-ink-muted text-center py-6">Aucune roue bouclée disponible.</p>
                )}
                {!rouesLoading && rouesDB.map(roue => {
                  const meta = roue.data?.meta ?? {};
                  const nom   = [meta.prenom, meta.nom].filter(Boolean).join(' ') || '—';
                  const label = [meta.feuille, meta.exo].filter(Boolean).join(' · ') || 'Sans titre';
                  const nbSessions = (meta.sessions ?? []).length;
                  const hasMeca = Array.isArray(roue.data?.mecanique) && roue.data.mecanique.length > 0;
                  const hasChaos = roue.data?.validated && Object.keys(roue.data.validated).length > 0;
                  const dateBouclage = new Date(roue.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
                  return (
                    <button
                      key={roue.id}
                      onClick={() => selectionnerRoue(roue)}
                      className="w-full text-left px-4 py-3 bg-cream-100 hover:bg-cream-200 border border-border rounded-xl transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{nom}</p>
                          <p className="text-xs text-ink-muted truncate">{label}</p>
                          <p className="text-xs text-ink-muted mt-0.5">{nbSessions} session{nbSessions > 1 ? 's' : ''} · bouclée le {dateBouclage}</p>
                        </div>
                        <div className="flex gap-1 shrink-0 mt-0.5">
                          {hasMeca  && <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded">M</span>}
                          {hasChaos && <span className="px-1.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded">C</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {roueErreur && <p className="mt-2 text-xs text-red-500">{roueErreur}</p>}
              </div>
            )}

            {/* Aperçu avant confirmation */}
            {roueApercu && !roueSucces && (
              <div className="space-y-3">
                <div className="bg-cream-100 rounded-lg p-4 space-y-1 text-sm">
                  <p><span className="text-ink-muted">{roueApercu.nbSessions} session{roueApercu.nbSessions > 1 ? 's' : ''} détectée{roueApercu.nbSessions > 1 ? 's' : ''}</span></p>
                  {roueApercu.mecaniques.length > 0 && (
                    <p>
                      <span className="text-ink-muted">{roueApercu.mecaniques.length} exercice{roueApercu.mecaniques.length > 1 ? 's' : ''} mécanique{roueApercu.mecaniques.length > 1 ? 's' : ''} : </span>
                      <span className="font-semibold">{roueApercu.mecaniques.map(m => `${m.reference} ${m.reussi ? '✓' : '✗'}`).join(', ')}</span>
                    </p>
                  )}
                  {roueApercu.exo && roueApercu.score !== null && (
                    <p>
                      <span className="text-ink-muted">Exercice chaotique {roueApercu.exo} — Score : </span>
                      <span className="font-semibold text-accent">{Math.round(roueApercu.score)}%</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={confirmerImportRoue}
                    disabled={roueImporting}
                    className="flex-1 py-2 bg-accent hover:bg-accent/90 disabled:bg-cream-200 disabled:text-ink-muted text-ink font-semibold rounded-lg text-sm transition-colors"
                  >
                    {roueImporting ? 'Insertion...' : '→ Confirmer l’insertion'}
                  </button>
                  <button
                    onClick={() => { setRoueApercu(null); setRoueErreur(''); }}
                    className="px-4 py-2 bg-cream-100 hover:bg-cream-200 text-ink font-medium rounded-lg text-sm transition-colors"
                  >
                    ← Retour
                  </button>
                </div>
              </div>
            )}

            {/* Succès */}
            {roueSucces && (
              <div className="bg-status-success/10 border border-status-success/30 rounded-lg p-4 space-y-1">
                <p className="text-sm font-semibold text-status-success">✅ {roueSucces.nb} session{roueSucces.nb > 1 ? 's' : ''} insérée{roueSucces.nb > 1 ? 's' : ''} pour {membreNom}</p>
                {roueSucces.nbMeca > 0 && <p className="text-sm text-ink-muted">{roueSucces.nbMeca} exercice{roueSucces.nbMeca > 1 ? 's' : ''} mécanique{roueSucces.nbMeca > 1 ? 's' : ''} inséré{roueSucces.nbMeca > 1 ? 's' : ''}</p>}
                {roueSucces.exo && roueSucces.score !== null && <p className="text-sm text-ink-muted">Exercice {roueSucces.exo} — Score : {Math.round(roueSucces.score)}%</p>}
                <button
                  onClick={() => setRoueSucces(null)}
                  className="mt-2 text-xs text-ink-muted underline"
                >
                  Sélectionner une autre roue
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ ÉTAPE 1 ═══════════════ */}
        {etape === 1 && (
          <div className="bg-cream-50 border border-border rounded-xl p-6 space-y-5 shadow-sm">
            <h2 className="font-semibold text-ink">Paramètres de la session</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Date</label>
                <input
                  type="date"
                  value={dateSession}
                  onChange={e => setDateSession(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Durée (minutes)</label>
                <input
                  type="number"
                  min={1}
                  value={duree}
                  onChange={e => setDuree(parseInt(e.target.value) || 1)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Feuille mécanique</label>
              <select
                value={feuilleMecaId}
                onChange={e => setFeuilleMecaId(e.target.value)}
                className={selectClass}
              >
                <option value="">— Aucune —</option>
                {feuilles.meca.map(f => (
                  <option key={f.id} value={f.id}>{f.titre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Feuille chaotique</label>
              <select
                value={feuilleChaosId}
                onChange={e => setFeuilleChaosId(e.target.value)}
                className={selectClass}
              >
                <option value="">— Aucune —</option>
                {feuilles.chaos.map(f => (
                  <option key={f.id} value={f.id}>{f.titre}</option>
                ))}
              </select>
            </div>

            <button
              onClick={creerSession}
              disabled={saving}
              className="w-full py-2.5 bg-accent hover:bg-accent/90 disabled:bg-cream-200 text-ink font-semibold rounded-lg transition-colors"
            >
              {saving ? 'Création...' : 'Créer la session →'}
            </button>
          </div>
        )}

        {/* ═══════════════ ÉTAPE 2 ═══════════════ */}
        {etape === 2 && session && (
          <div className="space-y-4">
            {/* Résumé session */}
            <div className="bg-cream-100 border border-border rounded-xl px-4 py-3 flex flex-wrap gap-4 text-sm text-ink">
              <span className="font-medium">{new Date(session.date_session).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
              <span className="text-ink-muted">·</span>
              <span>{session.duree} min</span>
              {session.feuille_mecanique_titre && (
                <>
                  <span className="text-ink-muted">·</span>
                  <span className="text-blue-600">M : {session.feuille_mecanique_titre}</span>
                </>
              )}
              {session.feuille_chaotique_titre && (
                <>
                  <span className="text-ink-muted">·</span>
                  <span className="text-accent">C : {session.feuille_chaotique_titre}</span>
                </>
              )}
            </div>

            {/* Boutons d'ajout */}
            <div className="flex gap-3">
              <button
                onClick={() => toggleForm('mecanique')}
                className={`flex-1 py-2.5 rounded-lg border-2 font-semibold text-sm transition-colors ${
                  formOuvert === 'mecanique'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-border bg-cream-50 text-ink hover:border-blue-400'
                }`}
              >
                + Exercice mécanique
              </button>
              <button
                onClick={() => toggleForm('chaotique')}
                className={`flex-1 py-2.5 rounded-lg border-2 font-semibold text-sm transition-colors ${
                  formOuvert === 'chaotique'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-cream-50 text-ink hover:border-accent'
                }`}
              >
                + Exercice chaotique
              </button>
            </div>

            {/* ─── Formulaire mécanique inline ─── */}
            {formOuvert === 'mecanique' && (
              <div className="bg-blue-50/30 border border-blue-200 rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-blue-700 text-sm">Exercice mécanique</h3>

                <div>
                  <label className={labelClass}>Référence (ex : Ex3)</label>
                  <input
                    type="text"
                    value={mecaRef}
                    onChange={e => setMecaRef(e.target.value)}
                    placeholder="Ex3"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                <div>
                  <label className={labelClass}>Résultat</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setMecaReussi(true)}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
                        mecaReussi === true
                          ? 'bg-status-success text-ink'
                          : 'bg-cream-100 text-ink hover:bg-green-100'
                      }`}
                    >
                      ✓ Réussi
                    </button>
                    <button
                      onClick={() => setMecaReussi(false)}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
                        mecaReussi === false
                          ? 'bg-red-500 text-white'
                          : 'bg-cream-100 text-ink hover:bg-red-100'
                      }`}
                    >
                      ✗ Échoué
                    </button>
                  </div>
                </div>

                <button
                  onClick={ajouterMecanique}
                  disabled={saving || mecaReussi === null}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-cream-200 disabled:text-ink-muted text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  {saving ? 'Ajout...' : 'Valider'}
                </button>
              </div>
            )}

            {/* ─── Formulaire chaotique inline ─── */}
            {formOuvert === 'chaotique' && (
              <div className="bg-accent/5 border border-accent/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-accent text-sm">Exercice chaotique</h3>
                  <div className="text-right">
                    <div className="text-xs text-ink-muted">Score</div>
                    <div className="text-xl font-bold text-accent">{scoreChaosCourant.toFixed(0)}%</div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Référence (ex : Ex3)</label>
                  <input
                    type="text"
                    value={chaosForm.reference}
                    onChange={e => setChaosField('reference', e.target.value as any)}
                    placeholder="Ex3"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                <div className="space-y-4">
                  <GrilleSection
                    titre="Compréhension"
                    items={GRILLE_C}
                    values={chaosForm}
                    onChange={setChaosField}
                  />
                  <GrilleSection
                    titre="Savoir"
                    items={GRILLE_S}
                    values={chaosForm}
                    onChange={setChaosField}
                  />
                  <GrilleSection
                    titre="Rédaction"
                    items={GRILLE_R}
                    values={chaosForm}
                    onChange={setChaosField}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chaosForm.correction}
                    onChange={e => setChaosField('correction', e.target.checked)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-ink font-medium">Correction effectuée (+30%)</span>
                </label>

                <button
                  onClick={ajouterChaotique}
                  disabled={saving}
                  className="w-full py-2 bg-accent hover:bg-accent/90 disabled:bg-cream-200 text-ink font-semibold rounded-lg transition-colors text-sm"
                >
                  {saving ? 'Ajout...' : 'Valider'}
                </button>
              </div>
            )}

            {/* ─── Liste des exercices ajoutés ─── */}
            {exercices.length > 0 && (
              <div className="bg-cream-50 border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-cream-100 border-b border-border">
                  <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    {exercices.length} exercice{exercices.length > 1 ? 's' : ''} ajouté{exercices.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {exercices.map(ex => (
                    <div key={ex.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          ex.type === 'mecanique'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-accent/20 text-accent'
                        }`}>
                          {ex.type === 'mecanique' ? 'M' : 'C'}
                        </span>
                        <span className="text-sm font-medium text-ink">{ex.reference}</span>
                      </div>
                      <div className="text-sm font-bold">
                        {ex.type === 'mecanique' ? (
                          <span className={ex.reussi ? 'text-status-success' : 'text-red-500'}>
                            {ex.reussi ? '✓ Réussi' : '✗ Échoué'}
                          </span>
                        ) : (
                          <span className="text-accent">{Math.round(calcScoreChaotique(ex))}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bouton terminer */}
            <button
              onClick={() => setEtape(3)}
              className="w-full py-3 bg-status-success hover:bg-status-success/90 text-ink font-bold rounded-xl transition-colors"
            >
              Terminer la session →
            </button>

            {/* Bouton annuler */}
            <button
              onClick={supprimerSessionEnCours}
              disabled={saving}
              className="w-full py-2 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 font-medium rounded-xl transition-colors text-sm"
            >
              Annuler et supprimer la session
            </button>
          </div>
        )}

        {/* ═══════════════ ÉTAPE 3 ═══════════════ */}
        {etape === 3 && session && (
          <div className="space-y-4">
            <div className="bg-cream-50 border border-border rounded-xl p-6">
              <h2 className="font-semibold text-ink mb-4">Récapitulatif</h2>

              {/* Infos session */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-cream-100 rounded-lg p-3 text-center">
                  <div className="text-xs text-ink-muted mb-1">Date</div>
                  <div className="font-semibold text-ink text-sm">
                    {new Date(session.date_session).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <div className="bg-cream-100 rounded-lg p-3 text-center">
                  <div className="text-xs text-ink-muted mb-1">Durée</div>
                  <div className="font-semibold text-ink text-sm">{session.duree} min</div>
                </div>
                {scoreMoyenMeca !== null && (
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-500 mb-1">Score mécanique</div>
                    <div className="text-xl font-bold text-blue-600">{scoreMoyenMeca}%</div>
                    <div className="text-xs text-ink-muted">{mecas.length} exercice{mecas.length > 1 ? 's' : ''}</div>
                  </div>
                )}
                {scoreMoyenChaos !== null && (
                  <div className="bg-accent/10 rounded-lg p-3 text-center">
                    <div className="text-xs text-accent mb-1">Score chaotique</div>
                    <div className="text-xl font-bold text-accent">{scoreMoyenChaos}%</div>
                    <div className="text-xs text-ink-muted">{chaoss.length} exercice{chaoss.length > 1 ? 's' : ''}</div>
                  </div>
                )}
              </div>

              {/* Liste exercices */}
              {exercices.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden mb-5">
                  <div className="bg-cream-100 px-4 py-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    Exercices
                  </div>
                  <div className="divide-y divide-border">
                    {exercices.map((ex, i) => (
                      <div key={ex.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-ink-muted font-mono w-5">{i + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            ex.type === 'mecanique'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-accent/20 text-accent'
                          }`}>
                            {ex.type === 'mecanique' ? 'M' : 'C'}
                          </span>
                          <span className="text-sm text-ink">{ex.reference}</span>
                        </div>
                        <div className="text-sm font-bold">
                          {ex.type === 'mecanique' ? (
                            <span className={ex.reussi ? 'text-status-success' : 'text-red-500'}>
                              {ex.reussi ? '✓' : '✗'}
                            </span>
                          ) : (
                            <span className="text-accent">{Math.round(calcScoreChaotique(ex))}%</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exercices.length === 0 && (
                <div className="text-center py-6 text-ink-muted text-sm">
                  Aucun exercice enregistré
                </div>
              )}

              <button
                onClick={reset}
                className="w-full py-3 bg-accent hover:bg-accent/90 text-ink font-bold rounded-xl transition-colors"
              >
                Confirmer — Nouvelle session
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════ HISTORIQUE ═══════════════ */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Historique</h2>

          {loadingHistorique ? (
            <div className="text-sm text-ink-muted text-center py-6">Chargement...</div>
          ) : historique.length === 0 ? (
            <div className="text-sm text-ink-muted text-center py-8 bg-cream-50 border border-border rounded-xl">
              Aucune session enregistrée
            </div>
          ) : (
            <div className="space-y-2">
              {historique.map(s => (
                <div key={s.id} className="bg-cream-50 border border-border rounded-xl overflow-hidden shadow-sm">

                  {/* ─ Formulaire édition session ─ */}
                  {sessionEnEdition === s.id ? (
                    <div className="px-4 py-4 space-y-3 bg-amber-50/40">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-ink text-sm">Modifier la session</h3>
                        <button
                          onClick={() => setSessionEnEdition(null)}
                          className="text-xs text-ink-muted hover:text-ink transition-colors"
                        >
                          ✕ Annuler
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Date</label>
                          <input type="date" value={editDateSession} onChange={e => setEditDateSession(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Durée (min)</label>
                          <input type="number" min={1} value={editDuree} onChange={e => setEditDuree(parseInt(e.target.value) || 1)} className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Feuille mécanique</label>
                        <select value={editFeuilleMecaId} onChange={e => setEditFeuilleMecaId(e.target.value)} className={selectClass}>
                          <option value="">— Aucune —</option>
                          {feuilles.meca.map(f => <option key={f.id} value={f.id}>{f.titre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Feuille chaotique</label>
                        <select value={editFeuilleChaosId} onChange={e => setEditFeuilleChaosId(e.target.value)} className={selectClass}>
                          <option value="">— Aucune —</option>
                          {feuilles.chaos.map(f => <option key={f.id} value={f.id}>{f.titre}</option>)}
                        </select>
                      </div>
                      <button
                        onClick={() => sauvegarderSession(s.id)}
                        disabled={saving}
                        className="w-full py-2 bg-accent hover:bg-accent/90 disabled:bg-cream-200 text-ink font-semibold rounded-lg text-sm transition-colors"
                      >
                        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                      </button>
                    </div>
                  ) : (
                    /* ─ En-tête session ─ */
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-ink text-sm">
                          {new Date(s.date_session + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {s.duree} min
                          {s.nb_meca  > 0 && <> · <span className="text-blue-600">{s.nb_meca} méca</span></>}
                          {s.nb_chaos > 0 && <> · <span className="text-accent">{s.nb_chaos} chaos</span></>}
                          {s.nb_meca === 0 && s.nb_chaos === 0 && <> · aucun exercice</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.score_moy_meca !== null && (
                          <div className="text-right">
                            <div className="text-[10px] text-ink-muted">Méca</div>
                            <div className="text-sm font-bold text-blue-600">{s.score_moy_meca}%</div>
                          </div>
                        )}
                        {s.score_moy_chaos !== null && (
                          <div className="text-right">
                            <div className="text-[10px] text-ink-muted">Chaos</div>
                            <div className="text-sm font-bold text-accent">{s.score_moy_chaos}%</div>
                          </div>
                        )}
                        {!isChefMode && (
                        <button
                          onClick={() => ouvrirEditionSession(s)}
                          className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-ink-muted hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-colors"
                        >
                          ✎ Modifier
                        </button>
                        )}
                        {!isChefMode && (
                        <button
                          onClick={() => supprimerSession(s.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                          title="Supprimer la session"
                        >
                          🗑
                        </button>
                        )}
                        <button
                          onClick={() => {
                            setSessionOuverte(sessionOuverte === s.id ? null : s.id);
                            setExerciceVu(null);
                            setExerciceEnEdition(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-ink hover:bg-cream-100 transition-colors"
                        >
                          {sessionOuverte === s.id ? '▲' : '▼'} Détail
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─ Accordion détail exercices ─ */}
                  {sessionOuverte === s.id && sessionEnEdition !== s.id && (
                    <div className="border-t border-border bg-cream-100/40">
                      {s.exercices.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-ink-muted text-center">Aucun exercice enregistré</div>
                      ) : (
                        <div className="divide-y divide-border">
                          {s.exercices.map((ex, i) => (
                            <React.Fragment key={ex.id}>

                              {/* Ligne exercice */}
                              <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-ink-muted font-mono w-5 shrink-0">{i + 1}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                                    ex.type === 'mecanique' ? 'bg-blue-100 text-blue-700' : 'bg-accent/20 text-accent'
                                  }`}>
                                    {ex.type === 'mecanique' ? 'M' : 'C'}
                                  </span>
                                  <span className="text-sm text-ink truncate">{ex.reference}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-sm font-bold mr-1">
                                    {ex.type === 'mecanique' ? (
                                      <span className={ex.reussi ? 'text-status-success' : 'text-red-500'}>
                                        {ex.reussi ? '✓' : '✗'}
                                      </span>
                                    ) : (
                                      <span className="text-accent">{ex.score}%</span>
                                    )}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setExerciceEnEdition(null);
                                      setExerciceVu(exerciceVu === ex.id ? null : ex.id);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                      exerciceVu === ex.id
                                        ? 'bg-cream-200 border-border text-ink'
                                        : 'bg-cream-50 border-border text-ink-muted hover:bg-cream-100 hover:text-ink'
                                    }`}
                                  >
                                    Voir
                                  </button>
                                  {!isChefMode && (
                                  <button
                                    onClick={() => {
                                      setExerciceVu(null);
                                      if (exerciceEnEdition === ex.id) setExerciceEnEdition(null);
                                      else ouvrirEditionExercice(ex);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                      exerciceEnEdition === ex.id
                                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                                        : 'bg-cream-50 border-border text-ink-muted hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800'
                                    }`}
                                  >
                                    Modifier
                                  </button>
                                  )}
                                </div>
                              </div>

                              {/* Panel VOIR */}
                              {exerciceVu === ex.id && (
                                <div className={`px-4 py-3 ${
                                  ex.type === 'mecanique'
                                    ? 'bg-blue-50/40 border-t border-blue-100'
                                    : 'bg-accent/5 border-t border-accent/20'
                                }`}>
                                  {ex.type === 'mecanique' ? (
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-medium text-ink">{ex.reference}</span>
                                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                        ex.reussi
                                          ? 'bg-status-success/20 text-status-success'
                                          : 'bg-red-100 text-red-600'
                                      }`}>
                                        {ex.reussi ? '✓ Réussi' : '✗ Échoué'}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-ink">{ex.reference}</span>
                                        <span className="text-lg font-bold text-accent">{ex.score}%</span>
                                      </div>
                                      <GrilleSectionLecture titre="Compréhension" items={GRILLE_C} values={ex} />
                                      <GrilleSectionLecture titre="Savoir"        items={GRILLE_S} values={ex} />
                                      <GrilleSectionLecture titre="Rédaction"     items={GRILLE_R} values={ex} />
                                      {ex.correction && (
                                        <div className="text-xs text-accent font-medium">✓ Correction effectuée (+30%)</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Panel MODIFIER */}
                              {exerciceEnEdition === ex.id && (
                                <div className={`px-4 py-4 space-y-3 ${
                                  ex.type === 'mecanique'
                                    ? 'bg-blue-50/30 border-t border-blue-200'
                                    : 'bg-accent/5 border-t border-accent/20'
                                }`}>
                                  {ex.type === 'mecanique' ? (
                                    <>
                                      <div>
                                        <label className={labelClass}>Référence</label>
                                        <input
                                          type="text"
                                          value={editMecaRef}
                                          onChange={e => setEditMecaRef(e.target.value)}
                                          className={inputClass}
                                          autoFocus
                                        />
                                      </div>
                                      <div>
                                        <label className={labelClass}>Résultat</label>
                                        <div className="flex gap-3">
                                          <button
                                            onClick={() => setEditMecaReussi(true)}
                                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
                                              editMecaReussi === true
                                                ? 'bg-status-success text-ink'
                                                : 'bg-cream-100 text-ink hover:bg-green-100'
                                            }`}
                                          >✓ Réussi</button>
                                          <button
                                            onClick={() => setEditMecaReussi(false)}
                                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
                                              editMecaReussi === false
                                                ? 'bg-red-500 text-white'
                                                : 'bg-cream-100 text-ink hover:bg-red-100'
                                            }`}
                                          >✗ Échoué</button>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-accent">Exercice chaotique</span>
                                        <div className="text-right">
                                          <div className="text-xs text-ink-muted">Score</div>
                                          <div className="text-lg font-bold text-accent">{Math.round(calcScoreChaotique(editChaosForm))}%</div>
                                        </div>
                                      </div>
                                      <div>
                                        <label className={labelClass}>Référence</label>
                                        <input
                                          type="text"
                                          value={editChaosForm.reference}
                                          onChange={e => setEditChaosField('reference', e.target.value as any)}
                                          className={inputClass}
                                          autoFocus
                                        />
                                      </div>
                                      <GrilleSection titre="Compréhension" items={GRILLE_C} values={editChaosForm} onChange={setEditChaosField} />
                                      <GrilleSection titre="Savoir"        items={GRILLE_S} values={editChaosForm} onChange={setEditChaosField} />
                                      <GrilleSection titre="Rédaction"     items={GRILLE_R} values={editChaosForm} onChange={setEditChaosField} />
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={editChaosForm.correction}
                                          onChange={e => setEditChaosField('correction', e.target.checked)}
                                          className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                                        />
                                        <span className="text-sm text-ink font-medium">Correction effectuée (+30%)</span>
                                      </label>
                                    </>
                                  )}
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => sauvegarderExercice(ex)}
                                      disabled={saving || (ex.type === 'mecanique' && editMecaReussi === null)}
                                      className="flex-1 py-2 bg-accent hover:bg-accent/90 disabled:bg-cream-200 disabled:text-ink-muted text-ink font-semibold rounded-lg text-sm transition-colors"
                                    >
                                      {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                                    </button>
                                    <button
                                      onClick={() => setExerciceEnEdition(null)}
                                      className="px-4 py-2 bg-cream-100 hover:bg-cream-200 text-ink font-medium rounded-lg text-sm transition-colors"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              )}

                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
