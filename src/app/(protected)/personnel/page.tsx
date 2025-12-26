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
  // ❌ SUPPRIMÉ : showValidationModal (validation directe maintenant)
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

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session || !session.user) {
        console.warn('Session invalide, redirection vers auth...');
        await supabase.auth.signOut();
        router.push('/auth');
        return;
      }

      setUserId(session.user.id);

      await loadUserInfo(session.user);
      await loadNotifications(session.user.id);
      await loadMonEquipe(session.user.id);
      await loadMesEquipes(session.user.id);

    } catch (error: any) {
      console.error('Erreur complète:', error);
      console.error('Message:', error.message);
      console.error('Code:', error.code);
      alert('Erreur de chargement. Voir console F12');
      console.error('Erreur chargement:', error);
      await supabase.auth.signOut();
      router.push('/auth');
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
      .select('id, nom, couleur')
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

      const { data, error } = await supabase.rpc('accepter_demande', {
        p_demande_id: demandeId,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('✅ Demande acceptée !');
      marquerCommeLue(notification.id);
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

  async function handleValiderSoumission(notification: Notification) {
    if (!confirm('Êtes-vous sûr de vouloir valider cette soumission ?')) return;

    try {
      const progressionId = notification.metadata?.progression_id;
      if (!progressionId) return;
      
      const { data, error } = await supabase.rpc('valider_soumission', {
        p_progression_id: progressionId,
        p_commentaire: null,
        p_prochaine_feuille_id: null, // ✅ Pas de feuille suivante obligatoire
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('✅ Soumission validée !');
      marquerCommeLue(notification.id);
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de la validation');
    }
  }

  // ❌ FONCTION SUPPRIMÉE : handleValiderAvecFeuille (plus nécessaire)

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

      alert('✅ Membre exclu');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur');
    }
  }

  async function handleSupprimerEquipe(equipeId: string) {
    if (!confirm('⚠️ ATTENTION : Supprimer cette équipe supprimera également tous ses membres et leurs progressions. Êtes-vous sûr ?')) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('supprimer_equipe', {
        p_equipe_id: equipeId,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('✅ Équipe supprimée');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de la suppression');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  const notifsNonLues = notifications.filter(n => !n.lu).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300 shadow-xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            👤 Mon Espace Personnel
          </h1>
          <p className="text-gray-600">
            Gérez vos informations, équipes et notifications
          </p>
        </div>

        {/* Informations personnelles */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              📋 Mes Informations
            </h2>
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-md"
            >
              ✏️ Modifier
            </button>
          </div>

          {userInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoItem label="Email" value={userInfo.email} />
              <InfoItem label="Prénom" value={userInfo.first_name} />
              <InfoItem label="Nom" value={userInfo.last_name} />
              <InfoItem label="Date de naissance" value={userInfo.birth_date} />
              <InfoItem label="Adresse" value={userInfo.address} />
              <InfoItem label="Ville" value={userInfo.city} />
              <InfoItem label="Code postal" value={userInfo.postal_code} />
              <InfoItem label="Rôle" value={userInfo.role} />
            </div>
          ) : (
            <div className="text-gray-500">Aucune information disponible</div>
          )}
        </div>

        {/* Mon équipe */}
        {monEquipe && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-300 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              👥 Mon Équipe
            </h2>
            <div
              className="p-4 rounded-xl border-2 transition-colors"
              style={{ borderColor: monEquipe.couleur }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-gray-900">
                    {monEquipe.nom}
                  </div>
                  <div className="text-sm text-gray-600">
                    {monEquipe.nb_membres} membre{monEquipe.nb_membres > 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => router.push('/entrainement')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all shadow-lg"
                >
                  Accéder à l'entraînement →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mes équipes (si chef) - GRILLE 3x3 */}
        {isChef && mesEquipes.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-300 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              🏆 Mes Équipes (Chef)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mesEquipes.map(equipe => (
                <div
                  key={equipe.id}
                  className="p-4 rounded-xl border-2 transition-all hover:shadow-lg hover:scale-105"
                  style={{ borderColor: equipe.couleur }}
                >
                  {/* Nom et nombre de membres */}
                  <div className="mb-3">
                    <div className="text-lg font-bold text-gray-900 mb-1">
                      {equipe.nom}
                    </div>
                    <div className="text-sm text-gray-600">
                      {equipe.nb_membres} membre{equipe.nb_membres > 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Boutons empilés verticalement */}
                  <div className="space-y-2">
                    <button
                      onClick={() => router.push(`/gestion-equipe?id=${equipe.id}`)}
                      className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-md"
                    >
                      Gérer l'équipe
                    </button>
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
                        className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors"
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => handleSupprimerEquipe(equipe.id)}
                        className="flex-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 font-medium rounded-lg transition-colors"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications - GRILLE 3x3 avec SCROLL */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              🔔 Notifications
            </h2>
            {notifsNonLues > 0 && (
              <span className="px-3 py-1 bg-blue-500 text-white text-sm font-bold rounded-full shadow-md">
                {notifsNonLues} nouvelle{notifsNonLues > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucune notification pour le moment
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
              {notifications.map(notif => {
                const isDemandeEnAttente = notif.type === 'demande_rejointe' && !notif.lu;
                const isSoumissionEnAttente = notif.type === 'soumission_feuille' && !notif.lu;
                
                return (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border-2 transition-all hover:scale-105 flex flex-col ${
                      notif.lu
                        ? 'border-gray-300 bg-gray-50/50'
                        : 'border-blue-200 bg-blue-50/20 shadow-md'
                    }`}
                  >
                    {/* Header avec badge */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {notif.type === 'demande_rejointe' && '👤 '}
                        {notif.type === 'soumission_feuille' && '📝 '}
                        {notif.type === 'demande_acceptee' && '✅ '}
                        {notif.type === 'demande_refusee' && '❌ '}
                        {notif.titre}
                      </h3>
                      {!notif.lu && (
                        <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded shadow-sm whitespace-nowrap ml-2">
                          NOUVEAU
                        </span>
                      )}
                    </div>

                    {/* Message */}
                    <p className="text-sm text-gray-600 mb-3 flex-1">
                      {notif.message}
                    </p>

                    {/* Date */}
                    <span className="text-xs text-gray-500 mb-3 block">
                      {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    
                    {/* Boutons d'action empilés */}
                    {isDemandeEnAttente && (
                      <div className="space-y-2">
                        <button
                          onClick={() => handleAccepterDemande(notif)}
                          className="w-full px-3 py-2 bg-green-100/30 hover:bg-green-200/50 text-green-600 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✓ Accepter
                        </button>
                        <button
                          onClick={() => handleRefuserDemande(notif)}
                          className="w-full px-3 py-2 bg-red-100/30 hover:bg-red-200/50 text-red-600 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✗ Refuser
                        </button>
                      </div>
                    )}

                    {isSoumissionEnAttente && (
                      <div className="space-y-2">
                        <button
                          onClick={() => handleValiderSoumission(notif)}
                          className="w-full px-3 py-2 bg-green-100/30 hover:bg-green-200/50 text-green-600 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✓ Valider
                        </button>
                        <button
                          onClick={() => {
                            setNotificationSelectionnee(notif);
                            setShowRejetModal(true);
                          }}
                          className="w-full px-3 py-2 bg-red-100/30 hover:bg-red-200/50 text-red-600 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✗ Rejeter
                        </button>
                      </div>
                    )}
                    
                    {notif.lu && (
                      <span className="text-xs text-gray-400 italic text-center">
                        Notification traitée
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEditModal && (
        <ModalEditUserInfo
          data={editData}
          onChange={setEditData}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveUserInfo}
        />
      )}

      {showEditEquipeModal && equipeSelectionnee && (
        <ModalEditEquipe
          data={editEquipeData}
          onChange={setEditEquipeData}
          onClose={() => {
            setShowEditEquipeModal(false);
            setEquipeSelectionnee(null);
          }}
          onSave={handleSaveEquipe}
        />
      )}

      {/* ❌ MODAL SUPPRIMÉ : ModalValidationAvecFeuille (validation directe) */}

      {showRejetModal && notificationSelectionnee && (
        <ModalRejet
          onClose={() => {
            setShowRejetModal(false);
            setNotificationSelectionnee(null);
          }}
          onRejeter={handleRejeterSoumission}
        />
      )}
    </div>
  );
}

/* ---------- COMPOSANTS AUXILIAIRES ---------- */

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-gray-900 font-medium">
        {value || <span className="text-gray-400 italic">Non renseigné</span>}
      </div>
    </div>
  );
}

/* ---------- MODALS ---------- */

function ModalEditUserInfo({
  data,
  onChange,
  onClose,
  onSave,
}: {
  data: UserInfo;
  onChange: (data: UserInfo) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Modifier mes informations
        </h2>

        <div className="space-y-4">
          <InputField
            label="Prénom"
            value={data.first_name}
            onChange={(v) => onChange({ ...data, first_name: v })}
          />
          <InputField
            label="Nom"
            value={data.last_name}
            onChange={(v) => onChange({ ...data, last_name: v })}
          />
          <InputField
            label="Date de naissance"
            type="date"
            value={data.birth_date}
            onChange={(v) => onChange({ ...data, birth_date: v })}
          />
          <InputField
            label="Adresse"
            value={data.address}
            onChange={(v) => onChange({ ...data, address: v })}
          />
          <InputField
            label="Ville"
            value={data.city}
            onChange={(v) => onChange({ ...data, city: v })}
          />
          <InputField
            label="Code postal"
            value={data.postal_code}
            onChange={(v) => onChange({ ...data, postal_code: v })}
          />
          <InputField
            label="Rôle"
            value={data.role}
            onChange={(v) => onChange({ ...data, role: v })}
            placeholder="Élève, Étudiant, Professionnel..."
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalEditEquipe({
  data,
  onChange,
  onClose,
  onSave,
}: {
  data: { nom: string; description: string; couleur: string };
  onChange: (data: any) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Modifier l'équipe
        </h2>

        <div className="space-y-4">
          <InputField
            label="Nom de l'équipe"
            value={data.nom}
            onChange={(v) => onChange({ ...data, nom: v })}
          />
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Description
            </label>
            <textarea
              value={data.description}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Couleur
            </label>
            <input
              type="color"
              value={data.couleur}
              onChange={(e) => onChange({ ...data, couleur: e.target.value })}
              className="w-full h-12 rounded-xl cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={!data.nom}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-all shadow-lg"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2 text-gray-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-2 border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
      />
    </div>
  );
}

function ModalRejet({
  onClose,
  onRejeter,
}: {
  onClose: () => void;
  onRejeter: (commentaire: string) => void;
}) {
  const [commentaire, setCommentaire] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Rejeter la soumission
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Expliquez pourquoi cette soumission est rejetée :
        </p>
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Votre commentaire..."
          className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none resize-none"
          rows={4}
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => onRejeter(commentaire)}
            disabled={!commentaire.trim()}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-md"
          >
            Rejeter
          </button>
        </div>
      </div>
    </div>
  );
}

// ❌ COMPOSANT SUPPRIMÉ : ModalValidationAvecFeuille (validation directe sans sélection de feuille)