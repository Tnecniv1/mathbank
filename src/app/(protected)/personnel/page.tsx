'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import ProfileCompletionModal from './_components/ProfileCompletionModal';

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

type UserInfo = {
 email: string;
 first_name: string;
 last_name: string;
 birth_date: string;
 address: string;
 city: string;
 postal_code: string;
 role: string;
 // Nouvelles colonnes
 pseudo: string;
 telephone: string;
 adresse: string;
 date_naissance: string;
 user_role: string;
};

/* ---------- COMPOSANT PRINCIPAL ---------- */
export default function PersonnelPage() {
 const router = useRouter();
 const [loading, setLoading] = useState(true);
 const [userId, setUserId] = useState<string | null>(null);
 
 // Données
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

 // Modals
 const [showRejetModal, setShowRejetModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showProfileModal, setShowProfileModal] = useState(false);

 // Accordéon
 const [openInfos, setOpenInfos] = useState(true);
 const [openNotifs, setOpenNotifs] = useState(false);
 const [notificationSelectionnee, setNotificationSelectionnee] = useState<Notification | null>(null);

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
 pseudo: '',
 telephone: '',
 adresse: '',
 date_naissance: '',
 user_role: '',
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
 .select('preferences, pseudo, telephone, adresse, date_naissance, user_role')
 .eq('user_id', user.id)
 .single();

 if (error) {
 console.error('Erreur chargement profil:', error);
 return;
 }

 const prefs = data?.preferences || {};
 const displayEmail = (user.email || '').endsWith('@mathbank.internal') ? '' : (user.email || '');
 const info: UserInfo = {
 email: displayEmail,
 first_name: prefs.first_name || '',
 last_name: prefs.last_name || '',
 birth_date: prefs.birth_date || '',
 address: prefs.address || '',
 city: prefs.city || '',
 postal_code: prefs.postal_code || '',
 role: prefs.role || '',
 pseudo: data?.pseudo || '',
 telephone: data?.telephone || '',
 adresse: data?.adresse || '',
 date_naissance: data?.date_naissance || '',
 user_role: data?.user_role || '',
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
 <div className="min-h-screen from-slate-900 to-slate-900 flex items-center justify-center">
 <div className="text-ink text-xl">Chargement...</div>
 </div>
 );
 }

 const notifsNonLues = notifications.filter(n => !n.lu).length;

 return (
 <div className="min-h-screen from-slate-900 to-slate-900 py-8 px-4">
 <div className="max-w-5xl mx-auto space-y-6">
 {/* En-tête */}
 <div className="bg-cream-50 rounded-lg p-6 border border-border shadow-sm">
 <h1 className="text-3xl font-bold text-ink mb-2">
 👤 Mon Espace Personnel
 </h1>
 <p className="text-ink-light">
 Gérez vos informations, équipes et notifications
 </p>
 </div>

 {/* Accordéon — Mes Informations */}
 <div className="bg-cream-50 rounded-lg border border-border shadow-sm overflow-hidden">
  <button
   type="button"
   onClick={() => setOpenInfos(!openInfos)}
   className="w-full flex justify-between items-center px-6 py-4 hover:bg-cream-100 transition-colors"
  >
   <h2 className="text-xl font-bold text-ink">📋 Mes Informations</h2>
   <span className="text-ink-muted text-lg">{openInfos ? '▲' : '▼'}</span>
  </button>
  {openInfos && (
   <div className="px-6 pb-6">
    <div className="flex justify-end gap-2 mb-4">
     <button
      onClick={() => setShowEditModal(true)}
      className="px-4 py-2 bg-accent-light0 hover:bg-accent text-ink font-medium rounded-lg transition-colors shadow-sm text-sm"
     >
      ✏️ Modifier
     </button>
     <button
      onClick={() => setShowProfileModal(true)}
      className="px-4 py-2 bg-[#185FA5] hover:bg-[#1450a3] text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
     >
      Modifier mes informations
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
      {userInfo.pseudo && <InfoItem label="Pseudo" value={userInfo.pseudo} />}
      {userInfo.telephone && <InfoItem label="Téléphone" value={userInfo.telephone} />}
      {userInfo.adresse && <InfoItem label="Adresse (profil)" value={userInfo.adresse} />}
      {userInfo.date_naissance && <InfoItem label="Date de naissance (profil)" value={userInfo.date_naissance} />}
      {userInfo.user_role && <InfoItem label="Profil" value={userInfo.user_role} />}
     </div>
    ) : (
     <div className="text-ink-muted">Aucune information disponible</div>
    )}
   </div>
  )}
 </div>

 {/* Accordéon — Notifications */}
 <div className="bg-cream-50 rounded-lg border border-border shadow-sm overflow-hidden">
  <button
   type="button"
   onClick={() => setOpenNotifs(!openNotifs)}
   className="w-full flex justify-between items-center px-6 py-4 hover:bg-cream-100 transition-colors"
  >
   <div className="flex items-center gap-3">
    <h2 className="text-xl font-bold text-ink">🔔 Notifications</h2>
    {notifsNonLues > 0 && (
     <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full">
      {notifsNonLues}
     </span>
    )}
   </div>
   <span className="text-ink-muted text-lg">{openNotifs ? '▲' : '▼'}</span>
  </button>
  {openNotifs && (
   <div className="px-6 pb-6">
    {notifications.length === 0 ? (
     <div className="text-center py-12 text-ink-muted">
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
         className={`p-4 rounded-lg border transition-all hover:scale-105 flex flex-col ${
          notif.lu
           ? 'border-border bg-cream-100/50'
           : 'border-border bg-accent-light/20 shadow-sm'
         }`}
        >
         <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-ink text-sm">
           {notif.type === 'demande_rejointe' && '👤 '}
           {notif.type === 'soumission_feuille' && '📝 '}
           {notif.type === 'demande_acceptee' && '✅ '}
           {notif.type === 'demande_refusee' && '❌ '}
           {notif.titre}
          </h3>
          {!notif.lu && (
           <span className="px-2 py-1 bg-accent-light0 text-ink text-xs font-bold rounded shadow-sm whitespace-nowrap ml-2">
            NOUVEAU
           </span>
          )}
         </div>
         <p className="text-sm text-ink-light mb-3 flex-1">{notif.message}</p>
         <span className="text-xs text-ink-muted mb-3 block">
          {new Date(notif.created_at).toLocaleDateString('fr-FR', {
           day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
         </span>
         {isDemandeEnAttente && (
          <div className="space-y-2">
           <button
            onClick={() => handleAccepterDemande(notif)}
            className="w-full px-3 py-2 bg-green-50/30 hover:bg-green-200/50 text-status-success text-sm font-medium rounded-lg transition-colors"
           >✓ Accepter</button>
           <button
            onClick={() => handleRefuserDemande(notif)}
            className="w-full px-3 py-2 bg-red-100/30 hover:bg-red-200/50 text-red-600 text-sm font-medium rounded-lg transition-colors"
           >✗ Refuser</button>
          </div>
         )}
         {isSoumissionEnAttente && (
          <div className="space-y-2">
           <button
            onClick={() => handleValiderSoumission(notif)}
            className="w-full px-3 py-2 bg-green-50/30 hover:bg-green-200/50 text-status-success text-sm font-medium rounded-lg transition-colors"
           >✓ Valider</button>
           <button
            onClick={() => { setNotificationSelectionnee(notif); setShowRejetModal(true); }}
            className="w-full px-3 py-2 bg-red-100/30 hover:bg-red-200/50 text-red-600 text-sm font-medium rounded-lg transition-colors"
           >✗ Rejeter</button>
          </div>
         )}
         {notif.lu && (
          <span className="text-xs text-gray-400 italic text-center">Notification traitée</span>
         )}
        </div>
       );
      })}
     </div>
    )}
   </div>
  )}
 </div>
 </div>

 {/* Modals */}
 {showProfileModal && (
 <ProfileCompletionModal
 closable={true}
 onClose={() => { setShowProfileModal(false); loadData(); }}
 initialData={{
 firstName: editData.first_name,
 lastName: editData.last_name,
 telephone: editData.telephone,
 adresse: editData.adresse,
 dateNaissance: editData.date_naissance,
 userRole: editData.user_role as any,
 }}
 />
 )}

 {showEditModal && (
 <ModalEditUserInfo
 data={editData}
 onChange={setEditData}
 onClose={() => setShowEditModal(false)}
 onSave={handleSaveUserInfo}
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
 <div className="text-sm font-medium text-ink-muted mb-1">{label}</div>
 <div className="text-ink font-medium">
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
 <div className="bg-cream-50 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
 <h2 className="text-2xl font-bold text-ink mb-4">
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
 className="flex-1 px-4 py-3 bg-cream-200 hover:bg-cream-200 text-ink font-semibold rounded-lg transition-colors"
 >
 Annuler
 </button>
 <button
 onClick={onSave}
 className="flex-1 px-4 py-3 bg-accent hover:bg-accent-hover text-ink font-semibold rounded-lg transition-all shadow-sm"
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
 <label className="block text-sm font-medium mb-2 text-ink">
 {label}
 </label>
 <input
 type={type}
 value={value}
 onChange={(e) => onChange(e.target.value)}
 placeholder={placeholder}
 className="w-full border border-border rounded-lg p-3 bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-blue-200 transition-all"
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
 <div className="bg-cream-50 rounded-lg p-6 max-w-md w-full shadow-2xl">
 <h2 className="text-2xl font-bold text-ink mb-4">
 Rejeter la soumission
 </h2>
 <p className="text-sm text-ink-light mb-4">
 Expliquez pourquoi cette soumission est rejetée :
 </p>
 <textarea
 value={commentaire}
 onChange={(e) => setCommentaire(e.target.value)}
 placeholder="Votre commentaire..."
 className="w-full p-3 border border-border rounded-lg bg-cream-50 text-ink focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none resize-none"
 rows={4}
 />
 <div className="flex gap-3 mt-4">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-2 bg-cream-200 hover:bg-cream-200 text-ink font-medium rounded-lg transition-colors"
 >
 Annuler
 </button>
 <button
 onClick={() => onRejeter(commentaire)}
 disabled={!commentaire.trim()}
 className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-ink font-medium rounded-lg transition-colors shadow-sm"
 >
 Rejeter
 </button>
 </div>
 </div>
 </div>
 );
}

// ❌ COMPOSANT SUPPRIMÉ : ModalValidationAvecFeuille (validation directe sans sélection de feuille)