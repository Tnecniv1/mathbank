'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

import ModalObserverFeuilles from '@/components/ModalObserverFeuilles';
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

type Feuille = {
  id: string;
  ordre: number;
  titre: string;
  chapitre_id: string;
  chapitre_titre: string;
  sujet_id: string;
  sujet_titre: string;
  niveau_id: string;
  niveau_titre: string;
};

type FeuilleAutorisee = {
  feuille_id: string;
};

type Progression = {
  feuille_id: string;
  statut: string;
  score: number | null;
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

const Loader = () => (
  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"/>
  </svg>
);

/* ---------- Modal Gestion Feuilles ---------- */
function ModalGestionFeuilles({
  membre,
  onClose,
  onSave,
}: {
  membre: Membre;
  onClose: () => void;
  onSave: () => void;
}) {
  const [feuilles, setFeuilles] = useState<Feuille[]>([]);
  const [feuillesAutorisees, setFeuillesAutorisees] = useState<Set<string>>(new Set());
  const [progressions, setProgressions] = useState<Map<string, Progression>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Charger toutes les feuilles avec niveau, sujet, chapitre
      const { data: feuillesData } = await supabase
        .from('feuille_entrainement')
        .select(`
          id, ordre, titre,
          chapitre!inner(
            id, titre, 
            sujet!inner(
              id, titre,
              niveau!inner(id, titre, ordre)
            )
          )
        `)
        .order('ordre');

      if (feuillesData) {
        const feuillesFormatees = feuillesData.map((f: any) => ({
          id: f.id,
          ordre: f.ordre,
          titre: f.titre,
          chapitre_id: f.chapitre.id,
          chapitre_titre: f.chapitre.titre,
          sujet_id: f.chapitre.sujet.id,
          sujet_titre: f.chapitre.sujet.titre,
          niveau_id: f.chapitre.sujet.niveau.id,
          niveau_titre: f.chapitre.sujet.niveau.titre,
        }));
        setFeuilles(feuillesFormatees);
      }

      // Charger feuilles autorisées
      const { data: autorisees } = await supabase
        .from('feuilles_autorisees')
        .select('feuille_id')
        .eq('membre_id', membre.membre_id);

      if (autorisees) {
        setFeuillesAutorisees(new Set(autorisees.map(a => a.feuille_id)));
      }

      // Charger progressions
      const { data: progsData } = await supabase
        .from('progression_feuille')
        .select('feuille_id, statut, score')
        .eq('user_id', membre.user_id);

      if (progsData) {
        const progMap = new Map();
        progsData.forEach(p => progMap.set(p.feuille_id, p));
        setProgressions(progMap);
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      alert('Erreur lors du chargement');
      setLoading(false);
    }
  }

  function toggleFeuille(feuilleId: string) {
    const newSet = new Set(feuillesAutorisees);
    if (newSet.has(feuilleId)) {
      newSet.delete(feuilleId);
    } else {
      newSet.add(feuilleId);
    }
    setFeuillesAutorisees(newSet);
  }

  function toggleAll(cocher: boolean) {
    if (cocher) {
      setFeuillesAutorisees(new Set(feuilles.map(f => f.id)));
    } else {
      setFeuillesAutorisees(new Set());
    }
  }

  async function handleSave() {
    try {
      setSaving(true);

      const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
        p_membre_id: membre.membre_id,
        p_feuilles_ids: Array.from(feuillesAutorisees),
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert(`✅ ${data.count} feuille(s) autorisée(s)`);
      onSave();
      onClose();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  // Grouper feuilles par niveau, puis sujet, puis chapitre
  const feuillesHierarchie = feuilles.reduce((acc, f) => {
    if (!acc[f.niveau_titre]) {
      acc[f.niveau_titre] = {};
    }
    if (!acc[f.niveau_titre][f.sujet_titre]) {
      acc[f.niveau_titre][f.sujet_titre] = {};
    }
    if (!acc[f.niveau_titre][f.sujet_titre][f.chapitre_titre]) {
      acc[f.niveau_titre][f.sujet_titre][f.chapitre_titre] = [];
    }
    acc[f.niveau_titre][f.sujet_titre][f.chapitre_titre].push(f);
    return acc;
  }, {} as Record<string, Record<string, Record<string, Feuille[]>>>);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 p-6">
          <h2 className="text-2xl font-bold text-white">Gérer les feuilles</h2>
          <p className="text-teal-100 mt-1">{membre.membre_nom}</p>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Actions rapides */}
          <div className="flex gap-3">
            <button
              onClick={() => toggleAll(true)}
              className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm font-medium"
            >
              ✓ Tout cocher
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              Tout décocher
            </button>
            <div className="ml-auto text-sm text-slate-600 dark:text-slate-400">
              {feuillesAutorisees.size} feuille(s) cochée(s)
            </div>
          </div>

          {/* Hiérarchie : Niveau → Sujet → Chapitre → Feuilles */}
          {Object.entries(feuillesHierarchie).map(([niveau, sujets]) => (
            <div key={niveau} className="space-y-5">
              {/* Titre du NIVEAU */}
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white bg-gradient-to-r from-teal-500 to-teal-600 text-transparent bg-clip-text">
                📚 {niveau}
              </h2>

              {/* SUJETS */}
              {Object.entries(sujets).map(([sujet, chapitres]) => (
                <div key={sujet} className="ml-4 space-y-4">
                  {/* Titre du SUJET */}
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-l-4 border-teal-500 pl-3">
                    {sujet}
                  </h3>

                  {/* CHAPITRES */}
                  {Object.entries(chapitres).map(([chapitre, feuillesChapitre]) => (
                    <div key={chapitre} className="ml-8 space-y-2">
                      {/* Titre du CHAPITRE */}
                      <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                        {chapitre}
                      </h4>

                      {/* FEUILLES */}
                      <div className="ml-6 space-y-2">
                        {feuillesChapitre.map(feuille => {
                          const estAutorisee = feuillesAutorisees.has(feuille.id);
                          const progression = progressions.get(feuille.id);
                          const estValidee = progression?.statut === 'validee';
                          const estEnAttente = progression?.statut === 'en_attente';

                          return (
                            <label
                              key={feuille.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                estAutorisee
                                  ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/20'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={estAutorisee}
                                onChange={() => toggleFeuille(feuille.id)}
                                className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />

                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-900 dark:text-slate-100">
                                    [{feuille.ordre}] {feuille.titre}
                                  </span>
                                  {/* Badges statut */}
                                  {estValidee && (
                                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded">
                                      🟣 Validée {progression.score ? `(${progression.score}/20)` : ''}
                                    </span>
                                  )}
                                  {estEnAttente && (
                                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                                      🟠 En attente
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Pastille */}
                              <div className="w-3 h-3 rounded-full" style={{
                                backgroundColor: estValidee ? '#9333ea' : estAutorisee ? '#f97316' : '#1e293b'
                              }} />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : '💾 Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
/* ---------- Page Gestion Équipe ---------- */
export default function GestionEquipePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [membreSelectionne, setMembreSelectionne] = useState<Membre | null>(null);
  const [showModalGestion, setShowModalGestion] = useState(false);
  const [equipeId, setEquipeId] = useState<string | null>(null);
  const [showObserverModal, setShowObserverModal] = useState(false);
  
  // États pour validation/rejet
  const [notificationSelectionnee, setNotificationSelectionnee] = useState<Notification | null>(null);
  const [showRejetModal, setShowRejetModal] = useState(false);
  const [commentaireRejet, setCommentaireRejet] = useState('');

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
        router.push('/auth');
        return;
      }

      // Charger l'équipe spécifique
      const { data: equipeData, error: equipeError } = await supabase
        .from('equipe')
        .select('*')
        .eq('id', equipeIdParam)
        .eq('chef_id', session.user.id)
        .single();

      if (equipeError || !equipeData) {
        alert('Équipe introuvable ou vous n\'êtes pas le chef');
        router.push('/personnel');
        return;
      }

      setEquipe(equipeData);

      // Charger les membres avec stats
      const { data: membresData } = await supabase
        .from('v_progression_membre')
        .select('*')
        .eq('equipe_id', equipeData.id)
        .order('joined_at', { ascending: false });

      setMembres(membresData || []);

      // Charger notifications filtrées pour cette équipe
      // 1. Charger toutes les notifications du chef
      const { data: allNotifsData } = await supabase
        .from('notification')
        .select('*')
        .eq('user_id', session.user.id)
        .in('type', ['demande_equipe', 'soumission_feuille'])
        .order('created_at', { ascending: false });

      // 2. Filtrer pour ne garder que celles de cette équipe
      const membreIds = (membresData || []).map(m => m.user_id);
      
      // Pour les soumissions, charger les progressions des membres
      const { data: progressionsData } = await supabase
        .from('progression_feuille')
        .select('id, user_id')
        .in('user_id', membreIds);
      
      const progressionIds = (progressionsData || []).map(p => p.id);
      
      const notifsFiltrees = (allNotifsData || []).filter(notif => {
        // Filtrer les notifications lues
        if (notif.lu) return false;
        
        // Pour les demandes : vérifier equipe_id dans metadata
        if (notif.type === 'demande_equipe') {
          return notif.metadata?.equipe_id === equipeData.id;
        }
        // Pour les soumissions : vérifier que la progression appartient à un membre
        if (notif.type === 'soumission_feuille') {
          return progressionIds.includes(notif.metadata?.progression_id);
        }
        return false;
      });

      setNotifications(notifsFiltrees);

      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }

  function handleGererFeuilles(membre: Membre) {
    setMembreSelectionne(membre);
    setShowModalGestion(true);
  }

  async function handleValiderSoumission(notification: Notification) {
    if (!confirm('Valider cette soumission ?')) return;

    try {
      const progressionId = notification.metadata?.progression_id;
      
      const { data, error } = await supabase.rpc('chef_valider_soumission', {
        p_progression_id: progressionId,
        p_score: null
      });

      if (error) throw error;
      // Marquer comme lue
      await supabase
        .from('notification')
        .update({ lu: true })
        .eq('id', notification.id);

      alert('✅ Soumission validée !');
      if (equipeId) loadData(equipeId);
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de la validation');
    }
  }

  function handleOuvrirRejet(notification: Notification) {
    setNotificationSelectionnee(notification);
    setCommentaireRejet('');
    setShowRejetModal(true);
  }

  async function handleRejeterSoumission() {
    if (!notificationSelectionnee) return;
    if (!commentaireRejet.trim()) {
      alert('Veuillez entrer un commentaire');
      return;
    }

    try {
      const progressionId = notificationSelectionnee.metadata?.progression_id;
      
      const { data, error } = await supabase.rpc('chef_refuser_soumission', {
        p_progression_id: progressionId,
        p_raison: commentaireRejet,
      });

      if (error) throw error;

      // Marquer comme lue
      await supabase
        .from('notification')
        .update({ lu: true })
        .eq('id', notificationSelectionnee.id);

      alert('Soumission rejetée');
      setShowRejetModal(false);
      setNotificationSelectionnee(null);
      setCommentaireRejet('');
      if (equipeId) loadData(equipeId);
    } catch (error: any) {
      console.error(error);
      alert('Erreur');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-teal-500">
          <Loader />
          <span className="text-lg">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!equipe) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Vous n'êtes pas chef d'une équipe
          </p>
          <button
            onClick={() => router.push('/personnel')}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const notifsNonLues = notifications.filter(n => !n.lu).length;
  const soumissionsEnAttente = membres.reduce((sum, m) => sum + (m.nb_soumissions_attente || 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/personnel')}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 mb-4"
          >
            ← Retour à Personnel
          </button>
          
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ backgroundColor: equipe.couleur }}
            >
              👥
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {equipe.nom}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {membres.length} membre{membres.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border-2 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <IconUser className="text-teal-600" />
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {membres.length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Membres</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border-2 border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-3">
              <IconBell className="text-orange-600" />
              <div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {soumissionsEnAttente}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Soumissions en attente</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <IconChart className="text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {notifsNonLues}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Notifications non lues</div>
              </div>
            </div>
          </div>
        </div>

        {/* Membres */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-slate-200 dark:border-slate-800 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              📋 Membres de l'équipe
            </h2>
            <button
              onClick={() => setShowObserverModal(true)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              🔍 Observer feuilles
            </button>
          </div>

          {membres.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Aucun membre pour le moment
            </div>
          ) : (
            <div className="space-y-3">
              {membres.map(membre => (
                <div
                  key={membre.membre_id}
                  className="p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-teal-400 dark:hover:border-teal-600 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                      {membre.membre_nom.charAt(0)}
                    </div>

                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {membre.membre_nom}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 flex gap-4">
                        <span>
                          {membre.nb_feuilles_validees}/{membre.nb_feuilles_autorisees} feuilles validées
                        </span>
                        {membre.score_moyen !== null && (
                          <span>Score moyen: {membre.score_moyen}/20</span>
                        )}
                      </div>
                      {membre.nb_soumissions_attente > 0 && (
                        <div className="mt-1">
                          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                            🟠 {membre.nb_soumissions_attente} soumission{membre.nb_soumissions_attente > 1 ? 's' : ''} en attente
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGererFeuilles(membre)}
                        className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <IconSettings />
                        Gérer les feuilles
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications de cette équipe */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            🔔 Notifications de l'équipe
          </h2>
          
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              Aucune notification pour cette équipe
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    notif.lu
                      ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                      : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {notif.type === 'demande_equipe' && '👤 '}
                      {notif.type === 'soumission_feuille' && '📝 '}
                      {notif.titre}
                    </h3>
                    {!notif.lu && (
                      <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded">
                        NOUVEAU
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {notif.message}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
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
                          onClick={() => handleValiderSoumission(notif)}
                          className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✓ Valider
                        </button>
                        <button
                          onClick={() => handleOuvrirRejet(notif)}
                          className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✗ Rejeter
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => router.push('/personnel')}
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-lg transition-colors"
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
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => router.push('/personnel')}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                Voir toutes les notifications ({notifsNonLues} non lues)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Gestion Feuilles */}
      {showModalGestion && membreSelectionne && (
        <ModalGestionFeuilles
          membre={membreSelectionne}
          onClose={() => {
            setShowModalGestion(false);
            setMembreSelectionne(null);
          }}
          onSave={() => {
            if (equipeId) loadData(equipeId); // Recharger après enregistrement
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Rejeter la soumission
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Expliquez pourquoi cette soumission est rejetée :
            </p>
            <textarea
              value={commentaireRejet}
              onChange={(e) => setCommentaireRejet(e.target.value)}
              placeholder="Votre commentaire..."
              className="w-full p-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800 outline-none resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejetModal(false);
                  setNotificationSelectionnee(null);
                  setCommentaireRejet('');
                }}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRejeterSoumission}
                disabled={!commentaireRejet.trim()}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Rejeter
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}