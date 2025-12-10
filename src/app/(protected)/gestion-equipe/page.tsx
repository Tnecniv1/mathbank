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

/* ---------- Modal Gestion Feuilles ---------- */
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
  // États
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Feuilles disponibles par type
  const [feuillesMecaniques, setFeuillesMecaniques] = useState<any[]>([]);
  const [feuillesChaotiques, setFeuillesChaotiques] = useState<any[]>([]);
  
  // Feuilles actuellement autorisées
  const [feuilleMecaAutorisee, setFeuilleMecaAutorisee] = useState<any>(null);
  const [feuilleChaosAutorisee, setFeuilleChaosAutorisee] = useState<any>(null);
  
  // Sélections pour ajout
  const [selectedMeca, setSelectedMeca] = useState<string>('');
  const [selectedChaos, setSelectedChaos] = useState<string>('');

  useEffect(() => {
    if (membre) {
      loadData();
    }
  }, [membre]);

  async function loadData() {
    try {
      setLoading(true);

      // 1. Charger toutes les feuilles avec leur type ET ordre de niveau
      const { data: toutesLesFeuilles } = await supabase
        .from('feuille_entrainement')
        .select(`
          id,
          ordre,
          titre,
          type,
          chapitre!inner(
            sujet!inner(
              niveau!inner(titre, ordre)
            )
          )
        `)
        .order('ordre');

      // 1.bis Charger les feuilles VALIDÉES (est_termine = true) par ce membre
      const { data: feuillesValidees } = await supabase
        .from('progression_feuille')
        .select('feuille_id')
        .eq('user_id', membre.user_id)
        .eq('est_termine', true);

      const idsValidees = new Set(feuillesValidees?.map(p => p.feuille_id) || []);

      // Après la ligne 165 (après .order('ordre'))
      console.log('🔍 TOUTES les feuilles chaotiques lycée:', 
        toutesLesFeuilles
          ?.filter((f: any) => f.type === 'chaotique' && f.chapitre?.sujet?.niveau?.titre === 'lycée')
          .map((f: any) => ({ 
            id: f.id, 
            titre: f.titre,
            est_validee: idsValidees.has(f.id)
          }))
      );

      if (toutesLesFeuilles) {
        const mecaniques: any[] = [];
        const chaotiques: any[] = [];

        toutesLesFeuilles.forEach((f: any) => {
          // FILTRER : Ne pas afficher les feuilles déjà validées
          if (idsValidees.has(f.id)) {
            return; // Skip cette feuille
          }

          const feuille = {
            id: f.id,
            ordre: f.ordre,
            titre: f.titre,
            type: f.type,
            niveau_titre: f.chapitre?.sujet?.niveau?.titre || 'N/A',
            niveau_ordre: f.chapitre?.sujet?.niveau?.ordre || 999,
          };

          if (f.type === 'mecanique') {
            mecaniques.push(feuille);
          } else if (f.type === 'chaotique') {
            chaotiques.push(feuille);
          }
        });

        // Trier par niveau puis par ordre
        mecaniques.sort((a, b) => a.niveau_ordre - b.niveau_ordre || a.ordre - b.ordre);
        chaotiques.sort((a, b) => a.niveau_ordre - b.niveau_ordre || a.ordre - b.ordre);

        setFeuillesMecaniques(mecaniques);
        console.log('🔍 Feuilles mécaniques finales:', mecaniques.length, mecaniques.map(f => f.titre));
        console.log('🔍 Feuilles chaotiques finales:', chaotiques.length, chaotiques.map(f => f.titre));

        setFeuillesChaotiques(chaotiques);
      }

      // 2. Charger les feuilles actuellement autorisées (NON validées uniquement)
      const { data: autorisees } = await supabase
        .from('feuilles_autorisees')
        .select(`
          feuille_id,
          feuille_entrainement!inner(titre, type)
        `)
        .eq('membre_id', membre.membre_id);

      if (autorisees) {
        // Pour chaque feuille autorisée, vérifier si elle est validée
        const autoriseesFiltrees = await Promise.all(
          autorisees.map(async (a: any) => {
            // Vérifier le statut de progression pour ce membre
            const { data: progression } = await supabase
              .from('progression_feuille')
              .select('statut')
              .eq('user_id', membre.user_id)
              .eq('feuille_id', a.feuille_id)
              .single();

            // ✅ Garder uniquement si PAS validée
            const estValidee = progression?.statut === 'validee';
            return estValidee ? null : a;
          })
        );

        // Filtrer les null et créer les détails
        autoriseesFiltrees.filter(Boolean).forEach((a: any) => {
          const detail = {
            feuille_id: a.feuille_id,
            type: a.feuille_entrainement.type,
            titre: a.feuille_entrainement.titre,
          };

          if (detail.type === 'mecanique') {
            setFeuilleMecaAutorisee(detail);
          } else if (detail.type === 'chaotique') {
            setFeuilleChaosAutorisee(detail);
          }
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement:', error);
      alert('Erreur lors du chargement des données');
      setLoading(false);
    }
  }

  async function handleAutoriser(type: 'mecanique' | 'chaotique') {
    const feuilleId = type === 'mecanique' ? selectedMeca : selectedChaos;
    
    if (!feuilleId) {
      alert('Veuillez sélectionner une feuille');
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
        p_membre_id: membre.membre_id,
        p_feuilles_a_ajouter: [feuilleId],
        p_feuilles_a_retirer: [],
      });

      if (error) throw error;

      if (data && !data.success) {
        alert(data.error || 'Erreur lors de l\'autorisation');
        setSaving(false);
        return;
      }

      alert('✓ Feuille autorisée avec succès');
      await loadData();
      
      if (type === 'mecanique') {
        setSelectedMeca('');
      } else {
        setSelectedChaos('');
      }
      
      onSave();
    } catch (error: any) {
      console.error('Erreur autorisation:', error);
      alert('Erreur : ' + (error.message || 'Impossible d\'autoriser la feuille'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRetirer(type: 'mecanique' | 'chaotique') {
    const feuille = type === 'mecanique' ? feuilleMecaAutorisee : feuilleChaosAutorisee;
    
    if (!feuille) return;
    if (!confirm(`Retirer "${feuille.titre}" ?`)) return;

    try {
      setSaving(true);

      const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
        p_membre_id: membre.membre_id,
        p_feuilles_a_ajouter: [],
        p_feuilles_a_retirer: [feuille.feuille_id],
      });

      if (error) throw error;

      alert('✓ Feuille retirée');
      await loadData();
      onSave();
    } catch (error: any) {
      console.error('Erreur retrait:', error);
      alert('Erreur : ' + (error.message || 'Impossible de retirer la feuille'));
    } finally {
      setSaving(false);
    }
  }

  // Fonction pour grouper les feuilles par niveau
  function grouperParNiveau(feuilles: any[]) {
    const niveauxMap = new Map<string, any[]>();
    
    feuilles.forEach(f => {
      if (!niveauxMap.has(f.niveau_titre)) {
        niveauxMap.set(f.niveau_titre, []);
      }
      niveauxMap.get(f.niveau_titre)!.push(f);
    });

    return Array.from(niveauxMap.entries());
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <Loader />
        </div>
      </div>
    );
  }

  const niveauxMecaniques = grouperParNiveau(feuillesMecaniques);
  const niveauxChaotiques = grouperParNiveau(feuillesChaotiques);

  console.log('Feuilles chaotiques:', JSON.stringify(feuillesChaotiques.map(f => ({
    titre: f.titre, 
    niveau: f.niveau_titre,
    id: f.id
  })), null, 2));

  console.log('Niveaux chaotiques groupés:', JSON.stringify(niveauxChaotiques.map(([niveau, feuilles]) => 
    ({
      niveau: niveau,
      nb_feuilles: feuilles.length
    })
  ), null, 2));


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        
        <div className="p-6 border-b-2 border-gray-300">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Gérer les feuilles - {membre.membre_nom}
            </h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
              <IconX />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Maximum : 1 feuille mécanique + 1 feuille chaotique
          </p>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Section Mécanique */}
          <div className="border-2 border-blue-200 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-blue-100/50/20/10">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              🔧 Feuille Mécanique <span className="text-sm font-normal">(1 maximum)</span>
            </h3>

            {feuilleMecaAutorisee ? (
              <div className="mb-4 p-3 bg-green-100/30 border-2 border-green-300 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-green-900">✅ Actuellement autorisée :</div>
                    <div className="font-bold text-green-800 mt-1">{feuilleMecaAutorisee.titre}</div>
                  </div>
                  <button onClick={() => handleRetirer('mecanique')} disabled={saving} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-gray-900 text-sm font-medium rounded-lg transition-colors">
                    Retirer
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-100 border-2 border-gray-300 rounded-lg">
                <div className="text-sm text-gray-600">Aucune feuille mécanique autorisée</div>
              </div>
            )}

            {!feuilleMecaAutorisee && (
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">Choisir une feuille à autoriser :</label>
                <div className="flex gap-2">
                  <select 
                    value={selectedMeca} 
                    onChange={(e) => setSelectedMeca(e.target.value)} 
                    disabled={saving} 
                    className="flex-1 px-3 py-2 border-2 border-blue-300 rounded-lg bg-white text-gray-900 disabled:opacity-50"
                  >
                    <option value="">-- Sélectionner une feuille --</option>
                    {niveauxMecaniques.map(([niveau, feuilles]) => (
                      <optgroup key={niveau} label={niveau}>
                        {feuilles.map((f: any) => (
                          <option key={f.id} value={f.id}>
                            #{f.ordre} - {f.titre}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={() => handleAutoriser('mecanique')} disabled={!selectedMeca || saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-gray-900 font-medium rounded-lg transition-colors">
                    {saving ? 'Chargement...' : 'Autoriser'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section Chaotique */}
          <div className="border-2 border-purple-200 rounded-xl p-4 bg-gradient-to-br from-purple-50 to-purple-100/50/20/10">
            <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
              🎲 Feuille Chaotique <span className="text-sm font-normal">(1 maximum)</span>
            </h3>

            {feuilleChaosAutorisee ? (
              <div className="mb-4 p-3 bg-green-100/30 border-2 border-green-300 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-green-900">✅ Actuellement autorisée :</div>
                    <div className="font-bold text-green-800 mt-1">{feuilleChaosAutorisee.titre}</div>
                  </div>
                  <button onClick={() => handleRetirer('chaotique')} disabled={saving} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-gray-900 text-sm font-medium rounded-lg transition-colors">
                    Retirer
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-100 border-2 border-gray-300 rounded-lg">
                <div className="text-sm text-gray-600">Aucune feuille chaotique autorisée</div>
              </div>
            )}

            {!feuilleChaosAutorisee && (
              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">Choisir une feuille à autoriser :</label>
                <div className="flex gap-2">
                  <select 
                    value={selectedChaos} 
                    onChange={(e) => setSelectedChaos(e.target.value)} 
                    disabled={saving} 
                    className="flex-1 px-3 py-2 border-2 border-purple-300 rounded-lg bg-white text-gray-900 disabled:opacity-50"
                  >
                    <option value="">-- Sélectionner une feuille --</option>
                    {niveauxChaotiques.map(([niveau, feuilles]) => (
                      <optgroup key={niveau} label={niveau}>
                        {feuilles.map((f: any) => (
                          <option key={f.id} value={f.id}>
                            #{f.ordre} - {f.titre}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={() => handleAutoriser('chaotique')} disabled={!selectedChaos || saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-gray-900 font-medium rounded-lg transition-colors">
                    {saving ? 'Chargement...' : 'Autoriser'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t-2 border-gray-300">
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-100 hover:bg-slate-300 text-gray-800 font-medium rounded-lg transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const [showRejetModal, setShowRejetModal] = useState(false);
  const [notificationSelectionnee, setNotificationSelectionnee] = useState<Notification | null>(null);
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
        router.push('/connexion');
        return;
      }

      setUserId(session.user.id);

      // Charger l'équipe spécifique
      const { data: equipeData, error: equipeError } = await supabase
        .from('equipe')
        .select('*')
        .eq('id', equipeIdParam)
        .eq('chef_id', session.user.id)
        .single();

      if (equipeError || !equipeData) {
        alert('Équipe introuvable ou vous n\'êtes pas le chef');
        router.push('/classement');
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

      // Charger les notifications
      const { data: notifsData } = await supabase
        .from('notification')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('lu', false)
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

  async function handleValiderSoumission(notif: Notification) {
    if (!confirm('Valider cette soumission ?')) return;

    try {
      const { error } = await supabase.rpc('valider_soumission_feuille', {
        p_notification_id: notif.id,
        p_user_id: notif.metadata.user_id,
        p_feuille_id: notif.metadata.feuille_id,
        p_score: notif.metadata.score,
      });

      if (error) throw error;

      alert('✓ Soumission validée');
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
      setNotificationSelectionnee(null);
      setCommentaireRejet('');
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
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap');
        h1, h2, h3, h4, h5, h6, .font-mono { font-family: 'IBM Plex Mono', monospace; }
        body { font-family: 'Lora', serif; }
        p, span, div { font-family: 'Lora', serif; }
      `}</style>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gestion de l'équipe
              </h1>
              <p className="text-gray-600 mt-2">
                Équipe : <span className="font-semibold" style={{ color: equipe.couleur }}>{equipe.nom}</span>
              </p>
            </div>
            <button
              onClick={() => router.push('/classement')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors"
            >
              ← Retour
            </button>
          </div>
        </div>

        {/* Liste des membres */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              👥 Membres de l'équipe ({membres.length})
            </h2>
            <button
              onClick={() => setShowObserverModal(true)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-gray-900 font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              🔍 Observer feuilles
            </button>
          </div>

          {membres.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucun membre pour le moment
            </div>
          ) : (
            <div className="space-y-3">
              {membres.map(membre => (
                <div
                  key={membre.membre_id}
                  className="p-4 border-2 border-gray-300 rounded-xl hover:border-teal-400 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-gray-900 font-bold text-lg">
                      {membre.membre_nom.charAt(0)}
                    </div>

                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {membre.membre_nom}
                      </div>
                      <div className="text-sm text-gray-600 flex gap-4">
                        <span>
                          {membre.nb_feuilles_validees}/{membre.nb_feuilles_autorisees} feuilles validées
                        </span>
                        {membre.score_moyen !== null && (
                          <span>Score moyen: {membre.score_moyen}/20</span>
                        )}
                      </div>
                      {membre.nb_soumissions_attente > 0 && (
                        <div className="mt-1">
                          <span className="px-2 py-1 bg-orange-100/30 text-orange-700 text-xs font-medium rounded">
                            🟠 {membre.nb_soumissions_attente} soumission{membre.nb_soumissions_attente > 1 ? 's' : ''} en attente
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleObserverProgression(membre)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-gray-900 font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <IconEye />
                        Observer
                      </button>
                      <button
                        onClick={() => handleGererFeuilles(membre)}
                        className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-gray-900 font-medium rounded-lg transition-colors flex items-center gap-2"
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
                          onClick={() => handleValiderSoumission(notif)}
                          className="px-3 py-1.5 bg-green-100/30 hover:bg-green-200/50 text-green-600 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✓ Valider
                        </button>
                        <button
                          onClick={() => handleOuvrirRejet(notif)}
                          className="px-3 py-1.5 bg-red-100/30 hover:bg-red-200/50 text-red-600 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✗ Rejeter
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

      {/* Modal Gestion Feuilles */}
      {showModalGestion && membreSelectionne && (
        <ModalGestionFeuilles
          membre={membreSelectionne}
          onClose={() => {
            setShowModalGestion(false);
            setMembreSelectionne(null);
          }}
          onSave={() => {
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
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors"
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
    </main>
  );
}