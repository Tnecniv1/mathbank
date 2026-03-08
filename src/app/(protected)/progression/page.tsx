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

type ScoreParPaquet = {
 ordre: number;
 label: string;      // ex : "1-30", "31-60"
 scoreMoyen: number;
 nbQuestions: number;
 dateDebut: string;
 dateFin: string;
};

const MAX_FEUILLES_PAR_LIGNE = 20;
const COLONNES_AFFICHEES = 20;

// Score brut par question : NULL = non évalué (exclu du calcul), 0 = évalué nul
const calcScore = (comp: number | null, sav: number | null, red: number | null, corr: number): number => {
 // Mécanique (VRAI/FAUX) : comp et red sont NULL, savoir = 0 ou 100
 // On retourne 130 pour VRAI et 0 pour FAUX : après /1.3 = 0 ou 100
 if (comp === null && red === null) {
   return sav !== null && sav > 0 ? 130 : 0;
 }
 // Chaotique : formule pondérée
 let sum = 0; let poids = 0;
 if (comp !== null) { sum += 50 * comp; poids += 50; }
 if (sav  !== null) { sum += 25 * sav;  poids += 25; }
 if (red  !== null) { sum += 25 * red;  poids += 25; }
 if (poids === 0) return 0;
 return (sum / poids) * (1 + 0.3 * corr);
};

export default function TableauProgression() {
 const [niveaux, setNiveaux] = useState<Niveau[]>([]);
 const [niveauSelectionne, setNiveauSelectionne] = useState<string | null>(null);
 const [data, setData] = useState<TableauData | null>(null);
 const [concentrationData, setConcentrationData] = useState<ConcentrationData[]>([]);
 const [concentrationDataAll, setConcentrationDataAll] = useState<ConcentrationData[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [fullscreenBlock, setFullscreenBlock] = useState<string | null>(null);
 const [scoreType, setScoreType] = useState<'mecanique' | 'chaotique' | 'global'>('mecanique');
 const [scoresParSessionMeca, setScoresParSessionMeca] = useState<ScoreParPaquet[]>([]);
 const [scoresParSessionChaos, setScoresParSessionChaos] = useState<ScoreParPaquet[]>([]);
 const [scoresGlobaux, setScoresGlobaux] = useState<{ date: string; scoreCumulatif: number }[]>([]);
 const [gridObjectifs, setGridObjectifs] = useState<GridData[]>([]);
 const [chartRenderKey, setChartRenderKey] = useState(0);

 useEffect(() => {
 loadNiveaux();
 }, []);

 // Recharts : forcer le recalcul des dimensions après l'ouverture du plein écran
 useEffect(() => {
   if (fullscreenBlock !== null) {
     const timer = setTimeout(() => setChartRenderKey(k => k + 1), 300);
     return () => clearTimeout(timer);
   }
 }, [fullscreenBlock]);

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
 // Récupérer toutes les feuilles du niveau
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
 const feuilleIdsStr = feuilleIds.join(',');

 // ── Archives : score_local + session_entrainement ──────────────────────
 const { data: scoresData } = await supabase
 .from('score_local')
 .select(`
 comprehension,
 savoir,
 redaction,
 correction,
 created_at,
 session_entrainement!inner(
 feuille_mecanique_id,
 feuille_chaotique_id,
 date_session,
 heure_session
 )
 `)
 .eq('session_entrainement.user_id', userId)
 .or(`feuille_mecanique_id.in.(${feuilleIdsStr}),feuille_chaotique_id.in.(${feuilleIdsStr})`, { foreignTable: 'session_entrainement' });

 // ── Nouvelles données : exercice + score_exercice + session ────────────
 const { data: newExercicesData } = await supabase
 .from('exercice')
 .select(`
 type,
 created_at,
 session!inner(
 user_id,
 date_session,
 feuille_mecanique_id,
 feuille_chaotique_id
 ),
 score_exercice(
 reussi,
 c1, c2, c3, c4,
 s1, s2, s3, s4,
 r1, r2, r3, r4,
 correction
 )
 `)
 .eq('session.user_id', userId)
 .or(`feuille_mecanique_id.in.(${feuilleIdsStr}),feuille_chaotique_id.in.(${feuilleIdsStr})`, { foreignTable: 'session' });

 // ── Construire la liste unifiée { score, date, isMecanique } ──────────
 const allMeca:  { score: number; date: string; ts: number }[] = [];
 const allChaos: { score: number; date: string; ts: number }[] = [];

 // Archives
 (scoresData || []).forEach((s: any) => {
 const isMecanique = s.session_entrainement.feuille_mecanique_id !== null;
 const rawScore    = calcScore(s.comprehension, s.savoir, s.redaction, s.correction);
 const scoreNorm   = rawScore / 1.3;
 const date        = s.session_entrainement.date_session;
 const ts          = new Date(`${date}T${s.session_entrainement.heure_session || '00:00:00'}`).getTime();
 if (isMecanique) allMeca.push({ score: scoreNorm, date, ts });
 else             allChaos.push({ score: scoreNorm, date, ts });
 });

 // Nouvelles données
 (newExercicesData || []).forEach((ex: any) => {
 const isMecanique = ex.type === 'mecanique';
 const score_ex    = ex.score_exercice?.[0];
 if (!score_ex) return;

 let scoreNorm: number;
 if (isMecanique) {
   scoreNorm = score_ex.reussi ? 100 : 0;
 } else {
   const comp   = ([score_ex.c1, score_ex.c2, score_ex.c3, score_ex.c4].filter(Boolean).length / 4) * 100;
   const savoir = ([score_ex.s1, score_ex.s2, score_ex.s3, score_ex.s4].filter(Boolean).length / 4) * 100;
   const red    = ([score_ex.r1, score_ex.r2, score_ex.r3, score_ex.r4].filter(Boolean).length / 4) * 100;
   const raw    = (50 * comp + 25 * savoir + 25 * red) / 100 * (1 + (score_ex.correction ? 0.3 : 0));
   scoreNorm    = raw / 1.3;
 }

 const date = ex.session.date_session;
 const ts   = new Date(ex.created_at).getTime();
 if (isMecanique) allMeca.push({ score: scoreNorm, date, ts });
 else             allChaos.push({ score: scoreNorm, date, ts });
 });

 // Trier chaque liste chronologiquement
 allMeca.sort((a, b)  => a.ts - b.ts);
 allChaos.sort((a, b) => a.ts - b.ts);

 if (allMeca.length === 0 && allChaos.length === 0) {
 setScoresParSessionMeca([]);
 setScoresParSessionChaos([]);
 setScoresGlobaux([]);
 return;
 }

 // Regrouper en paquets de 30 questions consécutives
 const TAILLE_PAQUET = 6;

 function groupEnPaquets(questions: { score: number; date: string }[]): ScoreParPaquet[] {
   const paquets: ScoreParPaquet[] = [];
   for (let i = 0; i < questions.length; i += TAILLE_PAQUET) {
     const chunk = questions.slice(i, i + TAILLE_PAQUET);
     const debut = i + 1;
     const fin   = i + chunk.length;
     const scoreMoyen = chunk.reduce((acc, q) => acc + q.score, 0) / chunk.length;
     paquets.push({
       ordre:      paquets.length + 1,
       label:      `${debut}-${fin}`,
       scoreMoyen,
       nbQuestions: chunk.length,
       dateDebut:  new Date(chunk[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
       dateFin:    new Date(chunk[chunk.length - 1].date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
     });
   }
   return paquets;
 }

 setScoresParSessionMeca(groupEnPaquets(allMeca));
 setScoresParSessionChaos(groupEnPaquets(allChaos));

 // Score global cumulatif pondéré (25% méca, 75% chaos)
 // Fusionner et trier par ts
 const allEntries = [
 ...allMeca.map(e  => ({ ...e, isMecanique: true  })),
 ...allChaos.map(e => ({ ...e, isMecanique: false })),
 ].sort((a, b) => a.ts - b.ts);

 const scoresGlobauxMap = new Map<string, number>();
 let cumulatifMeca  = 0;
 let cumulatifChaos = 0;

 allEntries.forEach(entry => {
 const ratio = entry.score / 100; // normalise [0,1]
 if (entry.isMecanique) cumulatifMeca  += ratio;
 else                   cumulatifChaos += ratio;
 scoresGlobauxMap.set(entry.date, 100 * (0.25 * cumulatifMeca + 0.75 * cumulatifChaos));
 });

 const scoresGlobauxArray = Array.from(scoresGlobauxMap.entries())
 .map(([date, score]) => ({ date, scoreCumulatif: score }))
 .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

 setScoresGlobaux(scoresGlobauxArray);
 } catch (err: any) {
 console.error('Erreur chargement scores:', err);
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

 const dateMin = date21JoursAvant.toISOString().split('T')[0];

 // Archives
 const { data: sessions } = await supabase
 .from('session_entrainement')
 .select('date_session, temps_mecanique, temps_chaotique')
 .eq('user_id', userId)
 .gte('date_session', dateMin)
 .order('date_session', { ascending: true });

 // Nouvelles données
 const { data: newSessions } = await supabase
 .from('session')
 .select('date_session, duree')
 .eq('user_id', userId)
 .gte('date_session', dateMin)
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
 const dureeTotal = (session.temps_mecanique || 0) + (session.temps_chaotique || 0);
 existing.duree += dureeTotal;
 existing.nbSessions += 1;
 }
 });

 newSessions?.forEach(s => {
 const existing = concentrationMap.get(s.date_session);
 if (existing) {
 existing.duree += s.duree || 0;
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

 // All-time : toutes les sessions sans limite de date, regroupées par jour
 const [{ data: allSessions }, { data: allNewSessions }] = await Promise.all([
   supabase
     .from('session_entrainement')
     .select('date_session, temps_mecanique, temps_chaotique')
     .eq('user_id', userId)
     .order('date_session', { ascending: true }),
   supabase
     .from('session')
     .select('date_session, duree')
     .eq('user_id', userId)
     .order('date_session', { ascending: true }),
 ]);

 if ((allSessions && allSessions.length > 0) || (allNewSessions && allNewSessions.length > 0)) {
   const allTimeMap = new Map<string, { duree: number; nbSessions: number }>();
   allSessions?.forEach(s => {
     const duree = (s.temps_mecanique || 0) + (s.temps_chaotique || 0);
     const entry = allTimeMap.get(s.date_session) ?? { duree: 0, nbSessions: 0 };
     entry.duree += duree;
     entry.nbSessions += 1;
     allTimeMap.set(s.date_session, entry);
   });
   allNewSessions?.forEach(s => {
     const entry = allTimeMap.get(s.date_session) ?? { duree: 0, nbSessions: 0 };
     entry.duree += s.duree || 0;
     entry.nbSessions += 1;
     allTimeMap.set(s.date_session, entry);
   });
   setConcentrationDataAll(
     Array.from(allTimeMap.entries())
       .sort(([a], [b]) => a.localeCompare(b))
       .map(([date, d]) => ({
         date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
         duree: d.duree,
         nbSessions: d.nbSessions,
       }))
   );
 }
 } catch (err: any) {
 console.error('Erreur chargement concentration:', err);
 setConcentrationData([]);
 setConcentrationDataAll([]);
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

 // Concentration : dataset selon le mode d'affichage
 const concentrationDisplay =
   fullscreenBlock === 'concentration' && concentrationDataAll.length > 0
     ? concentrationDataAll
     : concentrationData;

 // Scores paquets : N derniers en vue normale, tous en plein écran
 const PAQUETS_NORMAUX = 7;
 const scoresDisplayMeca  = fullscreenBlock === 'scores'
   ? scoresParSessionMeca
   : scoresParSessionMeca.slice(-PAQUETS_NORMAUX);
 const scoresDisplayChaos = fullscreenBlock === 'scores'
   ? scoresParSessionChaos
   : scoresParSessionChaos.slice(-PAQUETS_NORMAUX);

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

 <div className={`bg-cream-50 rounded-xl border border-border shadow-sm overflow-hidden ${fullscreenBlock === 'tableau' ? 'fixed inset-4 z-50 h-full flex flex-col' : ''}`}>
 <div className="bg-accent px-4 py-2.5 flex items-center justify-between flex-shrink-0">
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

 <div className={`overflow-x-auto overflow-y-auto ${fullscreenBlock === 'tableau' ? 'flex-1' : 'max-h-[35vh]'}`}>
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

 <div className="bg-cream-100/50 px-4 py-2 border-t border-border flex-shrink-0">
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
 <div className={`bg-cream-50 rounded-xl border border-border shadow-sm overflow-hidden aspect-square flex flex-col ${fullscreenBlock === 'scores' ? 'fixed inset-4 z-50 aspect-auto h-full' : ''}`}>
 <div className="px-3 py-2 flex items-center justify-between">
 <div>
 <h2 className="text-sm font-bold text-ink">Progresser en mathématique</h2>
 <p className="text-purple-100 text-xs">
 {scoreType === 'mecanique'
 ? `${scoresDisplayMeca.length}${fullscreenBlock !== 'scores' && scoresParSessionMeca.length > PAQUETS_NORMAUX ? `/${scoresParSessionMeca.length}` : ''} paquet${scoresDisplayMeca.length > 1 ? 's' : ''}`
 : `${scoresDisplayChaos.length}${fullscreenBlock !== 'scores' && scoresParSessionChaos.length > PAQUETS_NORMAUX ? `/${scoresParSessionChaos.length}` : ''} paquet${scoresDisplayChaos.length > 1 ? 's' : ''}`
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

 {/* GRAPHIQUE MÉCANIQUE - PAQUETS DE 30 */}
 {scoreType === 'mecanique' && scoresDisplayMeca.length > 0 && (
 <>
 <div className="p-3 flex-1 min-h-0">
 <ResponsiveContainer key={chartRenderKey} width="100%" height="100%">
 <LineChart data={scoresDisplayMeca}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
 <XAxis
 dataKey="label"
 stroke="#71717a"
 style={{ fontSize: '9px' }}
 label={{ value: 'Paquet', position: 'insideBottom', offset: -5, style: { fontSize: '10px' } }}
 interval="preserveStartEnd"
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
 formatter={(value: any) => [`${Math.round(value)}%`, '% de réussite']}
 labelFormatter={(value: any, payload: any) => {
 const item = payload[0]?.payload;
 return item ? `Q${item.label} · ${item.nbQuestions} questions (${item.dateDebut}–${item.dateFin})` : `Paquet ${value}`;
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
 {Math.round(scoresDisplayMeca.reduce((acc, s) => acc + s.scoreMoyen, 0) / scoresDisplayMeca.length)}%
 </div>
 <div className="text-accent text-[10px]">Moyenne</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {Math.round(Math.max(...scoresDisplayMeca.map(s => s.scoreMoyen)))}%
 </div>
 <div className="text-accent text-[10px]">Max</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {Math.round(Math.min(...scoresDisplayMeca.map(s => s.scoreMoyen)))}%
 </div>
 <div className="text-accent text-[10px]">Min</div>
 </div>
 </div>
 </div>
 </>
 )}

 {/* GRAPHIQUE CHAOTIQUE - PAQUETS DE 30 */}
 {scoreType === 'chaotique' && scoresDisplayChaos.length > 0 && (
 <>
 <div className="p-3 flex-1 min-h-0">
 <ResponsiveContainer key={chartRenderKey} width="100%" height="100%">
 <LineChart data={scoresDisplayChaos}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
 <XAxis
 dataKey="label"
 stroke="#71717a"
 style={{ fontSize: '9px' }}
 label={{ value: 'Paquet', position: 'insideBottom', offset: -5, style: { fontSize: '10px' } }}
 interval="preserveStartEnd"
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
 return item ? `Q${item.label} · ${item.nbQuestions} questions (${item.dateDebut}–${item.dateFin})` : `Paquet ${value}`;
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
 {Math.round(scoresDisplayChaos.reduce((acc, s) => acc + s.scoreMoyen, 0) / scoresDisplayChaos.length)}%
 </div>
 <div className="text-purple-700 text-[10px]">Moyenne</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {Math.round(Math.max(...scoresDisplayChaos.map(s => s.scoreMoyen)))}%
 </div>
 <div className="text-purple-700 text-[10px]">Max</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {Math.round(Math.min(...scoresDisplayChaos.map(s => s.scoreMoyen)))}%
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
 <ResponsiveContainer key={chartRenderKey} width="100%" height="100%">
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
 <div className={`bg-cream-50 rounded-xl border border-border shadow-sm overflow-hidden aspect-square flex flex-col ${fullscreenBlock === 'concentration' ? 'fixed inset-4 z-50 aspect-auto h-full' : ''}`}>
 <div className="px-3 py-2 flex items-center justify-between">
 <div>
 <h2 className="text-sm font-bold text-ink">Entraîner sa concentration</h2>
 <p className="text-blue-100 text-xs">
   {fullscreenBlock === 'concentration' ? 'Tout l\'historique' : '21 derniers jours'}
 </p>
 </div>
 <FullscreenButton blockId="concentration" />
 </div>

 {concentrationDisplay.some(d => d.duree > 0) ? (
 <>
 <div className="p-3 flex-1 min-h-0">
 <ResponsiveContainer key={chartRenderKey} width="100%" height="100%">
 <BarChart data={concentrationDisplay}>
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
 concentrationDisplay.reduce((acc, d) => acc + d.duree, 0) / 
 concentrationDisplay.filter(d => d.duree > 0).length || 0
 )} min
 </div>
 <div className="text-accent text-[10px]">Moy/jour</div>
 </div>
 <div>
 <div className="font-bold text-accent">
 {concentrationDisplay.reduce((acc, d) => acc + d.duree, 0)} min
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
 <div className={`bg-cream-50 rounded-xl border border-border shadow-sm overflow-hidden aspect-square flex flex-col ${fullscreenBlock === 'objectifs' ? 'fixed inset-4 z-50 aspect-auto h-full' : ''}`}>
   <div className="px-3 py-2 flex items-center justify-between">
     <div>
       <h2 className="text-sm font-bold text-ink">Parcours hebdomadaire</h2>
       <p className="text-ink-light text-xs">
         {gridObjectifs.filter(d => d.statut !== 'non_fixe').length > 0
           ? `${gridObjectifs.filter(d => d.statut === 'succes').length}/${gridObjectifs.filter(d => d.statut !== 'non_fixe').length} réussi(s)`
           : 'Aucun objectif'}
       </p>
     </div>
     <FullscreenButton blockId="objectifs" />
   </div>
   <GridObjectifs data={gridObjectifs} />
 </div>
 </div>
 </div>
 </div>
</div>
);
}