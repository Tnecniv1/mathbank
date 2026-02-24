'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import GridObjectifs, { GridData } from '@/components/GridObjectifs';

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

type ScoreParSession = {
 ordre: number;
 session_numero: number;
 scoreMoyen: number;
 nbQuestions: number;
 date: string;
};

const MAX_FEUILLES_PAR_LIGNE = 20;
const COLONNES_AFFICHEES = 20;

// Score brut par question : [0, 100] sans correction | [0, 130] avec correction
const calcScore = (comp: number, sav: number, red: number, corr: number): number =>
 ((50 * comp + 25 * sav + 25 * red) * (1 + 0.3 * corr)) / 100;

export default function TableauProgression() {
 const [niveaux, setNiveaux] = useState<Niveau[]>([]);
 const [niveauSelectionne, setNiveauSelectionne] = useState<string | null>(null);
 const [data, setData] = useState<TableauData | null>(null);
 const [concentrationData, setConcentrationData] = useState<ConcentrationData[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [fullscreenBlock, setFullscreenBlock] = useState<string | null>(null);
 const [scoreType, setScoreType] = useState<'mecanique' | 'chaotique' | 'global'>('mecanique');
 const [scoresParSessionMeca, setScoresParSessionMeca] = useState<ScoreParSession[]>([]);
 const [scoresParSessionChaos, setScoresParSessionChaos] = useState<ScoreParSession[]>([]);
 const [scoresGlobaux, setScoresGlobaux] = useState<{ date: string; scoreCumulatif: number }[]>([]);
 const [gridObjectifs, setGridObjectifs] = useState<GridData[]>([]);

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
 await loadGridObjectifs(userId);

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
 .select('feuille_id, statut, en_cours')
 .eq('user_id', userId)
 .in('feuille_id', feuilleIds);

 const progressionMap = new Map(
 progressions?.map(p => [p.feuille_id, { statut: p.statut, en_cours: p.en_cours }]) || []
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
 feuille_statut: progressionMap.get(feuille.id)?.statut || null,
 feuille_en_cours: progressionMap.get(feuille.id)?.en_cours || false
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
 comprehension,
 savoir,
 redaction,
 correction,
 created_at,
 session_id,
 session_entrainement!inner(
 user_id,
 feuille_mecanique_id,
 feuille_chaotique_id,
 numero_session,
 date_session,
 heure_session
 )
 `)
 .eq('session_entrainement.user_id', userId)
 .or(`feuille_mecanique_id.in.(${feuilleIds.join(',')}),feuille_chaotique_id.in.(${feuilleIds.join(',')})`, { foreignTable: 'session_entrainement' });

 if (error) {
 console.error('Erreur chargement scores locaux:', error);
 setScoresParSessionMeca([]);
 setScoresParSessionChaos([]);
 return;
 }

 if (!scoresData || scoresData.length === 0) {
 setScoresParSessionMeca([]);
 setScoresParSessionChaos([]);
 return;
 }

 // Trier par date et heure réelles de session (chronologique)
 scoresData.sort((a: any, b: any) => {
 const dateA = new Date(`${a.session_entrainement.date_session}T${a.session_entrainement.heure_session}`);
 const dateB = new Date(`${b.session_entrainement.date_session}T${b.session_entrainement.heure_session}`);
 return dateA.getTime() - dateB.getTime();
 });


 // Regrouper par session
 const sessionsMeca = new Map<string, ScoreLocal[]>();
 const sessionsChaos = new Map<string, ScoreLocal[]>();

 scoresData.forEach((score: any) => {
 const isMecanique = score.session_entrainement.feuille_mecanique_id !== null;
 const sessionId = score.session_id;
 const sessionNumero = score.session_entrainement.numero_session;

 const rawScore = calcScore(score.comprehension, score.savoir, score.redaction, score.correction);
 const scoreNorm = rawScore / 1.3; // normalise [0, 130] → [0, 100]

 const scoreLocal: ScoreLocal = {
 ordre: 0,
 score: scoreNorm,
 exercice: score.exercice,
 question: score.question,
 date: new Date(score.session_entrainement.date_session).toLocaleDateString('fr-FR'),
 session_id: sessionId,
 session_numero: sessionNumero
 };

 if (isMecanique) {
 if (!sessionsMeca.has(sessionId)) sessionsMeca.set(sessionId, []);
 sessionsMeca.get(sessionId)!.push(scoreLocal);
 } else {
 if (!sessionsChaos.has(sessionId)) sessionsChaos.set(sessionId, []);
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
 scoreMoyen: scoreMoyen,
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
 scoreMoyen: scoreMoyen,
 nbQuestions: scores.length,
 date: scores[0].date
 });
 });


 // Calculer le score global cumulatif pondéré (25% méca, 75% chaos)
 const scoresGlobauxMap = new Map<string, number>();
 let cumulatifMeca = 0;
 let cumulatifChaos = 0;

 scoresData.forEach((score: any) => {
 const isMecanique = score.session_entrainement.feuille_mecanique_id !== null;
 const dateSession = score.session_entrainement.date_session;
 const rawScore = calcScore(score.comprehension, score.savoir, score.redaction, score.correction);

 if (isMecanique) {
 cumulatifMeca += rawScore / 130; // ratio [0, 1] ajouté à chaque question mécanique
 } else {
 cumulatifChaos += rawScore / 130; // ratio [0, 1] ajouté à chaque question chaotique
 }

 scoresGlobauxMap.set(dateSession, 100 * (0.25 * cumulatifMeca + 0.75 * cumulatifChaos));
 });

 const scoresGlobauxArray = Array.from(scoresGlobauxMap.entries())
 .map(([date, score]) => ({
 date,
 scoreCumulatif: score
 }))
 .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

 setScoresGlobaux(scoresGlobauxArray);
 setScoresParSessionMeca(scoresSessionMeca);
 setScoresParSessionChaos(scoresSessionChaos);
 } catch (err: any) {
 console.error('Erreur chargement scores locaux:', err);
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

 async function loadGridObjectifs(userId: string) {
 try {
   // Trouver l'équipe du membre
   const { data: membreData } = await supabase
     .from('membre_equipe')
     .select('equipe_id')
     .eq('user_id', userId)
     .limit(1)
     .single();

   if (!membreData) {
     setGridObjectifs([]);
     return;
   }

   const { data: gridData } = await supabase.rpc('get_objectifs_grid_data', {
     p_equipe_id: membreData.equipe_id,
     p_membre_user_id: userId,
     p_nb_semaines: 24,
   });
   setGridObjectifs(gridData || []);
 } catch (err) {
   console.error('Erreur chargement grille objectifs:', err);
   setGridObjectifs([]);
 }
 }

 function processData(rawData: any[]) {
 console.log('🔍 DONNÉES BRUTES REÇUES:', rawData[0]);
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
 statut: row.feuille_statut || 'non_faite',
 en_cours: row.feuille_en_cours || false
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

 const getCellColor = (feuille: any) => {
 if (!feuille) return 'bg-cream-50 border border-border';
 if (feuille.statut === 'validee') return 'bg-status-success text-ink';
 if (feuille.en_cours === true) return 'bg-accent text-ink';
 return 'bg-cream-200 text-ink-light';
 };

 const getCellContent = (feuille: any, nbSessions: number) => {
 if (!feuille) return 'x';
 if (feuille.statut === 'validee') return '✓';
 if (feuille.en_cours === true && nbSessions > 0) return nbSessions.toString();
 if (feuille.en_cours === true) return '1';
 return '0';
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
 <div className="bg-cream-50 rounded-lg border border-border p-8 shadow-sm">
 <div className="text-center text-ink-muted">Chargement du tableau...</div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="bg-red-100/30 border border-red-300 rounded-lg p-6">
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
 className="p-1.5 hover:bg-cream-100/20 rounded-lg transition-colors"
 title="Plein écran"
 >
 <svg className="w-4 h-4 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
 </svg>
 </button>
 );

 return (
 <div className="min-h-screen bg-cream-50 p-6">
 <style jsx global>{`
 @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap');
 h1, h2, h3, h4, h5, h6, .font-mono { font-family: 'IBM Plex Mono', monospace; }
 body { font-family: 'Lora', serif; }
 p, span, div { font-family: 'Lora', serif; }
 `}</style>
 <div className="max-w-7xl mx-auto">
 <div className="space-y-6">
 {niveaux.length > 1 && (
 <div className="bg-cream-50 rounded-xl border border-border p-3 shadow-sm">
 <label className="block text-xs font-medium text-ink mb-1.5">
 Niveau
 </label>
 <select
 value={niveauSelectionne || ''}
 onChange={(e) => setNiveauSelectionne(e.target.value)}
 className="w-full max-w-xs px-3 py-1.5 text-sm rounded-lg border border-border bg-cream-50 text-ink focus:outline-none focus:ring-2 focus:ring-teal-500"
 >
 {niveaux.map((niveau) => (
 <option key={niveau.id} value={niveau.id}>
 {niveau.titre}
 </option>
 ))}
 </select>
 </div>
 )}

 <div className="bg-cream-50 rounded-xl border border-border shadow-sm overflow-hidden">
 <div className="bg-accent px-4 py-2.5 flex items-center justify-between">
 <div>
 <h2 className="text-base font-bold text-ink">Parcours d'apprentissage</h2>
 <p className="text-teal-100 text-xs">Ensemble des entrainement fait</p>
 </div>
 <div className="flex items-center gap-2">
 <div className="bg-cream-50/20 backdrop-blur-sm rounded-lg px-4 py-2">
 <div className="text-xs text-teal-100">TxSat Global</div>
 <div className="text-xl font-bold text-ink">{data.txSatGlobal}%</div>
 </div>
 <FullscreenButton blockId="tableau" />
 </div>
 </div>

 <div className="overflow-x-auto max-h-[35vh] overflow-y-auto">
 <table className="w-full text-xs">
 <thead>
 <tr className="border-b border-border">
 <th className="sticky left-0 bg-cream-200 px-3 py-2 text-center font-bold text-ink border-r-2 border-border min-w-[100px]">
 Sujet
 </th>
 <th className="sticky left-0 bg-cream-50 px-3 py-2 text-left font-semibold text-ink border-r border-border min-w-[150px]">
 Chapitre
 </th>
 <th className="px-3 py-2 text-center font-semibold text-ink border-r border-border min-w-[60px]">
 TxSat
 </th>
 {Array.from({ length: COLONNES_AFFICHEES }, (_, i) => (
 <th
 key={i}
 className="px-1.5 py-2 text-center font-medium text-ink-light border-r border-border min-w-[40px]"
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
 className={`hover:bg-cream-100/50 transition-colors ${
 chapIndex === chapitres.length - 1
 ? 'border-b-2 border-border'
 : 'border-b border-border'
 }`}
 >
 {chapIndex === 0 && (
 <td
 rowSpan={chapitres.length}
 className="sticky left-0 bg-cream-200 px-3 py-2 border-r-2 border-border text-center align-middle"
 >
 <span className="font-bold text-accent text-sm">
 {sujetTitre}
 </span>
 </td>
 )}

 <td className="sticky left-0 bg-cream-50 px-3 py-2 border-r border-border">
 <span className="text-ink text-xs">
 {chapitre.titre}
 {chapitre.partNumber && (
 <span className="text-ink-muted ml-1">
 ({chapitre.partNumber})
 </span>
 )}
 </span>
 </td>

 <td className="px-3 py-2 text-center border-r border-border">
 <span className="font-semibold text-ink text-xs">
 {calculateTxSat(chapitre.feuilles)}%
 </span>
 </td>

 {Array.from({ length: COLONNES_AFFICHEES }, (_, i) => {
 const feuille = chapitre.feuilles.find((f, idx) => idx === i);
 const statut = feuille ? feuille.statut : null;


 
 return (
 <td
 key={i}
 className="px-1.5 py-2 text-center border-r border-border"
 >
 <div
 className={`inline-flex items-center justify-center w-6 h-6 rounded font-semibold text-xs ${getCellColor(feuille || null)}`}
 >
 {getCellContent(feuille || null, feuille?.nbSessions || 0)}
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

 <div className="bg-cream-100/50 px-4 py-2 border-t border-border">
 <div className="flex items-center gap-4 text-xs">
 <span className="text-ink-light font-semibold">Légende :</span>
 <div className="flex items-center gap-1.5">
 <div className="w-5 h-5 rounded bg-status-success flex items-center justify-center text-ink font-semibold text-xs">✓</div>
 <span className="text-ink-light">Validée</span>
 </div>
 <div className="flex items-center gap-1.5">
 <div className="w-5 h-5 rounded bg-accent flex items-center justify-center text-ink font-semibold text-xs">1</div>
 <span className="text-ink-light">En progression</span>
 </div>
 <div className="flex items-center gap-1.5">
 <div className="w-5 h-5 rounded bg-cream-200 flex items-center justify-center text-ink-light font-semibold text-xs">0</div>
 <span className="text-ink-light">Non faite</span>
 </div>
 <div className="flex items-center gap-1.5">
 <div className="w-5 h-5 rounded bg-cream-50 border border-border flex items-center justify-center text-ink-muted font-semibold text-xs">x</div>
 <span className="text-ink-light">N'existe pas</span>
 </div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {/* Graphique des scores avec toggle */}
 <div className={`bg-cream-50 rounded-xl border border-border shadow-sm overflow-hidden aspect-square flex flex-col ${fullscreenBlock === 'scores' ? 'fixed inset-4 z-50 aspect-auto' : ''}`}>
 <div className="px-3 py-2 flex items-center justify-between">
 <div>
 <h2 className="text-sm font-bold text-ink">Progresser en mathématique</h2>
 <p className="text-purple-100 text-xs">
 {scoreType === 'mecanique'
 ? `${scoresParSessionMeca.length} session${scoresParSessionMeca.length > 1 ? 's' : ''}`
 : `${scoresParSessionChaos.length} session${scoresParSessionChaos.length > 1 ? 's' : ''}`
 }
 </p>
 </div>
 <div className="flex items-center gap-2">
 {/* Toggle Mécanique/Chaotique */}
 <div className="flex bg-cream-50/20 rounded-lg p-0.5">
 <button
 onClick={() => setScoreType('mecanique')}
 className={`px-2 py-1 text-xs font-medium rounded transition ${
 scoreType === 'mecanique'
 ? 'bg-cream-50 text-accent'
 : 'text-ink hover:bg-cream-100/10'
 }`}
 >
 M
 </button>
 <button
 onClick={() => setScoreType('chaotique')}
 className={`px-2 py-1 text-xs font-medium rounded transition ${
 scoreType === 'chaotique'
 ? 'bg-cream-50 text-purple-700'
 : 'text-ink hover:bg-cream-100/10'
 }`}
 >
 C
 </button>
 <button
 onClick={() => setScoreType('global')}
 className={`px-2 py-1 text-xs font-medium rounded transition ${
 scoreType === 'global'
 ? 'bg-cream-50 text-ink'
 : 'text-ink hover:bg-cream-100/10'
 }`}
 >
 G
 </button>
 </div>

 <FullscreenButton blockId="scores" />
 </div>
 </div>

 {/* GRAPHIQUE MÉCANIQUE - MODE SESSIONS */}
 {scoreType === 'mecanique' && scoresParSessionMeca.length > 0 && (
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
 stroke="#71717a"
 style={{ fontSize: '10px' }}
 domain={[0, 100]}
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

 <div className="bg-accent-light/20 px-3 py-1.5 border-t border-border">
 <div className="flex justify-around text-center text-xs">
 <div>
 <div className="font-bold text-accent">
 {Math.round(scoresParSessionMeca.reduce((acc, s) => acc + s.scoreMoyen, 0) / scoresParSessionMeca.length)}%
 </div>
 <div className="text-accent text-[10px]">Moyenne</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {Math.round(Math.max(...scoresParSessionMeca.map(s => s.scoreMoyen)))}%
 </div>
 <div className="text-accent text-[10px]">Max</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {Math.round(Math.min(...scoresParSessionMeca.map(s => s.scoreMoyen)))}%
 </div>
 <div className="text-accent text-[10px]">Min</div>
 </div>
 </div>
 </div>
 </>
 )}

 {/* GRAPHIQUE CHAOTIQUE - MODE SESSIONS */}
 {scoreType === 'chaotique' && scoresParSessionChaos.length > 0 && (
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
 stroke="var(--accent)"
 strokeWidth={2}
 dot={{ fill: 'var(--accent)', r: 4 }}
 name="Score Moyen"
 />
 </LineChart>
 </ResponsiveContainer>
 </div>

 <div className="bg-purple-50/20 px-3 py-1.5 border-t border-purple-200">
 <div className="flex justify-around text-center text-xs">
 <div>
 <div className="font-bold text-accent">
 {Math.round(scoresParSessionChaos.reduce((acc, s) => acc + s.scoreMoyen, 0) / scoresParSessionChaos.length)}%
 </div>
 <div className="text-purple-700 text-[10px]">Moyenne</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {Math.round(Math.max(...scoresParSessionChaos.map(s => s.scoreMoyen)))}%
 </div>
 <div className="text-purple-700 text-[10px]">Max</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {Math.round(Math.min(...scoresParSessionChaos.map(s => s.scoreMoyen)))}%
 </div>
 <div className="text-purple-700 text-[10px]">Min</div>
 </div>
 </div>
 </div>
 </>
 )}

 {/* GRAPHIQUE GLOBAL - CUMULATIF */}
 {scoreType === 'global' && scoresGlobaux.length > 0 && (
 <>
 <div className="p-3 flex-1 min-h-0">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={scoresGlobaux}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
 <XAxis
 dataKey="date"
 stroke="#71717a"
 style={{ fontSize: '10px' }}
 label={{ value: 'Date', position: 'insideBottom', offset: -5, style: { fontSize: '10px' } }}
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
 formatter={(value: any) => [value.toFixed(0), 'Score Global']}
 />
 <Line
 type="monotone"
 dataKey="scoreCumulatif"
 stroke="#10b981"
 strokeWidth={2}
 dot={{ fill: '#10b981', r: 3 }}
 activeDot={{ r: 5 }}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>

 <div className="bg-green-50/20 px-3 py-1.5 border-t border-green-200">
 <div className="flex justify-around text-center text-xs">
 <div>
 <div className="font-bold text-status-success">
 {scoresGlobaux[scoresGlobaux.length - 1].scoreCumulatif.toFixed(0)}
 </div>
 <div className="text-status-success text-[10px]">Score Actuel</div>
 </div>
 <div>
 <div className="font-bold text-status-success">
 {Math.max(...scoresGlobaux.map(s => s.scoreCumulatif)).toFixed(0)}
 </div>
 <div className="text-status-success text-[10px]">Max</div>
 </div>
 <div>
 <div className="font-bold text-status-success">
 {scoresGlobaux.length}
 </div>
 <div className="text-status-success text-[10px]">Jours</div>
 </div>
 </div>
 </div>
 </>
 )}


 {/* Messages si pas de données */}
 {scoreType === 'mecanique' && scoresParSessionMeca.length === 0 && (
 <div className="p-6 text-center text-ink-muted flex-1 min-h-0 flex flex-col items-center justify-center">
 <div className="text-2xl mb-1">📈</div>
 <p className="text-xs">Aucun score mécanique enregistré</p>
 <p className="text-[10px] text-gray-400 mt-1">Les scores sont créés lors des sessions mécaniques</p>
 </div>
 )}

 {scoreType === 'chaotique' && scoresParSessionChaos.length === 0 && (
 <div className="p-6 text-center text-ink-muted flex-1 min-h-0 flex flex-col items-center justify-center">
 <div className="text-2xl mb-1">📈</div>
 <p className="text-xs">Aucun score chaotique enregistré</p>
 <p className="text-[10px] text-gray-400 mt-1">Les scores sont créés lors des sessions chaotiques</p>
 </div>
 )}
 </div>

 {/* Graphique de concentration */}
 <div className={`bg-cream-50 rounded-xl border border-border shadow-sm overflow-hidden aspect-square flex flex-col ${fullscreenBlock === 'concentration' ? 'fixed inset-4 z-50 aspect-auto' : ''}`}>
 <div className="px-3 py-2 flex items-center justify-between">
 <div>
 <h2 className="text-sm font-bold text-ink">Entraîner sa concentration</h2>
 <p className="text-blue-100 text-xs">21 derniers jours</p>
 </div>
 <FullscreenButton blockId="concentration" />
 </div>

 {concentrationData.some(d => d.duree > 0) ? (
 <>
 <div className="p-3 flex-1 min-h-0">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={concentrationData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
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
 domain={[0, 1.3]}
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

 <div className="bg-accent-light/20 px-3 py-1.5 border-t border-border">
 <div className="flex justify-around text-center text-xs">
 <div>
 <div className="font-bold text-accent">
 {Math.round(
 concentrationData.reduce((acc, d) => acc + d.duree, 0) / 
 concentrationData.filter(d => d.duree > 0).length || 0
 )} min
 </div>
 <div className="text-accent text-[10px]">Moy/jour</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {concentrationData.reduce((acc, d) => acc + d.duree, 0)} min
 </div>
 <div className="text-accent text-[10px]">Total</div>
 </div>
 </div>
 </div>
 </>
 ) : (
 <div className="p-6 text-center text-ink-muted flex-1 min-h-0 flex flex-col items-center justify-center">
 <div className="text-2xl mb-1">⏱️</div>
 <p className="text-xs">Aucune donnée</p>
 </div>
 )}
 </div>

 {/* Grille objectifs hebdomadaires */}
 <GridObjectifs data={gridObjectifs} />
 </div>
 </div>
 </div>
</div>
);
}