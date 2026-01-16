'use client';

import React, { useEffect, useState } from 'react';
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



type ConcentrationData = {
  date: string;
  duree: number;
  nbSessions: number;
};

type ScoreLocal = {
  ordre: number;
  score: number;
  exercice: string;
  question: string;
  date: string;
  session_id?: string;
  session_numero?: number;
};

type ScoreMecaCumulatif = {
  ordre: number;
  scoreCumulatif: number;
  question: string;
  date: string;
};

type ScoreParSession = {
  ordre: number;
  session_numero: number;
  scoreMoyen: number;
  nbQuestions: number;
  date: string;
};

const MAX_FEUILLES_PAR_LIGNE = 30;
const COLONNES_AFFICHEES = 20;

export default function TableauProgression() {
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [niveauSelectionne, setNiveauSelectionne] = useState<string | null>(null);
  const [data, setData] = useState<TableauData | null>(null);
  const [concentrationData, setConcentrationData] = useState<ConcentrationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenBlock, setFullscreenBlock] = useState<string | null>(null);
  const [scoresMecaniques, setScoresMecaniques] = useState<ScoreLocal[]>([]);
  const [scoresChaotiques, setScoresChaotiques] = useState<ScoreLocal[]>([]);
  const [scoreType, setScoreType] = useState<'mecanique' | 'chaotique'>('mecanique');
  const [viewMode, setViewMode] = useState<'questions' | 'sessions'>('questions');
  const [scoresMecaCumulatifs, setScoresMecaCumulatifs] = useState<ScoreMecaCumulatif[]>([]);
  const [scoresParSessionMeca, setScoresParSessionMeca] = useState<ScoreParSession[]>([]);
  const [scoresParSessionChaos, setScoresParSessionChaos] = useState<ScoreParSession[]>([]);

  useEffect(() => {
    loadNiveaux();
  }, []);

  useEffect(() => {
    if (niveauSelectionne) {
      loadTableauData(niveauSelectionne);
    }
  }, [niveauSelectionne]);

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

      const userId = session.user.id;

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

      await loadScoresLocauxAvecType(niveauId, userId);
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



  async function loadScoresLocauxAvecType(niveauId: string, userId: string) {
      try {
        // Récupérer d'abord toutes les feuilles du niveau
        const { data: feuillesData } = await supabase
          .from('feuille_entrainement')
          .select(`
            id,
            chapitre:chapitre!inner(
              sujet:sujet!inner(
                niveau_id
              )
            )
          `)
          .eq('chapitre.sujet.niveau_id', niveauId);

        if (!feuillesData || feuillesData.length === 0) {
          setScoresMecaniques([]);
          setScoresChaotiques([]);
          setScoresMecaCumulatifs([]);
          setScoresParSessionMeca([]);
          setScoresParSessionChaos([]);
          return;
        }

        const feuilleIds = feuillesData.map((f: any) => f.id);

        // Récupérer les scores locaux filtrés par niveau
        const { data: scoresData, error } = await supabase
          .from('score_local')
          .select(`
            id,
            exercice,
            question,
            score_calcule,
            created_at,
            session_id,
            session_entrainement!inner(
              user_id,
              feuille_mecanique_id,
              feuille_chaotique_id,
              numero_session,
              date_session
            )
          `)
          .eq('session_entrainement.user_id', userId)
          .or(`feuille_mecanique_id.in.(${feuilleIds.join(',')}),feuille_chaotique_id.in.(${feuilleIds.join(',')})`, { foreignTable: 'session_entrainement' })
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Erreur chargement scores locaux:', error);
          setScoresMecaniques([]);
          setScoresChaotiques([]);
          setScoresMecaCumulatifs([]);
          setScoresParSessionMeca([]);
          setScoresParSessionChaos([]);
          return;
        }

        if (!scoresData || scoresData.length === 0) {
          setScoresMecaniques([]);
          setScoresChaotiques([]);
          setScoresMecaCumulatifs([]);
          setScoresParSessionMeca([]);
          setScoresParSessionChaos([]);
          return;
        }

        // Séparer les scores mécaniques et chaotiques
        const scoresMeca: ScoreLocal[] = [];
        const scoresChaos: ScoreLocal[] = [];
        let indexMeca = 1;
        let indexChaos = 1;
        let scoreCumulatif = 0;
        const scoresCumulatifs: ScoreMecaCumulatif[] = [];

        // Map pour regrouper par session
        const sessionsMeca = new Map<string, ScoreLocal[]>();
        const sessionsChaos = new Map<string, ScoreLocal[]>();

        scoresData.forEach((score: any) => {
          const isMecanique = score.session_entrainement.feuille_mecanique_id !== null;
          const sessionId = score.session_id;
          const sessionNumero = score.session_entrainement.numero_session;
          const dateSession = score.session_entrainement.date_session;
          
          if (isMecanique) {
            const scoreValue = parseFloat(score.score_calcule) || 0;
            const isSucces = scoreValue === 100;
            
            // Score normal
            const scoreLocal: ScoreLocal = {
              ordre: indexMeca++,
              score: scoreValue,
              exercice: score.exercice,
              question: score.question,
              date: new Date(score.created_at).toLocaleDateString('fr-FR'),
              session_id: sessionId,
              session_numero: sessionNumero
            };
            scoresMeca.push(scoreLocal);

            // Score cumulatif
            scoreCumulatif += isSucces ? 1 : -1;
            scoresCumulatifs.push({
              ordre: indexMeca - 1,
              scoreCumulatif: scoreCumulatif,
              question: score.question,
              date: new Date(score.created_at).toLocaleDateString('fr-FR')
            });

            // Regrouper par session
            if (!sessionsMeca.has(sessionId)) {
              sessionsMeca.set(sessionId, []);
            }
            sessionsMeca.get(sessionId)!.push(scoreLocal);
          } else {
            const scoreLocal: ScoreLocal = {
              ordre: indexChaos++,
              score: parseFloat(score.score_calcule) || 0,
              exercice: score.exercice,
              question: score.question,
              date: new Date(score.created_at).toLocaleDateString('fr-FR'),
              session_id: sessionId,
              session_numero: sessionNumero
            };
            scoresChaos.push(scoreLocal);

            // Regrouper par session
            if (!sessionsChaos.has(sessionId)) {
              sessionsChaos.set(sessionId, []);
            }
            sessionsChaos.get(sessionId)!.push(scoreLocal);
          }
        });

        // Calculer les moyennes par session pour mécaniques
        const scoresSessionMeca: ScoreParSession[] = [];
        let ordreMeca = 1;
        sessionsMeca.forEach((scores, sessionId) => {
          const scoreMoyen = scores.reduce((acc, s) => acc + s.score, 0) / scores.length;
          scoresSessionMeca.push({
            ordre: ordreMeca++,
            session_numero: scores[0].session_numero || 0,
            scoreMoyen: Math.round(scoreMoyen),
            nbQuestions: scores.length,
            date: scores[0].date
          });
        });

        // Calculer les moyennes par session pour chaotiques
        const scoresSessionChaos: ScoreParSession[] = [];
        let ordreChaos = 1;
        sessionsChaos.forEach((scores, sessionId) => {
          const scoreMoyen = scores.reduce((acc, s) => acc + s.score, 0) / scores.length;
          scoresSessionChaos.push({
            ordre: ordreChaos++,
            session_numero: scores[0].session_numero || 0,
            scoreMoyen: Math.round(scoreMoyen),
            nbQuestions: scores.length,
            date: scores[0].date
          });
        });

        setScoresMecaniques(scoresMeca);
        setScoresChaotiques(scoresChaos);
        setScoresMecaCumulatifs(scoresCumulatifs);
        setScoresParSessionMeca(scoresSessionMeca);
        setScoresParSessionChaos(scoresSessionChaos);
      } catch (err: any) {
        console.error('Erreur chargement scores locaux:', err);
        setScoresMecaniques([]);
        setScoresChaotiques([]);
        setScoresMecaCumulatifs([]);
        setScoresParSessionMeca([]);
        setScoresParSessionChaos([]);
      }
    }


  async function loadConcentrationData(niveauId: string, userId: string) {
    try {
      const { data: feuillesData } = await supabase
        .from('feuille_entrainement')
        .select(`
          id,
          chapitre:chapitre!inner(
            sujet:sujet!inner(
              niveau_id
            )
          )
        `)
        .eq('chapitre.sujet.niveau_id', niveauId);

      if (!feuillesData || feuillesData.length === 0) {
        setConcentrationData([]);
        return;
      }

      const feuilleIds = feuillesData.map(f => f.id);

      const { data: progressions } = await supabase
        .from('progression_feuille')
        .select('id')
        .eq('user_id', userId)
        .in('feuille_id', feuilleIds);

      if (!progressions || progressions.length === 0) {
        setConcentrationData([]);
        return;
      }

      const progressionIds = progressions.map(p => p.id);

      const date21JoursAvant = new Date();
      date21JoursAvant.setDate(date21JoursAvant.getDate() - 21);

      // Récupérer les sessions d'entraînement
      const { data: sessions } = await supabase
        .from('session_entrainement')
        .select('date_session, temps_mecanique, temps_chaotique, user_id')
        .eq('user_id', userId)
        .gte('date_session', date21JoursAvant.toISOString().split('T')[0])
        .order('date_session', { ascending: true });

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
          existing.duree += dureeTotal;
          existing.nbSessions += 1;
        }
      });

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
        {/* Graphique des scores avec toggle */}
                <div className={`bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden flex flex-col ${fullscreenBlock === 'scores' ? 'fixed inset-4 z-50' : ''}`}>
                          <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-3 py-2 flex items-center justify-between flex-shrink-0">
                            <div>
                              <h2 className="text-sm font-bold text-gray-900">Progresser en mathématique</h2>
                              <p className="text-purple-100 text-xs">
                                {scoreType === 'mecanique'
                                  ? viewMode === 'questions'
                                    ? `${scoresMecaniques.length} question${scoresMecaniques.length > 1 ? 's' : ''}`
                                    : `${scoresParSessionMeca.length} session${scoresParSessionMeca.length > 1 ? 's' : ''}`
                                  : viewMode === 'questions'
                                    ? `${scoresChaotiques.length} question${scoresChaotiques.length > 1 ? 's' : ''}`
                                    : `${scoresParSessionChaos.length} session${scoresParSessionChaos.length > 1 ? 's' : ''}`
                                }
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Toggle Mécanique/Chaotique */}
                              <div className="flex bg-white/20 rounded-lg p-0.5">
                                <button
                                  onClick={() => setScoreType('mecanique')}
                                  className={`px-2 py-1 text-xs font-medium rounded transition ${
                                    scoreType === 'mecanique'
                                      ? 'bg-white text-blue-700'
                                      : 'text-white hover:bg-white/10'
                                  }`}
                                >
                                  M
                                </button>
                                <button
                                  onClick={() => setScoreType('chaotique')}
                                  className={`px-2 py-1 text-xs font-medium rounded transition ${
                                    scoreType === 'chaotique'
                                      ? 'bg-white text-purple-700'
                                      : 'text-white hover:bg-white/10'
                                  }`}
                                >
                                  C
                                </button>
                              </div>
                              {/* Toggle Questions/Sessions */}
                              <div className="flex bg-white/20 rounded-lg p-0.5">
                                <button
                                  onClick={() => setViewMode('questions')}
                                  className={`px-2 py-1 text-xs font-medium rounded transition ${
                                    viewMode === 'questions'
                                      ? 'bg-white text-gray-900'
                                      : 'text-white hover:bg-white/10'
                                  }`}
                                >
                                  Q
                                </button>
                                <button
                                  onClick={() => setViewMode('sessions')}
                                  className={`px-2 py-1 text-xs font-medium rounded transition ${
                                    viewMode === 'sessions'
                                      ? 'bg-white text-gray-900'
                                      : 'text-white hover:bg-white/10'
                                  }`}
                                >
                                  S
                                </button>
                              </div>
                              <FullscreenButton blockId="scores" />
                            </div>
                          </div>

                          {/* GRAPHIQUE MÉCANIQUE - MODE QUESTIONS (Cumulatif) */}
                          {scoreType === 'mecanique' && viewMode === 'questions' && scoresMecaCumulatifs.length > 0 && (
                            <>
                              <div className="p-3 flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={scoresMecaCumulatifs}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                                    <XAxis 
                                      dataKey="ordre" 
                                      stroke="#71717a"
                                      style={{ fontSize: '10px' }}
                                      label={{ value: 'Question', position: 'insideBottom', offset: -5, style: { fontSize: '10px' } }}
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
                                      formatter={(value: any) => [`Score: ${value}`, 'Cumulatif']}
                                      labelFormatter={(value: any, payload: any) => {
                                        const item = payload[0]?.payload;
                                        return item ? `Q${value} - ${item.question}` : `Question ${value}`;
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="scoreCumulatif"
                                      stroke="#3b82f6"
                                      strokeWidth={2}
                                      dot={{ fill: '#3b82f6', r: 4 }}
                                      name="Score Cumulatif"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>

                              <div className="bg-blue-50/20 px-3 py-1.5 border-t border-blue-200 flex-shrink-0">
                                <div className="flex justify-around text-center text-xs">
                                  <div>
                                    <div className="font-bold text-blue-600">
                                      {scoresMecaCumulatifs[scoresMecaCumulatifs.length - 1]?.scoreCumulatif || 0}
                                    </div>
                                    <div className="text-blue-700 text-[10px]">Score Actuel</div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-blue-600">
                                      {Math.max(...scoresMecaCumulatifs.map(s => s.scoreCumulatif))}
                                    </div>
                                    <div className="text-blue-700 text-[10px]">Max</div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-blue-600">
                                      {Math.min(...scoresMecaCumulatifs.map(s => s.scoreCumulatif))}
                                    </div>
                                    <div className="text-blue-700 text-[10px]">Min</div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {/* GRAPHIQUE MÉCANIQUE - MODE SESSIONS */}
                          {scoreType === 'mecanique' && viewMode === 'sessions' && scoresParSessionMeca.length > 0 && (
                            <>
                              <div className="p-3 flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={scoresParSessionMeca}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                                    <XAxis 
                                      dataKey="ordre" 
                                      stroke="#71717a"
                                      style={{ fontSize: '10px' }}
                                      label={{ value: 'Session', position: 'insideBottom', offset: -5, style: { fontSize: '10px' } }}
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
                                      formatter={(value: any) => [`${Math.round(value)}%`, 'Moyenne']}
                                      labelFormatter={(value: any, payload: any) => {
                                        const item = payload[0]?.payload;
                                        return item ? `Session #${item.session_numero} (${item.nbQuestions} questions)` : `Session ${value}`;
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="scoreMoyen"
                                      stroke="#3b82f6"
                                      strokeWidth={2}
                                      dot={{ fill: '#3b82f6', r: 4 }}
                                      name="Score Moyen"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>

                              <div className="bg-blue-50/20 px-3 py-1.5 border-t border-blue-200 flex-shrink-0">
                                <div className="flex justify-around text-center text-xs">
                                  <div>
                                    <div className="font-bold text-blue-600">
                                      {Math.round(
                                        scoresParSessionMeca.reduce((acc, s) => acc + s.scoreMoyen, 0) / scoresParSessionMeca.length
                                      )}%
                                    </div>
                                    <div className="text-blue-700 text-[10px]">Moyenne</div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-blue-600">
                                      {Math.max(...scoresParSessionMeca.map(s => s.scoreMoyen))}%
                                    </div>
                                    <div className="text-blue-700 text-[10px]">Max</div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-blue-600">
                                      {Math.min(...scoresParSessionMeca.map(s => s.scoreMoyen))}%
                                    </div>
                                    <div className="text-blue-700 text-[10px]">Min</div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {/* GRAPHIQUE CHAOTIQUE - MODE QUESTIONS */}
                          {scoreType === 'chaotique' && viewMode === 'questions' && scoresChaotiques.length > 0 && (
                            <>
                              <div className="p-3 flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={scoresChaotiques}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                                    <XAxis 
                                      dataKey="ordre" 
                                      stroke="#71717a"
                                      style={{ fontSize: '10px' }}
                                      label={{ value: 'Question', position: 'insideBottom', offset: -5, style: { fontSize: '10px' } }}
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
                                      formatter={(value: any) => [`${Math.round(value)}%`, 'Score']}
                                      labelFormatter={(value: any, payload: any) => {
                                        const item = payload[0]?.payload;
                                        return item ? `Q${value} - ${item.exercice} ${item.question}` : `Question ${value}`;
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="score"
                                      stroke="#a855f7"
                                      strokeWidth={2}
                                      dot={{ fill: '#a855f7', r: 4 }}
                                      name="Score Chaotique"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>

                              <div className="bg-purple-50/20 px-3 py-1.5 border-t border-purple-200 flex-shrink-0">
                                <div className="flex justify-around text-center text-xs">
                                  <div>
                                    <div className="font-bold text-purple-600">
                                      {Math.round(
                                        scoresChaotiques.reduce((acc, s) => acc + s.score, 0) / scoresChaotiques.length
                                      )}%
                                    </div>
                                    <div className="text-purple-700 text-[10px]">Moyenne</div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-purple-600">
                                      {Math.max(...scoresChaotiques.map(s => s.score))}%
                                    </div>
                                    <div className="text-purple-700 text-[10px]">Max</div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-purple-600">
                                      {Math.min(...scoresChaotiques.map(s => s.score))}%
                                    </div>
                                    <div className="text-purple-700 text-[10px]">Min</div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {/* GRAPHIQUE CHAOTIQUE - MODE SESSIONS */}
                          {scoreType === 'chaotique' && viewMode === 'sessions' && scoresParSessionChaos.length > 0 && (
                            <>
                              <div className="p-3 flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={scoresParSessionChaos}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                                    <XAxis 
                                      dataKey="ordre" 
                                      stroke="#71717a"
                                      style={{ fontSize: '10px' }}
                                      label={{ value: 'Session', position: 'insideBottom', offset: -5, style: { fontSize: '10px' } }}
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
                                      formatter={(value: any) => [`${Math.round(value)}%`, 'Moyenne']}
                                      labelFormatter={(value: any, payload: any) => {
                                        const item = payload[0]?.payload;
                                        return item ? `Session #${item.session_numero} (${item.nbQuestions} questions)` : `Session ${value}`;
                                      }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="scoreMoyen"
                                      stroke="#a855f7"
                                      strokeWidth={2}
                                      dot={{ fill: '#a855f7', r: 4 }}
                                      name="Score Moyen"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>

                              <div className="bg-purple-50/20 px-3 py-1.5 border-t border-purple-200 flex-shrink-0">
                                <div className="flex justify-around text-center text-xs">
                                  <div>
                                    <div className="font-bold text-purple-600">
                                      {Math.round(
                                        scoresParSessionChaos.reduce((acc, s) => acc + s.scoreMoyen, 0) / scoresParSessionChaos.length
                                      )}%
                                    </div>
                                    <div className="text-purple-700 text-[10px]">Moyenne</div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-purple-600">
                                      {Math.max(...scoresParSessionChaos.map(s => s.scoreMoyen))}%
                                    </div>
                                    <div className="text-purple-700 text-[10px]">Max</div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-purple-600">
                                      {Math.min(...scoresParSessionChaos.map(s => s.scoreMoyen))}%
                                    </div>
                                    <div className="text-purple-700 text-[10px]">Min</div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Messages si pas de données */}
                          {scoreType === 'mecanique' && scoresMecaCumulatifs.length === 0 && (
                            <div className="p-6 text-center text-gray-500 flex-1 flex flex-col items-center justify-center">
                              <div className="text-2xl mb-1">📈</div>
                              <p className="text-xs">Aucun score mécanique enregistré</p>
                              <p className="text-[10px] text-gray-400 mt-1">Les scores sont créés lors des sessions mécaniques</p>
                            </div>
                          )}

                          {scoreType === 'chaotique' && scoresChaotiques.length === 0 && (
                            <div className="p-6 text-center text-gray-500 flex-1 flex flex-col items-center justify-center">
                              <div className="text-2xl mb-1">📈</div>
                              <p className="text-xs">Aucun score chaotique enregistré</p>
                              <p className="text-[10px] text-gray-400 mt-1">Les scores sont créés lors des sessions chaotiques</p>
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