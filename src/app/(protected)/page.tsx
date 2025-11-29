'use client';

import Link from "next/link";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
  badges_obtenus: any;
  progression_niveaux: ProgressionNiveau[];
};

function BadgeProgressionCard({ niveau }: { niveau: ProgressionNiveau }) {
  const progression = niveau.pourcentage / 100; // 0 à 1
  const emoji = niveau.badge.split(' ')[0]; // Extraire l'emoji
  
  // Calculer l'opacité de l'emoji selon la progression
  const emojiOpacity = 0.15 + (progression * 0.85); // De 0.15 à 1.0
  
  // Couleur selon le niveau
  const colors = {
    1: { from: '#a855f7', to: '#7e22ce' }, // Violet (Élémentaire)
    2: { from: '#eab308', to: '#ca8a04' }, // Jaune (Collège)
    3: { from: '#f97316', to: '#ea580c' }, // Orange (Lycée)
    4: { from: '#3b82f6', to: '#1d4ed8' }, // Bleu (Licence)
    5: { from: '#ec4899', to: '#be185d' }, // Rose (Master)
    6: { from: '#ef4444', to: '#b91c1c' }, // Rouge (Doctorat)
  };
  
  const color = colors[niveau.niveau_ordre as keyof typeof colors] || colors[1];
  const estComplete = progression === 1;
  
  return (
    <div className="relative group">
      {/* Carte avec fond progressif */}
      <div 
        className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
          estComplete 
            ? 'border-yellow-400 shadow-2xl shadow-yellow-500/50' 
            : 'border-slate-300 dark:border-slate-700'
        }`}
        style={{
          background: estComplete
            ? `linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%)`
            : `linear-gradient(135deg, ${color.from} ${progression * 100}%, #e2e8f0 ${progression * 100}%)`
        }}
      >
        {/* Grille de pixels en fond (effet visuel) */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 11px),
              repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 11px)
            `
          }}
        />
        
        {/* Contenu */}
        <div className="relative p-6 flex flex-col items-center">
          {/* Emoji avec opacité progressive */}
          <div 
            className={`text-6xl mb-3 transition-all duration-500 ${
              estComplete ? 'scale-110' : ''
            }`}
            style={{ 
              opacity: emojiOpacity,
              filter: estComplete ? 'drop-shadow(0 0 20px rgba(255,255,255,0.8))' : 'none'
            }}
          >
            {emoji}
            {estComplete && <span className="ml-2 text-4xl">✨</span>}
          </div>
          
          {/* Nom du niveau */}
          <div className={`text-sm font-bold mb-2 transition-colors ${
            progression > 0.3 
              ? 'text-white' 
              : 'text-slate-700 dark:text-slate-300'
          }`}>
            {niveau.niveau_titre}
          </div>
          
          {/* Pourcentage */}
          <div className={`text-2xl font-extrabold mb-1 ${
            progression > 0.3 
              ? 'text-white' 
              : 'text-slate-900 dark:text-slate-100'
          }`}>
            {niveau.pourcentage}%
          </div>
          
          {/* Badge obtenu */}
          {estComplete && (
            <div className="mt-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-bold">
              ✓ Obtenu
            </div>
          )}
        </div>
        
        {/* Animation pulse si complété */}
        {estComplete && (
          <div className="absolute inset-0 rounded-2xl animate-pulse bg-yellow-400/10" />
        )}
      </div>
    </div>
  );
}

function ProgressionSection() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProgressionData | null>(null);

  useEffect(() => {
    loadProgression();
  }, []);

  async function loadProgression() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('❌ Pas de session');
        return;
      }

      console.log('✅ Session OK, appel RPC...');
      
      const { data: result, error } = await supabase.rpc('get_progression_utilisateur', {
        p_user_id: session.user.id
      });

      if (error) {
        console.error('❌ Erreur RPC:', error);
        throw error;
      }
      
      console.log('✅ Données reçues:', result);
      
      setData(result);
    } catch (error) {
      console.error('❌ Erreur chargement progression:', error);
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

  if (!data?.progression_niveaux || data.progression_niveaux.length === 0) {
    // Créer des badges par défaut avec 0%
    const defaultNiveaux: ProgressionNiveau[] = [
      { niveau_id: '1', niveau_titre: 'Élémentaire', niveau_ordre: 1, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐛 Asticot' },
      { niveau_id: '2', niveau_titre: 'Collège', niveau_ordre: 2, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐝 Abeille' },
      { niveau_id: '3', niveau_titre: 'Lycée', niveau_ordre: 3, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐻 Ours' },
      { niveau_id: '4', niveau_titre: 'Licence', niveau_ordre: 4, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐘 Éléphant' },
      { niveau_id: '5', niveau_titre: 'Master', niveau_ordre: 5, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🦄 Licorne' },
      { niveau_id: '6', niveau_titre: 'Doctorat', niveau_ordre: 6, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐉 Dragon' },
    ];
    
    return (
      <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-700 shadow-xl">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
          🏆 Collections
        </h2>
        
        {/* Grille de badges */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {defaultNiveaux.map((niveau) => (
            <BadgeProgressionCard key={niveau.niveau_id} niveau={niveau} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-700 shadow-xl">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
        🏆 Votre Collection
      </h2>
      
      {/* Grille de badges */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {data.progression_niveaux.map((niveau) => (
          <BadgeProgressionCard key={niveau.niveau_id} niveau={niveau} />
        ))}
      </div>
      
      
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Bloc Progression avec Badges */}
        <div className="mb-8">
          <ProgressionSection />
        </div>

        {/* Grille de navigation */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Bibliothèque */}
          <Link
            href="/library"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <div className="text-4xl mb-3">📚</div>
            <h2 className="text-xl font-bold mb-2">Bibliothèque</h2>
            <p className="text-slate-300 text-sm">
              Accédez aux feuilles d'entraînement et suivez votre parcours
            </p>
          </Link>

          {/* Progression */}
          <Link
            href="/progression"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <div className="text-4xl mb-3">📊</div>
            <h2 className="text-xl font-bold mb-2">Progression</h2>
            <p className="text-purple-100 text-sm">
              Consultez vos statistiques et votre évolution
            </p>
          </Link>

          {/* Classement */}
          <Link
            href="/classement"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <div className="text-4xl mb-3">🏆</div>
            <h2 className="text-xl font-bold mb-2">Classement</h2>
            <p className="text-blue-100 text-sm">
              Comparez vos performances et créez votre équipe
            </p>
          </Link>

          {/* Personnel */}
          <Link
            href="/personnel"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700 text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <div className="text-4xl mb-3">👤</div>
            <h2 className="text-xl font-bold mb-2">Personnel</h2>
            <p className="text-green-100 text-sm">
              Gérez votre équipe et vos notifications
            </p>
          </Link>

          {/* Administration */}
          <Link
            href="/admin"
            className="group p-6 rounded-2xl shadow-lg bg-gradient-to-br from-teal-600 to-teal-700 dark:from-teal-700 dark:to-teal-800 text-white hover:shadow-xl hover:scale-105 transition-all duration-200 md:col-span-2"
          >
            <div className="text-4xl mb-3">⚙️</div>
            <h2 className="text-xl font-bold mb-2">Administration</h2>
            <p className="text-teal-100 text-sm">
              Gérez les niveaux, sujets, chapitres et feuilles d'entraînement
            </p>
          </Link>
        </div>

        {/* Footer info */}
        <div className="text-center text-sm text-slate-500 dark:text-slate-400 pt-8">
     
        </div>
      </div>
    </main>
  );
}