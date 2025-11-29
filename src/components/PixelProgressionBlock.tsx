'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Badge = {
  niveau_ordre: number;
  niveau_titre: string;
  badge: string;
};

type ProgressionNiveau = {
  niveau_id: string;
  niveau_titre: string;
  niveau_ordre: number;
  total_feuilles: number;
  feuilles_validees: number;
  pourcentage: number;
  badge: string;
};

type ProgressionData = {
  badges_obtenus: Badge[];
  progression_niveaux: ProgressionNiveau[];
};

export default function PixelProgressionBlock() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProgressionData | null>(null);
  const [niveauSelectionne, setNiveauSelectionne] = useState<number>(1);

  useEffect(() => {
    loadProgression();
  }, []);

  async function loadProgression() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: result, error } = await supabase.rpc('get_progression_utilisateur', {
        p_user_id: session.user.id
      });

      if (error) throw error;
      
      setData(result);
      
      // Sélectionner le premier niveau avec progression par défaut
      if (result?.progression_niveaux?.length > 0) {
        setNiveauSelectionne(result.progression_niveaux[0].niveau_ordre);
      }
    } catch (error) {
      console.error('Erreur chargement progression:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const niveauActuel = data.progression_niveaux?.find(n => n.niveau_ordre === niveauSelectionne);
  const allBadges = [
    { ordre: 1, badge: '🐛 Asticot', titre: 'Élémentaire' },
    { ordre: 2, badge: '🐝 Abeille', titre: 'Collège' },
    { ordre: 3, badge: '🐻 Ours', titre: 'Lycée' },
    { ordre: 4, badge: '🐘 Éléphant', titre: 'Licence' },
    { ordre: 5, badge: '🦄 Licorne', titre: 'Master' },
    { ordre: 6, badge: '🐉 Dragon', titre: 'Doctorat' },
  ];

  const badgesObtenus = new Set(data.badges_obtenus?.map(b => b.niveau_ordre) || []);

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-700 shadow-xl">
      
      {/* 1. Collection de Badges */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          🏆 Collection de Badges
        </h2>
        <div className="flex gap-4 flex-wrap">
          {allBadges.map(({ ordre, badge, titre }) => {
            const obtenu = badgesObtenus.has(ordre);
            return (
              <div
                key={ordre}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                  obtenu
                    ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-400 dark:border-yellow-600 shadow-lg'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 opacity-50'
                }`}
              >
                <div className={`text-5xl mb-2 ${obtenu ? 'animate-bounce' : 'grayscale'}`}>
                  {badge.split(' ')[0]}
                </div>
                <div className={`text-xs font-semibold ${obtenu ? 'text-yellow-900 dark:text-yellow-100' : 'text-slate-500'}`}>
                  {titre}
                </div>
                {obtenu && (
                  <div className="mt-1 text-green-600 dark:text-green-400 text-sm font-bold">
                    ✓ Obtenu
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Sélection Niveau */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          📚 Sélectionnez un niveau
        </h3>
        <div className="flex gap-2 flex-wrap">
          {data.progression_niveaux?.map((niveau) => (
            <button
              key={niveau.niveau_id}
              onClick={() => setNiveauSelectionne(niveau.niveau_ordre)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                niveauSelectionne === niveau.niveau_ordre
                  ? 'bg-teal-500 text-white shadow-lg scale-105'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {niveau.niveau_titre}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Pixel Géant */}
      {niveauActuel && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-2 border-slate-300 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              🎨 {niveauActuel.niveau_titre}
            </h3>
            <div className="text-4xl">
              {niveauActuel.badge.split(' ')[0]}
            </div>
          </div>

          {/* Pixel Grid */}
          <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: niveauActuel.total_feuilles }, (_, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-sm transition-all ${
                    i < niveauActuel.feuilles_validees
                      ? 'bg-purple-500 shadow-sm animate-pulse'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  title={`Feuille ${i + 1} ${i < niveauActuel.feuilles_validees ? '✓' : ''}`}
                />
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Progression
              </span>
              <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                {niveauActuel.pourcentage}%
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                Feuilles validées
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {niveauActuel.feuilles_validees} / {niveauActuel.total_feuilles}
              </span>
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 rounded-full"
                style={{ width: `${niveauActuel.pourcentage}%` }}
              />
            </div>

            {/* Message de motivation */}
            {niveauActuel.pourcentage === 100 ? (
              <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 rounded-lg text-center">
                <div className="text-3xl mb-2">🎉</div>
                <div className="font-bold text-green-900 dark:text-green-100">
                  Badge {niveauActuel.badge} débloqué !
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Prochain badge :</strong> {niveauActuel.badge}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Encore <strong>{niveauActuel.total_feuilles - niveauActuel.feuilles_validees}</strong> feuilles à valider !
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}