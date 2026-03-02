'use client';

import React, { useState } from 'react';

/* ================================================================
   Types
   ================================================================ */

export type JourDetail = {
  date_jour: string;
  /** Meilleure session mécanique du jour (la plus longue) */
  meca_session_id: string | null;
  meca_duree: number;
  meca_nb_questions: number;
  meca_valide: boolean;
  /** Meilleure session chaotique du jour (la plus longue) */
  chaos_session_id: string | null;
  chaos_duree: number;
  chaos_nb_questions: number;
  chaos_valide: boolean;
  /** Vrai si meca_valide ET chaos_valide */
  jour_valide: boolean;
};

export type ProgressionMembre = {
  id: string;
  user_id: string;
  nom: string;
  /** Nombre de jours VALIDES réalisés. */
  nb_jours_valides: number;
  nb_exercices_mecanique_realises: number;
  nb_exercices_chaotique_realises: number;
  objectif_atteint: boolean;
  derniere_mise_a_jour: string;
  /** Détail de chaque jour ayant au moins une session dans la semaine. */
  jours: JourDetail[];
};

export type ObjectifData = {
  id: string;
  equipe_id: string;
  date_debut: string;
  date_fin: string;
  nb_jours_min: number;
  nb_exercices_mecanique: number;
  consignes_mecanique: string | null;
  nb_exercices_chaotique: number;
  consignes_chaotique: string | null;
  description: string | null;
  statut: 'en_cours' | 'succes' | 'echec';
  created_at: string;
  /** Durée minimale pour qu'une session meca ou chaos soit comptée (minutes). */
  duree_min_session: number;
  /** 'auto' : calcul automatique | 'manuel' : le prof force le statut. */
  validation_mode: 'auto' | 'manuel';
  /** Note laissée par le prof lors d'une clôture manuelle. */
  commentaire_manuel: string | null;
  progressions: ProgressionMembre[] | null;
};

/* ================================================================
   Props du composant
   ================================================================ */

type Props = {
  objectif: ObjectifData;
  isChef: boolean;
  onCloturer?: (
    objectifId: string,
    statut: 'succes' | 'echec',
    commentaire?: string
  ) => void;
  onBasculerMode?: (objectifId: string, mode: 'auto' | 'manuel') => void;
};

/* ================================================================
   Helpers
   ================================================================ */

function getStatutBadge(objectif: ObjectifData): {
  label: string;
  color: string;
  bg: string;
} {
  if (objectif.statut === 'succes')
    return { label: 'SUCCÈS', color: 'text-green-700', bg: 'bg-green-100' };
  if (objectif.statut === 'echec')
    return { label: 'ÉCHEC', color: 'text-red-700', bg: 'bg-red-100' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fin = new Date(objectif.date_fin);
  fin.setHours(0, 0, 0, 0);

  if (fin >= today)
    return { label: 'EN COURS', color: 'text-blue-700', bg: 'bg-blue-100' };
  return { label: 'À CLÔTURER', color: 'text-amber-700', bg: 'bg-amber-100' };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function formatDateCourt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  });
}

/* ================================================================
   Composant principal
   ================================================================ */

export default function ObjectifCard({
  objectif,
  isChef,
  onCloturer,
  onBasculerMode,
}: Props) {
  const statut = getStatutBadge(objectif);
  const progressions = objectif.progressions || [];
  const prog = progressions[0] ?? null;
  const jours = prog?.jours ?? [];

  const isCloture = objectif.statut === 'succes' || objectif.statut === 'echec';
  const isExpire =
    objectif.statut === 'en_cours' && new Date(objectif.date_fin) < new Date();
  const isManuel = objectif.validation_mode === 'manuel';

  // Peut clôturer si : chef + en_cours + (expiré en mode auto OU mode manuel)
  const peutCloturer =
    isChef && !isCloture && (isExpire || isManuel) && !!onCloturer;

  // État local pour la clôture avec commentaire
  const [pendingCloture, setPendingCloture] = useState<
    'succes' | 'echec' | null
  >(null);
  const [commentaire, setCommentaire] = useState('');

  function handleConfirmerCloture() {
    if (!pendingCloture || !onCloturer) return;
    onCloturer(objectif.id, pendingCloture, commentaire || undefined);
    setPendingCloture(null);
    setCommentaire('');
  }

  function handleAnnulerCloture() {
    setPendingCloture(null);
    setCommentaire('');
  }

  /* ──────────────────────────────────────────────────────────── */

  return (
    <div
      className={`bg-cream-50 border rounded-lg overflow-hidden ${
        isCloture
          ? 'border-border opacity-80'
          : isExpire
          ? 'border-amber-300'
          : 'border-border'
      }`}
    >
      {/* ── Header ── */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">
              {formatDate(objectif.date_debut)} — {formatDate(objectif.date_fin)}
            </h3>
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded ${statut.bg} ${statut.color}`}
            >
              {statut.label}
            </span>
            {/* Badge mode validation */}
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded ${
                isManuel
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {isManuel ? 'MANUEL' : 'AUTO'}
            </span>
          </div>
          {objectif.description && (
            <p className="text-sm text-ink-light mt-1">{objectif.description}</p>
          )}
          {/* Commentaire manuel affiché sous le titre */}
          {objectif.commentaire_manuel && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">
              💬 {objectif.commentaire_manuel}
            </p>
          )}
        </div>
      </div>

      {/* ── Critères ── */}
      <div className="px-5 py-3 bg-cream-100 border-t border-b border-border space-y-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
          <span>
            📅 {objectif.nb_jours_min} jour
            {objectif.nb_jours_min > 1 ? 's' : ''} valide
            {objectif.nb_jours_min > 1 ? 's' : ''} min
          </span>
          <span>⏱ {objectif.duree_min_session} min/session</span>
          {objectif.nb_exercices_mecanique > 0 && (
            <span>
              🔧 {objectif.nb_exercices_mecanique} exo
              {objectif.nb_exercices_mecanique > 1 ? 's' : ''} meca/jour
            </span>
          )}
          {objectif.nb_exercices_chaotique > 0 && (
            <span>
              🌀 {objectif.nb_exercices_chaotique} exo
              {objectif.nb_exercices_chaotique > 1 ? 's' : ''} chaos/jour
            </span>
          )}
        </div>
        {objectif.consignes_mecanique && (
          <p className="text-xs text-ink-light">
            🔧 {objectif.consignes_mecanique}
          </p>
        )}
        {objectif.consignes_chaotique && (
          <p className="text-xs text-ink-light">
            🌀 {objectif.consignes_chaotique}
          </p>
        )}
      </div>

      {/* ── Détail des jours ── */}
      {jours.length > 0 && (
        <div className="px-5 py-3 border-b border-border space-y-3">

          {/* En-tête colonnes */}
          <div className="grid grid-cols-[3rem_1fr_1fr_1.5rem] gap-x-2 text-xs text-ink-light font-medium uppercase tracking-wide pb-1 border-b border-border/60">
            <span>Date</span>
            <span>🔧 Meca</span>
            <span>🌀 Chaos</span>
            <span className="text-center">Jour</span>
          </div>

          {/* Ligne par jour */}
          {jours.map((j) => (
            <div
              key={j.date_jour}
              className="grid grid-cols-[3rem_1fr_1fr_1.5rem] gap-x-2 items-center text-sm"
            >
              {/* Date */}
              <span className="text-ink-light text-xs shrink-0">
                {formatDateCourt(j.date_jour)}
              </span>

              {/* Session mécanique */}
              {j.meca_session_id ? (
                <div className="flex items-center gap-1">
                  <span
                    className={`text-xs ${
                      j.meca_valide ? 'text-ink' : 'text-ink-light'
                    }`}
                  >
                    {j.meca_duree}min
                    {j.meca_nb_questions > 0 && ` · ${j.meca_nb_questions}q`}
                  </span>
                  <span className="text-xs">{j.meca_valide ? '✅' : '❌'}</span>
                </div>
              ) : (
                <span className="text-xs text-ink-muted italic">—</span>
              )}

              {/* Session chaotique */}
              {j.chaos_session_id ? (
                <div className="flex items-center gap-1">
                  <span
                    className={`text-xs ${
                      j.chaos_valide ? 'text-ink' : 'text-ink-light'
                    }`}
                  >
                    {j.chaos_duree}min
                    {j.chaos_nb_questions > 0 && ` · ${j.chaos_nb_questions}q`}
                  </span>
                  <span className="text-xs">{j.chaos_valide ? '✅' : '❌'}</span>
                </div>
              ) : (
                <span className="text-xs text-ink-muted italic">—</span>
              )}

              {/* Validité du jour */}
              <span className="text-center text-base">
                {j.jour_valide ? '✅' : '❌'}
              </span>
            </div>
          ))}

          {/* Barre de progression jours valides */}
          {prog && (
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink-light">Jours valides</span>
                <span className="font-semibold text-ink">
                  {prog.nb_jours_valides} / {objectif.nb_jours_min}
                </span>
              </div>
              <div className="w-full bg-cream-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    prog.objectif_atteint ? 'bg-green-500' : 'bg-accent'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      objectif.nb_jours_min > 0
                        ? (prog.nb_jours_valides / objectif.nb_jours_min) * 100
                        : 0
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pas encore d'activité ── */}
      {jours.length === 0 && !isCloture && (
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs text-ink-muted text-center">
            Aucune session terminée cette semaine
          </p>
        </div>
      )}

      {/* ── Contrôles chef ── */}
      {isChef && !isCloture && (
        <div className="px-5 py-3 space-y-3">
          {/* Toggle auto / manuel */}
          {onBasculerMode && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-light">Mode validation</span>
              <button
                onClick={() =>
                  onBasculerMode(
                    objectif.id,
                    isManuel ? 'auto' : 'manuel'
                  )
                }
                className="text-xs text-accent hover:underline font-medium"
              >
                {isManuel ? '↩ Repasser en auto' : '✏ Passer en manuel'}
              </button>
            </div>
          )}

          {/* Boutons de clôture */}
          {peutCloturer && !pendingCloture && (
            <div className="flex gap-3">
              <button
                onClick={() => setPendingCloture('succes')}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-sm"
              >
                ✓ Succès
              </button>
              <button
                onClick={() => setPendingCloture('echec')}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors text-sm"
              >
                ✗ Échec
              </button>
            </div>
          )}

          {/* Formulaire commentaire avant confirmation */}
          {pendingCloture && (
            <div className="space-y-2 border border-border rounded-lg p-3 bg-cream-100">
              <p className="text-sm font-medium text-ink">
                Clôturer comme{' '}
                <span
                  className={
                    pendingCloture === 'succes'
                      ? 'text-green-700'
                      : 'text-red-600'
                  }
                >
                  {pendingCloture === 'succes' ? 'Succès' : 'Échec'}
                </span>
              </p>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Commentaire optionnel (visible par l'étudiant)…"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-cream-50 text-ink resize-none focus:outline-none focus:ring-2 focus:ring-accent/20"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmerCloture}
                  className="flex-1 px-3 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Confirmer
                </button>
                <button
                  onClick={handleAnnulerCloture}
                  className="flex-1 px-3 py-1.5 bg-cream-200 hover:bg-cream-200/80 text-ink rounded-lg text-sm font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
