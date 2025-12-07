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
  const progression = niveau.pourcentage / 100;
  const emoji = niveau.badge.split(' ')[0];
  const emojiOpacity = 0.15 + (progression * 0.85);
  
  const colors = {
    1: { from: '#a855f7', to: '#7e22ce' },
    2: { from: '#ffd93d', to: '#ffb700' },
    3: { from: '#f97316', to: '#ea580c' },
    4: { from: '#4db7ff', to: '#0084d4' },
    5: { from: '#ec4899', to: '#be185d' },
    6: { from: '#ef4444', to: '#b91c1c' },
  };
  
  const color = colors[niveau.niveau_ordre as keyof typeof colors] || colors[1];
  const estComplete = progression === 1;
  
  return (
    <div className="relative group">
      <div 
        className="relative overflow-hidden rounded-xl border-2 transition-all duration-300"
        style={{
          background: estComplete
            ? '#2a2840'
            : `linear-gradient(135deg, ${color.from} ${progression * 100}%, #2a2840 ${progression * 100}%)`,
          borderColor: progression > 0 ? color.from : '#4db7ff33'
        }}
      >
        <div className="relative p-4 flex flex-col items-center">
          <div 
            className="text-4xl mb-2 transition-all duration-500"
            style={{ opacity: emojiOpacity }}
          >
            {emoji}
          </div>
          
          <div className="text-xs font-mono font-bold mb-1 text-slate-300">
            {niveau.niveau_titre}
          </div>
          
          <div className="text-xl font-mono font-extrabold text-white">
            {niveau.pourcentage}%
          </div>
        </div>
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
      if (!session) return;
      
      const { data: result, error } = await supabase.rpc('get_progression_utilisateur', {
        p_user_id: session.user.id
      });

      if (error) throw error;
      setData(result);
    } catch (error) {
      console.error('Erreur chargement progression:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[#18162a] rounded-2xl p-6 border border-[#4db7ff33]">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#4db7ff] border-t-transparent"></div>
        </div>
      </div>
    );
  }

  const niveaux = data?.progression_niveaux?.length ? data.progression_niveaux : [
    { niveau_id: '1', niveau_titre: 'élémentaire', niveau_ordre: 1, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐛 Asticot' },
    { niveau_id: '2', niveau_titre: 'collège', niveau_ordre: 2, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐝 Abeille' },
    { niveau_id: '3', niveau_titre: 'lycée', niveau_ordre: 3, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐻 Ours' },
    { niveau_id: '4', niveau_titre: 'licence', niveau_ordre: 4, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐘 Éléphant' },
    { niveau_id: '5', niveau_titre: 'master', niveau_ordre: 5, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🦄 Licorne' },
    { niveau_id: '6', niveau_titre: 'doctorat', niveau_ordre: 6, total_feuilles: 0, feuilles_validees: 0, pourcentage: 0, badge: '🐉 Dragon' },
  ];

  return (
    <div className="bg-[#18162a] rounded-2xl p-6 border border-[#4db7ff33]">
      <h2 className="text-lg font-mono font-bold text-white mb-4 flex items-center gap-2">
        🏆 Collection des Badges
      </h2>
      
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {niveaux.map((niveau) => (
          <BadgeProgressionCard key={niveau.niveau_id} niveau={niveau} />
        ))}
      </div>
    </div>
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
        
        {/* Section Progression (réduite) */}
        <ProgressionSection />

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