'use client';

import React from 'react';

export type ProgressionMembre = {
  id: string;
  user_id: string;
  nom: string;
  nb_sessions_realisees: number;
  nb_exercices_mecanique_realises: number;
  nb_exercices_chaotique_realises: number;
  objectif_atteint: boolean;
  derniere_mise_a_jour: string;
};

export type ObjectifData = {
  id: string;
  equipe_id: string;
  date_debut: string;
  date_fin: string;
  nb_sessions_min: number;
  nb_exercices_mecanique: number;
  consignes_mecanique: string | null;
  nb_exercices_chaotique: number;
  consignes_chaotique: string | null;
  description: string | null;
  statut: 'en_cours' | 'succes' | 'echec';
  created_at: string;
  progressions: ProgressionMembre[] | null;
};

type Props = {
  objectif: ObjectifData;
  onCloturer?: (objectifId: string, statut: 'succes' | 'echec') => void;
};

function getStatutBadge(objectif: ObjectifData): { label: string; color: string; bg: string } {
  if (objectif.statut === 'succes') {
    return { label: 'SUCCES', color: 'text-green-700', bg: 'bg-green-100' };
  }
  if (objectif.statut === 'echec') {
    return { label: 'ECHEC', color: 'text-red-700', bg: 'bg-red-100' };
  }

  const now = new Date();
  const fin = new Date(objectif.date_fin);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const finDate = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());

  if (finDate >= today) {
    return { label: 'EN COURS', color: 'text-blue-700', bg: 'bg-blue-100' };
  }
  return { label: 'A CLOTURER', color: 'text-amber-700', bg: 'bg-amber-100' };
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  if (max === 0) return null;
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-cream-200 rounded-full h-2 min-w-[60px]">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-ink-light whitespace-nowrap">{value}/{max}</span>
    </div>
  );
}

function getMembreColor(progression: ProgressionMembre): string {
  if (progression.objectif_atteint) return 'border-l-green-500';
  const hasAny =
    progression.nb_sessions_realisees > 0 ||
    progression.nb_exercices_mecanique_realises > 0 ||
    progression.nb_exercices_chaotique_realises > 0;
  if (hasAny) return 'border-l-yellow-500';
  return 'border-l-red-400';
}

export default function ObjectifCard({ objectif, onCloturer }: Props) {
  const statut = getStatutBadge(objectif);
  const progressions = objectif.progressions || [];
  const isExpire = objectif.statut === 'en_cours' && new Date(objectif.date_fin) < new Date();
  const isCloture = objectif.statut === 'succes' || objectif.statut === 'echec';

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <div className={`bg-cream-50 border rounded-lg overflow-hidden ${
      isCloture ? 'border-border opacity-80' : isExpire ? 'border-amber-300' : 'border-border'
    }`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-ink">
              {formatDate(objectif.date_debut)} — {formatDate(objectif.date_fin)}
            </h3>
            <span className={`px-2 py-0.5 text-xs font-bold rounded ${statut.bg} ${statut.color}`}>
              {statut.label}
            </span>
          </div>
          {objectif.description && (
            <p className="text-sm text-ink-light mt-1">{objectif.description}</p>
          )}
        </div>
      </div>

      {/* Criteres */}
      <div className="px-5 py-3 bg-cream-100 border-t border-b border-border space-y-1">
        <div className="flex flex-wrap gap-4 text-sm text-ink">
          <span>📅 {objectif.nb_sessions_min} session{objectif.nb_sessions_min > 1 ? 's' : ''} min</span>
          {objectif.nb_exercices_mecanique > 0 && (
            <span>🔧 {objectif.nb_exercices_mecanique} exo{objectif.nb_exercices_mecanique > 1 ? 's' : ''} meca</span>
          )}
          {objectif.nb_exercices_chaotique > 0 && (
            <span>🌀 {objectif.nb_exercices_chaotique} exo{objectif.nb_exercices_chaotique > 1 ? 's' : ''} chaos</span>
          )}
        </div>
        {objectif.consignes_mecanique && (
          <p className="text-xs text-ink-light">🔧 {objectif.consignes_mecanique}</p>
        )}
        {objectif.consignes_chaotique && (
          <p className="text-xs text-ink-light">🌀 {objectif.consignes_chaotique}</p>
        )}
      </div>

      {/* Progression par membre */}
      <div className="px-5 py-3 space-y-3">
        {progressions.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-2">Aucun membre</p>
        ) : (
          progressions.map((prog) => (
            <div
              key={prog.id}
              className={`border-l-4 pl-3 py-2 ${getMembreColor(prog)}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-ink text-sm">{prog.nom}</span>
                {prog.objectif_atteint && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    ATTEINT
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1 text-xs text-ink-light">
                  <span>📅</span>
                  <ProgressBar
                    value={prog.nb_sessions_realisees}
                    max={objectif.nb_sessions_min}
                    color="bg-blue-500"
                  />
                </div>
                {objectif.nb_exercices_mecanique > 0 && (
                  <div className="flex items-center gap-1 text-xs text-ink-light">
                    <span>🔧</span>
                    <ProgressBar
                      value={prog.nb_exercices_mecanique_realises}
                      max={objectif.nb_exercices_mecanique}
                      color="bg-amber-500"
                    />
                  </div>
                )}
                {objectif.nb_exercices_chaotique > 0 && (
                  <div className="flex items-center gap-1 text-xs text-ink-light">
                    <span>🌀</span>
                    <ProgressBar
                      value={prog.nb_exercices_chaotique_realises}
                      max={objectif.nb_exercices_chaotique}
                      color="bg-purple-500"
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Boutons de cloture pour les objectifs expires */}
      {isExpire && onCloturer && (
        <div className="px-5 py-3 border-t border-border flex gap-3">
          <button
            onClick={() => onCloturer(objectif.id, 'succes')}
            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            ✓ Succes
          </button>
          <button
            onClick={() => onCloturer(objectif.id, 'echec')}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            ✗ Echec
          </button>
        </div>
      )}
    </div>
  );
}
