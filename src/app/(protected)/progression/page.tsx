'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';



// Types
type SessionTravail = {
  id: string;
  progression_id: string;
  date: string;
  heure: string;
  duree: number;
  commentaire: string | null;
  created_at: string;
};

type ProgressionFeuille = {
  id: string;
  feuille_id: string;
  est_termine: boolean;
  score: number | null;
  temps_total: number;
  created_at: string;
  updated_at: string;
  feuille?: {
    titre: string;
    ordre: number;
  };
  sessions?: SessionTravail[];
};

type StatsData = {
  tempsMoyenSession: number;
  scoreMoyen: number;
  streakActuel: number;
  tempsParJour: { date: string; duree: number }[];
  scoresParFeuille: { numero: number; titre: string; score: number }[];
  disciplineParJour: { date: string; actif: boolean }[];
  totalFeuilles: number;
  feuillesTerminees: number;
};

// Composant KPI Card
function KPICard({ title, value, unit, icon }: { title: string; value: number | string; unit: string; icon: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</h3>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{value}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{unit}</span>
      </div>
    </div>
  );
}

// Composant Heatmap Discipline
function HeatmapDiscipline({ data }: { data: { date: string; actif: boolean }[] }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {data.map((day, index) => {
        const date = new Date(day.date);
        const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'short' });
        
        return (
          <div key={index} className="flex flex-col items-center gap-1">
            <div
              className={`w-10 h-10 rounded-lg transition-colors ${
                day.actif
                  ? 'bg-purple-500 dark:bg-purple-600'
                  : 'bg-zinc-100 dark:bg-zinc-800'
              }`}
              title={`${day.date} - ${day.actif ? 'Actif' : 'Inactif'}`}
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ProgressionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      setError(null);

      // DEBUG : Vérifier la session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('🔍 DEBUG Session:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        email: session?.user?.email,
        sessionError: sessionError
      });
      
      if (sessionError || !session || !session.user) {
        throw new Error('Vous devez être connecté pour voir votre progression');
      }

      const user = session.user;

      // 1. Récupérer toutes les progressions de l'utilisateur avec les sessions
      const { data: progressions, error: progError } = await supabase
        .from('progression_feuille')
        .select(`
          *,
          feuille:feuille_entrainement(titre, ordre),
          sessions:session_travail(*)
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      console.log('🔍 DEBUG Progressions:', {
        count: progressions?.length || 0,
        error: progError,
        data: progressions
      });

      if (progError) throw progError;
      if (!progressions) throw new Error('Aucune donnée de progression');

      // 2. Calculer les statistiques
      const statsCalculated = calculateStats(progressions as ProgressionFeuille[]);
      setStats(statsCalculated);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(progressions: ProgressionFeuille[]): StatsData {
    // Extraire toutes les sessions
    const toutesLesSessions: (SessionTravail & { progression: ProgressionFeuille })[] = [];
    progressions.forEach(prog => {
      if (prog.sessions) {
        prog.sessions.forEach(session => {
          toutesLesSessions.push({ ...session, progression: prog });
        });
      }
    });

    // Trier par date (plus récentes d'abord)
    toutesLesSessions.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.heure}`);
      const dateB = new Date(`${b.date}T${b.heure}`);
      return dateB.getTime() - dateA.getTime();
    });

    // Prendre les 21 dernières sessions
    const dernieresSessions = toutesLesSessions.slice(0, 21);

    // 1. Temps moyen par session (21 dernières)
    const tempsMoyenSession = dernieresSessions.length > 0
      ? Math.round(dernieresSessions.reduce((acc, s) => acc + s.duree, 0) / dernieresSessions.length)
      : 0;

    // 2. Score moyen (feuilles terminées uniquement)
    const feuillesAvecScore = progressions.filter(p => p.est_termine && p.score !== null);
    const scoreMoyen = feuillesAvecScore.length > 0
      ? Math.round(feuillesAvecScore.reduce((acc, p) => acc + (p.score || 0), 0) / feuillesAvecScore.length)
      : 0;

    // 3. Streak actuel
    const streakActuel = calculateStreak(toutesLesSessions);

    // 4. Temps par jour (21 derniers jours)
    const tempsParJour = calculateTempsParJour(toutesLesSessions);

    // 5. Scores par feuille (21 dernières feuilles terminées)
    const feuillesTerminees = progressions.filter(p => p.est_termine);
    const dernieresFeuillesTerminees = feuillesTerminees.slice(0, 21).reverse();
    const scoresParFeuille = dernieresFeuillesTerminees.map((p, index) => ({
      numero: index + 1,
      titre: p.feuille?.titre || `Feuille ${p.feuille?.ordre || '?'}`,
      score: p.score || 0,
    }));

    // 6. Discipline par jour (21 derniers jours)
    const disciplineParJour = calculateDisciplineParJour(toutesLesSessions);

    // 7. Total feuilles vs terminées
    const totalFeuilles = progressions.length;
    const feuillesTermineesCount = feuillesTerminees.length;

    return {
      tempsMoyenSession,
      scoreMoyen,
      streakActuel,
      tempsParJour,
      scoresParFeuille,
      disciplineParJour,
      totalFeuilles,
      feuillesTerminees: feuillesTermineesCount,
    };
  }

  function calculateStreak(sessions: SessionTravail[]): number {
    if (sessions.length === 0) return 0;

    // Grouper par jour
    const joursAvecSession = new Set(
      sessions.map(s => new Date(s.date).toDateString())
    );

    let streak = 0;
    const aujourd_hui = new Date();
    
    // Vérifier jour par jour en remontant
    for (let i = 0; i < 365; i++) {
      const jour = new Date(aujourd_hui);
      jour.setDate(jour.getDate() - i);
      
      if (joursAvecSession.has(jour.toDateString())) {
        streak++;
      } else if (i > 0) { // Ne pas casser le streak si aujourd'hui n'a pas de session
        break;
      }
    }

    return streak;
  }

  function calculateTempsParJour(sessions: SessionTravail[]): { date: string; duree: number }[] {
    const derniers21Jours: { date: string; duree: number }[] = [];
    const aujourd_hui = new Date();

    for (let i = 20; i >= 0; i--) {
      const jour = new Date(aujourd_hui);
      jour.setDate(jour.getDate() - i);
      const dateStr = jour.toISOString().split('T')[0];

      const sessionsJour = sessions.filter(s => s.date === dateStr);
      const dureeTotal = sessionsJour.reduce((acc, s) => acc + s.duree, 0);

      derniers21Jours.push({
        date: jour.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        duree: dureeTotal,
      });
    }

    return derniers21Jours;
  }

  function calculateDisciplineParJour(sessions: SessionTravail[]): { date: string; actif: boolean }[] {
    const derniers21Jours: { date: string; actif: boolean }[] = [];
    const aujourd_hui = new Date();

    const joursAvecSession = new Set(sessions.map(s => s.date));

    for (let i = 20; i >= 0; i--) {
      const jour = new Date(aujourd_hui);
      jour.setDate(jour.getDate() - i);
      const dateStr = jour.toISOString().split('T')[0];

      derniers21Jours.push({
        date: dateStr,
        actif: joursAvecSession.has(dateStr),
      });
    }

    return derniers21Jours;
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-zinc-500">
          Chargement de vos statistiques...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 rounded-xl p-6 text-red-700 dark:text-red-300">
          <h2 className="font-semibold mb-2">Erreur</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!stats) return null;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Progression</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Visualisez votre évolution • {stats.feuillesTerminees}/{stats.totalFeuilles} feuilles terminées
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard
          title="Temps moyen par session"
          value={stats.tempsMoyenSession}
          unit="min"
          icon="⏱️"
        />
        <KPICard
          title="Score moyen"
          value={stats.scoreMoyen}
          unit="pts"
          icon="🎯"
        />
        <KPICard
          title="Streak actuel"
          value={stats.streakActuel}
          unit={`jour${stats.streakActuel > 1 ? 's' : ''}`}
          icon="🔥"
        />
      </div>

      {/* Graphique principal : Temps de concentration */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          Temps de concentration (par jour)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats.tempsParJour}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-700" />
            <XAxis 
              dataKey="date" 
              stroke="#71717a" 
              style={{ fontSize: '12px' }} 
            />
            <YAxis 
              stroke="#71717a" 
              style={{ fontSize: '12px' }}
              label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#18181b' }}
            />
            <Line
              type="monotone"
              dataKey="duree"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Graphiques du bas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Score par feuille */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
            Scores par feuille (21 dernières)
          </h2>
          {stats.scoresParFeuille.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.scoresParFeuille}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-700" />
                <XAxis 
                  dataKey="numero" 
                  stroke="#71717a" 
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Feuille n°', position: 'insideBottom', offset: -5, style: { fontSize: '12px' } }}
                />
                <YAxis 
                  stroke="#71717a" 
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Score', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e4e4e7',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(value) => `Feuille ${value}`}
                  formatter={(value: any, name: string, props: any) => [
                    `${value} pts`,
                    props.payload.titre
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#10b981"
                  fill="#10b98120"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-zinc-400">
              Aucune feuille terminée pour le moment
            </div>
          )}
        </div>

        {/* Discipline */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
            Discipline (21 derniers jours)
          </h2>
          <div className="flex items-center justify-center py-4">
            <HeatmapDiscipline data={stats.disciplineParJour} />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mt-4">
            Violet = au moins 1 session ce jour-là
          </p>
        </div>
      </div>
    </main>
  );
}