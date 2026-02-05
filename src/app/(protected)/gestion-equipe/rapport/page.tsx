'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* ---------- Types ---------- */
type RapportArchive = {
  id: string;
  trimestre: number;
  annee: number;
  titre: string;
  periode_debut: string;
  periode_fin: string;
};

type Analytics = {
  user_id: string;
  generated_at: string;
  periode_analyse: {
    debut_3_mois: string;
    debut_1_mois: string;
    debut_12_semaines: string;
    fin: string;
  };
  trois_mois: {
    score_progression: number;
    score_actuel: number;
    score_il_y_a_3_mois: number;
    minutes_concentration: number;
    heures_concentration: number;
    questions_travaillees: number;
  };
  // Statistiques globales (tout l'historique)
  global?: {
    score_progression: number;
    minutes_concentration: number;
    questions_travaillees: number;
  };
  evolution: {
    temps_par_mois: Array<{
      mois: string;
      annee: number;
      mois_num: number;
      total_minutes: number;
      moyenne_par_session: number;
    }>;
    score_12_semaines: Array<{
      semaine: number;
      annee: number;
      debut_semaine: string;
      score_moyen: number;
      score_moyen_pct: number;
      nb_questions: number;
    }>;
    composantes_dernier_mois: Array<{
      semaine: number;
      debut_semaine: string;
      comprehension_moy: number;
      savoir_moy: number;
      redaction_moy: number;
      nb_questions: number;
    }>;
  };
  feuilles: {
    total_validees: number;
    validees_ce_mois: number;
    par_mois: Array<{
      mois: string;
      annee: number;
      mois_num: number;
      nb_feuilles_validees: number;
    }>;
  };
};

type MembreInfo = {
  user_id: string;
  full_name: string;
  equipe_nom: string;
};

type MonthlyData = {
  mois_label: string;
  mois_court: string;
  temps_minutes: number;
  temps_heures: number;
  feuilles: number;
};

/* ---------- Icônes ---------- */
const IconArrowLeft = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconCalendar = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconRefresh = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Loader = () => (
  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"/>
  </svg>
);

/* ---------- Fonction de préparation des données ---------- */
function prepareMonthlyData(analytics: Analytics): MonthlyData[] {
  const evolution = analytics?.evolution;
  const feuilles = analytics?.feuilles;

  // Vérification de sécurité pour les rapports archivés
  if (!evolution?.temps_par_mois) return [];

  return evolution.temps_par_mois.map((m) => {
    const feuillesMois = feuilles?.par_mois?.find(
      (f) => f.mois_num === m.mois_num && f.annee === m.annee
    );

    return {
      mois_label: `${m.mois} ${m.annee}`,
      mois_court: m.mois,
      temps_minutes: m.total_minutes,
      temps_heures: Math.round((m.total_minutes / 60) * 10) / 10,
      feuilles: feuillesMois?.nb_feuilles_validees || 0,
    };
  });
}

/* ---------- Composants ---------- */

function SelectorRapport({
  rapports,
  selectedId,
  onSelect,
  onRefresh,
  isRefreshing
}: {
  rapports: RapportArchive[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="bg-cream-50 border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink flex items-center gap-2">
          <IconCalendar />
          Historique des rapports
        </h3>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <IconRefresh />
          {isRefreshing ? 'Chargement...' : 'Actualiser'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedId === null
              ? 'bg-accent text-white'
              : 'bg-cream-100 text-ink hover:bg-cream-200'
          }`}
        >
          Temps réel
        </button>
        {rapports.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedId === r.id
                ? 'bg-accent text-white'
                : 'bg-cream-100 text-ink hover:bg-cream-200'
            }`}
          >
            Q{r.trimestre} {r.annee}
          </button>
        ))}
      </div>
    </div>
  );
}

function TableauPerformance({ data }: { data: Analytics }) {
  // Récupérer les stats avec fallback pour les rapports archivés qui peuvent avoir une structure différente
  const troisMois = data.trois_mois || (data as any).trimestre_stats || {};
  const globalStats = data.global || {};

  // Utiliser les stats globales pour les 3 métriques principales, sinon fallback sur trois_mois
  const scoreProgression = globalStats.score_progression ?? troisMois.score_progression ?? 0;
  const minutesConcentration = globalStats.minutes_concentration ?? troisMois.minutes_concentration ?? 0;
  const questionsTravaillees = globalStats.questions_travaillees ?? troisMois.questions_travaillees ?? 0;
  const scoreActuel = troisMois.score_actuel ?? 0;

  const heures = Math.floor(minutesConcentration / 60);
  const minutes = Math.round(minutesConcentration % 60);
  const tempsFormate = heures > 0
    ? `${heures}h ${minutes}min`
    : `${minutes} min`;

  return (
    <div className="bg-cream-50 border border-border rounded-lg overflow-hidden">
      <div className="bg-cream-100 px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-ink flex items-center gap-2">
          <span>📈</span> Performance globale
        </h3>
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-border">
          <tr>
            <td className="px-4 py-3 text-ink-light">Score progression</td>
            <td className="px-4 py-3 text-right font-semibold text-ink">
              <span className={scoreProgression >= 0 ? 'text-status-success' : 'text-status-error'}>
                {scoreProgression >= 0 ? '+' : ''}{Math.round(scoreProgression)} points
              </span>
            </td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-ink-light">Temps de concentration</td>
            <td className="px-4 py-3 text-right font-semibold text-ink">
              {tempsFormate}
            </td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-ink-light">Questions travaillées</td>
            <td className="px-4 py-3 text-right font-semibold text-ink">
              {questionsTravaillees} questions
            </td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-ink-light">Score actuel</td>
            <td className="px-4 py-3 text-right font-semibold text-accent">
              {Math.round(scoreActuel)} pts
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Grille de progression 10x10 ---------- */
function ProgressionGrid({ totalValidees, valideesDerniers3Mois }: {
  totalValidees: number;
  valideesDerniers3Mois: number;
}) {
  const maxCases = 100;
  const valideesAvant = Math.max(0, totalValidees - valideesDerniers3Mois);
  const validees3Mois = Math.min(valideesDerniers3Mois, totalValidees);
  const casesVides = Math.max(0, maxCases - totalValidees);

  const cases: ('avant' | 'recent' | 'vide')[] = [
    ...Array(valideesAvant).fill('avant'),
    ...Array(validees3Mois).fill('recent'),
    ...Array(casesVides).fill('vide'),
  ];

  return (
    <div>
      <div className="grid grid-cols-10 gap-1 w-fit mx-auto">
        {cases.map((type, i) => (
          <div
            key={i}
            className={`
              w-6 h-6 sm:w-8 sm:h-8 rounded-sm transition-colors
              ${type === 'avant' ? 'bg-purple-500' : ''}
              ${type === 'recent' ? 'bg-yellow-400' : ''}
              ${type === 'vide' ? 'bg-stone-200' : ''}
            `}
            title={
              type === 'avant' ? 'Validée avant les 3 derniers mois' :
              type === 'recent' ? 'Validée durant les 3 derniers mois' :
              'À venir'
            }
          />
        ))}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap justify-center gap-4 text-sm mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-500 rounded-sm" />
          <span className="text-ink-light">Avant 3 mois ({valideesAvant})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-400 rounded-sm" />
          <span className="text-ink-light">3 derniers mois ({validees3Mois})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-stone-200 rounded-sm" />
          <span className="text-ink-light">À venir ({casesVides})</span>
        </div>
      </div>

      {/* Résumé textuel */}
      <div className="text-center mt-3 text-ink font-medium">
        {totalValidees} / 100 feuilles validées ({totalValidees}%)
      </div>
    </div>
  );
}

/* ---------- Tableau évolution des compétences ---------- */
function EvolutionCompetences({ composantes }: {
  composantes: Analytics['evolution']['composantes_dernier_mois'];
}) {
  if (!composantes || composantes.length === 0) {
    return (
      <div className="text-center text-ink-light py-4">
        Pas assez de données pour afficher l'évolution des compétences
      </div>
    );
  }

  const premiere = composantes[0];
  const derniere = composantes[composantes.length - 1];

  const competences = [
    {
      nom: '🧠 Compréhension',
      debut: premiere.comprehension_moy,
      fin: derniere.comprehension_moy,
    },
    {
      nom: '🛠️ Savoir-faire',
      debut: premiere.savoir_moy,
      fin: derniere.savoir_moy,
    },
    {
      nom: '✍️ Rédaction',
      debut: premiere.redaction_moy,
      fin: derniere.redaction_moy,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-cream-100">
            <th className="border border-border px-4 py-2 text-left text-sm font-medium text-ink">Compétence</th>
            <th className="border border-border px-4 py-2 text-right text-sm font-medium text-ink">Début</th>
            <th className="border border-border px-4 py-2 text-right text-sm font-medium text-ink">Fin</th>
            <th className="border border-border px-4 py-2 text-right text-sm font-medium text-ink">Évolution</th>
          </tr>
        </thead>
        <tbody>
          {competences.map((c) => {
            const delta = c.fin - c.debut;
            const arrow = delta > 0 ? '↗️' : delta < 0 ? '↘️' : '→';
            const colorClass = delta > 0 ? 'text-status-success' : delta < 0 ? 'text-status-error' : 'text-ink';

            return (
              <tr key={c.nom} className="hover:bg-cream-100/50">
                <td className="border border-border px-4 py-2 text-ink">{c.nom}</td>
                <td className="border border-border px-4 py-2 text-right text-ink">
                  {c.debut.toFixed(1)}%
                </td>
                <td className="border border-border px-4 py-2 text-right text-ink">
                  {c.fin.toFixed(1)}%
                </td>
                <td className={`border border-border px-4 py-2 text-right font-medium ${colorClass}`}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}% {arrow}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Section Tendances avec graphiques ---------- */
function SectionTendancesGraphiques({ data }: { data: Analytics }) {
  const monthlyData = prepareMonthlyData(data);
  const score12Semaines = data?.evolution?.score_12_semaines || [];

  // Calculer les feuilles validées durant les 3 derniers mois (avec vérification)
  const valideesDerniers3Mois = (data?.feuilles?.par_mois || []).reduce(
    (acc, m) => acc + (m.nb_feuilles_validees || 0),
    0
  );

  // Préparer les données du graphique score par semaine
  const scoreParSemaine = score12Semaines.map((s) => {
    const date = new Date(s.debut_semaine);
    const jourMois = `${date.getDate()}/${date.getMonth() + 1}`;
    return {
      semaine: `S${s.semaine}`,
      semaine_label: jourMois,
      score: s.score_moyen_pct,
      nb_questions: s.nb_questions,
    };
  });

  // Vérifier si on a des données
  if (monthlyData.length === 0 && score12Semaines.length === 0) {
    return (
      <div className="bg-cream-50 border border-border rounded-lg overflow-hidden">
        <div className="bg-cream-100 px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-ink flex items-center gap-2">
            <span>📊</span> Tendances (3 derniers mois)
          </h3>
        </div>
        <div className="p-6 text-center text-ink-light">
          Pas assez de données pour afficher les tendances
        </div>
      </div>
    );
  }

  const maxMinutes = Math.max(...monthlyData.map((m) => m.temps_minutes), 60);

  return (
    <div className="bg-cream-50 border border-border rounded-lg overflow-hidden">
      <div className="bg-cream-100 px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-ink flex items-center gap-2">
          <span>📊</span> Tendances (3 derniers mois)
        </h3>
      </div>

      <div className="p-6 space-y-8">
        {/* 1. Temps de travail par mois - INCHANGÉ */}
        {monthlyData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
              <span>⏱️</span> Temps de travail par mois
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis
                    dataKey="mois_court"
                    tick={{ fill: '#1a1a1a', fontSize: 12 }}
                    axisLine={{ stroke: '#d4d4d4' }}
                  />
                  <YAxis
                    domain={[0, Math.ceil(maxMinutes / 50) * 50]}
                    tick={{ fill: '#1a1a1a', fontSize: 12 }}
                    axisLine={{ stroke: '#d4d4d4' }}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fafaf8',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value} min (${(value / 60).toFixed(1)}h)`, 'Temps']}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar
                    dataKey="temps_minutes"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                    name="Temps"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 2. Score moyen PAR SEMAINE (12 semaines) - MODIFIÉ */}
        {scoreParSemaine.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
              <span>🎯</span> Score moyen par semaine ({scoreParSemaine.length} semaines)
            </h4>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreParSemaine} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis
                    dataKey="semaine_label"
                    tick={{ fill: '#1a1a1a', fontSize: 11 }}
                    axisLine={{ stroke: '#d4d4d4' }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#1a1a1a', fontSize: 12 }}
                    axisLine={{ stroke: '#d4d4d4' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fafaf8',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(1)}% (${props.payload.nb_questions} questions)`,
                      'Score moyen'
                    ]}
                    labelFormatter={(label) => `Semaine du ${label}`}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: '#2563eb', r: 4, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 3. Progression globale (grille 10x10) - NOUVEAU */}
        <div>
          <h4 className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
            <span>📄</span> Progression dans le parcours
          </h4>
          <ProgressionGrid
            totalValidees={data?.feuilles?.total_validees || 0}
            valideesDerniers3Mois={valideesDerniers3Mois}
          />
        </div>

        {/* 4. Évolution des compétences - NOUVEAU */}
        <div>
          <h4 className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
            <span>📈</span> Évolution des compétences
          </h4>
          <EvolutionCompetences composantes={data?.evolution?.composantes_dernier_mois || []} />
        </div>

        {/* 5. Tableau récapitulatif mensuel - INCHANGÉ */}
        {monthlyData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
              <span>📋</span> Récapitulatif mensuel
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-cream-100">
                    <th className="border border-border px-4 py-2 text-left text-sm font-medium text-ink">Mois</th>
                    <th className="border border-border px-4 py-2 text-right text-sm font-medium text-ink">Temps</th>
                    <th className="border border-border px-4 py-2 text-right text-sm font-medium text-ink">Feuilles</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m) => (
                    <tr key={m.mois_label} className="hover:bg-cream-100/50">
                      <td className="border border-border px-4 py-2 text-ink">{m.mois_label}</td>
                      <td className="border border-border px-4 py-2 text-right font-medium text-ink">
                        {m.temps_heures}h
                      </td>
                      <td className="border border-border px-4 py-2 text-right font-medium text-accent">
                        {m.feuilles}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TableauPointsAttention({ data }: { data: Analytics }) {
  // Accès sécurisé aux données (pour les rapports archivés)
  const evolution = data?.evolution;
  const feuilles = data?.feuilles;
  const composantes = evolution?.composantes_dernier_mois || [];
  const parMois = feuilles?.par_mois || [];

  const points: Array<{ type: 'warning' | 'success' | 'info'; message: string }> = [];

  // Analyser les composantes du dernier mois
  if (composantes.length > 0) {
    const derniereSemaine = composantes[composantes.length - 1];

    if (derniereSemaine.comprehension_moy < 50) {
      points.push({ type: 'warning', message: `Compréhension à renforcer (${derniereSemaine.comprehension_moy.toFixed(0)}%)` });
    } else if (derniereSemaine.comprehension_moy >= 75) {
      points.push({ type: 'success', message: `Compréhension excellente (${derniereSemaine.comprehension_moy.toFixed(0)}%)` });
    }

    if (derniereSemaine.savoir_moy < 50) {
      points.push({ type: 'warning', message: `Savoir-faire à renforcer (${derniereSemaine.savoir_moy.toFixed(0)}%)` });
    } else if (derniereSemaine.savoir_moy >= 75) {
      points.push({ type: 'success', message: `Savoir-faire excellent (${derniereSemaine.savoir_moy.toFixed(0)}%)` });
    }

    if (derniereSemaine.redaction_moy < 50) {
      points.push({ type: 'warning', message: `Rédaction à renforcer (${derniereSemaine.redaction_moy.toFixed(0)}%)` });
    } else if (derniereSemaine.redaction_moy >= 75) {
      points.push({ type: 'success', message: `Rédaction excellente (${derniereSemaine.redaction_moy.toFixed(0)}%)` });
    }
  }

  // Analyser l'évolution des feuilles validées
  if (parMois.length >= 2) {
    const dernierMois = parMois[parMois.length - 1];
    const avantDernier = parMois[parMois.length - 2];

    if (dernierMois.nb_feuilles_validees < avantDernier.nb_feuilles_validees) {
      points.push({
        type: 'info',
        message: `Baisse d'activité (${avantDernier.nb_feuilles_validees} → ${dernierMois.nb_feuilles_validees} feuilles)`
      });
    } else if (dernierMois.nb_feuilles_validees > avantDernier.nb_feuilles_validees) {
      points.push({
        type: 'success',
        message: `Activité en hausse (${avantDernier.nb_feuilles_validees} → ${dernierMois.nb_feuilles_validees} feuilles)`
      });
    }
  }

  if (points.length === 0) {
    points.push({ type: 'info', message: 'Pas assez de données pour générer des points d\'attention' });
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': return '📉';
      default: return '•';
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-amber-50';
      case 'success': return 'bg-green-50';
      case 'info': return 'bg-blue-50';
      default: return 'bg-cream-100';
    }
  };

  return (
    <div className="bg-cream-50 border border-border rounded-lg overflow-hidden">
      <div className="bg-cream-100 px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-ink flex items-center gap-2">
          <span>🎯</span> Points d'attention
        </h3>
      </div>
      <div className="divide-y divide-border">
        {points.map((point, index) => (
          <div key={index} className={`px-4 py-3 ${getBgColor(point.type)}`}>
            <span className="mr-2">{getIcon(point.type)}</span>
            <span className="text-ink">{point.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Page principale ---------- */
export default function RapportMembrePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [membreInfo, setMembreInfo] = useState<MembreInfo | null>(null);
  const [rapportsArchives, setRapportsArchives] = useState<RapportArchive[]>([]);
  const [selectedRapportId, setSelectedRapportId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const equipeId = searchParams.get('id');
  const membreId = searchParams.get('membre');

  useEffect(() => {
    if (!equipeId || !membreId) {
      setError('Paramètres manquants');
      setLoading(false);
      return;
    }

    loadRapport(equipeId, membreId);
  }, [searchParams]);

  async function loadRapport(equipeId: string, membreId: string) {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        router.push('/auth');
        return;
      }

      const { data: equipeData, error: equipeError } = await supabase
        .from('equipe')
        .select('id, nom, chef_id')
        .eq('id', equipeId)
        .eq('chef_id', session.user.id)
        .single();

      if (equipeError || !equipeData) {
        setError('Équipe introuvable ou vous n\'êtes pas le chef');
        setLoading(false);
        return;
      }

      const { data: membreEquipe, error: membreError } = await supabase
        .from('membre_equipe')
        .select('user_id')
        .eq('equipe_id', equipeId)
        .eq('user_id', membreId)
        .single();

      if (membreError || !membreEquipe) {
        setError('Ce membre n\'appartient pas à votre équipe');
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('user_id', membreId)
        .single();

      setMembreInfo({
        user_id: membreId,
        full_name: profileData?.full_name || 'Membre',
        equipe_nom: equipeData.nom
      });

      // Charger les rapports archivés
      const { data: rapports } = await supabase
        .rpc('get_user_reports', {
          p_user_id: membreId,
          p_equipe_id: equipeId
        });
      setRapportsArchives(rapports || []);

      // Charger les analytics temps réel
      const { data: analyticsData, error: analyticsError } = await supabase
        .rpc('get_user_analytics', { p_user_id: membreId });

      if (analyticsError) {
        console.error('Erreur analytics:', analyticsError);
        setError('Erreur lors du chargement des analytics');
        setLoading(false);
        return;
      }

      setAnalytics(analyticsData);
      setLoading(false);
    } catch (err) {
      console.error('Erreur:', err);
      setError('Une erreur est survenue');
      setLoading(false);
    }
  }

  function handleRetour() {
    if (equipeId) {
      router.push(`/gestion-equipe?id=${equipeId}`);
    } else {
      router.back();
    }
  }

  async function handleSelectRapport(rapportId: string | null) {
    if (rapportId === null) {
      // Charger les données temps réel
      if (!membreId) return;
      setIsRefreshing(true);
      const { data: analyticsData } = await supabase
        .rpc('get_user_analytics', { p_user_id: membreId });
      setAnalytics(analyticsData);
      setSelectedRapportId(null);
      setIsRefreshing(false);
    } else {
      // Charger le rapport archivé
      setIsRefreshing(true);
      const { data: rapportData } = await supabase
        .from('rapport_trimestriel')
        .select('donnees')
        .eq('id', rapportId)
        .single();
      if (rapportData) {
        setAnalytics(rapportData.donnees as Analytics);
        setSelectedRapportId(rapportId);
      }
      setIsRefreshing(false);
    }
  }

  async function handleRefresh() {
    if (!membreId) return;
    setIsRefreshing(true);
    const { data: analyticsData } = await supabase
      .rpc('get_user_analytics', { p_user_id: membreId });
    setAnalytics(analyticsData);
    setSelectedRapportId(null);
    setIsRefreshing(false);
  }

  function formatPeriode(): string {
    const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('fr-FR');

    // Si rapport archivé sélectionné
    if (selectedRapportId) {
      const rapport = rapportsArchives.find(r => r.id === selectedRapportId);
      if (rapport?.periode_debut && rapport?.periode_fin) {
        return `${formatDate(rapport.periode_debut)} - ${formatDate(rapport.periode_fin)}`;
      }
    }

    // Mode temps réel : du début du trimestre actuel jusqu'à aujourd'hui
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    // Calculer le premier mois du trimestre actuel (0=jan, 3=avr, 6=juil, 9=oct)
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    const quarterStart = new Date(currentYear, quarterStartMonth, 1);

    return `${formatDate(quarterStart)} - ${formatDate(now)}`;
  }

  function getRapportTitre(): string {
    if (selectedRapportId) {
      const rapport = rapportsArchives.find(r => r.id === selectedRapportId);
      return rapport?.titre || 'Rapport archivé';
    }
    return 'Temps réel';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-ink-light mb-4">{error}</p>
          <button
            onClick={handleRetour}
            className="px-4 py-2 bg-accent text-ink font-medium rounded-lg"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (!analytics || !membreInfo) {
    return null;
  }

  return (
    <main className="min-h-screen bg-cream-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleRetour}
            className="p-2 hover:bg-cream-200 rounded-lg transition-colors text-ink"
          >
            <IconArrowLeft />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ink">
              📋 Rapport de {membreInfo.full_name}
            </h1>
            <p className="text-sm text-ink-light">
              {membreInfo.equipe_nom} • {getRapportTitre()}
              {selectedRapportId === null && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  En direct
                </span>
              )}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              📅 Période : {formatPeriode()}
            </p>
          </div>
        </div>

        {/* Sélecteur de rapports */}
        <SelectorRapport
          rapports={rapportsArchives}
          selectedId={selectedRapportId}
          onSelect={handleSelectRapport}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Sections */}
        <div className="grid gap-6">
          {/* Section 1 : Performance sur 3 mois - INCHANGÉE */}
          <TableauPerformance data={analytics} />

          {/* Section 2 : Tendances avec graphiques - AMÉLIORÉE */}
          <SectionTendancesGraphiques data={analytics} />

          {/* Section 3 : Points d'attention */}
          <TableauPointsAttention data={analytics} />
        </div>

        {/* Données brutes (debug) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="bg-cream-100 border border-border rounded-lg p-4">
            <summary className="cursor-pointer text-ink-light text-sm">
              Données brutes (debug)
            </summary>
            <pre className="mt-4 text-xs overflow-auto">
              {JSON.stringify(analytics, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
