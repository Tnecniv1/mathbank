'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';

type EvolutionPoint = {
  question_num: number;
  exercice: string;
  question: string;
  score_question: number;
  score_cumule: number;
  created_at: string;
};

type GraphiqueLiveProps = {
  sessionId: string;
  nbTotal: number;
  duree: string;
};

export function GraphiqueLive({ sessionId, nbTotal, duree }: GraphiqueLiveProps) {
  const [evolutionScore, setEvolutionScore] = useState<EvolutionPoint[]>([]);
  const [nouveauScore, setNouveauScore] = useState(false);
  const [dernierAjout, setDernierAjout] = useState(0);

  const scoreTotal = evolutionScore.length > 0
    ? evolutionScore[evolutionScore.length - 1].score_cumule
    : 0;

  const nbNotees = evolutionScore.length;

  // Polling toutes les 2 secondes
  // Ref pour comparer sans déclencher de re-render
  const lastCountRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function fetchEvolution() {
      const { data } = await supabase
        .rpc('get_session_live_evolution', { p_session_id: sessionId });

      if (!active || !data) return;

      // Ne mettre à jour que s'il y a de nouvelles questions
      if (data.length > lastCountRef.current) {
        lastCountRef.current = data.length;

        setNouveauScore(true);
        setDernierAjout(data[data.length - 1].score_question);
        setEvolutionScore(data);

        setTimeout(() => {
          if (active) setNouveauScore(false);
        }, 1500);
      }
    }

    fetchEvolution();

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchEvolution();
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  return (
    <div className="h-full flex flex-col">
      {/* Score actuel */}
      <motion.div
        className="text-center mb-6"
        animate={nouveauScore ? { scale: [1, 1.12, 1] } : {}}
        transition={{ duration: 0.5 }}
      >
        <p className="text-sm text-gray-500 mb-1">Score en temps réel</p>
        <h2 className="text-6xl font-black text-purple-600">
          {Math.round(scoreTotal)} <span className="text-3xl font-bold">pts</span>
        </h2>
        {nouveauScore && (
          <motion.p
            className="text-sm text-green-600 mt-2 font-semibold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            +{Math.round(dernierAjout)} pts
          </motion.p>
        )}
      </motion.div>

      {/* Graphique */}
      <div className="flex-1 min-h-0">
        {evolutionScore.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-lg">En attente de la première notation...</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionScore} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
              <Line
                type="monotone"
                dataKey="score_cumule"
                stroke="#8b5cf6"
                strokeWidth={4}
                dot={{ r: 8, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 10, fill: '#7c3aed' }}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <XAxis
                dataKey="question_num"
                label={{ value: 'Questions', position: 'insideBottom', offset: -10 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                label={{ value: 'Score cumulé (pts)', angle: -90, position: 'insideLeft', offset: 5 }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '2px solid #8b5cf6',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
                formatter={(value: number) => [`${Math.round(value)} pts`, 'Score cumulé']}
                labelFormatter={(label) => `Question ${label}`}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-8 mt-4 text-sm text-gray-500">
        <span>📊 {nbNotees}/{nbTotal > 0 ? nbTotal : '?'} questions notées</span>
        <span>⏱️ {duree}</span>
      </div>
    </div>
  );
}
