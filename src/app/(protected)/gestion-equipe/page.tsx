'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

import ModalObserverFeuilles from '@/components/ModalObserverFeuilles';
import ModalGererFeuillesScope from '@/components/ModalGererFeuillesScope';

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

      // Charger l'équipe spécifique
      const { data: equipeDataArray, error: equipeError } = await supabase
        .from('equipe')
        .select('*')
        .eq('id', equipeIdParam)
        .eq('chef_id', session.user.id);

      if (equipeError) {
        console.error('Erreur équipe:', equipeError);
        alert('Erreur lors du chargement de l\'équipe');
        router.push('/classement');
        return;
      }

      if (!equipeDataArray || equipeDataArray.length === 0) {
        alert('Équipe introuvable ou vous n\'êtes pas le chef');
        router.push('/classement');
        return;
      }

      const equipeData = equipeDataArray[0];
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

        // Calculer le score global
        const { data: scoresEquipe } = await supabase
          .from('score_local')
          .select(`
            score_calcule,
            session_entrainement!inner(
              user_id,
              feuille_mecanique_id,
              feuille_chaotique_id
            )
          `);

        if (scoresEquipe) {
          console.log('📊 Nombre de scores équipe:', scoresEquipe?.length);

          // Calculer le score total et par membre (SANS filtre de validation)
          const scoreParMembre = new Map<string, number>();
          let scoreTotal = 0;

          scoresEquipe.forEach((score: any) => {
            const userId = score.session_entrainement.user_id;
            
            if (userIds.includes(userId)) {
              const scoreBrut = parseFloat(score.score_calcule) * 100;
              scoreTotal += scoreBrut;
              scoreParMembre.set(userId, (scoreParMembre.get(userId) || 0) + scoreBrut);
            }
          });

          setScoreGlobalEquipe(Math.round(scoreTotal));

          const contributions = Array.from(scoreParMembre.entries()).map(([userId, score]) => {
            const profile = profilesData?.find((p: any) => p.user_id === userId);
            return {
              user_id: userId,
              nom: profile?.full_name || 'Inconnu',
              score: Math.round(score)
            };
          }).sort((a, b) => b.score - a.score);

          setContributionsMembres(contributions);
          console.log('🏆 Score Global:', Math.round(scoreTotal));
          console.log('👥 Contributions:', contributions);
        }
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

  function handleObserverProgression(membre: Membre) {
    // Redirection vers /progression avec le user_id du membre en query param
    router.push(`/progression/observer/${membre.user_id}`);
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

      alert('✓ Soumission validée');
      setShowSyntheseModal(false);
      setSyntheseData(null);
      if (equipeId) loadData(equipeId);
    } catch (error) {
      console.error(error);
      alert('Erreur lors de la validation');
    }
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!equipe) return null;

  return (
    <main className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">




        {/* Liste des membres */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            👥 Membres de l'équipe ({membres.length})
          </h2>
          
          {membres.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucun membre pour le moment
            </div>
          ) : (
            <div className="space-y-3">
              {membres.map((membre: Membre) => (
                <div
                  key={membre.membre_id}
                  className="p-4 border-2 border-gray-300 rounded-xl hover:border-teal-400 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                      {membre.membre_nom.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-semibold text-gray-900 text-lg">
                      {membre.membre_nom}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleGererFeuilles(membre)}
                      className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors"
                    >
                      📄 Feuilles
                    </button>
                    <button
                      onClick={() => handleObserverProgression(membre)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                      📊 Progression
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Score Global de l'Équipe */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            🏆 Score Global de l'Équipe
          </h2>

          <div className="text-center mb-8">
            <div className="text-5xl font-bold text-teal-600 mb-2">
              {scoreGlobalEquipe}
            </div>
            <div className="text-sm text-gray-600">
              Score total de compétition
            </div>
          </div>

          {contributionsMembres.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700 mb-3">
                📊 Contribution de chaque membre
              </h3>
              {contributionsMembres.map((contrib, index) => {
                const pourcentage = scoreGlobalEquipe > 0 
                  ? Math.round((contrib.score / scoreGlobalEquipe) * 100) 
                  : 0;
                
                return (
                  <div key={contrib.user_id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          {contrib.nom}
                        </span>
                        <span className="text-sm font-semibold text-teal-600">
                          {contrib.score} pts ({pourcentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-teal-500 h-2 rounded-full transition-all"
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
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Aucune donnée de contribution disponible</p>
              <p className="text-xs text-gray-400 mt-1">
                Les membres doivent avoir des feuilles validées avec des scores
              </p>
            </div>
          )}
        </div>

        {/* Notifications de cette équipe */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            🔔 Notifications de l'équipe
          </h2>
          
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune notification pour cette équipe
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    notif.lu
                      ? 'border-gray-300 bg-gray-50/50'
                      : 'border-blue-200 bg-blue-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {notif.type === 'demande_equipe' && '👤 '}
                      {notif.type === 'soumission_feuille' && '📝 '}
                      {notif.titre}
                    </h3>
                    {!notif.lu && (
                      <span className="px-2 py-1 bg-blue-500 text-gray-900 text-xs font-bold rounded">
                        NOUVEAU
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {notif.message}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
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
                          className="px-3 py-1.5 bg-blue-100/30 hover:bg-blue-200/50 text-blue-600 text-sm font-medium rounded-lg transition-colors"
                        >
                          👁️ Voir détails
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => router.push('/personnel')}
                        className="px-3 py-1.5 bg-blue-100/30 hover:bg-blue-200/50 text-blue-600 text-sm font-medium rounded-lg transition-colors"
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
            <div className="mt-4 pt-4 border-t border-gray-300">
              <button
                onClick={() => router.push('/personnel')}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-gray-900 font-medium rounded-lg transition-colors"
              >
                Voir toutes les notifications ({notifsNonLues} non lues)
              </button>
            </div>
          )}
        </div>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Rejeter la soumission
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Expliquez pourquoi cette soumission est rejetée :
            </p>
            <textarea
              value={commentaireRejet}
              onChange={(e) => setCommentaireRejet(e.target.value)}
              placeholder="Votre commentaire..."
              className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejetModal(false);
                  setNotificationSelectionnee(null);
                  setCommentaireRejet('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRejeterSoumission}
                disabled={!commentaireRejet.trim()}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-gray-900 font-medium rounded-lg transition-colors"
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
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">
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
                className="text-white hover:bg-white/20 rounded-lg p-2 transition"
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
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-4xl mb-2">📭</div>
                      <p>Aucune question enregistrée pour cette feuille</p>
                    </div>
                  ) : (
                    <>
                      {/* Nouvelle synthèse simplifiée */}
                      <div className="space-y-4">
                        {/* En-tête : Résumé de Travail */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4">
                          <h3 className="text-lg font-bold text-gray-900 mb-3">📋 Résumé de Travail</h3>
                          
                          {/* Informations de la feuille */}
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-gray-700 flex-wrap">
                              <span className="font-semibold">{syntheseData.niveauNom || 'Niveau'}</span>
                              <span>•</span>
                              <span>{syntheseData.sujetNom || 'Sujet'}</span>
                              <span>•</span>
                              <span>{syntheseData.chapitreNom || 'Chapitre'}</span>
                            </div>
                            <div className="text-base font-semibold text-gray-900 mt-2">
                              {syntheseData.feuilleTitre}
                            </div>
                          </div>
                        </div>

                        {/* Volume de travail */}
                        <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">📊</span>
                            <h4 className="font-semibold text-gray-900">Volume de travail</h4>
                          </div>
                          <div className="text-gray-700">
                            <span className="font-bold text-blue-600">{nbSessions}</span> session{nbSessions > 1 ? 's' : ''} • <span className="font-bold text-blue-600">{tempsTotal}</span> minutes
                          </div>
                        </div>

                        {/* Niveau de maîtrise */}
                        <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">🎯</span>
                            <h4 className="font-semibold text-gray-900">Niveau de maîtrise</h4>
                          </div>

                          {/* Score Global */}
                          <div className="mb-4 pb-4 border-b border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">Score Global</div>
                            <div className="text-3xl font-bold text-blue-600">
                              {(syntheseData.scoreGlobal / 100).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              sur {syntheseData.scoresLocaux.length} question{syntheseData.scoresLocaux.length > 1 ? 's' : ''}
                            </div>
                          </div>

                          {/* Détail par composante */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              Détail par composante :
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                              <span className="text-sm text-gray-700">🧠 Compréhension</span>
                              <span className="text-lg font-bold text-blue-600">{scoreComprehension.toFixed(2)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                              <span className="text-sm text-gray-700">🛠️ Savoir-faire</span>
                              <span className="text-lg font-bold text-green-600">{scoreSavoir.toFixed(2)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                              <span className="text-sm text-gray-700">✍️ Rédaction</span>
                              <span className="text-lg font-bold text-purple-600">{scoreRedaction.toFixed(2)}</span>
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
              <div className="border-t border-gray-200 p-6 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowSyntheseModal(false);
                    setSyntheseData(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors"
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
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
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
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                >
                  ✓ Valider
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}