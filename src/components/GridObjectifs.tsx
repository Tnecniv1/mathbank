'use client';

import React, { useState } from 'react';

export interface GridData {
  semaine_debut: string;
  semaine_fin: string;
  statut: 'succes' | 'echec' | 'en_cours' | 'non_fixe';
}

interface GridObjectifsProps {
  data: GridData[];
}

const COLS = 4;

function getCellConfig(statut: string): { bg: string; label: string } {
  switch (statut) {
    case 'succes':   return { bg: 'bg-yellow-400',                       label: 'Objectif réussi' };
    case 'echec':    return { bg: 'bg-gray-900',                         label: 'Objectif échoué' };
    case 'en_cours': return { bg: 'bg-blue-400',                         label: 'En cours' };
    case 'non_fixe': return { bg: 'bg-gray-100 border border-gray-200',  label: "Pas d'objectif" };
    default:         return { bg: 'bg-gray-100',                         label: '' };
  }
}

function formatPeriode(debut: string, fin: string): string {
  const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${new Date(debut).toLocaleDateString('fr-FR', opt)} — ${new Date(fin).toLocaleDateString('fr-FR', opt)}`;
}

type TooltipState = { x: number; y: number; ligne1: string; ligne2: string };

/* ---------------------------------------------------------------
   Composant — rend uniquement le contenu (grille + légende).
   Le wrapper card et le header sont gérés par le parent (page.tsx).
   --------------------------------------------------------------- */
export default function GridObjectifs({ data }: GridObjectifsProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="text-2xl">🎯</div>
        <p className="text-xs text-ink-muted">Aucun objectif fixé pour le moment</p>
      </div>
    );
  }

  // Compléter la dernière ligne jusqu'à un multiple de COLS
  const padded: (GridData | null)[] = [...data];
  const remainder = padded.length % COLS;
  if (remainder !== 0) {
    for (let i = 0; i < COLS - remainder; i++) {
      padded.push(null);
    }
  }

  return (
    <>
      {/* Tooltip fixed — échappe à tout overflow:hidden parent */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg text-center whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <div className="font-medium leading-tight">{tooltip.ligne1}</div>
          <div className="text-gray-400 text-[10px] mt-0.5">{tooltip.ligne2}</div>
        </div>
      )}

      {/* Grille 4 colonnes — flex-1 pour remplir le parent */}
      <div className="flex-1 p-3 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-4 gap-1.5">
          {padded.map((item, index) => {
            if (item === null) {
              return (
                <div
                  key={`pad-${index}`}
                  className="aspect-square rounded-md bg-gray-100 border border-gray-200 opacity-40"
                />
              );
            }

            const { bg, label } = getCellConfig(item.statut);

            return (
              <div
                key={index}
                className={`aspect-square rounded-md ${bg} cursor-default`}
                onMouseEnter={item.semaine_debut ? (e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    x: r.left + r.width / 2,
                    y: r.top,
                    ligne1: formatPeriode(item.semaine_debut, item.semaine_fin),
                    ligne2: label,
                  });
                } : undefined}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="px-3 py-2 border-t border-border flex-shrink-0">
        <div className="flex flex-wrap justify-around gap-x-2 gap-y-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm flex-shrink-0" />
            <span className="text-ink-light text-[10px]">Réussi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-blue-400 rounded-sm flex-shrink-0" />
            <span className="text-ink-light text-[10px]">En cours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-gray-900 rounded-sm flex-shrink-0" />
            <span className="text-ink-light text-[10px]">Échoué</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-gray-100 border border-gray-300 rounded-sm flex-shrink-0" />
            <span className="text-ink-light text-[10px]">Non fixé</span>
          </div>
        </div>
      </div>
    </>
  );
}
