'use client';

import Link from "next/link";
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

type BadgesData = {
  badges_niveau: BadgeNiveau[];
  badges_comportement: BadgeComportement[];
  badges_performance: BadgePerformance[];
  progression_niveaux: any[];
};

function BadgeCard({ badge, type }: { 
  badge: BadgeNiveau | BadgeComportement | BadgePerformance; 
  type: 'niveau' | 'comportement' | 'performance' 
}) {
  const obtenu = badge.obtenu;
  const hasPalier = badge.palier > 1;
  
  return (
    <div
      className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-300 min-w-[90px] ${
        obtenu
          ? 'bg-gradient-to-br from-[#ffd93d22] to-[#ffb70022] border-[#ffd93d] shadow-lg hover:scale-105'
          : 'bg-[#1f1d35] border-[#4db7ff33] opacity-50'
      }`}
      title={('description' in badge) ? badge.description : ''}
    >
      {/* Badge emoji avec palier */}
      <div className={`text-4xl mb-1 relative ${obtenu ? '' : 'grayscale'}`}>
        {badge.emoji}
        {hasPalier && obtenu && (
          <span className="absolute -top-1 -right-1 text-xs font-bold bg-[#4db7ff] text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#18162a]">
            {badge.palier}
          </span>
        )}
      </div>
      
      {/* Nom du badge */}
      <div className={`text-xs font-mono font-bold text-center ${
        obtenu ? 'text-[#ffd93d]' : 'text-slate-500'
      }`}>
        {badge.nom}
      </div>
      
      {/* Sous-titre pour badges de niveau */}
      {type === 'niveau' && 'titre' in badge && (
        <div className="text-[10px] text-slate-400 mt-0.5">
          {badge.titre}
        </div>
      )}
      
      {/* Infos supplémentaires */}
      {obtenu && (
        <>
          {'heures_total' in badge && badge.heures_total !== undefined && (
            <div className="text-[10px] text-[#4db7ff] mt-1">
              {Math.floor(badge.heures_total)}h
            </div>
          )}
          {'nb_feuilles' in badge && badge.nb_feuilles !== undefined && (
            <div className="text-[10px] text-[#4db7ff] mt-1">
              {badge.nb_feuilles} ✓
            </div>
          )}
          {'amelioration_pct' in badge && badge.amelioration_pct !== undefined && (
            <div className="text-[10px] text-[#4db7ff] mt-1">
              +{Math.floor(badge.amelioration_pct)}%
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BadgesSection() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BadgesData | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadBadges();
  }, []);

  async function loadBadges() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      
      const { data: result, error } = await supabase.rpc('get_badges_utilisateur_complet', {
        p_user_id: session.user.id
      });

      if (error) {
        console.error('Erreur RPC badges:', error);
        // Fallback : afficher les badges vides si la fonction n'existe pas
        setData({
          badges_niveau: [
            { code: 'niveau_1', emoji: '🐛', nom: 'Asticot', titre: 'Élémentaire', palier: 1, obtenu: false },
            { code: 'niveau_2', emoji: '🐝', nom: 'Abeille', titre: 'Collège', palier: 1, obtenu: false },
            { code: 'niveau_3', emoji: '🐻', nom: 'Ours', titre: 'Lycée', palier: 1, obtenu: false },
            { code: 'niveau_4', emoji: '🐋', nom: 'Baleine', titre: 'Licence', palier: 1, obtenu: false },
            { code: 'niveau_5', emoji: '🦄', nom: 'Licorne', titre: 'Master', palier: 1, obtenu: false },
            { code: 'niveau_6', emoji: '🐉', nom: 'Dragon', titre: 'Doctorat', palier: 1, obtenu: false },
          ],
          badges_comportement: [
            { code: 'discipline_fer', emoji: '💪', nom: 'Discipline', description: '5+ entraînements/semaine × 4 semaines', palier: 1, obtenu: false },
            { code: 'concentration', emoji: '⚡', nom: 'Concentration', description: 'Paliers de 50h', palier: 0, obtenu: false },
            { code: 'score_feu', emoji: '🔥', nom: 'Score de feu', description: '≥2 chapitres par niveau', palier: 1, obtenu: false },
            { code: 'progression', emoji: '📈', nom: 'Progression', description: 'Score toujours croissant', palier: 1, obtenu: false },
          ],
          badges_performance: [
            { code: 'etoile_montante', emoji: '🌟', nom: 'Étoile', description: '1 feuille/2 semaines', palier: 1, obtenu: false },
            { code: 'precision', emoji: '🎯', nom: 'Précision', description: 'Feuilles du 1er coup', palier: 0, obtenu: false },
            { code: 'fusee', emoji: '🚀', nom: 'Fusée', description: 'Amélioration +30%', palier: 0, obtenu: false },
            { code: 'champion', emoji: '🏅', nom: 'Champion', description: 'Top 3 de l\'équipe', palier: 1, obtenu: false },
          ],
          progression_niveaux: []
        });
      } else {
        setData(result);
      }
    } catch (error) {
      console.error('Erreur chargement badges:', error);
      // En cas d'erreur, afficher quand même les badges vides
      setData({
        badges_niveau: [
          { code: 'niveau_1', emoji: '🐛', nom: 'Asticot', titre: 'Élémentaire', palier: 1, obtenu: false },
          { code: 'niveau_2', emoji: '🐝', nom: 'Abeille', titre: 'Collège', palier: 1, obtenu: false },
          { code: 'niveau_3', emoji: '🐻', nom: 'Ours', titre: 'Lycée', palier: 1, obtenu: false },
          { code: 'niveau_4', emoji: '🐋', nom: 'Baleine', titre: 'Licence', palier: 1, obtenu: false },
          { code: 'niveau_5', emoji: '🦄', nom: 'Licorne', titre: 'Master', palier: 1, obtenu: false },
          { code: 'niveau_6', emoji: '🐉', nom: 'Dragon', titre: 'Doctorat', palier: 1, obtenu: false },
        ],
        badges_comportement: [
          { code: 'discipline_fer', emoji: '💪', nom: 'Discipline', description: '5+ entraînements/semaine × 4 semaines', palier: 1, obtenu: false },
          { code: 'concentration', emoji: '⚡', nom: 'Concentration', description: 'Paliers de 50h', palier: 0, obtenu: false },
          { code: 'score_feu', emoji: '🔥', nom: 'Score de feu', description: '≥2 chapitres par niveau', palier: 1, obtenu: false },
          { code: 'progression', emoji: '📈', nom: 'Progression', description: 'Score toujours croissant', palier: 1, obtenu: false },
        ],
        badges_performance: [
          { code: 'etoile_montante', emoji: '🌟', nom: 'Étoile', description: '1 feuille/2 semaines', palier: 1, obtenu: false },
          { code: 'precision', emoji: '🎯', nom: 'Précision', description: 'Feuilles du 1er coup', palier: 0, obtenu: false },
          { code: 'fusee', emoji: '🚀', nom: 'Fusée', description: 'Amélioration +30%', palier: 0, obtenu: false },
          { code: 'champion', emoji: '🏅', nom: 'Champion', description: 'Top 3 de l\'équipe', palier: 1, obtenu: false },
        ],
        progression_niveaux: []
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[#18162a] rounded-2xl p-4 border border-[#4db7ff33]">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#4db7ff] border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Compteurs de badges obtenus
  const niveauObtenus = data.badges_niveau?.filter(b => b.obtenu).length || 0;
  const comportementObtenus = data.badges_comportement?.filter(b => b.obtenu).length || 0;
  const performanceObtenus = data.badges_performance?.filter(b => b.obtenu).length || 0;
  const totalObtenus = niveauObtenus + comportementObtenus + performanceObtenus;

  // Badges obtenus récents (max 5 pour l'aperçu)
  const badgesObtenus = [
    ...data.badges_niveau.filter(b => b.obtenu),
    ...data.badges_comportement.filter(b => b.obtenu),
    ...data.badges_performance.filter(b => b.obtenu),
  ].slice(0, 5);

  return (
    <>
      {/* Version compacte */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-[#18162a] rounded-2xl p-4 border border-[#4db7ff33] hover:border-[#4db7ff] transition-all duration-300 group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🏆</div>
            <div className="text-left">
              <h2 className="text-lg font-mono font-bold text-white">
                Vos Badges
              </h2>
              <p className="text-xs text-slate-400">
                {totalObtenus}/14 badges débloqués
              </p>
            </div>
          </div>
          
          {/* Aperçu des badges obtenus */}
          <div className="flex items-center gap-2">
            {badgesObtenus.length > 0 ? (
              <>
                {badgesObtenus.map((badge, idx) => (
                  <div key={idx} className="text-2xl">
                    {badge.emoji}
                  </div>
                ))}
                {totalObtenus > 5 && (
                  <div className="text-sm text-slate-400 font-mono">
                    +{totalObtenus - 5}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-500 font-mono">
                Aucun badge débloqué
              </div>
            )}
            <div className="text-slate-400 group-hover:text-white transition-colors ml-2">
              →
            </div>
          </div>
        </div>
      </button>

      {/* Modal détaillé */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#18162a] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#4db7ff]" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="sticky top-0 bg-[#18162a] border-b border-[#4db7ff33] p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
                  🏆 Vos Badges
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {totalObtenus}/14 badges débloqués
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Contenu du modal */}
            <div className="p-6 space-y-6">
              
              {/* Stats rapides */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#1f1d35] rounded-lg p-3 border border-[#a855f733]">
                  <div className="text-xs text-slate-400 mb-1">Niveau</div>
                  <div className="text-xl font-mono font-bold text-[#a855f7]">
                    {niveauObtenus}/6
                  </div>
                </div>
                <div className="bg-[#1f1d35] rounded-lg p-3 border border-[#ffd93d33]">
                  <div className="text-xs text-slate-400 mb-1">Comportement</div>
                  <div className="text-xl font-mono font-bold text-[#ffd93d]">
                    {comportementObtenus}/4
                  </div>
                </div>
                <div className="bg-[#1f1d35] rounded-lg p-3 border border-[#4db7ff33]">
                  <div className="text-xs text-slate-400 mb-1">Performance</div>
                  <div className="text-xl font-mono font-bold text-[#4db7ff]">
                    {performanceObtenus}/4
                  </div>
                </div>
              </div>

              {/* Badges de Niveau */}
              <div>
                <h3 className="text-lg font-mono font-bold text-white mb-3 flex items-center gap-2">
                  🏆 Badges de Niveau <span className="text-sm text-[#a855f7]">({niveauObtenus}/6)</span>
                </h3>
                <div className="flex gap-3 flex-wrap">
                  {data.badges_niveau?.map((badge) => (
                    <BadgeCard key={badge.code} badge={badge} type="niveau" />
                  ))}
                </div>
              </div>

              {/* Badges de Comportement */}
              <div>
                <h3 className="text-lg font-mono font-bold text-white mb-3 flex items-center gap-2">
                  💎 Badges de Comportement <span className="text-sm text-[#ffd93d]">({comportementObtenus}/4)</span>
                </h3>
                <div className="flex gap-3 flex-wrap">
                  {data.badges_comportement?.map((badge) => (
                    <BadgeCard key={badge.code} badge={badge} type="comportement" />
                  ))}
                </div>
              </div>

              {/* Badges de Performance */}
              <div>
                <h3 className="text-lg font-mono font-bold text-white mb-3 flex items-center gap-2">
                  ⚡ Badges de Performance <span className="text-sm text-[#4db7ff]">({performanceObtenus}/4)</span>
                </h3>
                <div className="flex gap-3 flex-wrap">
                  {data.badges_performance?.map((badge) => (
                    <BadgeCard key={badge.code} badge={badge} type="performance" />
                  ))}
                </div>
              </div>

              {/* Légende */}
              <div className="bg-[#1f1d35] rounded-xl p-4 border border-[#4db7ff33]">
                <h4 className="text-sm font-mono font-bold text-white mb-2">
                  💡 Badges à paliers progressifs
                </h4>
                <div className="text-xs text-slate-400 space-y-1 font-mono">
                  <div>⚡ <span className="text-[#4db7ff]">Concentration</span> : +1 palier toutes les 50h</div>
                  <div>🎯 <span className="text-[#4db7ff]">Précision</span> : +1 palier toutes les 5 feuilles du 1er coup</div>
                  <div>🚀 <span className="text-[#4db7ff]">Fusée</span> : +1 palier pour chaque +30% d'amélioration</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#18162a] p-6">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Lora:wght@400;600;700&display=swap');
        
        body {
          font-family: 'Lora', serif;
        }
        
        h1, h2, h3, h4, h5, h6 {
          font-family: 'IBM Plex Mono', monospace;
        }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Section Badges (nouvelle) */}
        <BadgesSection />

        {/* Grille de navigation principale */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Bibliothèque */}
          <Link
            href="/library"
            className="group relative overflow-hidden p-8 rounded-2xl border-2 border-[#4db7ff33] bg-gradient-to-br from-[#1f1d35] to-[#18162a] hover:border-[#4db7ff] transition-all duration-300 hover:scale-105"
          >
            <div className="relative z-10">
              <div className="text-5xl mb-4">📚</div>
              <h2 className="text-2xl font-mono font-bold text-white mb-2">Bibliothèque</h2>
              <p className="text-slate-400 text-sm font-serif">
                Accédez aux feuilles d'entraînement et suivez votre parcours
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#4db7ff22] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Mes Sessions */}
          <Link
            href="/library/sessions"
            className="group relative overflow-hidden p-8 rounded-2xl border-2 border-[#ffd93d33] bg-gradient-to-br from-[#2d2517] to-[#18162a] hover:border-[#ffd93d] transition-all duration-300 hover:scale-105"
          >
            <div className="relative z-10">
              <div className="text-5xl mb-4">📝</div>
              <h2 className="text-2xl font-mono font-bold text-white mb-2">Mes Sessions</h2>
              <p className="text-slate-400 text-sm font-serif">
                Enregistrez vos entraînements quotidiens et suivez votre historique
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#ffd93d22] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Progression */}
          <Link
            href="/progression"
            className="group relative overflow-hidden p-8 rounded-2xl border-2 border-[#a855f733] bg-gradient-to-br from-[#251d35] to-[#18162a] hover:border-[#a855f7] transition-all duration-300 hover:scale-105"
          >
            <div className="relative z-10">
              <div className="text-5xl mb-4">📊</div>
              <h2 className="text-2xl font-mono font-bold text-white mb-2">Progression</h2>
              <p className="text-slate-400 text-sm font-serif">
                Consultez vos statistiques et votre évolution
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#a855f722] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Classement */}
          <Link
            href="/classement"
            className="group relative overflow-hidden p-8 rounded-2xl border-2 border-[#4db7ff33] bg-gradient-to-br from-[#1d2535] to-[#18162a] hover:border-[#4db7ff] transition-all duration-300 hover:scale-105"
          >
            <div className="relative z-10">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-2xl font-mono font-bold text-white mb-2">Classement</h2>
              <p className="text-slate-400 text-sm font-serif">
                Comparez vos performances et créez votre équipe
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#4db7ff22] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Personnel */}
          <Link
            href="/personnel"
            className="group relative overflow-hidden p-8 rounded-2xl border-2 border-[#10b98133] bg-gradient-to-br from-[#1d2d25] to-[#18162a] hover:border-[#10b981] transition-all duration-300 hover:scale-105"
          >
            <div className="relative z-10">
              <div className="text-5xl mb-4">👤</div>
              <h2 className="text-2xl font-mono font-bold text-white mb-2">Personnel</h2>
              <p className="text-slate-400 text-sm font-serif">
                Gérez votre équipe et vos notifications
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#10b98122] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Administration */}
          <Link
            href="/admin"
            className="group relative overflow-hidden p-8 rounded-2xl border-2 border-[#14b8a633] bg-gradient-to-br from-[#1d2d2d] to-[#18162a] hover:border-[#14b8a6] transition-all duration-300 hover:scale-105"
          >
            <div className="relative z-10">
              <div className="text-5xl mb-4">⚙️</div>
              <h2 className="text-2xl font-mono font-bold text-white mb-2">Administration</h2>
              <p className="text-slate-400 text-sm font-serif">
                Gérez les niveaux, sujets, chapitres et feuilles d'entraînement
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#14b8a622] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 font-mono pt-4">
          <p>Système d'apprentissage collaboratif avec équipes et validation</p>
        </div>
      </div>
    </main>
  );
}