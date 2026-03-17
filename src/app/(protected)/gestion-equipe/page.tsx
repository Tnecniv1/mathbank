'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

import ModalObserverFeuilles from '@/components/ModalObserverFeuilles';
import ModalGererFeuillesScope from '@/components/ModalGererFeuillesScope';
import ParcoursTimeline from '@/components/ParcoursTimeline';

/* ---------- Types ---------- */
type Membre = {
 membre_id: string;
 user_id: string;
 membre_nom: string;
 equipe_id: string;
 nb_feuilles_autorisees: number;
 nb_feuilles_validees: number;
 nb_soumissions_attente: number;
 score_moyen: number | null;
 joined_at: string;
};

type Equipe = {
 id: string;
 nom: string;
 couleur: string;
 chef_id: string;
};

type Notification = {
 id: string;
 type: string;
 titre: string;
 message: string;
 lu: boolean;
 created_at: string;
 metadata: any;
};

type ScoreLocalDetail = {
 id: string;
 exercice: string;
 question: string;
 comprehension: number;
 savoir: number;
 redaction: number;
 correction: number;
 score_calcule: number;
};

type EtapeParcours = {
 id: string;
 numero: number;
 titre_snapshot: string;
 statut: string;
 autorisee_at: string | null;
 validee_at: string | null;
 feuille_id: string;
 chapitre_snapshot?: string | null;
 clot_noeud?: boolean;
};

type FeuilleSimple = {
 id: string;
 titre: string;
 type: string;
};

type SyntheseData = {
 scoresLocaux: ScoreLocalDetail[];
 scoreGlobal: number;
 scoreMax: number;
 feuilleId: string;
 feuilleTitre: string;
 membreNom: string;
 userId: string;
 niveauNom?: string;
 sujetNom?: string;
 chapitreNom?: string;
};

/* ---------- Icônes ---------- */
const IconUser = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2"/>
 <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
 </svg>
);

const IconSettings = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
 <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2" stroke="currentColor" strokeWidth="2"/>
 </svg>
);

const IconChart = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2"/>
 <path d="M7 16l4-8 4 4 4-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
 </svg>
);

const IconBell = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2"/>
 </svg>
);

const IconCheck = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
 <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
 </svg>
);

const IconX = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
 <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
 </svg>
);

const IconEye = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
 <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
 </svg>
);

const Loader = () => (
 <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
 <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
 <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"/>
 </svg>
);

/* ---------- Page principale ---------- */
export default function GestionEquipePage() {
 const router = useRouter();
 const [loading, setLoading] = useState(true);
 const [userId, setUserId] = useState<string | null>(null);
 const [equipeId, setEquipeId] = useState<string | null>(null);
 const [equipe, setEquipe] = useState<Equipe | null>(null);
 const [membres, setMembres] = useState<Membre[]>([]);
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const [notifsNonLues, setNotifsNonLues] = useState(0);

 const [showModalGestion, setShowModalGestion] = useState(false);
 const [membreSelectionne, setMembreSelectionne] = useState<Membre | null>(null);
 const [showObserverModal, setShowObserverModal] = useState(false);
 const [scoreGlobalEquipe, setScoreGlobalEquipe] = useState<number>(0);
 const [contributionsMembres, setContributionsMembres] = useState<{user_id: string, nom: string, score: number}[]>([]);
 const [isChef, setIsChef] = useState(false);

 const [membreParcoursModal, setMembreParcoursModal] = useState<Membre | null>(null);
 const [etapesParcours, setEtapesParcours] = useState<EtapeParcours[]>([]);
 const [loadingParcours, setLoadingParcours] = useState(false);
 const [feuillesDisponibles, setFeuillesDisponibles] = useState<FeuilleSimple[]>([]);
 const [etapeEnRemplacement, setEtapeEnRemplacement] = useState<string | null>(null);

 const [showRejetModal, setShowRejetModal] = useState(false);
 const [notificationSelectionnee, setNotificationSelectionnee] = useState<Notification | null>(null);
 const [commentaireRejet, setCommentaireRejet] = useState('');

 const [showSyntheseModal, setShowSyntheseModal] = useState(false);
 const [syntheseData, setSyntheseData] = useState<SyntheseData | null>(null);
 const [loadingSynthese, setLoadingSynthese] = useState(false);
 const [scoreComprehension, setScoreComprehension] = useState<number>(0);
 const [scoreSavoir, setScoreSavoir] = useState<number>(0);
 const [scoreRedaction, setScoreRedaction] = useState<number>(0);
 const [nbSessions, setNbSessions] = useState<number>(0);
 const [tempsTotal, setTempsTotal] = useState<number>(0);

 const [showClotureNoeudModal, setShowClotureNoeudModal] = useState(false);
 const [etapeACloturer, setEtapeACloturer] = useState<string | null>(null);

 useEffect(() => {
 // Récupérer l'ID de l'équipe depuis l'URL
 const params = new URLSearchParams(window.location.search);
 const id = params.get('id');
 setEquipeId(id);
 
 if (id) {
 loadData(id);
 }
 }, []);

 async function loadData(equipeIdParam: string) {
 try {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !session.user) {
 router.push('/connexion');
 return;
 }

 setUserId(session.user.id);

 // Charger l'équipe — d'abord essayer en tant que chef
 const { data: equipeChefData } = await supabase
 .from('equipe')
 .select('*')
 .eq('id', equipeIdParam)
 .eq('chef_id', session.user.id);

 let equipeData: Equipe | null = null;

 if (equipeChefData && equipeChefData.length > 0) {
 equipeData = equipeChefData[0];
 setIsChef(true);
 } else {
 // Vérifier si l'utilisateur est membre de cette équipe
 const { data: membreCheck } = await supabase
 .from('membre_equipe')
 .select('equipe_id')
 .eq('equipe_id', equipeIdParam)
 .eq('user_id', session.user.id)
 .single();

 if (!membreCheck) {
 alert('Équipe introuvable ou vous n\'y avez pas accès');
 router.push('/classement');
 return;
 }

 // Charger l'équipe sans filtre chef_id
 const { data: equipePublicData } = await supabase
 .from('equipe')
 .select('*')
 .eq('id', equipeIdParam)
 .single();

 if (!equipePublicData) {
 alert('Erreur lors du chargement de l\'équipe');
 router.push('/classement');
 return;
 }

 equipeData = equipePublicData;
 setIsChef(false);
 }

 if (!equipeData) {
 router.push('/classement');
 return;
 }

 setEquipe(equipeData);

 // Charger les membres de l'équipe
 const { data: membresIds } = await supabase
 .from('membre_equipe')
 .select('user_id')
 .eq('equipe_id', equipeData.id);

 if (membresIds && membresIds.length > 0) {
 const userIds = membresIds.map(m => m.user_id);
 
 const { data: profilesData } = await supabase
 .from('profiles')
 .select('user_id, full_name')
 .in('user_id', userIds);
 
 const membresAvecStats = await Promise.all(
 (profilesData || []).map(async (profile) => {
 const { count: nbValidees } = await supabase
 .from('progression_feuille')
 .select('*', { count: 'exact', head: true })
 .eq('user_id', profile.user_id)
 .eq('statut', 'validee');
 
 const { count: nbAttente } = await supabase
 .from('progression_feuille')
 .select('*', { count: 'exact', head: true })
 .eq('user_id', profile.user_id)
 .eq('statut', 'en_attente');
 
 const { data: membreEquipeData } = await supabase
 .from('membre_equipe')
 .select('id')
 .eq('user_id', profile.user_id)
 .eq('equipe_id', equipeData.id)
 .single();
 
 const { count: nbAutorisees } = await supabase
 .from('feuilles_autorisees')
 .select('*', { count: 'exact', head: true })
 .eq('membre_id', membreEquipeData?.id || '');
 
 return {
 membre_id: membreEquipeData?.id || profile.user_id,
 user_id: profile.user_id,
 membre_nom: profile.full_name,
 nb_feuilles_validees: nbValidees || 0,
 nb_feuilles_autorisees: nbAutorisees || 0,
 score_moyen: null,
 nb_soumissions_attente: nbAttente || 0
 };
 })
 );
 
 setMembres(membresAvecStats);

 // Calculer le score global — deux sources : score_local (archives) + score_exercice (nouvelles sessions)
 const [{ data: scoresAnciens }, { data: scoresNouveaux }] = await Promise.all([
 supabase
 .from('score_local')
 .select('score_calcule, session_entrainement!inner(user_id)'),
 supabase
 .from('score_exercice')
 .select('reussi, c1, c2, c3, c4, s1, s2, s3, s4, r1, r2, r3, r4, correction, exercice!inner(type, session!inner(user_id))'),
 ]);

 const scoreParMembre = new Map<string, number>();
 let scoreTotal = 0;

 // Archives (score_calcule pré-calculé, valeurs 0–1.3, × 100 = points)
 scoresAnciens?.forEach((score: any) => {
 const uid = score.session_entrainement?.user_id;
 if (uid && userIds.includes(uid)) {
 const pts = (parseFloat(score.score_calcule) || 0) * 100;
 scoreTotal += pts;
 scoreParMembre.set(uid, (scoreParMembre.get(uid) || 0) + pts);
 }
 });

 // Nouvelles sessions — score calculé depuis les booléens de score_exercice
 // Mécanique : reussi → 100 pts | Chaotique : chaque critère vrai → 10 pts (max 130)
 scoresNouveaux?.forEach((score: any) => {
 const uid = score.exercice?.session?.user_id;
 if (uid && userIds.includes(uid)) {
 let pts = 0;
 if (score.exercice?.type === 'mecanique') {
 pts = score.reussi ? 100 : 0;
 } else {
 const bools: boolean[] = [
 score.c1, score.c2, score.c3, score.c4,
 score.s1, score.s2, score.s3, score.s4,
 score.r1, score.r2, score.r3, score.r4,
 score.correction,
 ];
 pts = bools.filter(Boolean).length * 10;
 }
 scoreTotal += pts;
 scoreParMembre.set(uid, (scoreParMembre.get(uid) || 0) + pts);
 }
 });

 setScoreGlobalEquipe(Math.round(scoreTotal));

 const contributions = Array.from(scoreParMembre.entries()).map(([uid, score]) => {
 const profile = profilesData?.find((p: any) => p.user_id === uid);
 return {
 user_id: uid,
 nom: profile?.full_name || 'Inconnu',
 score: Math.round(score),
 };
 }).sort((a, b) => b.score - a.score);

 setContributionsMembres(contributions);
 } else {
 setMembres([]);
 }

 // Charger les notifications LIÉES À CETTE ÉQUIPE uniquement
 const { data: notifsData } = await supabase
 .from('notification')
 .select('*')
 .eq('user_id', session.user.id)
 .eq('lu', false)
 .contains('metadata', { equipe_id: equipeData.id })
 .order('created_at', { ascending: false })
 .limit(10);

 if (notifsData) {
 setNotifications(notifsData);
 setNotifsNonLues(notifsData.filter(n => !n.lu).length);
 }

 setLoading(false);
 } catch (error) {
 console.error(error);
 alert('Erreur lors du chargement');
 setLoading(false);
 }
 }

 function handleGererFeuilles(membre: Membre) {
 setMembreSelectionne(membre);
 setShowModalGestion(true);
 }

 async function handleVoirParcours(membre: Membre) {
 setMembreParcoursModal(membre);
 setEtapeEnRemplacement(null);
 setLoadingParcours(true);
 const { data } = await supabase
  .from('etape_parcours')
  .select('id, numero, titre_snapshot, statut, autorisee_at, validee_at, feuille_id, chapitre_snapshot, clot_noeud, type')
  .eq('user_id', membre.user_id)
  .order('numero', { ascending: true });
 setEtapesParcours(data || []);
 // Charger toutes les feuilles pour le sélecteur
 const { data: feuilles } = await supabase
  .from('feuille_entrainement')
  .select('id, titre, type')
  .order('ordre');
 setFeuillesDisponibles(feuilles || []);
 setLoadingParcours(false);
 }

 async function handleRemplacerFeuille(etapeId: string, feuilleId: string, titreFeuille: string) {
 const { error } = await supabase
  .from('etape_parcours')
  .update({ feuille_id: feuilleId, titre_snapshot: titreFeuille })
  .eq('id', etapeId);
 if (error) { alert('Erreur lors de la mise à jour'); return; }
 setEtapesParcours(prev => prev.map(e =>
  e.id === etapeId ? { ...e, feuille_id: feuilleId, titre_snapshot: titreFeuille } : e
 ));
 setEtapeEnRemplacement(null);
 }

 async function handleOuvrirSynthese(notif: Notification) {
 setLoadingSynthese(true);
 setShowSyntheseModal(true);

 try {
 const userId = notif.metadata.user_id;
 const feuilleId = notif.metadata.feuille_id;

 // Récupérer le titre de la feuille et le nom du membre
 const { data: feuilleData } = await supabase
 .from('feuille_entrainement')
 .select('titre')
 .eq('id', feuilleId)
 .single();

 const { data: userData } = await supabase
 .from('profiles')
 .select('full_name')
 .eq('id', userId)
 .single();

 // Récupérer les sessions de cette feuille pour cet utilisateur
 const { data: sessionsData } = await supabase
 .from('session_entrainement')
 .select('id')
 .eq('user_id', userId)
 .or(`feuille_mecanique_id.eq.${feuilleId},feuille_chaotique_id.eq.${feuilleId}`);

 if (!sessionsData || sessionsData.length === 0) {
 setSyntheseData({
 scoresLocaux: [],
 scoreGlobal: 0,
 scoreMax: 0,
 feuilleId,
 feuilleTitre: feuilleData?.titre || 'Feuille inconnue',
 membreNom: userData?.full_name || 'Membre inconnu',
 userId,
 });
 setLoadingSynthese(false);
 return;
 }

 const sessionIds = sessionsData.map((s: any) => s.id);

 // Charger les scores locaux
 const { data: scoresData } = await supabase
 .from('score_local')
 .select('*')
 .in('session_id', sessionIds)
 .order('created_at', { ascending: true });

 if (!scoresData || scoresData.length === 0) {
 setSyntheseData({
 scoresLocaux: [],
 scoreGlobal: 0,
 scoreMax: 0,
 feuilleId,
 feuilleTitre: feuilleData?.titre || 'Feuille inconnue',
 membreNom: userData?.full_name || 'Membre inconnu',
 userId,
 });
 setLoadingSynthese(false);
 return;
 }

 const scores: ScoreLocalDetail[] = scoresData.map((s: any) => ({
 id: s.id,
 exercice: s.exercice || 'Question',
 question: s.question,
 comprehension: s.comprehension,
 savoir: s.savoir,
 redaction: s.redaction,
 correction: s.correction,
 score_calcule: parseFloat(s.score_calcule) || 0,
 }));

 // Calculer le score global (score moyen entre 0 et 1.3)
 const total = scores.reduce((acc, s) => acc + s.score_calcule, 0);
 const scoreMoyen = scores.length > 0 ? total / scores.length : 0;
 const scoreGlobalCalc = scoreMoyen * 100; // Multiplier par 100 pour la compatibilité

 // Calculer les scores moyens par composante
 const scoreComprehensionCalc = scores.length > 0
 ? scores.reduce((acc, s) => acc + s.comprehension, 0) / (scores.length * 100)
 : 0;

 const scoreSavoirCalc = scores.length > 0
 ? scores.reduce((acc, s) => acc + s.savoir, 0) / (scores.length * 100)
 : 0;

 const scoreRedactionCalc = scores.length > 0
 ? scores.reduce((acc, s) => acc + s.redaction, 0) / (scores.length * 100)
 : 0;

 setScoreComprehension(scoreComprehensionCalc);
 setScoreSavoir(scoreSavoirCalc);
 setScoreRedaction(scoreRedactionCalc);

 // Charger les infos des sessions pour le volume
 const { data: sessionsDetails } = await supabase
 .from('session_entrainement')
 .select('temps_mecanique, temps_chaotique')
 .eq('user_id', userId)
 .or(`feuille_mecanique_id.eq.${feuilleId},feuille_chaotique_id.eq.${feuilleId}`);

 const nbSessionsCalc = sessionsDetails?.length || 0;
 const tempsTotalCalc = sessionsDetails?.reduce((acc: number, s: any) => 
 acc + (s.temps_mecanique || s.temps_chaotique || 0), 0) || 0;

 setNbSessions(nbSessionsCalc);
 setTempsTotal(tempsTotalCalc);

 // Charger les infos de la feuille (niveau, sujet, chapitre)
 const { data: feuilleComplete } = await supabase
 .from('feuille_entrainement')
 .select(`
 titre,
 chapitre:chapitre!inner(
 nom,
 sujet:sujet!inner(
 nom,
 niveau:niveau(nom)
 )
 )
 `)
 .eq('id', feuilleId)
 .single();

 setSyntheseData({
 scoresLocaux: scores,
 scoreGlobal: scoreGlobalCalc,
 scoreMax: scores.length * 1.3,
 feuilleId,
 feuilleTitre: feuilleComplete?.titre || feuilleData?.titre || 'Feuille inconnue',
 membreNom: userData?.full_name || 'Membre inconnu',
 userId,
 niveauNom: feuilleComplete?.chapitre?.sujet?.niveau?.nom || 'Niveau',
 sujetNom: feuilleComplete?.chapitre?.sujet?.nom || 'Sujet',
 chapitreNom: feuilleComplete?.chapitre?.nom || 'Chapitre',
 });

 setLoadingSynthese(false);
 } catch (error) {
 console.error('Erreur chargement synthèse:', error);
 alert('Erreur lors du chargement de la synthèse');
 setShowSyntheseModal(false);
 setLoadingSynthese(false);
 }
 }

 async function handleValiderSoumission(notif: Notification) {
 if (!confirm('Valider cette soumission ?')) return;

 try {
 // Si on valide depuis le modal de synthèse, utiliser le score calculé
 const scoreAUtiliser = syntheseData ? syntheseData.scoreGlobal : notif.metadata.score;

 const { error } = await supabase.rpc('valider_soumission_feuille', {
 p_notification_id: notif.id,
 p_user_id: notif.metadata.user_id,
 p_feuille_id: notif.metadata.feuille_id,
 p_score: scoreAUtiliser,
 });

 if (error) throw error;

 setShowSyntheseModal(false);
 setSyntheseData(null);

 // Chercher l'étape correspondante pour proposer la clôture du nœud
 const etapeData = await supabase
 .from('etape_parcours')
 .select('id')
 .eq('user_id', notif.metadata.user_id)
 .eq('feuille_id', notif.metadata.feuille_id)
 .order('autorisee_at', { ascending: false })
 .limit(1)
 .then(res => res.data?.[0] ?? null);

 if (etapeData) {
 setEtapeACloturer(etapeData.id);
 setShowClotureNoeudModal(true);
 } else {
 if (equipeId) loadData(equipeId);
 }
 } catch (error) {
 console.error(error);
 alert('Erreur lors de la validation');
 }
 }

 async function handleCloturerNoeud(clot: boolean) {
 if (clot && etapeACloturer) {
 await supabase
 .from('etape_parcours')
 .update({ clot_noeud: true })
 .eq('id', etapeACloturer);
 }
 setShowClotureNoeudModal(false);
 setEtapeACloturer(null);
 if (equipeId) loadData(equipeId);
 }

 function handleOuvrirRejet(notif: Notification) {
 setNotificationSelectionnee(notif);
 setShowRejetModal(true);
 }

 async function handleRejeterSoumission() {
 if (!notificationSelectionnee || !commentaireRejet.trim()) return;

 try {
 const { error } = await supabase.rpc('rejeter_soumission_feuille', {
 p_notification_id: notificationSelectionnee.id,
 p_user_id: notificationSelectionnee.metadata.user_id,
 p_feuille_id: notificationSelectionnee.metadata.feuille_id,
 p_commentaire: commentaireRejet.trim(),
 });

 if (error) throw error;

 alert('✓ Soumission rejetée');
 setShowRejetModal(false);
 setShowSyntheseModal(false);
 setNotificationSelectionnee(null);
 setCommentaireRejet('');
 setSyntheseData(null);
 if (equipeId) loadData(equipeId);
 } catch (error) {
 console.error(error);
 alert('Erreur lors du rejet');
 }
 }

 if (loading) {
 return (
 <div className="min-h-screen bg-cream-50 flex items-center justify-center">
 <Loader />
 </div>
 );
 }

 if (!equipe) return null;

 return (
 <main className="min-h-screen bg-cream-50 p-4 md:p-8">
 <div className="max-w-6xl mx-auto space-y-6">

 {/* Vue membre (non-chef) */}
 {!isChef && (
 <div className="bg-cream-50 rounded-lg p-6 border border-border">
 <h2 className="text-xl font-bold text-ink mb-4">
 👤 Mon espace dans l'équipe {equipe.nom}
 </h2>
 <div className="space-y-3">
 <button
 onClick={() => router.push(`/gestion-equipe/rapport?id=${equipeId}&membre=${userId}`)}
 className="w-full p-4 border border-border rounded-lg hover:border-accent transition-all flex items-center justify-between"
 >
 <div className="flex items-center gap-3">
 <span className="text-2xl">📋</span>
 <div className="text-left">
 <div className="font-semibold text-ink">Mon rapport</div>
 <div className="text-sm text-ink-light">Consulter mes statistiques et ma progression</div>
 </div>
 </div>
 <span className="text-ink-light">→</span>
 </button>
 <button
 onClick={() => router.push(`/gestion-equipe/objectifs?id=${equipeId}&membre=${userId}`)}
 className="w-full p-4 border border-border rounded-lg hover:border-accent transition-all flex items-center justify-between"
 >
 <div className="flex items-center gap-3">
 <span className="text-2xl">🎯</span>
 <div className="text-left">
 <div className="font-semibold text-ink">Mes objectifs</div>
 <div className="text-sm text-ink-light">Voir mes objectifs fixés par le chef d'équipe</div>
 </div>
 </div>
 <span className="text-ink-light">→</span>
 </button>
 </div>
 </div>
 )}

 {/* Liste des membres (chef uniquement) */}
 {isChef && (
 <div className="bg-cream-50 rounded-lg p-6 border border-border">
 <h2 className="text-xl font-bold text-ink mb-4">
 👥 Membres de l'équipe ({membres.length})
 </h2>
 
 {membres.length === 0 ? (
 <div className="text-center py-8 text-ink-muted">
 Aucun membre pour le moment
 </div>
 ) : (
 <div className="space-y-3">
 {membres.map((membre: Membre) => (
 <div
 key={membre.membre_id}
 className="p-4 border border-border rounded-lg hover:border-teal-400 transition-all flex items-center justify-between"
 >
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full flex items-center justify-center text-ink font-bold text-lg">
 {membre.membre_nom.charAt(0).toUpperCase()}
 </div>
 <div className="font-semibold text-ink text-lg">
 {membre.membre_nom}
 </div>
 </div>

 <div className="flex gap-3">
 <button
 onClick={() => handleGererFeuilles(membre)}
 className="px-4 py-2 bg-accent hover:bg-accent text-ink font-medium rounded-lg transition-colors"
 >
 📄 Feuilles
 </button>
 <button
 onClick={() => handleVoirParcours(membre)}
 className="px-4 py-2 bg-accent-light0 hover:bg-accent text-ink font-medium rounded-lg transition-colors"
 >
 🗺 Parcours
 </button>
 <button
 onClick={() => router.push(`/library/sessions?membre=${membre.user_id}`)}
 className="px-4 py-2 bg-accent-light0 hover:bg-accent text-ink font-medium rounded-lg transition-colors"
 >
 📝 Insérer
 </button>
 <button
 onClick={() => router.push(`/gestion-equipe/rapport?id=${equipeId}&membre=${membre.user_id}`)}
 className="px-4 py-2 bg-accent-light0 hover:bg-accent text-ink font-medium rounded-lg transition-colors"
 >
 📋 Rapport
 </button>
 <button
 onClick={() => router.push(`/gestion-equipe/objectifs?id=${equipeId}&membre=${membre.user_id}`)}
 className="px-4 py-2 bg-accent-light0 hover:bg-accent text-ink font-medium rounded-lg transition-colors"
 >
 🎯 Objectifs
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}


 {/* Score Global de l'Équipe */}
 <div className="bg-cream-50 rounded-lg p-6 border border-border">
 <h2 className="text-xl font-bold text-ink mb-6">
 🏆 Score Global de l'Équipe
 </h2>

 <div className="text-center mb-8">
 <div className="text-5xl font-bold text-accent mb-2">
 {scoreGlobalEquipe}
 </div>
 <div className="text-sm text-ink-light">
 Score total de compétition
 </div>
 </div>

 {contributionsMembres.length > 0 && (
 <div className="space-y-3">
 <h3 className="font-semibold text-ink mb-3">
 📊 Contribution de chaque membre
 </h3>
 {contributionsMembres.map((contrib, index) => {
 const pourcentage = scoreGlobalEquipe > 0 
 ? Math.round((contrib.score / scoreGlobalEquipe) * 100) 
 : 0;
 
 return (
 <div key={contrib.user_id} className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full flex items-center justify-center text-ink font-bold text-sm">
 {index + 1}
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between mb-1">
 <span className="font-medium text-ink">
 {contrib.nom}
 </span>
 <span className="text-sm font-semibold text-accent">
 {contrib.score} pts ({pourcentage}%)
 </span>
 </div>
 <div className="w-full bg-cream-200 rounded-full h-2">
 <div 
 className="bg-accent h-2 rounded-full transition-all"
 style={{ width: `${pourcentage}%` }}
 ></div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {contributionsMembres.length === 0 && (
 <div className="text-center py-8 text-ink-muted">
 <p className="text-sm">Aucune donnée de contribution disponible</p>
 <p className="text-xs text-gray-400 mt-1">
 Les membres doivent avoir des feuilles validées avec des scores
 </p>
 </div>
 )}
 </div>

 {/* Notifications de cette équipe (chef uniquement) */}
 {isChef && (
 <div className="bg-cream-50 rounded-lg p-6 border border-border">
 <h2 className="text-xl font-bold text-ink mb-4">
 🔔 Notifications de l'équipe
 </h2>
 
 {notifications.length === 0 ? (
 <div className="text-center py-8 text-ink-muted">
 Aucune notification pour cette équipe
 </div>
 ) : (
 <div className="space-y-3">
 {notifications.map(notif => (
 <div
 key={notif.id}
 className={`p-4 rounded-lg border transition-all ${
 notif.lu
 ? 'border-border bg-cream-100/50'
 : 'border-border bg-accent-light/20'
 }`}
 >
 <div className="flex items-start justify-between mb-2">
 <h3 className="font-semibold text-ink">
 {notif.type === 'demande_equipe' && '👤 '}
 {notif.type === 'soumission_feuille' && '📝 '}
 {notif.titre}
 </h3>
 {!notif.lu && (
 <span className="px-2 py-1 bg-accent-light0 text-ink text-xs font-bold rounded">
 NOUVEAU
 </span>
 )}
 </div>
 <p className="text-sm text-ink-light mb-3">
 {notif.message}
 </p>
 <div className="flex items-center justify-between">
 <span className="text-xs text-ink-muted">
 {new Date(notif.created_at).toLocaleDateString('fr-FR', {
 day: 'numeric',
 month: 'long',
 hour: '2-digit',
 minute: '2-digit'
 })}
 </span>
 {notif.type === 'soumission_feuille' ? (
 <div className="flex gap-2">
 <button
 onClick={() => handleOuvrirSynthese(notif)}
 className="px-3 py-1.5 bg-accent-light/30 hover:bg-blue-200/50 text-accent text-sm font-medium rounded-lg transition-colors"
 >
 👁️ Voir détails
 </button>
 </div>
 ) : (
 <button
 onClick={() => router.push('/personnel')}
 className="px-3 py-1.5 bg-accent-light/30 hover:bg-blue-200/50 text-accent text-sm font-medium rounded-lg transition-colors"
 >
 Gérer →
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 
 {notifications.length > 0 && (
 <div className="mt-4 pt-4 border-t border-border">
 <button
 onClick={() => router.push('/personnel')}
 className="w-full px-4 py-2 bg-accent-light0 hover:bg-accent text-ink font-medium rounded-lg transition-colors"
 >
 Voir toutes les notifications ({notifsNonLues} non lues)
 </button>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Modal Gestion Feuilles (Vue Scope) */}
 {showModalGestion && membreSelectionne && (
 <ModalGererFeuillesScope
 membre={membreSelectionne}
 onClose={() => {
 setShowModalGestion(false);
 setMembreSelectionne(null);
 }}
 onUpdate={() => {
 if (equipeId) loadData(equipeId);
 }}
 />
 )}

 {/* Modal Parcours */}
 {membreParcoursModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
  <div className="bg-cream-50 rounded-lg max-w-4xl w-full max-h-[85vh] overflow-y-auto flex flex-col">
  {/* Header */}
  <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
   <h2 className="text-xl font-bold text-ink">
   🗺 Parcours de {membreParcoursModal.membre_nom}
   </h2>
   <button
   onClick={() => { setMembreParcoursModal(null); setEtapeEnRemplacement(null); }}
   className="w-8 h-8 rounded-lg hover:bg-cream-200 flex items-center justify-center transition-colors"
   >
   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
   </svg>
   </button>
  </div>
  {/* Contenu */}
  <div className="flex-1 overflow-y-auto p-6">
   {loadingParcours ? (
   <div className="flex items-center justify-center py-12 text-ink-light">Chargement…</div>
   ) : etapesParcours.length === 0 ? (
   <div className="text-center py-12 text-ink-muted">Aucune étape trouvée pour ce membre.</div>
   ) : (
   <>
   {/* Timeline visuelle */}
   <ParcoursTimeline etapes={etapesParcours} />
   </>
   )}
  </div>
  {/* Footer */}
  <div className="px-6 py-4 border-t border-border flex-shrink-0">
   <button
   onClick={() => { setMembreParcoursModal(null); setEtapeEnRemplacement(null); }}
   className="w-full px-4 py-2 bg-cream-200 hover:bg-cream-300 text-ink font-medium rounded-lg transition-colors"
   >
   Fermer
   </button>
  </div>
  </div>
 </div>
 )}

 {/* Modal Observer Feuilles */}
 {showObserverModal && equipeId && (
 <ModalObserverFeuilles
 equipeId={equipeId}
 onClose={() => setShowObserverModal(false)}
 />
 )}

 {/* Modal Rejet */}
 {showRejetModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-cream-50 rounded-lg max-w-md w-full p-6">
 <h2 className="text-xl font-bold text-ink mb-4">
 Rejeter la soumission
 </h2>
 <p className="text-sm text-ink-light mb-4">
 Expliquez pourquoi cette soumission est rejetée :
 </p>
 <textarea
 value={commentaireRejet}
 onChange={(e) => setCommentaireRejet(e.target.value)}
 placeholder="Votre commentaire..."
 className="w-full p-3 border border-border rounded-lg bg-cream-50 text-ink focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none resize-none"
 rows={4}
 />
 <div className="flex gap-3 mt-4">
 <button
 onClick={() => {
 setShowRejetModal(false);
 setNotificationSelectionnee(null);
 setCommentaireRejet('');
 }}
 className="flex-1 px-4 py-2 bg-cream-200 hover:bg-cream-200 text-ink font-medium rounded-lg transition-colors"
 >
 Annuler
 </button>
 <button
 onClick={handleRejeterSoumission}
 disabled={!commentaireRejet.trim()}
 className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-ink font-medium rounded-lg transition-colors"
 >
 Rejeter
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Modal Synthèse */}
 {showSyntheseModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-cream-50 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
 {/* Header */}
 <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
 <div>
 <h2 className="text-xl font-bold text-ink">
 📝 Synthèse de la soumission
 </h2>
 {syntheseData && (
 <p className="text-blue-100 text-sm mt-1">
 {syntheseData.membreNom} - {syntheseData.feuilleTitre}
 </p>
 )}
 </div>
 <button
 onClick={() => {
 setShowSyntheseModal(false);
 setSyntheseData(null);
 }}
 className="text-ink hover:bg-cream-100/20 rounded-lg p-2 transition"
 >
 <IconX />
 </button>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6">
 {loadingSynthese ? (
 <div className="flex items-center justify-center py-12">
 <Loader />
 </div>
 ) : syntheseData ? (
 <div className="space-y-4">
 {syntheseData.scoresLocaux.length === 0 ? (
 <div className="text-center py-12 text-ink-muted">
 <div className="text-4xl mb-2">📭</div>
 <p>Aucune question enregistrée pour cette feuille</p>
 </div>
 ) : (
 <>
 {/* Nouvelle synthèse simplifiée */}
 <div className="space-y-4">
 {/* En-tête : Résumé de Travail */}
 <div className="border border-border rounded-lg p-4">
 <h3 className="text-lg font-bold text-ink mb-3">📋 Résumé de Travail</h3>
 
 {/* Informations de la feuille */}
 <div className="space-y-1 text-sm">
 <div className="flex items-center gap-2 text-ink flex-wrap">
 <span className="font-semibold">{syntheseData.niveauNom || 'Niveau'}</span>
 <span>•</span>
 <span>{syntheseData.sujetNom || 'Sujet'}</span>
 <span>•</span>
 <span>{syntheseData.chapitreNom || 'Chapitre'}</span>
 </div>
 <div className="text-base font-semibold text-ink mt-2">
 {syntheseData.feuilleTitre}
 </div>
 </div>
 </div>

 {/* Volume de travail */}
 <div className="bg-cream-50 border border-border rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-lg">📊</span>
 <h4 className="font-semibold text-ink">Volume de travail</h4>
 </div>
 <div className="text-ink">
 <span className="font-bold text-accent">{nbSessions}</span> session{nbSessions > 1 ? 's' : ''} • <span className="font-bold text-accent">{tempsTotal}</span> minutes
 </div>
 </div>

 {/* Niveau de maîtrise */}
 <div className="bg-cream-50 border border-border rounded-lg p-4">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-lg">🎯</span>
 <h4 className="font-semibold text-ink">Niveau de maîtrise</h4>
 </div>

 {/* Score Global */}
 <div className="mb-4 pb-4 border-b border-border">
 <div className="text-sm text-ink-light mb-1">Score Global</div>
 <div className="text-3xl font-bold text-accent">
 {(syntheseData.scoreGlobal / 100).toFixed(2)}
 </div>
 <div className="text-xs text-ink-muted mt-1">
 sur {syntheseData.scoresLocaux.length} question{syntheseData.scoresLocaux.length > 1 ? 's' : ''}
 </div>
 </div>

 {/* Détail par composante */}
 <div className="space-y-2">
 <div className="text-sm font-medium text-ink mb-2">
 Détail par composante :
 </div>
 
 <div className="flex items-center justify-between p-2 bg-accent-light rounded-lg">
 <span className="text-sm text-ink">🧠 Compréhension</span>
 <span className="text-lg font-bold text-accent">{scoreComprehension.toFixed(2)}</span>
 </div>
 
 <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
 <span className="text-sm text-ink">🛠️ Savoir-faire</span>
 <span className="text-lg font-bold text-status-success">{scoreSavoir.toFixed(2)}</span>
 </div>
 
 <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
 <span className="text-sm text-ink">✍️ Rédaction</span>
 <span className="text-lg font-bold text-accent">{scoreRedaction.toFixed(2)}</span>
 </div>
 </div>
 </div>
 </div>
 </>
 )}
 </div>
 ) : null}
 </div>

 {/* Footer avec boutons */}
 {syntheseData && syntheseData.scoresLocaux.length > 0 && (
 <div className="border-t border-border p-6 flex gap-3 flex-shrink-0">
 <button
 onClick={() => {
 setShowSyntheseModal(false);
 setSyntheseData(null);
 }}
 className="flex-1 px-4 py-2 bg-cream-200 hover:bg-cream-200 text-ink font-medium rounded-lg transition-colors"
 >
 Fermer
 </button>
 <button
 onClick={() => {
 // Trouver la notification correspondante
 const notif = notifications.find(n => 
 n.metadata.user_id === syntheseData.userId && 
 n.metadata.feuille_id === syntheseData.feuilleId
 );
 if (notif) {
 setShowSyntheseModal(false);
 handleOuvrirRejet(notif);
 }
 }}
 className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-ink font-medium rounded-lg transition-colors"
 >
 ✗ Rejeter
 </button>
 <button
 onClick={() => {
 // Trouver la notification correspondante
 const notif = notifications.find(n => 
 n.metadata.user_id === syntheseData.userId && 
 n.metadata.feuille_id === syntheseData.feuilleId
 );
 if (notif) {
 handleValiderSoumission(notif);
 }
 }}
 className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-ink font-medium rounded-lg transition-colors"
 >
 ✓ Valider
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 {/* Mini-modal Clôture Nœud */}
 {showClotureNoeudModal && (
 <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
 <div className="bg-cream-50 rounded-xl shadow-xl max-w-sm w-full p-6 border border-border">
 <p className="text-base font-semibold text-ink mb-5 text-center">
 Cette feuille clôt-elle le nœud en cours ?
 </p>
 <div className="flex flex-col gap-3">
 <button
 onClick={() => handleCloturerNoeud(true)}
 className="w-full px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
 >
 ✅ Oui, nœud validé
 </button>
 <button
 onClick={() => handleCloturerNoeud(false)}
 className="w-full px-4 py-2.5 bg-cream-200 hover:bg-cream-300 text-ink font-medium rounded-lg transition-colors"
 >
 ➡️ Non, continuer le nœud
 </button>
 </div>
 </div>
 </div>
 )}
 </main>
 );
}