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
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatJour(d: string) {
  const date = new Date(d + 'T12:00:00');
  const wd = date.toLocaleDateString('fr-FR', { weekday: 'short' });
  const dm = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  return `${wd.charAt(0).toUpperCase() + wd.slice(1, 3)}. ${dm}`;
}

function fmt(nbQ: number): string {
  if (nbQ === 0) return '—';
  return `${nbQ} exercice${nbQ > 1 ? 's' : ''}`;
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

  const pct = prog && objectif.nb_jours_min > 0
    ? Math.min(100, (prog.nb_jours_valides / objectif.nb_jours_min) * 100)
    : 0;

  return (
    <div
      className={`bg-cream-50 border rounded-xl overflow-hidden shadow-sm ${
        isCloture
          ? 'border-border opacity-75'
          : isExpire
          ? 'border-amber-300'
          : 'border-border'
      }`}
    >
      {/* ══════════════ EN-TÊTE ══════════════ */}
      <div className="px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-ink leading-tight">
              {formatDate(objectif.date_debut)}
              <span className="text-ink-muted font-normal mx-2">—</span>
              {formatDate(objectif.date_fin)}
            </h3>
            {objectif.description && (
              <p className="text-sm text-ink-light mt-1.5">{objectif.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <span className={`px-3 py-1 text-sm font-bold rounded-full ${statut.bg} ${statut.color}`}>
              {statut.label}
            </span>
            {isManuel && (
              <span className="px-3 py-1 text-sm font-bold rounded-full bg-amber-100 text-amber-700">
                MANUEL
              </span>
            )}
          </div>
        </div>

        {objectif.commentaire_manuel && (
          <div className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            💬 {objectif.commentaire_manuel}
          </div>
        )}
      </div>

      {/* ══════════════ CRITÈRES ══════════════ */}
      <div className="px-6 py-4 bg-cream-100 border-t border-b border-border">
        <div className="flex flex-wrap gap-3">
          {/* Jours min */}
          <div className="flex items-center gap-2.5 bg-cream-50 border border-border rounded-lg px-4 py-2.5">
            <span className="text-xl">📅</span>
            <div>
              <div className="text-xs text-ink-muted leading-none mb-0.5">Jours valides min</div>
              <div className="text-sm font-bold text-ink">
                {objectif.nb_jours_min} jour{objectif.nb_jours_min > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Durée min */}
          <div className="flex items-center gap-2.5 bg-cream-50 border border-border rounded-lg px-4 py-2.5">
            <span className="text-xl">⏱</span>
            <div>
              <div className="text-xs text-ink-muted leading-none mb-0.5">Durée min/session</div>
              <div className="text-sm font-bold text-ink">{objectif.duree_min_session} min</div>
            </div>
          </div>

          {/* Exos méca */}
          {objectif.nb_exercices_mecanique > 0 && (
            <div className="flex items-center gap-2.5 bg-cream-50 border border-border rounded-lg px-4 py-2.5">
              <span className="text-xl">🔧</span>
              <div>
                <div className="text-xs text-ink-muted leading-none mb-0.5">Méca / jour</div>
                <div className="text-sm font-bold text-ink">
                  {objectif.nb_exercices_mecanique} exercice{objectif.nb_exercices_mecanique > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}

          {/* Exos chaos */}
          {objectif.nb_exercices_chaotique > 0 && (
            <div className="flex items-center gap-2.5 bg-cream-50 border border-border rounded-lg px-4 py-2.5">
              <span className="text-xl">🌀</span>
              <div>
                <div className="text-xs text-ink-muted leading-none mb-0.5">Chaos / jour</div>
                <div className="text-sm font-bold text-ink">
                  {objectif.nb_exercices_chaotique} exercice{objectif.nb_exercices_chaotique > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Consignes */}
        {(objectif.consignes_mecanique || objectif.consignes_chaotique) && (
          <div className="mt-3 space-y-1">
            {objectif.consignes_mecanique && (
              <p className="text-sm text-ink-light">🔧 {objectif.consignes_mecanique}</p>
            )}
            {objectif.consignes_chaotique && (
              <p className="text-sm text-ink-light">🌀 {objectif.consignes_chaotique}</p>
            )}
          </div>
        )}
      </div>

      {/* ══════════════ PROGRESSION ══════════════ */}
      {prog && (
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-base font-semibold text-ink">Jours valides</span>
            <span className={`text-3xl font-bold leading-none ${prog.objectif_atteint ? 'text-green-600' : 'text-ink'}`}>
              {prog.nb_jours_valides}
              <span className="text-lg font-normal text-ink-muted"> / {objectif.nb_jours_min}</span>
            </span>
          </div>
          <div className="w-full bg-cream-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                prog.objectif_atteint ? 'bg-green-500' : 'bg-accent'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {prog.objectif_atteint && (
            <p className="text-sm font-semibold text-green-600 mt-2">✓ Objectif atteint</p>
          )}
        </div>
      )}

      {/* ══════════════ TABLEAU DES JOURS ══════════════ */}
      {jours.length > 0 && (
        <div className="px-6 py-5 border-b border-border">

          {/* En-tête colonnes */}
          <div className="grid grid-cols-[120px_1fr_1fr_72px] gap-x-4 pb-2 border-b-2 border-border mb-3">
            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Date</span>
            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">🔧 Mécanique</span>
            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">🌀 Chaotique</span>
            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider text-center">Jour</span>
          </div>

          {/* Lignes */}
          <div className="space-y-1">
            {jours.map((j) => (
              <div
                key={j.date_jour}
                className={`grid grid-cols-[120px_1fr_1fr_72px] gap-x-4 items-center py-2.5 px-3 rounded-lg ${
                  j.jour_valide ? 'bg-green-50 border border-green-200' : 'border border-transparent hover:bg-cream-100/60'
                }`}
              >
                {/* Date + durée */}
                <div>
                  <div className="text-sm font-semibold text-ink">{formatJour(j.date_jour)}</div>
                  {(j.meca_duree || j.chaos_duree) > 0 && (
                    <div className="text-xs text-ink-muted mt-0.5">
                      {j.meca_duree || j.chaos_duree} min
                    </div>
                  )}
                </div>

                {/* Mécanique — exercices seulement */}
                {j.meca_session_id ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${j.meca_valide ? 'text-ink font-medium' : 'text-ink-light'}`}>
                      {fmt(j.meca_nb_questions)}
                    </span>
                    <span className="text-lg leading-none">{j.meca_valide ? '✅' : '❌'}</span>
                  </div>
                ) : (
                  <span className="text-sm text-ink-muted">—</span>
                )}

                {/* Chaotique — exercices seulement */}
                {j.chaos_session_id ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${j.chaos_valide ? 'text-ink font-medium' : 'text-ink-light'}`}>
                      {fmt(j.chaos_nb_questions)}
                    </span>
                    <span className="text-lg leading-none">{j.chaos_valide ? '✅' : '❌'}</span>
                  </div>
                ) : (
                  <span className="text-sm text-ink-muted">—</span>
                )}

                {/* Jour valide */}
                <div className="text-center text-2xl leading-none">
                  {j.jour_valide ? '✅' : '❌'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pas encore d'activité ── */}
      {jours.length === 0 && !isCloture && (
        <div className="px-6 py-8 border-b border-border text-center">
          <p className="text-sm text-ink-muted">Aucune session terminée cette semaine</p>
        </div>
      )}

      {/* ══════════════ CONTRÔLES CHEF ══════════════ */}
      {isChef && !isCloture && (
        <div className="px-6 py-5 space-y-4">

          {/* Toggle auto / manuel */}
          {onBasculerMode && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-ink">
                Mode validation :{' '}
                <span className="font-semibold">{isManuel ? 'Manuel' : 'Automatique'}</span>
              </span>
              <button
                onClick={() => onBasculerMode(objectif.id, isManuel ? 'auto' : 'manuel')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors shrink-0 ${
                  isManuel
                    ? 'bg-cream-100 border-border text-ink hover:bg-cream-200'
                    : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                }`}
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
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors text-base"
              >
                ✓ Clôturer — Succès
              </button>
              <button
                onClick={() => setPendingCloture('echec')}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors text-base"
              >
                ✗ Clôturer — Échec
              </button>
            </div>
          )}

          {/* Formulaire commentaire avant confirmation */}
          {pendingCloture && (
            <div className="space-y-3 border border-border rounded-xl p-5 bg-cream-100">
              <p className="text-base font-semibold text-ink">
                Clôturer comme{' '}
                <span className={pendingCloture === 'succes' ? 'text-green-700' : 'text-red-600'}>
                  {pendingCloture === 'succes' ? 'Succès' : 'Échec'}
                </span>
              </p>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Commentaire optionnel (visible par l'étudiant)…"
                className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-cream-50 text-ink resize-none focus:outline-none focus:ring-2 focus:ring-accent/20"
                rows={2}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmerCloture}
                  className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent/90 text-ink rounded-lg text-sm font-bold transition-colors"
                >
                  Confirmer
                </button>
                <button
                  onClick={handleAnnulerCloture}
                  className="flex-1 px-4 py-2.5 bg-cream-200 hover:bg-cream-300 text-ink rounded-lg text-sm font-medium transition-colors"
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
