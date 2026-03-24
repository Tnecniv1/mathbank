'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ParcoursTimeline from '@/components/ParcoursTimeline';

/* ---------- Types ---------- */
type FeuilleEntrainement = {
 id: string;
 ordre: number;
 ordre_dans_niveau: number;
 titre: string;
 description: string | null;
 pdf_url: string;
 difficulte: number | null;
};

type Chapitre = {
 id: string;
 ordre: number;
 titre: string;
 description: string | null;
 feuilles: FeuilleEntrainement[];
};

type Sujet = {
 id: string;
 ordre: number;
 titre: string;
 description: string | null;
 chapitres: Chapitre[];
 feuilles?: FeuilleEntrainement[];
};

type Niveau = {
 id: string;
 ordre: number;
 titre: string;
 description: string | null;
 sujets: Sujet[];
};

type NoeudRow = {
 id: string;
 parent_id: string | null;
 titre: string;
 ordre: number;
 type: 'niveau' | 'sujet' | 'chapitre' | 'mecanique' | 'chaotique';
 pdf_url: string | null;
 difficulte: number | null;
 profondeur: number;
};

type SessionTravail = {
 id: string;
 date: string;
 heure: string;
 duree: number;
 commentaire: string | null;
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

type ScoresParExercice = {
 exercice: string;
 questions: ScoreLocalDetail[];
};

type Progression = {
 id: string;
 feuille_id: string;
 est_termine: boolean;
 score: number | null;
 temps_total: number;
 sessions: SessionTravail[];
 statut: string;
 commentaire_chef: string | null;
 est_bloquee?: boolean; // NOUVEAU : Feuille bloquée par le chef
};

/* ---------- Icônes ---------- */
const Loader = () => (
 <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
 <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
 </svg>
);

const IconFile = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12V7l-4-4z" stroke="currentColor" strokeWidth="2" />
 <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" />
 </svg>
);

const IconCircleEmpty = () => (
 <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
 <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
 </svg>
);

const IconCircleFilled = () => (
 <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
 <circle cx="12" cy="12" r="10" />
 </svg>
);

const IconCheck = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
 <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
);

const IconLock = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
 <path d="M12 15v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
 <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" />
 </svg>
);

/* ---------- Data fetch ---------- */
async function getParcoursComplet(niveauId: string) {
 console.log('🔄 Chargement du parcours niveau:', niveauId);
 try {
 const { data, error } = await supabase
 .rpc('get_arbre_noeud', { p_racine_id: niveauId });

 if (error) throw error;

 const rows = data as NoeudRow[];

 const niveauRow = rows.find(r => r.type === 'niveau');
 if (!niveauRow) throw new Error('Niveau introuvable');

 const sujets: Sujet[] = rows
 .filter(r => r.type === 'sujet')
 .sort((a, b) => a.ordre - b.ordre)
 .map(s => {
 const chapitres: Chapitre[] = rows
 .filter(r => r.type === 'chapitre' && r.parent_id === s.id)
 .sort((a, b) => a.ordre - b.ordre)
 .map(c => {
 const feuilles: FeuilleEntrainement[] = rows
 .filter(r => (r.type === 'mecanique' || r.type === 'chaotique') && r.parent_id === c.id)
 .sort((a, b) => a.ordre - b.ordre)
 .map(f => ({
 id: f.id,
 ordre: f.ordre,
 ordre_dans_niveau: 0,
 titre: f.titre,
 description: null,
 pdf_url: f.pdf_url ?? '',
 difficulte: f.difficulte,
 }));
 return { id: c.id, ordre: c.ordre, titre: c.titre, description: null, feuilles };
 });
 const feuillesDirectes: FeuilleEntrainement[] = rows
 .filter(r => (r.type === 'mecanique' || r.type === 'chaotique') && r.parent_id === s.id)
 .sort((a, b) => a.ordre - b.ordre)
 .map(f => ({
 id: f.id,
 ordre: f.ordre,
 ordre_dans_niveau: 0,
 titre: f.titre,
 description: null,
 pdf_url: f.pdf_url ?? '',
 difficulte: f.difficulte,
 }));
 return { id: s.id, ordre: s.ordre, titre: s.titre, description: null, chapitres, feuilles: feuillesDirectes };
 });

 // Recalculer ordre_dans_niveau
 let compteur = 1;
 for (const sujet of sujets) {
 for (const feuille of sujet.feuilles ?? [])
 feuille.ordre_dans_niveau = compteur++;
 for (const chapitre of sujet.chapitres)
 for (const feuille of chapitre.feuilles)
 feuille.ordre_dans_niveau = compteur++;
 }

 if (process.env.NODE_ENV === 'development')
 console.log(`📦 ${rows.length} nœuds chargés`);

 return {
 data: { id: niveauRow.id, ordre: niveauRow.ordre, titre: niveauRow.titre, description: null, sujets } as Niveau,
 error: null,
 };
 } catch (e: any) {
 console.error(e);
 return { data: null, error: e };
 }
}

async function getNiveaux() {
 try {
 const { data, error } = await supabase
 .from('noeud')
 .select('id, ordre, titre')
 .eq('type', 'niveau')
 .order('ordre', { ascending: true });

 if (error) throw error;
 return { data: data as Niveau[], error: null };
 } catch (e: any) {
 console.error(e);
 return { data: null, error: e };
 }
}

/* ---------- Composant Feuille ---------- */
function FeuilleCard({ 
 feuille, 
 progression,
 onOpen, 
 onUpdateProgression 
}: { 
 feuille: FeuilleEntrainement; 
 progression: Progression | null;
 onOpen: () => void;
 onUpdateProgression: () => void;
}) {
 const [showModal, setShowModal] = useState(false);
 const [isAuthorized, setIsAuthorized] = useState(false);

 // Vérifier si cette feuille est autorisée (nouveau système)
 useEffect(() => {
 (async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !session.user) return;

 // Récupérer l'ID du membre
 const { data: membre } = await supabase
 .from('membre_equipe')
 .select('id')
 .eq('user_id', session.user.id)
 .single();

 if (membre) {
 // Vérifier si cette feuille est dans les feuilles autorisées
 const { data: autorisee, count } = await supabase
 .from('feuilles_autorisees')
 .select('feuille_id', { count: 'exact', head: true })
 .eq('membre_id', membre.id)
 .eq('feuille_id', feuille.id);
 
 if (count && count > 0) {
 setIsAuthorized(true);
 }
 }
 })();
 }, [feuille.id]);

 // Déterminer le statut de la feuille
 const estValidee = progression?.statut === 'validee';
 const estBloquee = progression?.est_bloquee;

 console.log('🔍 Feuille:', feuille.titre, {
 statut: progression?.statut,
 est_bloquee: progression?.est_bloquee,
 estValidee,
 estBloquee
 });

 const handlePastilleClick = (e: React.MouseEvent) => {
 e.stopPropagation();
 
 // Si bloquée, afficher message
 if (estBloquee) {
 alert('🔒 Cette feuille est bloquée. Votre chef doit d\'abord valider votre travail en cours.');
 return;
 }
 
 setShowModal(true);
 };

 const handleCardClick = () => {
 // Si bloquée, empêcher l'ouverture
 if (estBloquee) {
 alert('🔒 Cette feuille est bloquée. Seule la feuille autorisée par votre chef est accessible.');
 return;
 }
 
 onOpen();
 };

 return (
 <>
 <button
 onClick={handleCardClick}
 disabled={estBloquee}
 className={`group relative flex items-center gap-4 w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
 estBloquee
 ? 'border-gray-700 bg-cream-50/50 opacity-60 cursor-not-allowed'
 : isAuthorized && !estValidee
 ? 'border-green-400 bg-green-50/20 hover:border-status-success hover:shadow-sm'
 : 'border-border bg-cream-50 border border-accent/30 hover:border-accent hover:shadow-sm'
 }`}
 >
 {/* Badge de blocage */}
 {estBloquee && (
 <div className="absolute top-2 right-2 z-10">
 <span className="px-2 py-1 bg-cream-100 text-ink-light text-xs font-medium rounded-full flex items-center gap-1">
 <IconLock />
 Bloquée
 </span>
 </div>
 )}

 {/* Badge feuille autorisée */}
 {isAuthorized && !estValidee && !estBloquee && (
 <div className="absolute top-2 right-2 z-10">
 <span className="px-3 py-1 from-green-500 to-emerald-500 text-ink text-xs font-bold rounded-full flex items-center gap-1 shadow-sm animate-pulse">
 ✓ À faire
 </span>
 </div>
 )}

 {/* Numéro d'ordre avec pastille */}
 <div className={`flex items-center justify-center w-10 h-10 rounded-full text-ink font-bold text-lg shadow-sm transition-transform ${
 estBloquee 
 ? 'bg-slate-400'
 : 'bg-status-success group-hover:scale-110'
 }`}>
 {feuille.ordre_dans_niveau}
 </div>

 {/* Contenu */}
 <div className="flex-1 text-left min-w-0">
 <div className="flex items-center gap-2">
 <div className="font-medium text-ink truncate">{feuille.titre}</div>
 {feuille.difficulte && (
 <div className="flex items-center gap-1 px-2 py-1 bg-cream-200 rounded-md flex-shrink-0">
 <div className="grid grid-cols-2 gap-0.5">
 {[...Array(6)].map((_, i) => (
 <div 
 key={i} 
 className={`w-2 h-2 rounded-full transition-colors ${
 i < feuille.difficulte 
 ? 'bg-ink-light' 
 : 'bg-slate-300'
 }`} 
 />
 ))}
 </div>
 </div>
 )}
 </div>
 {feuille.description && (
 <div className="text-sm text-ink-light mt-0.5 line-clamp-1">{feuille.description}</div>
 )}
 {progression && progression.temps_total > 0 && (
 <div className="text-xs text-blue-500 mt-1">
 {progression.temps_total} min • {progression.score !== null ? `Score: ${progression.score}` : 'Pas de score'}
 </div>
 )}
 </div>

 {/* Icône PDF */}
 <div className={`transition-colors ${
 estBloquee 
 ? 'text-ink-light'
 : 'text-ink-light group-hover:text-accent'
 }`}>
 <IconFile />
 </div>

 {/* Pastille de progression - 3 COULEURS */}
 <div
 onClick={handlePastilleClick}
 className="absolute -top-2 -right-2 cursor-pointer hover:scale-110 transition-transform"
 >
 {estValidee ? (
 /* 🟣 VIOLET = Validée */
 <div className="text-status-success drop-shadow-sm">
 <IconCircleFilled />
 </div>
 ) : isAuthorized && !estBloquee ? (
 /* 🟠 ORANGE = Autorisée/Disponible */
 <div className="text-orange-500 drop-shadow-sm">
 <IconCircleFilled />
 </div>
 ) : (
 /* ⚫ NOIR = Bloquée/Non autorisée */
 <div className="text-ink hover:text-status-success transition-colors">
 <IconCircleEmpty />
 </div>
 )}
 </div>
 </button>

 {/* Modal de progression */}
 {showModal && !estBloquee && (
 <ProgressionModal
 feuille={feuille}
 progression={progression}
 onClose={() => setShowModal(false)}
 onSave={onUpdateProgression}
 />
 )}
 </>
 );
}

/* ---------- Modal de Progression ---------- */
function ProgressionModal({
 feuille,
 progression,
 onClose,
 onSave,
}: {
 feuille: FeuilleEntrainement;
 progression: Progression | null;
 onClose: () => void;
 onSave: () => void;
}) {
 const [sessions, setSessions] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [score, setScore] = useState(''); // Score saisi par le membre
 const [saving, setSaving] = useState(false);
 const [scoresLocaux, setScoresLocaux] = useState<ScoreLocalDetail[]>([]);
 const [scoreGlobal, setScoreGlobal] = useState<number>(0);
 const [scoreMax, setScoreMax] = useState<number>(0);
 const [scoreComprehension, setScoreComprehension] = useState<number>(0);
 const [scoreSavoir, setScoreSavoir] = useState<number>(0);
 const [scoreRedaction, setScoreRedaction] = useState<number>(0);
 const [nbSessions, setNbSessions] = useState<number>(0);
 const [tempsTotal, setTempsTotal] = useState<number>(0);

 useEffect(() => {
 loadSessions();
 }, []);

 async function loadSessions() {
 try {
 const { data: { session: userSession } } = await supabase.auth.getSession();
 if (!userSession || !userSession.user) return;
 const userId = userSession.user.id;

 // ── 1. Ancien système : session_entrainement ──
 const { data: oldSessions } = await supabase
 .from('session_entrainement')
 .select('*')
 .eq('user_id', userId)
 .or(`feuille_mecanique_id.eq.${feuille.id},feuille_chaotique_id.eq.${feuille.id}`)
 .order('date_session', { ascending: false });

 const oldSessionsFiltered = (oldSessions || []).map((s: any) => {
 const isMecanique = s.feuille_mecanique_id === feuille.id;
 return {
 id: s.id,
 numero: s.numero_session,
 date: s.date_session,
 heure: s.heure_session,
 temps: isMecanique ? s.temps_mecanique : s.temps_chaotique,
 type: isMecanique ? 'mecanique' : 'chaotique',
 };
 }).filter((s: any) => s.temps !== null && s.temps > 0);

 // ── 2. Nouveau système : session ──
 const { data: newSessions } = await supabase
 .from('session')
 .select('id, duree, date_session, feuille_mecanique_id, feuille_chaotique_id')
 .eq('user_id', userId)
 .or(`feuille_mecanique_id.eq.${feuille.id},feuille_chaotique_id.eq.${feuille.id}`)
 .order('date_session', { ascending: false });

 const newSessionsFiltered = (newSessions || []).map((s: any) => {
 const isMecanique = s.feuille_mecanique_id === feuille.id;
 return {
 id: s.id,
 date: s.date_session,
 temps: s.duree || 0,
 type: isMecanique ? 'mecanique' : 'chaotique',
 };
 }).filter((s: any) => s.temps > 0);

 const allSessions = [...oldSessionsFiltered, ...newSessionsFiltered];
 setSessions(allSessions);

 // ── 3. Scores ancien système ──
 const scores: ScoreLocalDetail[] = [];
 const oldSessionIds = (oldSessions || []).map((s: any) => s.id);

 if (oldSessionIds.length > 0) {
 const { data: scoresData } = await supabase
 .from('score_local')
 .select('*')
 .in('session_id', oldSessionIds)
 .order('created_at', { ascending: true });

 if (scoresData) {
 for (const s of scoresData) {
 scores.push({
 id: s.id,
 exercice: s.exercice || 'Question',
 question: s.question,
 comprehension: s.comprehension,
 savoir: s.savoir,
 redaction: s.redaction,
 correction: s.correction,
 score_calcule: parseFloat(s.score_calcule) || 0,
 });
 }
 }
 }

 // ── 4. Scores nouveau système ──
 const newSessionIds = (newSessions || []).map((s: any) => s.id);
 if (newSessionIds.length > 0) {
 const { data: exercicesData } = await supabase
 .from('exercice')
 .select('id, type, score_exercice(reussi, c1, c2, c3, c4, s1, s2, s3, s4, r1, r2, r3, r4, correction)')
 .in('session_id', newSessionIds);

 if (exercicesData) {
 for (const ex of exercicesData as any[]) {
 const se = Array.isArray(ex.score_exercice) ? ex.score_exercice[0] : ex.score_exercice;
 if (!se) continue;

 if (ex.type === 'mecanique') {
 scores.push({
 id: ex.id,
 exercice: 'Exercice mécanique',
 question: '',
 comprehension: se.reussi ? 100 : 0,
 savoir: se.reussi ? 100 : 0,
 redaction: 0,
 correction: se.reussi ? 1 : 0,
 score_calcule: se.reussi ? 1 : 0,
 });
 } else {
 const cPts = [se.c1, se.c2, se.c3, se.c4].filter(Boolean).length;
 const sPts = [se.s1, se.s2, se.s3, se.s4].filter(Boolean).length;
 const rPts = [se.r1, se.r2, se.r3, se.r4].filter(Boolean).length;
 const totalBools = cPts + sPts + rPts + (se.correction ? 1 : 0);
 scores.push({
 id: ex.id,
 exercice: 'Exercice chaotique',
 question: '',
 comprehension: (cPts / 4) * 100,
 savoir: (sPts / 4) * 100,
 redaction: (rPts / 4) * 100,
 correction: se.correction ? 1 : 0,
 score_calcule: totalBools / 10,
 });
 }
 }
 }
 }

 // ── 5. Calcul des statistiques ──
 setScoresLocaux(scores);

 if (scores.length > 0) {
 const total = scores.reduce((acc, s) => acc + s.score_calcule, 0);
 setScoreGlobal((total / scores.length) * 100);
 setScoreMax(scores.length * 1.3);
 setScoreComprehension(scores.reduce((acc, s) => acc + s.comprehension, 0) / (scores.length * 100));
 setScoreSavoir(scores.reduce((acc, s) => acc + s.savoir, 0) / (scores.length * 100));
 setScoreRedaction(scores.reduce((acc, s) => acc + s.redaction, 0) / (scores.length * 100));
 }

 setNbSessions(allSessions.length);
 setTempsTotal(allSessions.reduce((acc: number, s: any) => acc + (s.temps || 0), 0));

 setLoading(false);
 } catch (error) {
 console.error('Erreur chargement sessions:', error);
 setLoading(false);
 }
 }

 const handleValider = async () => {
 try {
 console.log('=== DÉBUT handleValider ===');
 console.log('scoreGlobal:', scoreGlobal);
 console.log('tempsTotal:', tempsTotal);
 console.log('sessions.length:', sessions.length);
 console.log('scoresLocaux.length:', scoresLocaux.length);
 console.log('progression:', progression);
 
 setSaving(true);
 
 // Vérifier qu'on a des sessions
 if (sessions.length === 0) {
 alert('❌ Vous devez d\'abord enregistrer des sessions d\'entraînement sur cette feuille.\n\nRendez-vous sur"Mes Sessions" pour ajouter vos sessions quotidiennes.');
 setSaving(false);
 return;
 }

 // Utiliser le score calculé automatiquement
 const scoreValue = scoreGlobal;
 
 if (scoresLocaux.length === 0) {
 alert('❌ Aucune question enregistrée. Enregistrez des sessions avec des questions avant de soumettre.');
 setSaving(false);
 return;
 }


 const { data: { session: userSession } } = await supabase.auth.getSession();
 if (!userSession || !userSession.user) {
 alert('Vous devez être connecté');
 setSaving(false);
 return;
 }

 // Vérifier si l'utilisateur est dans une équipe
 const { data: membreData } = await supabase
 .from('membre_equipe')
 .select('equipe_id')
 .eq('user_id', userSession.user.id)
 .single();

 if (membreData) {
 // ========================================
 // CAS 1 : MEMBRE D'UNE ÉQUIPE
 // → Soumettre pour validation par le chef
 // ========================================
 
 // Mettre à jour la progression avec le score et temps calculés
 const { error: updateError } = await supabase
 .from('progression_feuille')
 .update({
 score: scoreValue,
 temps_total: tempsTotal,
 est_termine: true,
 })
 .eq('id', progression!.id);

 if (updateError) throw updateError;

 console.log('=== Appel RPC soumettre_feuille ===');
 console.log('progression.id:', progression!.id);


 // Appeler la fonction de soumission
 const { data, error } = await supabase.rpc('soumettre_feuille', {
 p_progression_id: progression!.id
 });

 console.log('=== Retour RPC ===');
 console.log('data:', data);
 console.log('error:', error);

 if (error) throw error;

 if (!data || !data.success) {
 alert(data?.error || 'Erreur lors de la soumission');
 setSaving(false);
 return;
 }

 alert(`✅ Feuille soumise au chef pour validation !\n\n📊 Score : ${(scoreValue / 100).toFixed(2)}\n⏱️ Temps total : ${tempsTotal} min`);
 } else {
 // ========================================
 // CAS 2 : PAS DANS UNE ÉQUIPE
 // → Validation automatique
 // ========================================
 
 const { error } = await supabase
 .from('progression_feuille')
 .update({
 est_termine: true,
 en_cours: false,
 statut: 'validee',
 score: scoreValue,
 temps_total: tempsTotal,
 validee_at: new Date().toISOString()
 })
 .eq('id', progression!.id);

 if (error) throw error;

 alert(`✅ Feuille terminée !\n\n📊 Score : ${(scoreValue / 100).toFixed(2)}\n⏱️ Temps total : ${tempsTotal} min`);
 }

 onClose();
 onSave();
 } catch (error: any) {
 console.error('Erreur validation:', error);
 alert('Erreur lors de la validation');
 } finally {
 setSaving(false);
 }
 };

 const estValidee = progression?.statut === 'validee';
 const estEnAttente = progression?.statut === 'en_attente';

 if (loading) {
 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
 <div className="bg-cream-50 rounded-lg p-8">
 <Loader />
 </div>
 </div>
 );
 }

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-cream-50 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="sticky top-0 from-accent to-accentaccent p-6 rounded-t-2xl">
 <h2 className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-ink">{feuille.titre}</h2>
 {feuille.description && (
 <p className="text-teal-100 mt-1">{feuille.description}</p>
 )}
 </div>

 <div className="p-6 space-y-6">
 {/* Afficher le commentaire du chef si présent */}
 {progression?.commentaire_chef && (
 <div className="p-4 bg-accent-light/20 border border-border rounded-lg">
 <div className="flex items-start gap-3">
 <div className="text-2xl">💬</div>
 <div className="flex-1">
 <div className="font-semibold text-accent mb-1">
 Commentaire du chef :
 </div>
 <p className="text-accent">
 {progression.commentaire_chef}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Afficher si en attente */}
 {estEnAttente && (
 <div className="p-4 bg-orange-50/20 border border-status-success/30 rounded-lg text-center">
 <div className="text-3xl mb-2">⏳</div>
 <div className="font-semibold text-status-success">
 Feuille en attente de validation
 </div>
 <p className="text-sm text-orange-700 mt-2">
 Votre chef d'équipe doit valider votre soumission avant que vous puissiez continuer.
 </p>
 </div>
 )}

 {/* Afficher si validée avec score */}
 {estValidee && progression?.score !== null && (
 <div className="p-4 bg-green-50/20 border border-green-200 rounded-lg text-center">
 <div className="text-3xl mb-2">✅</div>
 <div className="font-semibold text-status-success">
 Feuille validée !
 </div>
 <div className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-status-success mt-2">
 {progression.score}/100
 </div>
 </div>
 )}

 {/* Statistiques */}
 <div className="grid grid-cols-2 gap-4">
 <div className="p-4 bg-cream-50 rounded-lg text-center">
 <div className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-blue-500">
 {sessions.length}
 </div>
 <div className="text-sm text-ink-light">Session{sessions.length > 1 ? 's' : ''}</div>
 </div>
 <div className="p-4 bg-cream-50 rounded-lg text-center">
 <div className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-blue-500">
 {tempsTotal} min
 </div>
 <div className="text-sm text-ink-light">Temps total</div>
 </div>
 </div>

 {/* Nouvelle synthèse simplifiée */}
 {!estValidee && !estEnAttente && scoresLocaux.length > 0 && (
 <div className="space-y-4">
 {/* En-tête : Résumé de Travail */}
 <div className="border border-border rounded-lg p-4">
 <h3 className="text-lg font-bold text-ink mb-3">📋 Résumé de Travail</h3>
 
 {/* Informations de la feuille */}
 {progression && (
 <div className="space-y-1 text-sm">
 <div className="flex items-center gap-2 text-ink flex-wrap">
 <span className="font-semibold">{progression.niveau?.nom || 'Niveau'}</span>
 <span>•</span>
 <span>{progression.sujet?.nom || 'Sujet'}</span>
 <span>•</span>
 <span>{progression.chapitre?.nom || 'Chapitre'}</span>
 </div>
 <div className="text-base font-semibold text-ink mt-2">
 {feuille.titre}
 </div>
 </div>
 )}
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
 {(scoreGlobal / 100).toFixed(2)}
 </div>
 <div className="text-xs text-ink-muted mt-1">
 sur {scoresLocaux.length} question{scoresLocaux.length > 1 ? 's' : ''}
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
 )}

 {/* Message d'info si pas de sessions */}
 {sessions.length === 0 && (
 <div className="p-4 bg-amber-50/20 border border-yellow-200 rounded-lg">
 <div className="flex items-start gap-3">
 <div className="text-2xl">ℹ️</div>
 <div className="flex-1 text-sm">
 <p className="text-status-success font-medium mb-1">
 Comment ça marche ?
 </p>
 <ol className="text-status-success space-y-1 list-decimal list-inside">
 <li>Allez sur"Mes Sessions" depuis la page d'accueil</li>
 <li>Enregistrez vos sessions d'entraînement quotidiennes</li>
 <li>Revenez ici quand vous avez terminé la feuille</li>
 <li>Entrez votre score et cliquez sur"Soumettre"</li>
 </ol>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="sticky bottom-0 bg-cream-50 border-t border-border p-6 flex gap-3">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-2 bg-cream-100 hover:bg-[#3d3b58] text-ink font-medium rounded-lg transition-colors"
 >
 Fermer
 </button>
 {!estValidee && !estEnAttente && progression && (
 <button
 onClick={handleValider}
 disabled={saving || scoresLocaux.length === 0}
 className="flex-1 px-4 py-2 bg-accent-light0 hover:bg-accent-light0 disabled:bg-slate-300 disabled:cursor-not-allowed text-ink font-medium rounded-lg transition-colors"
 >
 {saving ? 'Envoi...' : 'Soumettre pour validation'}
 </button>
 )}
 </div>
 </div>
 </div>
 );
}


/* ---------- Composant Chapitre ---------- */
function ChapitreSection({ chapitre, progressions, onOpenPdf, onProgressionUpdate }: { chapitre: Chapitre; progressions: Map<string, Progression>; onOpenPdf: (url: string) => void; onProgressionUpdate: () => void }) {
 const [isOpen, setIsOpen] = useState(false);
 
 return (
 <div className="mb-4">
 {/* Header cliquable du chapitre */}
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="w-full flex items-center justify-between gap-3 p-4 bg-cream-100 hover:bg-cream-200 rounded-lg transition-colors border border-border"
 >
 <div className="flex items-center gap-3">
 <div className="w-1 h-8 rounded-full"></div>
 <h3 className="text-lg font-bold text-ink">{chapitre.titre}</h3>
 <span className="text-sm text-ink-muted">
 ({chapitre.feuilles.length} feuille{chapitre.feuilles.length > 1 ? 's' : ''})
 </span>
 </div>
 
 {/* Icône chevron */}
 <svg 
 className={`w-5 h-5 text-ink-light transition-transform ${isOpen ? 'rotate-180' : ''}`}
 fill="none" 
 viewBox="0 0 24 24" 
 stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {/* Contenu dépliable */}
 {isOpen && (
 <div className="mt-3 ml-6">
 {chapitre.feuilles.length > 0 ? (
 <div className="space-y-3">
 {chapitre.feuilles.map((feuille) => (
 <FeuilleCard 
 key={feuille.id} 
 feuille={feuille} 
 progression={progressions.get(feuille.id) || null}
 onOpen={() => onOpenPdf(feuille.pdf_url)} 
 onUpdateProgression={onProgressionUpdate}
 />
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-ink-light border border-dashed border-border rounded-lg bg-cream-100">
 Aucune feuille d'entraînement pour ce chapitre
 </div>
 )}
 </div>
 )}
 </div>
 );
}


/* ---------- Composant Sujet ---------- */
function SujetSection({ sujet, progressions, onOpenPdf, onProgressionUpdate }: { sujet: Sujet; progressions: Map<string, Progression>; onOpenPdf: (url: string) => void; onProgressionUpdate: () => void }) {
 return (
 <div className="mb-12">
 {/* En-tête du sujet */}
 <div className="inline-block mb-6 px-6 py-3 rounded-full from-accent text-ink font-bold text-xl shadow-sm">
 {sujet.titre}
 </div>

 {/* Feuilles directes sous le sujet (sans chapitre intermédiaire) */}
 {(sujet.feuilles ?? []).length > 0 && (
 <div className="space-y-3 mb-8">
 {(sujet.feuilles ?? []).map((feuille) => (
 <FeuilleCard
 key={feuille.id}
 feuille={feuille}
 progression={progressions.get(feuille.id) || null}
 onOpen={() => onOpenPdf(feuille.pdf_url)}
 onUpdateProgression={onProgressionUpdate}
 />
 ))}
 </div>
 )}

 {/* Chapitres */}
 {sujet.chapitres.length > 0 ? (
 <div className="space-y-8">
 {sujet.chapitres.map((chapitre) => (
 <ChapitreSection key={chapitre.id} chapitre={chapitre} progressions={progressions} onOpenPdf={onOpenPdf} onProgressionUpdate={onProgressionUpdate} />
 ))}
 </div>
 ) : (sujet.feuilles ?? []).length === 0 ? (
 <div className="text-center py-12 text-ink-light border border-dashed border-border rounded-lg">
 Aucun chapitre pour ce sujet
 </div>
 ) : null}
 </div>
 );
}

/* ---------- Page principale ---------- */
export default function LibraryPage() {
 const router = useRouter();
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [niveaux, setNiveaux] = useState<Niveau[]>([]);
 const [niveauSelectionne, setNiveauSelectionne] = useState<string | null>(null);
 const [parcours, setParcours] = useState<Niveau | null>(null);
 const [progressions, setProgressions] = useState<Map<string, Progression>>(new Map());
 const [feuillesEnProgression, setFeuillesEnProgression] = useState<Array<{
 feuille: FeuilleEntrainement;
 progression: Progression;
 chapitre: string;
 }>>([]);
 const [progressionOuverte, setProgressionOuverte] = useState(false);
 const [parcoursOuvert, setParcoursOuvert] = useState(true);
 const [etapesParcours, setEtapesParcours] = useState<{numero: number; titre_snapshot: string; statut: string; validee_at: string | null}[]>([]);;

 // Chargement initial des niveaux
 useEffect(() => {
 (async () => {
 const result = await getNiveaux();
 if (result.error) {
 setError(result.error.message || 'Erreur lors du chargement');
 setLoading(false);
 return;
 }

 if (result.data && result.data.length > 0) {
 setNiveaux(result.data);
 // Sélectionner automatiquement le premier niveau
 setNiveauSelectionne(result.data[0].id);
 } else {
 setLoading(false);
 }
 })();
 }, []);

 // Chargement des feuilles en progression + parcours
 useEffect(() => {
 loadFeuillesEnProgression();
 (async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const { data } = await supabase
  .from('etape_parcours')
  .select('numero, titre_snapshot, statut, validee_at, chapitre_snapshot, clot_noeud, type')
  .eq('user_id', session.user.id)
  .order('numero', { ascending: true });
  if (data) setEtapesParcours(data);
 })();
 }, []);

 // Chargement du parcours quand un niveau est sélectionné
 useEffect(() => {
 if (!niveauSelectionne) return;

 (async () => {
 setLoading(true);
 
 // Récupérer la session (plus fiable que getUser)
 const { data: { session } } = await supabase.auth.getSession();
 
 if (!session || !session.user) {
 setError('Vous devez être connecté');
 setLoading(false);
 return;
 }

 const user = session.user;

 // Charger le parcours
 const result = await getParcoursComplet(niveauSelectionne);
 if (result.error) {
 setError(result.error.message || 'Erreur lors du chargement du parcours');
 } else {
 setParcours(result.data);
 
 // ========================================
 // NOUVEAU : Charger progressions + feuilles autorisées
 // ========================================
 if (result.data) {
 // Vérifier si membre d'une équipe et charger TOUTES les feuilles autorisées
 const { data: membre } = await supabase
 .from('membre_equipe')
 .select('id')
 .eq('user_id', user.id)
 .single();

 // Charger les feuilles autorisées (plusieurs feuilles possibles)
 let feuillesAutoriseesIds = new Set<string>();
 if (membre) {
 const { data: autorisees } = await supabase
 .from('feuilles_autorisees')
 .select('feuille_id')
 .eq('membre_id', membre.id);
 
 if (autorisees) {
 feuillesAutoriseesIds = new Set(autorisees.map(a => a.feuille_id));
 }
 }

 // Charger progressions
 const { data: progressionsData } = await supabase
 .from('progression_feuille')
 .select(`
 *,
 sessions:session_travail(*)
 `)
 .eq('user_id', user.id);

 const progMap = new Map<string, Progression>();

 // Remplir avec les progressions existantes
 if (progressionsData) {
 progressionsData.forEach((prog: any) => {
 // Calculer si la feuille est bloquée
 // Bloquée = membre d'équipe ET (pas autorisée ET pas validée)
 const estBloquee = membre && 
 !feuillesAutoriseesIds.has(prog.feuille_id) && 
 prog.statut !== 'validee';

 progMap.set(prog.feuille_id, {
 id: prog.id,
 feuille_id: prog.feuille_id,
 est_termine: prog.est_termine,
 score: prog.score,
 temps_total: prog.temps_total || 0,
 sessions: prog.sessions || [],
 statut: prog.statut,
 commentaire_chef: prog.commentaire_chef,
 est_bloquee: estBloquee,
 });
 });
 }

 // Si membre d'équipe, bloquer TOUTES les feuilles non autorisées
 if (membre) {
 const bloquerFeuille = (feuille: any) => {
 if (!progMap.has(feuille.id)) {
 progMap.set(feuille.id, {
 id: '',
 feuille_id: feuille.id,
 est_termine: false,
 score: null,
 temps_total: 0,
 sessions: [],
 statut: null,
 commentaire_chef: null,
 est_bloquee: !feuillesAutoriseesIds.has(feuille.id),
 });
 }
 };
 result.data.sujets.forEach((sujet: any) => {
 (sujet.feuilles ?? []).forEach(bloquerFeuille);
 sujet.chapitres.forEach((chapitre: any) => {
 chapitre.feuilles.forEach(bloquerFeuille);
 });
 });
 }

 setProgressions(progMap);
 }
 }
 setLoading(false);
 })();
 }, [niveauSelectionne]);

 // Ouvrir un PDF
 const handleOpenPdf = (url: string) => {
 window.open(url, '_blank');
 };

 // Recharger la progression après mise à jour
 const handleProgressionUpdate = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !session.user) return;
 
 // Recharger UNIQUEMENT les progressions
 const { data: progressionsData } = await supabase
 .from('progression_feuille')
 .select(`
 *,
 sessions:session_travail(*)
 `)
 .eq('user_id', session.user.id);

 if (!progressionsData) return;

 // Mettre à jour la Map locale
 const newProgMap = new Map(progressions);

 progressionsData.forEach((prog: any) => {
 newProgMap.set(prog.feuille_id, {
 id: prog.id,
 feuille_id: prog.feuille_id,
 est_termine: prog.est_termine,
 score: prog.score,
 temps_total: prog.temps_total || 0,
 sessions: prog.sessions || [],
 statut: prog.statut || 'en_cours',
 commentaire_chef: prog.commentaire_chef,
 est_bloquee: newProgMap.get(prog.feuille_id)?.est_bloquee || false,
 });
 });

 setProgressions(newProgMap);
 await loadFeuillesEnProgression();
 };

 const loadFeuillesEnProgression = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !session.user) return;

 const { data, error } = await supabase
 .from('progression_feuille')
 .select(`
 id,
 feuille_id,
 statut,
 en_cours,
 est_termine,
 score,
 temps_total,
 commentaire_chef,
 noeud:noeud(
 id,
 titre,
 pdf_url,
 ordre,
 difficulte
 )
 `)
 .eq('user_id', session.user.id)
 .eq('en_cours', true);

 if (error) {
 console.error('Erreur chargement feuilles en progression:', error);
 return;
 }

 const feuilles = data?.map((item: any) => ({
 feuille: {
 id: item.noeud.id,
 titre: item.noeud.titre,
 description: null,
 pdf_url: item.noeud.pdf_url,
 ordre: item.noeud.ordre,
 ordre_dans_niveau: 0,
 difficulte: item.noeud.difficulte,
 },
 progression: {
 id: item.id,
 feuille_id: item.feuille_id,
 est_termine: item.est_termine,
 score: item.score,
 temps_total: item.temps_total,
 sessions: [],
 statut: item.statut || 'en_cours',
 commentaire_chef: item.commentaire_chef,
 },
 chapitre: 'Chapitre inconnu',
 })) || [];

 setFeuillesEnProgression(feuilles);
 };

 /* ---------- États de chargement / erreur ---------- */
 if (loading) {
 return (
 <div className="min-h-screen bg-cream-50 flex items-center justify-center">
 <div className="flex items-center gap-3 text-accent">
 <Loader />
 <span className="text-lg text-ink">Chargement du parcours…</span>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
 <div className="bg-red-100/30 border border-red-300/40 rounded-lg p-6 max-w-md">
 <h2 className="text-red-600 font-semibold mb-2">Erreur</h2>
 <p className="text-ink">{error}</p>
 <button
 onClick={() => location.reload()}
 className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-ink"
 >
 Réessayer
 </button>
 </div>
 </div>
 );
 }

 /* ---------- Rendu principal ---------- */
 return (
 <main className="min-h-screen bg-cream-50 text-ink transition-colors">
 <style jsx global>{`
 @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap');
 h1, h2, h3, h4, h5, h6, .font-mono { font-family: 'IBM Plex Mono', monospace; }
 body { font-family: 'Lora', serif; }
 p, span, div { font-family: 'Lora', serif; }
 `}</style>
 <div className="max-w-4xl mx-auto px-6 py-8">
 {/* Header */}
 <header className="mb-10">
 <div>
 <h1 className="text-3xl md:text-4xl font-[\'IBM_Plex_Mono\'] font-extrabold tracking-tight">
 <span className="text-ink">Parcours de </span>
 <span className="text-blue-500">Mathématiques</span>
 </h1>
 <p className="text-ink-light mt-2">Suis le chemin d'apprentissage étape par étape</p>
 </div>
 </header>

 {/* Section En Progression (pliable) */}
 {feuillesEnProgression.length > 0 && (
 <div className="mb-8 rounded-lg border border-status-success/30">
 <button
  onClick={() => setProgressionOuverte(v => !v)}
  className="w-full flex items-center justify-between px-6 py-4 rounded-lg hover:bg-status-success/5 transition-colors"
 >
  <h2 className="text-2xl font-['IBM_Plex_Mono'] font-bold text-status-success flex items-center gap-2">
  🔥 En Progression
  <span className="text-sm font-normal text-status-success/70">
   ({feuillesEnProgression.length})
  </span>
  </h2>
  <span className="text-status-success text-lg">{progressionOuverte ? '▼' : '▶'}</span>
 </button>
 {progressionOuverte && (
  <div className="px-6 pb-6 space-y-2">
  {feuillesEnProgression.map(({ feuille, progression }) => (
   <FeuilleCard
   key={feuille.id}
   feuille={feuille}
   progression={progression}
   onOpen={() => handleOpenPdf(feuille.pdf_url)}
   onUpdateProgression={handleProgressionUpdate}
   />
  ))}
  </div>
 )}
 </div>
 )}

 {/* Section Mon Parcours (pliable) */}
 <div className="mb-8 rounded-lg border border-border">
 <button
  onClick={() => setParcoursOuvert(v => !v)}
  className="w-full flex items-center justify-between px-6 py-4 rounded-lg hover:bg-cream-100 transition-colors"
 >
  <h2 className="text-2xl font-['IBM_Plex_Mono'] font-bold text-ink flex items-center gap-2">
  🗺 Mon Parcours
  {etapesParcours.length > 0 && (
   <span className="text-sm font-normal text-ink-muted">
   ({etapesParcours.length} étape{etapesParcours.length > 1 ? 's' : ''})
   </span>
  )}
  </h2>
  <span className="text-ink-light text-lg">{parcoursOuvert ? '▼' : '▶'}</span>
 </button>
 {parcoursOuvert && (
  <div className="pb-4">
   <ParcoursTimeline etapes={etapesParcours} />
  </div>
 )}
 </div>

 {/* Sélecteur de niveau (si plusieurs niveaux disponibles) */}
 {niveaux.length > 1 && (
 <div className="mb-8">
 <label className="block text-sm font-medium mb-2 text-ink">Niveau</label>
 <select
 value={niveauSelectionne || ''}
 onChange={(e) => setNiveauSelectionne(e.target.value)}
 className="w-full max-w-xs px-4 py-2 rounded-lg border border-accent/30 bg-cream-50 border border-accent/30 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
 >
 {niveaux.map((niveau) => (
 <option key={niveau.id} value={niveau.id}>
 {niveau.titre}
 </option>
 ))}
 </select>
 </div>
 )}



 {/* Contenu du parcours */}
 {!parcours || !parcours.sujets || parcours.sujets.length === 0 ? (
 <div className="text-center text-ink-light py-20 bg-cream-50 bg-cream-50/50 rounded-lg border border-dashed border-border">
 <p className="text-lg mb-2">Aucun contenu disponible pour le moment</p>
 <p className="text-sm">Le parcours sera bientôt enrichi avec des exercices</p>
 </div>
 ) : (
 <div className="space-y-12">
 {parcours.sujets.map((sujet) => (
 <SujetSection key={sujet.id} sujet={sujet} progressions={progressions} onOpenPdf={handleOpenPdf} onProgressionUpdate={handleProgressionUpdate} />
 ))}
 </div>
 )}
 </div>
 </main>
 );
}