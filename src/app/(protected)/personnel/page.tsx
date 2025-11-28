'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

/* ---------- TYPES ---------- */
type Notification = {
  id: string;
  type: string;
  titre: string;
  message: string;
  lu: boolean;
  metadata: any;
  created_at: string;
};

type MonEquipe = {
  id: string;
  nom: string;
  couleur: string;
  nb_membres: number;
};

type Membre = {
  user_id: string;
  full_name: string;
  joined_at: string;
};

type UserInfo = {
  email: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  address: string;
  city: string;
  postal_code: string;
  role: string;
};

type Feuille = {
  id: string;
  titre: string;
  ordre: number;
};

/* ---------- COMPOSANT PRINCIPAL ---------- */
export default function PersonnelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Données
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [monEquipe, setMonEquipe] = useState<MonEquipe | null>(null);
  const [isChef, setIsChef] = useState(false);
  const [mesEquipes, setMesEquipes] = useState<MonEquipe[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Modals
  const [showRejetModal, setShowRejetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditEquipeModal, setShowEditEquipeModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showAcceptationModal, setShowAcceptationModal] = useState(false); // NOUVEAU
  const [notificationSelectionnee, setNotificationSelectionnee] = useState<Notification | null>(null);
  const [equipeSelectionnee, setEquipeSelectionnee] = useState<MonEquipe | null>(null);
  
  // État pour l'édition des infos
  const [editData, setEditData] = useState<UserInfo>({
    email: '',
    first_name: '',
    last_name: '',
    birth_date: '',
    address: '',
    city: '',
    postal_code: '',
    role: '',
  });

  // État pour l'édition d'équipe
  const [editEquipeData, setEditEquipeData] = useState({
    nom: '',
    description: '',
    couleur: '#3B82F6',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        router.push('/auth');
        return;
      }

      setUserId(session.user.id);

      // Charger les données
      await loadUserInfo(session.user);
      await loadNotifications(session.user.id);
      await loadMonEquipe(session.user.id);
      await loadMesEquipes(session.user.id);

    } catch (error: any) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserInfo(user: any) {
    const { data, error } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Erreur chargement profil:', error);
      return;
    }

    const prefs = data?.preferences || {};
    const info: UserInfo = {
      email: user.email || '',
      first_name: prefs.first_name || '',
      last_name: prefs.last_name || '',
      birth_date: prefs.birth_date || '',
      address: prefs.address || '',
      city: prefs.city || '',
      postal_code: prefs.postal_code || '',
      role: prefs.role || '',
    };

    setUserInfo(info);
    setEditData(info);
  }

  async function handleSaveUserInfo() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: `${editData.first_name} ${editData.last_name}`,
          preferences: {
            first_name: editData.first_name,
            last_name: editData.last_name,
            birth_date: editData.birth_date,
            address: editData.address,
            city: editData.city,
            postal_code: editData.postal_code,
            role: editData.role,
          },
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      alert('✅ Informations mises à jour !');
      setUserInfo(editData);
      setShowEditModal(false);
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de la mise à jour');
    }
  }

  async function handleSaveEquipe() {
    if (!equipeSelectionnee) return;

    try {
      const { error } = await supabase
        .from('equipe')
        .update({
          nom: editEquipeData.nom,
          description: editEquipeData.description || null,
          couleur: editEquipeData.couleur,
        })
        .eq('id', equipeSelectionnee.id);

      if (error) throw error;

      alert('✅ Équipe modifiée !');
      setShowEditEquipeModal(false);
      setEquipeSelectionnee(null);
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de la modification');
    }
  }

  async function loadNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notification')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    setNotifications(data || []);
  }

  async function loadMonEquipe(userId: string) {
    const { data: membre, error } = await supabase
      .from('membre_equipe')
      .select(`
        equipe:equipe(id, nom, couleur)
      `)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (membre && membre.equipe) {
      const { data: membresCount } = await supabase
        .from('membre_equipe')
        .select('user_id', { count: 'exact' })
        .eq('equipe_id', membre.equipe.id);

      setMonEquipe({
        id: membre.equipe.id,
        nom: membre.equipe.nom,
        couleur: membre.equipe.couleur,
        nb_membres: membresCount?.length || 0,
      });
    }
  }

  async function loadMesEquipes(userId: string) {
    const { data, error } = await supabase
      .from('equipe')
      .select('*')
      .eq('chef_id', userId);

    if (error) throw error;

    if (data && data.length > 0) {
      setIsChef(true);

      const equipesAvecNbMembres = await Promise.all(
        data.map(async (equipe) => {
          const { data: membresData } = await supabase
            .from('membre_equipe')
            .select('user_id', { count: 'exact' })
            .eq('equipe_id', equipe.id);

          return {
            id: equipe.id,
            nom: equipe.nom,
            couleur: equipe.couleur,
            nb_membres: membresData?.length || 0,
          };
        })
      );

      setMesEquipes(equipesAvecNbMembres);

      if (data.length > 0) {
        const equipeIds = data.map(e => e.id);
        const { data: membresData } = await supabase
          .from('membre_equipe')
          .select(`
            user_id,
            joined_at,
            equipe_id,
            profiles!inner(full_name)
          `)
          .in('equipe_id', equipeIds);

        if (membresData) {
          const membresFormatted = membresData.map((m: any) => ({
            user_id: m.user_id,
            full_name: m.profiles.full_name,
            joined_at: m.joined_at,
          }));
          setMembres(membresFormatted);
        }
      }
    }
  }

  async function handleAccepterDemande(notification: Notification) {
    try {
      const demandeId = notification.metadata?.demande_id;
      if (!demandeId) return;

      // NOUVEAU : Demander au chef de choisir la feuille de départ
      // Pour simplifier, on ouvre un modal pour sélectionner la feuille
      setNotificationSelectionnee(notification);
      setShowAcceptationModal(true);
    } catch (error: any) {
      console.error(error);
      alert('Erreur');
    }
  }

  // NOUVELLE FONCTION : Accepter avec feuille de départ
  async function handleAccepterAvecFeuille(feuilleDepart: string) {
    if (!notificationSelectionnee) return;

    try {
      const demandeId = notificationSelectionnee.metadata?.demande_id;
      
      const { data, error } = await supabase.rpc('accepter_demande', {
        p_demande_id: demandeId,
        p_feuille_depart_id: feuilleDepart,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('✅ Demande acceptée et feuille de départ définie !');
      marquerCommeLue(notificationSelectionnee.id);
      setShowAcceptationModal(false);
      setNotificationSelectionnee(null);
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de l\'acceptation');
    }
  }

  async function handleRefuserDemande(notification: Notification) {
    try {
      const demandeId = notification.metadata?.demande_id;
      if (!demandeId) return;

      const { data, error } = await supabase.rpc('refuser_demande', {
        p_demande_id: demandeId,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('Demande refusée');
      marquerCommeLue(notification.id);
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur');
    }
  }

  // MODIFICATION : Ouvrir le modal de validation avec sélection de feuille
  async function handleValiderSoumission(notification: Notification) {
    setNotificationSelectionnee(notification);
    setShowValidationModal(true);
  }

  // NOUVEAU : Valider avec choix de la prochaine feuille
  async function handleValiderAvecFeuille(
    prochaineFeuilleId: string,
    commentaire?: string
  ) {
    if (!notificationSelectionnee) return;

    try {
      const progressionId = notificationSelectionnee.metadata?.progression_id;
      
      const { data, error } = await supabase.rpc('valider_soumission', {
        p_progression_id: progressionId,
        p_commentaire: commentaire || null,
        p_prochaine_feuille_id: prochaineFeuilleId,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('✅ Soumission validée et prochaine feuille autorisée !');
      marquerCommeLue(notificationSelectionnee.id);
      setShowValidationModal(false);
      setNotificationSelectionnee(null);
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de la validation');
    }
  }

  async function handleRejeterSoumission(commentaire: string) {
    if (!notificationSelectionnee) return;

    try {
      const progressionId = notificationSelectionnee.metadata?.progression_id;
      if (!progressionId) return;

      const { data, error } = await supabase.rpc('rejeter_soumission', {
        p_progression_id: progressionId,
        p_commentaire: commentaire,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('Soumission rejetée');
      marquerCommeLue(notificationSelectionnee.id);
      setShowRejetModal(false);
      setNotificationSelectionnee(null);
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur');
    }
  }

  async function handleExcluireMembre(membreId: string, equipeId: string) {
    if (!confirm('Êtes-vous sûr de vouloir exclure ce membre ?')) return;

    try {
      const { data, error } = await supabase.rpc('exclure_membre', {
        p_membre_id: membreId,
        p_equipe_id: equipeId,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('Membre exclu');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur');
    }
  }

  async function handleQuitterEquipe() {
    if (!confirm('Êtes-vous sûr de vouloir quitter cette équipe ?')) return;

    try {
      const { data, error } = await supabase.rpc('quitter_equipe');

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('Vous avez quitté l\'équipe');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur');
    }
  }

  async function handleSupprimerEquipe(equipeId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette équipe ? Cette action est irréversible.')) return;

    try {
      const { data, error } = await supabase.rpc('supprimer_equipe', {
        p_equipe_id: equipeId,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('Équipe supprimée');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur');
    }
  }

  async function marquerCommeLue(notificationId: string) {
    await supabase
      .from('notification')
      .update({ lu: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, lu: true } : n)
    );
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'student': return '🎓 Étudiant';
      case 'teacher': return '👨‍🏫 Professeur';
      case 'parent': return '👨‍👩‍👧‍👦 Parent';
      default: return role;
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Chargement...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-8">
          👤 Mon Espace Personnel
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Colonne gauche : Infos et équipe */}
          <div className="space-y-6">
            {/* Informations personnelles */}
            {userInfo && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    ℹ️ Mes informations
                  </h2>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    Modifier
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm w-32">Nom complet :</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {userInfo.first_name && userInfo.last_name 
                        ? `${userInfo.first_name} ${userInfo.last_name}`
                        : <span className="italic text-slate-400">Non renseigné</span>
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm w-32">Email :</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {userInfo.email}
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm w-32">Naissance :</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {userInfo.birth_date 
                        ? new Date(userInfo.birth_date).toLocaleDateString('fr-FR')
                        : <span className="italic text-slate-400">Non renseignée</span>
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm w-32">Adresse :</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {userInfo.address || <span className="italic text-slate-400">Non renseignée</span>}
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm w-32">Ville :</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {userInfo.city 
                        ? `${userInfo.city}${userInfo.postal_code ? ` (${userInfo.postal_code})` : ''}`
                        : <span className="italic text-slate-400">Non renseignée</span>
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm w-32">Profil :</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {userInfo.role 
                        ? getRoleLabel(userInfo.role)
                        : <span className="italic text-slate-400">Non renseigné</span>
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Mon équipe (si membre) */}
            {monEquipe && !isChef && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  👥 Mon équipe
                </h2>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-12 rounded-full" style={{ backgroundColor: monEquipe.couleur }} />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {monEquipe.nom}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {monEquipe.nb_membres} membre{monEquipe.nb_membres > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleQuitterEquipe}
                  className="w-full px-4 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-medium rounded-lg transition-colors"
                >
                  Quitter l'équipe
                </button>
              </div>
            )}

            {/* Mes équipes (si chef) */}
            {isChef && mesEquipes.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  👑 Mes équipes
                </h2>
                <div className="space-y-3">
                  {mesEquipes.map(equipe => (
                    <div key={equipe.id} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: equipe.couleur }} />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {equipe.nom}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {equipe.nb_membres} membre{equipe.nb_membres > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEquipeSelectionnee(equipe);
                            setEditEquipeData({
                              nom: equipe.nom,
                              description: '',
                              couleur: equipe.couleur,
                            });
                            setShowEditEquipeModal(true);
                          }}
                          className="flex-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-lg transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleSupprimerEquipe(equipe.id)}
                          className="flex-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {membres.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Membres
                    </h3>
                    <div className="space-y-2">
                      {membres.map(membre => (
                        <div key={membre.user_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span className="text-sm text-slate-900 dark:text-slate-100">
                            {membre.full_name}
                          </span>
                          <button
                            onClick={() => handleExcluireMembre(membre.user_id, mesEquipes[0].id)}
                            className="px-3 py-1 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg transition-colors"
                          >
                            Exclure
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Colonne droite : Notifications */}
          <div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                🔔 Notifications
              </h2>

              {notifications.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  Aucune notification
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {notifications.map(notif => (
                    <NotificationCard
                      key={notif.id}
                      notification={notif}
                      onAccepter={handleAccepterDemande}
                      onRefuser={handleRefuserDemande}
                      onValider={handleValiderSoumission}
                      onRejeter={(notif) => {
                        setNotificationSelectionnee(notif);
                        setShowRejetModal(true);
                      }}
                      onMarquerLue={marquerCommeLue}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        {showRejetModal && (
          <ModalRejet
            onClose={() => {
              setShowRejetModal(false);
              setNotificationSelectionnee(null);
            }}
            onRejeter={handleRejeterSoumission}
          />
        )}

        {showEditModal && (
          <ModalEditInfo
            data={editData}
            onClose={() => setShowEditModal(false)}
            onChange={setEditData}
            onSave={handleSaveUserInfo}
          />
        )}

        {showEditEquipeModal && equipeSelectionnee && (
          <ModalEditEquipe
            equipe={equipeSelectionnee}
            data={editEquipeData}
            onClose={() => {
              setShowEditEquipeModal(false);
              setEquipeSelectionnee(null);
            }}
            onChange={setEditEquipeData}
            onSave={handleSaveEquipe}
          />
        )}

        {/* NOUVEAU : Modal de validation avec sélection de feuille */}
        {showValidationModal && notificationSelectionnee && (
          <ModalValidationAvecFeuille
            notification={notificationSelectionnee}
            onClose={() => {
              setShowValidationModal(false);
              setNotificationSelectionnee(null);
            }}
            onValider={handleValiderAvecFeuille}
          />
        )}

        {/* NOUVEAU : Modal d'acceptation avec sélection de feuille de départ */}
        {showAcceptationModal && notificationSelectionnee && (
          <ModalAcceptationAvecFeuille
            notification={notificationSelectionnee}
            onClose={() => {
              setShowAcceptationModal(false);
              setNotificationSelectionnee(null);
            }}
            onAccepter={handleAccepterAvecFeuille}
          />
        )}
      </div>
    </main>
  );
}

/* ---------- COMPOSANT : Carte de notification ---------- */
function NotificationCard({ 
  notification, 
  onAccepter, 
  onRefuser, 
  onValider, 
  onRejeter,
  onMarquerLue
}: any) {
  const getIcon = () => {
    switch (notification.type) {
      case 'demande_rejointe': return '🆕';
      case 'soumission_feuille': return '📝';
      case 'demande_acceptee': return '✅';
      case 'demande_refusee': return '❌';
      case 'feuille_validee': return '✅';
      case 'feuille_rejetee': return '❌';
      case 'exclusion_equipe': return '⚠️';
      default: return '📧';
    }
  };

  return (
    <div className={`p-4 rounded-xl border ${
      notification.lu 
        ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700' 
        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{getIcon()}</div>
        <div className="flex-1">
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            {notification.titre}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {notification.message}
          </p>

          {notification.type === 'demande_rejointe' && !notification.lu && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onAccepter(notification)}
                className="flex-1 px-3 py-2 bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-lg transition-colors"
              >
                Accepter
              </button>
              <button
                onClick={() => onRefuser(notification)}
                className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors"
              >
                Refuser
              </button>
            </div>
          )}

          {notification.type === 'soumission_feuille' && !notification.lu && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onValider(notification)}
                className="flex-1 px-3 py-2 bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-lg transition-colors"
              >
                Valider
              </button>
              <button
                onClick={() => onRejeter(notification)}
                className="flex-1 px-3 py-2 bg-orange-100 dark:bg-orange-900/20 hover:bg-orange-200 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-sm font-medium rounded-lg transition-colors"
              >
                Rejeter
              </button>
            </div>
          )}

          {!notification.lu && !['demande_rejointe', 'soumission_feuille'].includes(notification.type) && (
            <button
              onClick={() => onMarquerLue(notification.id)}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Marquer comme lu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- MODAL : Rejeter une soumission ---------- */
function ModalRejet({ onClose, onRejeter }: any) {
  const [commentaire, setCommentaire] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Rejeter la soumission
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Commentaire <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Expliquez ce qui doit être amélioré..."
              rows={4}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onRejeter(commentaire)}
              disabled={!commentaire}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-all"
            >
              Rejeter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- MODAL : Modifier les informations ---------- */
function ModalEditInfo({ data, onClose, onChange, onSave }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full my-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
          Modifier mes informations
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Prénom</label>
              <input
                type="text"
                value={data.first_name}
                onChange={(e) => onChange({ ...data, first_name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nom</label>
              <input
                type="text"
                value={data.last_name}
                onChange={(e) => onChange({ ...data, last_name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date de naissance</label>
            <input
              type="date"
              value={data.birth_date}
              onChange={(e) => onChange({ ...data, birth_date: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <input
              type="text"
              value={data.address}
              onChange={(e) => onChange({ ...data, address: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ville</label>
              <input
                type="text"
                value={data.city}
                onChange={(e) => onChange({ ...data, city: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Code postal</label>
              <input
                type="text"
                value={data.postal_code}
                onChange={(e) => onChange({ ...data, postal_code: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Profil</label>
            <div className="grid grid-cols-3 gap-3">
              <label
                className={`flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  data.role === 'parent'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="parent"
                  checked={data.role === 'parent'}
                  onChange={(e) => onChange({ ...data, role: e.target.value })}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-1">👨‍👩‍👧‍👦</div>
                  <div className="text-sm font-medium">Parent</div>
                </div>
              </label>

              <label
                className={`flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  data.role === 'student'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={data.role === 'student'}
                  onChange={(e) => onChange({ ...data, role: e.target.value })}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-1">🎓</div>
                  <div className="text-sm font-medium">Étudiant</div>
                </div>
              </label>

              <label
                className={`flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  data.role === 'teacher'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="teacher"
                  checked={data.role === 'teacher'}
                  onChange={(e) => onChange({ ...data, role: e.target.value })}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-1">👨‍🏫</div>
                  <div className="text-sm font-medium">Professeur</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onSave}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- MODAL : Modifier une équipe ---------- */
function ModalEditEquipe({ equipe, data, onClose, onChange, onSave }: any) {
  React.useEffect(() => {
    async function loadEquipeDetails() {
      const { data: equipeData } = await supabase
        .from('equipe')
        .select('description')
        .eq('id', equipe.id)
        .single();

      if (equipeData) {
        onChange({
          nom: equipe.nom,
          description: equipeData.description || '',
          couleur: equipe.couleur,
        });
      }
    }
    loadEquipeDetails();
  }, [equipe.id]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
          Modifier l'équipe
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nom de l'équipe <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={data.nom}
              onChange={(e) => onChange({ ...data, nom: e.target.value })}
              placeholder="Les Champions"
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={data.description}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              placeholder="Une équipe de passionnés..."
              rows={3}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Couleur de l'équipe
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={data.couleur}
                onChange={(e) => onChange({ ...data, couleur: e.target.value })}
                className="w-16 h-12 rounded-lg border-2 border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <div className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                <span className="font-mono text-sm text-slate-900 dark:text-slate-100">
                  {data.couleur}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onSave}
              disabled={!data.nom}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-all"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- MODAL : Validation avec sélection de feuille ---------- */
function ModalValidationAvecFeuille({ 
  notification, 
  onClose, 
  onValider 
}: {
  notification: Notification;
  onClose: () => void;
  onValider: (prochaineFeuilleId: string, commentaire?: string) => void;
}) {
  const [feuilles, setFeuilles] = useState<Feuille[]>([]);
  const [feuilleSelectionnee, setFeuilleSelectionnee] = useState<string>('');
  const [commentaire, setCommentaire] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeuilles() {
      const { data } = await supabase
        .from('feuille_entrainement')
        .select('id, titre, ordre')
        .order('ordre');
      
      setFeuilles(data || []);
      setLoading(false);
    }
    loadFeuilles();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Valider la soumission
        </h2>

        <div className="space-y-4">
          {/* Sélection de la prochaine feuille */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
              Prochaine feuille autorisée <span className="text-red-500">*</span>
            </label>
            {loading ? (
              <div className="text-sm text-slate-500">Chargement...</div>
            ) : (
              <select
                required
                value={feuilleSelectionnee}
                onChange={(e) => setFeuilleSelectionnee(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Choisir une feuille --</option>
                {feuilles.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.ordre}. {f.titre}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cette feuille sera la seule accessible par le membre
            </p>
          </div>

          {/* Commentaire optionnel */}
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
              Commentaire (optionnel)
            </label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Bon travail ! Continue comme ça."
              rows={3}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onValider(feuilleSelectionnee, commentaire)}
              disabled={!feuilleSelectionnee}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-all"
            >
              Valider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- MODAL : Acceptation avec sélection de feuille de départ ---------- */
function ModalAcceptationAvecFeuille({
  notification,
  onClose,
  onAccepter,
}: {
  notification: Notification;
  onClose: () => void;
  onAccepter: (feuilleDepart: string) => void;
}) {
  const [feuilles, setFeuilles] = useState<Feuille[]>([]);
  const [feuilleSelectionnee, setFeuilleSelectionnee] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeuilles() {
      const { data } = await supabase
        .from('feuille_entrainement')
        .select('id, titre, ordre')
        .order('ordre');
      
      setFeuilles(data || []);
      setLoading(false);
    }
    loadFeuilles();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Accepter dans l'équipe
        </h2>

        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Choisissez la feuille par laquelle ce membre doit commencer.
        </p>

        <div className="space-y-4">
          {/* Sélection de la feuille de départ */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
              Feuille de départ <span className="text-red-500">*</span>
            </label>
            {loading ? (
              <div className="text-sm text-slate-500">Chargement...</div>
            ) : (
              <select
                required
                value={feuilleSelectionnee}
                onChange={(e) => setFeuilleSelectionnee(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Choisir une feuille --</option>
                {feuilles.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.ordre}. {f.titre}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cette feuille sera la seule accessible au début
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onAccepter(feuilleSelectionnee)}
              disabled={!feuilleSelectionnee}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-all"
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}