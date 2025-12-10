'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Types
type Niveau = {
  id: string;
  titre: string;
  ordre: number;
};

type FeuilleData = {
  id: string;
  titre: string;
  ordre: number;
  chapitre_id: string;
  statut: 'validee' | 'en_cours' | 'non_faite' | null;
};

type ChapitreData = {
  id: string;
  titre: string;
  sujet_titre: string;
  ordre: number;
  feuilles: FeuilleData[];
};

type ChapitreRow = {
  id: string;
  titre: string;
  sujet_titre: string;
  ordre: number;
  feuilles: FeuilleData[];
  partNumber?: number;
};

type TableauData = {
  chapitres: ChapitreRow[];
  maxFeuilles: number;
  txSatGlobal: number;
};

type ScoreEvolution = {
  ordre: number;
  score_meca: number | null;
  score_chaos: number | null;
  titre_meca: string | null;
  titre_chaos: string | null;
  date: string;
};

type ConcentrationData = {
  date: string;
  duree: number;
  nbSessions: number;
};

const MAX_FEUILLES_PAR_LIGNE = 30;
const COLONNES_AFFICHEES = 20;

export default function TableauProgression() {
  const router = useRouter();
  const params = useParams();
  const observedUserId = params.userId as string;

  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [niveauSelectionne, setNiveauSelectionne] = useState<string | null>(null);
  const [data, setData] = useState<TableauData | null>(null);
  const [scoresEvolution, setScoresEvolution] = useState<ScoreEvolution[]>([]);
  const [concentrationData, setConcentrationData] = useState<ConcentrationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenBlock, setFullscreenBlock] = useState<string | null>(null);

  // États pour l'observation
  const [membreObserveNom, setMembreObserveNom] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkAuthorization();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadNiveaux();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (niveauSelectionne) {
      loadTableauData(niveauSelectionne);
    }
  }, [niveauSelectionne]);

  async function checkAuthorization() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        router.push('/connexion');
        return;
      }

      const chefUserId = session.user.id;

      const { data: membreData, error: membreError } = await supabase
        .from('membre_equipe')
        .select('user_id, equipe_id')
        .eq('user_id', observedUserId)
        .single();

      if (membreError || !membreData) {
        setError('Membre introuvable');
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', observedUserId)
        .single();

      const { data: equipeData } = await supabase
        .from('equipe')
        .select('chef_id')
        .eq('id', membreData.equipe_id)
        .eq('chef_id', chefUserId)
        .single();

      if (!equipeData) {
        setError('Vous n\'êtes pas autorisé à observer ce membre');
        setLoading(false);
        return;
      }

      setMembreObserveNom(profileData?.full_name || 'Membre');
      setIsAuthorized(true);
    } catch (err: any) {
      console.error('Erreur auth:', err);
      setError('Erreur lors de la vérification des autorisations');
      setLoading(false);
    }
  }

  async function loadNiveaux() {
    try {
      const { data: niveauxData, error: niveauxError } = await supabase
        .from('niveau')
        .select('id, titre, ordre')
        .order('ordre', { ascending: true });

      if (niveauxError) throw niveauxError;

      setNiveaux(niveauxData || []);
      
      if (niveauxData && niveauxData.length > 0) {
        setNiveauSelectionne(niveauxData[0].id);
      }
    } catch (err: any) {
      console.error('Erreur chargement niveaux:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadTableauData(niveauId: string) {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        throw new Error('Vous devez être connecté');
      }

      const userId = observedUserId;

      const { data: rawData, error: queryError } = await supabase
        .rpc('get_tableau_progression', {
          p_niveau_id: niveauId,
          p_user_id: userId
        });

      if (queryError) {
        console.log('RPC non disponible, utilisation de la requête manuelle');
        const manualData = await loadDataManually(niveauId, userId);
        processData(manualData);
      } else {
        processData(rawData);
      }

      await loadScoresEvolution(niveauId, userId);
      await loadConcentrationData(niveauId, userId);

      setLoading(false);
    } catch (err: any) {
      console.error('Erreur chargement tableau:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadDataManually(niveauId: string, userId: string) {
    const { data, error } = await supabase
      .from('sujet')
      .select(`
        id,
        titre,
        ordre,
        chapitres:chapitre(
          id,
          titre,
          ordre,
          feuilles:feuille_entrainement(
            id,
            titre,
            ordre
          )
        )
      `)
      .eq('niveau_id', niveauId)
      .order('ordre', { ascending: true });

    if (error) throw error;

    const feuilleIds = data
      ?.flatMap(s => s.chapitres?.flatMap(c => c.feuilles?.map(f => f.id) || []) || [])
      .filter(Boolean) || [];

    const { data: progressions } = await supabase
      .from('progression_feuille')
      .select('feuille_id, statut')
      .eq('user_id', userId)
      .in('feuille_id', feuilleIds);

    const progressionMap = new Map(
      progressions?.map(p => [p.feuille_id, p.statut]) || []
    );

    const result: any[] = [];
    data?.forEach(sujet => {
      sujet.chapitres?.forEach(chapitre => {
        chapitre.feuilles?.forEach(feuille => {
          result.push({
            sujet_id: sujet.id,
            sujet_titre: sujet.titre,
            sujet_ordre: sujet.ordre,
            chapitre_id: chapitre.id,
            chapitre_titre: chapitre.titre,
            chapitre_ordre: chapitre.ordre,
            feuille_id: feuille.id,
            feuille_titre: feuille.titre,
            feuille_ordre: feuille.ordre,
            feuille_statut: progressionMap.get(feuille.id) || null
          });
        });
        
        if (!chapitre.feuilles || chapitre.feuilles.length === 0) {
          result.push({
            sujet_id: sujet.id,
            sujet_titre: sujet.titre,
            sujet_ordre: sujet.ordre,
            chapitre_id: chapitre.id,
            chapitre_titre: chapitre.titre,
            chapitre_ordre: chapitre.ordre,
            feuille_id: null,
            feuille_titre: null,
            feuille_ordre: null,
            feuille_statut: null
          });
        }
      });
    });

    return result;
  }

  async function loadScoresEvolution(niveauId: string, userId: string) {
    try {
      const { data: feuillesData } = await supabase
        .from('feuille_entrainement')
        .select(`
          id,
          titre,
          type,
          chapitre:chapitre!inner(
            sujet:sujet!inner(
              niveau_id
            )
          )
        `)
        .eq('chapitre.sujet.niveau_id', niveauId);

      if (!feuillesData || feuillesData.length === 0) {
        setScoresEvolution([]);
        return;
      }

      const feuilleIds = feuillesData.map(f => f.id);

      const { data: progressions } = await supabase
        .from('progression_feuille')
        .select('feuille_id, score, validee_at')
        .eq('user_id', userId)
        .eq('statut', 'validee')
        .in('feuille_id', feuilleIds)
        .not('score', 'is', null)
        .not('validee_at', 'is', null)
        .order('validee_at', { ascending: true });

      if (!progressions || progressions.length === 0) {
        setScoresEvolution([]);
        return;
      }

      const feuillesMap = new Map(
        feuillesData.map(f => [f.id, { titre: f.titre, type: f.type }])
      );

      // Créer un tableau avec toutes les dates et séparer méca/chaos
      const scores: ScoreEvolution[] = progressions.map((prog, index) => {
        const feuille = feuillesMap.get(prog.feuille_id);
        const isMecanique = feuille?.type === 'mecanique';
        
        return {
          ordre: index + 1,
          score_meca: isMecanique ? (prog.score || 0) : null,
          score_chaos: !isMecanique ? (prog.score || 0) : null,
          titre_meca: isMecanique ? feuille.titre : null,
          titre_chaos: !isMecanique ? feuille.titre : null,
          date: new Date(prog.validee_at).toLocaleDateString('fr-FR')
        };
      });

      setScoresEvolution(scores);
    } catch (err: any) {
      console.error('Erreur chargement scores:', err);
      setScoresEvolution([]);
    }
  }

  async function loadConcentrationData(niveauId: string, userId: string) {
    try {
      // Récupérer directement toutes les sessions de l'utilisateur
      const date21JoursAvant = new Date();
      date21JoursAvant.setDate(date21JoursAvant.getDate() - 21);

      const { data: sessions, error } = await supabase
        .from('session_entrainement')
        .select('date_session, temps_mecanique, temps_chaotique')
        .eq('user_id', userId)
        .gte('date_session', date21JoursAvant.toISOString().split('T')[0])
        .order('date_session', { ascending: true });

      console.log('🔍 Debug concentration - userId:', userId);
      console.log('🔍 Debug concentration - date21JoursAvant:', date21JoursAvant.toISOString().split('T')[0]);
      console.log('🔍 Debug concentration - sessions récupérées:', sessions);
      console.log('🔍 Debug concentration - error:', error);

      if (error) {
        console.error('Erreur récupération sessions:', error);
        setConcentrationData([]);
        return;
      }

      const aujourd_hui = new Date();
      const concentrationMap = new Map<string, { duree: number; nbSessions: number }>();

      for (let i = 20; i >= 0; i--) {
        const jour = new Date(aujourd_hui);
        jour.setDate(jour.getDate() - i);
        const dateStr = jour.toISOString().split('T')[0];
        concentrationMap.set(dateStr, { duree: 0, nbSessions: 0 });
      }

      sessions?.forEach(session => {
        const existing = concentrationMap.get(session.date_session);
        if (existing) {
          // Additionner les temps mécaniques et chaotiques
          const dureeTotal = (session.temps_mecanique || 0) + (session.temps_chaotique || 0);
          console.log('📊 Session:', session.date_session, '- Méca:', session.temps_mecanique, '- Chaos:', session.temps_chaotique, '- Total:', dureeTotal);
          existing.duree += dureeTotal;
          existing.nbSessions += 1;
        } else {
          console.log('⚠️ Session ignorée (hors période):', session.date_session);
        }
      });

      console.log('📈 Concentration Map finale:', Array.from(concentrationMap.entries()));

      const concentrationArray: ConcentrationData[] = [];
      for (let i = 20; i >= 0; i--) {
        const jour = new Date(aujourd_hui);
        jour.setDate(jour.getDate() - i);
        const dateStr = jour.toISOString().split('T')[0];
        const data = concentrationMap.get(dateStr) || { duree: 0, nbSessions: 0 };
        
        concentrationArray.push({
          date: jour.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
          duree: data.duree,
          nbSessions: data.nbSessions
        });
      }

      setConcentrationData(concentrationArray);
    } catch (err: any) {
      console.error('Erreur chargement concentration:', err);
      setConcentrationData([]);
    }
  }

  function processData(rawData: any[]) {
    if (!rawData || rawData.length === 0) {
      setData({
        chapitres: [],
        maxFeuilles: 0,
        txSatGlobal: 0
      });
      return;
    }

    const chapitresMap = new Map<string, ChapitreData>();

    rawData.forEach(row => {
      const chapitreKey = row.chapitre_id;
      
      if (!chapitresMap.has(chapitreKey)) {
        chapitresMap.set(chapitreKey, {
          id: row.chapitre_id,
          titre: row.chapitre_titre,
          sujet_titre: row.sujet_titre,
          ordre: row.chapitre_ordre,
          feuilles: []
        });
      }

      const chapitre = chapitresMap.get(chapitreKey)!;
      
      if (row.feuille_id) {
        chapitre.feuilles.push({
          id: row.feuille_id,
          titre: row.feuille_titre,
          ordre: row.feuille_ordre,
          chapitre_id: row.chapitre_id,
          statut: row.feuille_statut || 'non_faite'
        });
      }
    });

    chapitresMap.forEach(chapitre => {
      chapitre.feuilles.sort((a, b) => a.ordre - b.ordre);
    });

    const chapitresRows: ChapitreRow[] = [];
    let maxFeuilles = 0;

    Array.from(chapitresMap.values()).forEach(chapitre => {
      const nbFeuilles = chapitre.feuilles.length;
      
      if (nbFeuilles === 0) {
        chapitresRows.push({
          ...chapitre,
          partNumber: undefined
        });
      } else if (nbFeuilles <= MAX_FEUILLES_PAR_LIGNE) {
        chapitresRows.push({
          ...chapitre,
          partNumber: undefined
        });
        maxFeuilles = Math.max(maxFeuilles, nbFeuilles);
      } else {
        const nbParts = Math.ceil(nbFeuilles / MAX_FEUILLES_PAR_LIGNE);
        
        for (let i = 0; i < nbParts; i++) {
          const start = i * MAX_FEUILLES_PAR_LIGNE;
          const end = Math.min(start + MAX_FEUILLES_PAR_LIGNE, nbFeuilles);
          const feuilles = chapitre.feuilles.slice(start, end);
          
          chapitresRows.push({
            id: `${chapitre.id}_part${i + 1}`,
            titre: chapitre.titre,
            sujet_titre: chapitre.sujet_titre,
            ordre: chapitre.ordre,
            feuilles,
            partNumber: i + 1
          });
          
          maxFeuilles = Math.max(maxFeuilles, feuilles.length);
        }
      }
    });

    const toutesLesFeuilles = Array.from(chapitresMap.values())
      .flatMap(c => c.feuilles);
    
    const feuillesValidees = toutesLesFeuilles.filter(
      f => f.statut === 'validee'
    ).length;
    
    const txSatGlobal = toutesLesFeuilles.length > 0
      ? Math.round((feuillesValidees / toutesLesFeuilles.length) * 100)
      : 0;

    setData({
      chapitres: chapitresRows,
      maxFeuilles: COLONNES_AFFICHEES,
      txSatGlobal
    });
  }

  const calculateTxSat = (feuilles: FeuilleData[]) => {
    if (feuilles.length === 0) return 0;
    const validees = feuilles.filter(f => f.statut === 'validee').length;
    return Math.round((validees / feuilles.length) * 100);
  };

  const getCellColor = (statut: string | null) => {
    if (statut === 'validee') return 'bg-[#ffd93d] text-gray-900';
    if (statut === 'en_cours') return 'bg-orange-500 text-gray-900';
    if (statut === 'non_faite') return 'bg-gray-200 text-gray-600';
    return 'bg-white';
  };

  const getCellContent = (statut: string | null) => {
    if (statut === 'validee') return '1';
    if (statut === 'en_cours') return '0';
    if (statut === 'non_faite') return '0';
    return 'x';
  };

  const sujetsGroupes = data ? data.chapitres.reduce((acc, chapitre) => {
    if (!acc[chapitre.sujet_titre]) {
      acc[chapitre.sujet_titre] = [];
    }
    acc[chapitre.sujet_titre].push(chapitre);
    return acc;
  }, {} as Record<string, ChapitreRow[]>) : {};

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 p-8 shadow-sm">
        <div className="text-center text-gray-500">Chargement du tableau...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100/30 border border-red-300 rounded-xl p-6">
        <h3 className="font-semibold text-red-900 mb-2">Erreur</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const toggleFullscreen = (blockId: string) => {
    setFullscreenBlock(fullscreenBlock === blockId ? null : blockId);
  };

  const FullscreenButton = ({ blockId }: { blockId: string }) => (
    <button
      onClick={() => toggleFullscreen(blockId)}
      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
      title="Plein écran"
    >
      <svg className="w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    </button>
  );

  return (
    <div className="min-h-screen bg-white p-6">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap');
        h1, h2, h3, h4, h5, h6, .font-mono { font-family: 'IBM Plex Mono', monospace; }
        body { font-family: 'Lora', serif; }
        p, span, div { font-family: 'Lora', serif; }
      `}</style>
      <div className="max-w-7xl mx-auto">
    <div className="space-y-3">
      {/* Bandeau d'observation */}
      {membreObserveNom && (
        <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                👁️
              </div>
              <div>
                <div className="text-sm font-semibold text-blue-900">
                  Mode Observation
                </div>
                <div className="text-lg font-bold text-blue-700">
                  Vous observez : {membreObserveNom}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              ← Retour à la gestion
            </button>
          </div>
        </div>
      )}

      {niveaux.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-300 p-3 shadow-sm">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Niveau
          </label>
          <select
            value={niveauSelectionne || ''}
            onChange={(e) => setNiveauSelectionne(e.target.value)}
            className="w-full max-w-xs px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {niveaux.map((niveau) => (
              <option key={niveau.id} value={niveau.id}>
                {niveau.titre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Parcours d'apprentissage</h2>
            <p className="text-teal-100 text-xs">Ensemble des entrainement fait</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-xs text-teal-100">TxSat Global</div>
              <div className="text-xl font-bold text-gray-900">{data.txSatGlobal}%</div>
            </div>
            <FullscreenButton blockId="tableau" />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[35vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="sticky left-0 bg-gray-100 px-3 py-2 text-center font-bold text-gray-700 border-r-2 border-gray-300 min-w-[100px]">
                  Sujet
                </th>
                <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 min-w-[150px]">
                  Chapitre
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-300 min-w-[60px]">
                  TxSat
                </th>
                {Array.from({ length: COLONNES_AFFICHEES }, (_, i) => (
                  <th
                    key={i}
                    className="px-1.5 py-2 text-center font-medium text-gray-600 border-r border-gray-300 min-w-[40px]"
                  >
                    F{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(sujetsGroupes).map(([sujetTitre, chapitres], sujetIndex) => (
                <React.Fragment key={sujetTitre}>
                  {chapitres.map((chapitre, chapIndex) => (
                    <tr
                      key={chapitre.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        chapIndex === chapitres.length - 1
                          ? 'border-b-2 border-gray-300'
                          : 'border-b border-gray-200'
                      }`}
                    >
                      {chapIndex === 0 && (
                        <td
                          rowSpan={chapitres.length}
                          className="sticky left-0 bg-gray-100 px-3 py-2 border-r-2 border-gray-300 text-center align-middle"
                        >
                          <span className="font-bold text-teal-600 text-sm">
                            {sujetTitre}
                          </span>
                        </td>
                      )}

                      <td className="sticky left-0 bg-white px-3 py-2 border-r border-gray-300">
                        <span className="text-gray-700 text-xs">
                          {chapitre.titre}
                          {chapitre.partNumber && (
                            <span className="text-gray-500 ml-1">
                              ({chapitre.partNumber})
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        <span className="font-semibold text-gray-700 text-xs">
                          {calculateTxSat(chapitre.feuilles)}%
                        </span>
                      </td>

                      {Array.from({ length: COLONNES_AFFICHEES }, (_, i) => {
                        const feuille = chapitre.feuilles.find((f, idx) => idx === i);
                        const statut = feuille ? feuille.statut : null;
                        
                        return (
                          <td
                            key={i}
                            className="px-1.5 py-2 text-center border-r border-gray-200"
                          >
                            <div
                              className={`inline-flex items-center justify-center w-6 h-6 rounded font-semibold text-xs ${getCellColor(statut)}`}
                            >
                              {getCellContent(statut)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50/50 px-4 py-2 border-t border-gray-300">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-600 font-semibold">Légende :</span>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-[#ffd93d] flex items-center justify-center text-gray-900 font-semibold text-xs">1</div>
              <span className="text-gray-600">Validée</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-gray-900 font-semibold text-xs">0</div>
              <span className="text-gray-600">En progression</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-xs">0</div>
              <span className="text-gray-600">Non faite</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-white border border-gray-300 flex items-center justify-center text-gray-500 font-semibold text-xs">x</div>
              <span className="text-gray-600">N'existe pas</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Graphique des scores */}
        <div className={`bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden flex flex-col ${fullscreenBlock === 'scores' ? 'fixed inset-4 z-50' : ''}`}>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-3 py-2 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Progresser en mathématique</h2>
              <p className="text-purple-100 text-xs">
                {scoresEvolution.length > 0 
                  ? `${scoresEvolution.length} feuille${scoresEvolution.length > 1 ? 's' : ''}`
                  : 'Aucune donnée'
                }
              </p>
            </div>
            <FullscreenButton blockId="scores" />
          </div>

          {scoresEvolution.length > 0 ? (
            <>
              <div className="p-3 flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoresEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7"  />
                    <XAxis 
                      dataKey="ordre" 
                      stroke="#71717a"
                      style={{ fontSize: '10px' }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="#71717a"
                      style={{ fontSize: '10px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e4e4e7',
                        borderRadius: '8px',
                        fontSize: '11px'
                      }}
                      formatter={(value: any, name: string) => {
                        if (value === null) return ['', ''];
                        return [`${value}%`, name === 'score_meca' ? 'Mécanique' : 'Chaotique'];
                      }}
                      labelFormatter={(value: any) => `Feuille #${value}`}
                      />
                    <Line
                      type="monotone"
                      dataKey="score_meca"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 3 }}
                      connectNulls
                      name="Mécanique"
                    />
                    <Line
                      type="monotone"
                      dataKey="score_chaos"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={{ fill: '#a855f7', r: 3 }}
                      connectNulls
                      name="Chaotique"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-purple-50/20 px-3 py-1.5 border-t border-purple-200 flex-shrink-0">
                <div className="flex justify-around text-center text-xs">
                  <div>
                    <div className="font-bold text-blue-600">
                      {Math.round(
                        scoresEvolution.filter(s => s.score_meca !== null).reduce((acc, s) => acc + (s.score_meca || 0), 0) / 
                        (scoresEvolution.filter(s => s.score_meca !== null).length || 1)
                      )}%
                    </div>
                    <div className="text-blue-700 text-[10px]">Moy. Méca</div>
                  </div>
                  <div>
                    <div className="font-bold text-purple-600">
                      {Math.round(
                        scoresEvolution.filter(s => s.score_chaos !== null).reduce((acc, s) => acc + (s.score_chaos || 0), 0) / 
                        (scoresEvolution.filter(s => s.score_chaos !== null).length || 1)
                      )}%
                    </div>
                    <div className="text-purple-700 text-[10px]">Moy. Chaos</div>
                  </div>
                  <div>
                    <div className="font-bold text-green-600">
                      {Math.max(
                        ...scoresEvolution.map(s => s.score_meca || 0),
                        ...scoresEvolution.map(s => s.score_chaos || 0)
                      )}%
                    </div>
                    <div className="text-green-700 text-[10px]">Max</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-gray-500 flex-1 flex flex-col items-center justify-center">
              <div className="text-2xl mb-1">📊</div>
              <p className="text-xs">Aucune donnée</p>
            </div>
          )}
        </div>

        {/* Graphique de concentration */}
        <div className={`bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden flex flex-col ${fullscreenBlock === 'concentration' ? 'fixed inset-4 z-50' : ''}`}>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Entraîner sa concentration</h2>
              <p className="text-blue-100 text-xs">21 derniers jours</p>
            </div>
            <FullscreenButton blockId="concentration" />
          </div>

          {concentrationData.some(d => d.duree > 0) ? (
            <>
              <div className="p-3 flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={concentrationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7"  />
                    <XAxis 
                      dataKey="date" 
                      stroke="#71717a"
                      style={{ fontSize: '9px' }}
                      angle={-45}
                      textAnchor="end"
                      height={40}
                      interval={6}
                    />
                    <YAxis 
                      stroke="#71717a"
                      style={{ fontSize: '10px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e4e4e7',
                        borderRadius: '8px',
                        fontSize: '11px'
                      }}
                      formatter={(value: any, name: string, props: any) => [
                        `${value} min (${props.payload.nbSessions} session${props.payload.nbSessions > 1 ? 's' : ''})`,
                        'Temps'
                      ]}
                    />
                    <Bar
                      dataKey="duree"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-blue-50/20 px-3 py-1.5 border-t border-blue-200 flex-shrink-0">
                <div className="flex justify-around text-center text-xs">
                  <div>
                    <div className="font-bold text-blue-600">
                      {Math.round(
                        concentrationData.reduce((acc, d) => acc + d.duree, 0) / 
                        concentrationData.filter(d => d.duree > 0).length || 0
                      )} min
                    </div>
                    <div className="text-blue-700 text-[10px]">Moy/jour</div>
                  </div>
                  <div>
                    <div className="font-bold text-blue-600">
                      {concentrationData.reduce((acc, d) => acc + d.duree, 0)} min
                    </div>
                    <div className="text-blue-700 text-[10px]">Total</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-gray-500 flex-1 flex flex-col items-center justify-center">
              <div className="text-2xl mb-1">⏱️</div>
              <p className="text-xs">Aucune donnée</p>
            </div>
          )}
        </div>

        {/* Grille 4x3 */}
        <div className={`bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden ${fullscreenBlock === 'grille' ? 'fixed inset-4 z-50' : ''}`}>
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-3 py-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Apprendre à apprendre</h2>
              <p className="text-teal-100 text-xs">Pédago-visible</p>
            </div>
            <FullscreenButton blockId="grille" />
          </div>
          
          <div className="p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-lg border-2 flex items-center justify-center font-bold text-base ${
                    i % 3 === 0 
                      ? 'border-green-500 bg-green-50/20 text-green-600'
                      : 'border-red-500 bg-red-50/20 text-red-600'
                  }`}
                >
                  {i % 3 === 0 ? '✓' : '✗'}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50/50 px-3 py-1.5 border-t border-gray-300 text-center">
            <p className="text-xs text-gray-600">8/12 réussies</p>
          </div>
        </div>
      </div>
    </div>
      </div>
    </div>
  );
}