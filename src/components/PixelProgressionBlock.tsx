'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Types
type BadgeNiveau = {
  code: string;
  emoji: string;
  nom: string;
  titre: string;
  palier: number;
  obtenu: boolean;
};

type BadgeComportement = {
  code: string;
  emoji: string;
  nom: string;
  description: string;
  palier: number;
  obtenu: boolean;
  heures_total?: number;
};

type BadgePerformance = {
  code: string;
  emoji: string;
  nom: string;
  description: string;
  palier: number;
  obtenu: boolean;
  nb_feuilles?: number;
  amelioration_pct?: number;
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

type BadgesData = {
  badges_niveau: BadgeNiveau[];
  badges_comportement: BadgeComportement[];
  badges_performance: BadgePerformance[];
  progression_niveaux: ProgressionNiveau[];
};

export default function PixelProgressionBlock() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BadgesData | null>(null);
  const [niveauSelectionne, setNiveauSelectionne] = useState<number>(1);

  useEffect(() => {
    loadProgression();
  }, []);

  async function loadProgression() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: result, error } = await supabase.rpc('get_badges_utilisateur_complet', {
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

  // Fonction pour afficher un badge avec palier
  const renderBadge = (
    badge: BadgeNiveau | BadgeComportement | BadgePerformance,
    type: 'niveau' | 'comportement' | 'performance'
  ) => {
    const obtenu = badge.obtenu;
    const hasPalier = badge.palier > 1;
    
    return (
      <div
        key={badge.code}
        className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all min-w-[140px] ${
          obtenu
            ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-400 dark:border-yellow-600 shadow-lg'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 opacity-50'
        }`}
        title={('description' in badge) ? badge.description : ''}
      >
        <div className={`text-5xl mb-2 relative ${obtenu ? 'animate-bounce' : 'grayscale'}`}>
          {badge.emoji}
          {hasPalier && obtenu && (
            <span className="absolute -top-1 -right-1 text-lg font-bold bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
              {badge.palier}
            </span>
          )}
        </div>
        <div className={`text-xs font-semibold text-center ${obtenu ? 'text-yellow-900 dark:text-yellow-100' : 'text-slate-500'}`}>
          {badge.nom}
        </div>
        {type === 'niveau' && 'titre' in badge && (
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {badge.titre}
          </div>
        )}
        {obtenu && (
          <div className="mt-2 text-green-600 dark:text-green-400 text-sm font-bold">
            ✓ Obtenu
          </div>
        )}
        {/* Infos supplémentaires pour badges à palier */}
        {obtenu && 'heures_total' in badge && badge.heures_total !== undefined && (
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {Math.floor(badge.heures_total)}h
          </div>
        )}
        {obtenu && 'nb_feuilles' in badge && badge.nb_feuilles !== undefined && (
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {badge.nb_feuilles} feuilles
          </div>
        )}
        {obtenu && 'amelioration_pct' in badge && badge.amelioration_pct !== undefined && (
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            +{Math.floor(badge.amelioration_pct)}%
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-700 shadow-xl">
      
      {/* 1. Collection de Badges de Niveau */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          🏆 Badges de Niveau
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Complétez 100% d'un niveau pour débloquer son badge
        </p>
        <div className="flex gap-4 flex-wrap">
          {data.badges_niveau?.map((badge) => renderBadge(badge, 'niveau'))}
        </div>
      </div>

      {/* 2. Badges de Comportement */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          💎 Badges de Comportement
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Récompenses pour votre régularité et discipline
        </p>
        <div className="flex gap-4 flex-wrap">
          {data.badges_comportement?.map((badge) => renderBadge(badge, 'comportement'))}
        </div>
      </div>

      {/* 3. Badges de Performance */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          ⚡ Badges de Performance
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Récompenses pour vos exploits et progrès
        </p>
        <div className="flex gap-4 flex-wrap">
          {data.badges_performance?.map((badge) => renderBadge(badge, 'performance'))}
        </div>
      </div>

      {/* 4. Sélection Niveau */}
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

      {/* 5. Pixel Géant */}
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

      {/* Légende pour les badges à paliers */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-2">
          💡 Badges à paliers
        </h4>
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <div>⚡ <strong>Concentration électrique</strong> : Palier +1 toutes les 50 heures</div>
          <div>🎯 <strong>Précision absolue</strong> : Palier +1 toutes les 5 feuilles réussies du 1er coup</div>
          <div>🚀 <strong>Fusée</strong> : Palier +1 pour chaque +30% d'amélioration</div>
        </div>
      </div>
    </div>
  );
}