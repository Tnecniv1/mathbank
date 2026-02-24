'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { GraphiqueLive } from '@/components/GraphiqueLive';
import { TableauNotation } from '@/components/TableauNotation';

export default function SessionLivePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [feuilleTitre, setFeuilleTitre] = useState('');
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [duree, setDuree] = useState('00:00');
  const [stopping, setStopping] = useState(false);

  // Charger les données de la session
  useEffect(() => {
    async function loadSession() {
      const { data, error } = await supabase
        .from('session_entrainement')
        .select(`
          *,
          feuille_mecanique:feuille_mecanique_id(titre),
          feuille_chaotique:feuille_chaotique_id(titre)
        `)
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        alert('Session introuvable');
        router.push('/library/sessions');
        return;
      }

      if (data.statut === 'terminee') {
        alert('Cette session est déjà terminée');
        router.push('/library/sessions');
        return;
      }

      setSessionData(data);
      setStartedAt(new Date(data.started_at));
      setFeuilleTitre(
        data.feuille_mecanique?.titre ||
        data.feuille_chaotique?.titre ||
        'Session Live'
      );
      setLoading(false);
    }

    loadSession();
  }, [sessionId, router]);

  // Timer de durée
  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      const minutes = Math.floor(diff / 60);
      const secondes = diff % 60;
      setDuree(`${String(minutes).padStart(2, '0')}:${String(secondes).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const handleScoreInserted = useCallback(() => {
    // Le GraphiqueLive se met à jour via son propre polling
  }, []);

  const arreterSession = async () => {
    if (!confirm('Arrêter la session live ?')) return;

    setStopping(true);

    // Calculer le temps total en minutes
    const tempsMinutes = startedAt
      ? Math.round((Date.now() - startedAt.getTime()) / 60000)
      : 0;

    // Mettre à jour le statut et le temps
    const updateData: any = {
      statut: 'terminee',
    };

    // Mettre à jour le temps sur la bonne colonne
    // Note : le select avec join remplace feuille_*_id par l'objet feuille_*
    if (sessionData?.feuille_mecanique) {
      updateData.temps_mecanique = tempsMinutes;
    } else if (sessionData?.feuille_chaotique) {
      updateData.temps_chaotique = tempsMinutes;
    }

    const { error } = await supabase
      .from('session_entrainement')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('Erreur arrêt session:', error);
      alert('Erreur lors de l\'arrêt de la session');
      setStopping(false);
      return;
    }

    router.push('/library/sessions');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="w-10 h-10 animate-spin mx-auto mb-4 text-purple-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
          </svg>
          <p className="text-gray-500">Chargement de la session live...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b-2 border-gray-200 flex justify-between items-center px-6 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="font-bold text-red-600 text-sm uppercase tracking-wide">Session Live</span>
          </span>
          <h1 className="text-lg font-bold text-gray-800">{feuilleTitre}</h1>
          <span className="text-sm text-gray-400 font-mono">{duree}</span>
        </div>
        <button
          onClick={arreterSession}
          disabled={stopping}
          className="px-5 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold rounded-lg transition flex items-center gap-2"
        >
          {stopping ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
              </svg>
              Arrêt...
            </>
          ) : (
            <>■ Arrêter la session</>
          )}
        </button>
      </header>

      {/* Graphique (75% hauteur) */}
      <div className="h-3/4 bg-gradient-to-br from-gray-50 to-white p-6 overflow-hidden">
        <GraphiqueLive
          sessionId={sessionId}
          nbTotal={0}
          duree={duree}
        />
      </div>

      {/* Tableau Notation (25% hauteur) */}
      <div className="h-1/4 bg-white border-t-2 border-gray-200 overflow-hidden">
        <TableauNotation
          sessionId={sessionId}
          onScoreInserted={handleScoreInserted}
        />
      </div>
    </div>
  );
}
