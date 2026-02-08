'use client';

import React from 'react';

export interface GridData {
  semaine_debut: string;
  semaine_fin: string;
  statut: 'succes' | 'echec' | 'non_fixe';
}

interface GridObjectifsProps {
  data: GridData[];
}

function getColor(statut: string): string {
  switch (statut) {
    case 'succes': return 'bg-purple-500';
    case 'echec': return 'bg-red-500';
    case 'non_fixe': return 'bg-cream-200';
    default: return 'bg-gray-300';
  }
}

function getLabel(statut: string): string {
  switch (statut) {
    case 'succes': return 'Objectif reussi';
    case 'echec': return 'Objectif echoue';
    case 'non_fixe': return 'Pas d\'objectif';
    default: return '';
  }
}

function formatPeriode(debut: string, fin: string): string {
  const d = new Date(debut);
  const f = new Date(fin);
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au ${f.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
}

export default function GridObjectifs({ data }: GridObjectifsProps) {
  const nbReussis = data.filter(d => d.statut === 'succes').length;
  const nbEchoues = data.filter(d => d.statut === 'echec').length;
  const nbTotal = data.filter(d => d.statut !== 'non_fixe').length;

  return (
    <div className="bg-cream-50 rounded-xl border border-border shadow-sm overflow-hidden aspect-square flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-ink">Objectifs hebdomadaires</h2>
          <p className="text-ink-light text-xs">
            {nbTotal > 0 ? `${nbReussis}/${nbTotal} reussi${nbReussis > 1 ? 's' : ''}` : 'Aucun objectif'}
          </p>
        </div>
      </div>

      {/* Grille */}
      <div className="flex-1 min-h-0 p-3 flex items-center justify-center">
        {data.length === 0 ? (
          <div className="text-center text-ink-muted">
            <div className="text-2xl mb-1">🎯</div>
            <p className="text-xs">Aucune donnee</p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5 w-full">
            {data.map((item, index) => (
              <div
                key={index}
                className={`
                  ${getColor(item.statut)}
                  aspect-square rounded-md
                  cursor-pointer
                  transition-all duration-200
                  hover:scale-110 hover:shadow-lg
                  group relative
                `}
              >
                <div className="
                  absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                  hidden group-hover:block
                  bg-gray-900 text-white text-xs rounded px-2 py-1
                  whitespace-nowrap z-10
                  pointer-events-none
                ">
                  {formatPeriode(item.semaine_debut, item.semaine_fin)}
                  <br />
                  {getLabel(item.statut)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Legende */}
      <div className="px-3 py-1.5 border-t border-border flex-shrink-0">
        <div className="flex justify-around text-center text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-purple-500 rounded-sm" />
            <span className="text-ink-light">Reussi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
            <span className="text-ink-light">Echoue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-cream-200 rounded-sm" />
            <span className="text-ink-light">Non fixe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
