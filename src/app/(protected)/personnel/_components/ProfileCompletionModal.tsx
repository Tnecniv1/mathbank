'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Role = 'etudiant' | 'parent' | 'professeur' | '';

type Props = {
 closable?: boolean;
 onClose?: () => void;
 initialData?: {
  firstName?: string;
  lastName?: string;
  telephone?: string;
  adresse?: string;
  dateNaissance?: string;
  userRole?: Role;
 };
};

const ROLES: { value: Exclude<Role, ''>; emoji: string; label: string }[] = [
 { value: 'etudiant',    emoji: '🎓', label: 'Étudiant'    },
 { value: 'parent',      emoji: '👨‍👩‍👧',  label: 'Parent'      },
 { value: 'professeur',  emoji: '👨‍🏫', label: 'Professeur'  },
];

export default function ProfileCompletionModal({ closable = false, onClose, initialData }: Props) {
 const [form, setForm] = useState({
  firstName:    initialData?.firstName    ?? '',
  lastName:     initialData?.lastName     ?? '',
  email:        '',
  userRole:     (initialData?.userRole    ?? '') as Role,
  telephone:    initialData?.telephone    ?? '',
  adresse:      initialData?.adresse      ?? '',
  dateNaissance: initialData?.dateNaissance ?? '',
 });
 const [loading, setLoading] = useState(false);
 const [error, setError]     = useState<string | null>(null);

 async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);

  if (!form.firstName || !form.lastName || !form.email || !form.adresse || !form.dateNaissance) {
   setError('Tous les champs obligatoires (*) doivent être remplis.');
   return;
  }
  if (!form.userRole) {
   setError('Veuillez sélectionner votre profil.');
   return;
  }

  setLoading(true);
  try {
   const { data: { user }, error: authErr } = await supabase.auth.getUser();
   if (authErr || !user) throw new Error('Non authentifié');

   const { error: profileErr } = await supabase
    .from('profiles')
    .update({
     full_name:      `${form.firstName} ${form.lastName}`,
     telephone:      form.telephone || null,
     adresse:        form.adresse,
     date_naissance: form.dateNaissance,
     user_role:      form.userRole,
     profil_complet: true,
     preferences: {
      first_name: form.firstName,
      last_name:  form.lastName,
     },
    })
    .eq('user_id', user.id);

   if (profileErr) throw profileErr;

   const { error: emailErr } = await supabase.auth.updateUser({ email: form.email });
   if (emailErr) console.error('[ProfileModal] email update error:', emailErr);

   if (closable && onClose) {
    onClose();
   } else {
    window.location.reload();
   }
  } catch (err: any) {
   setError(err.message ?? 'Erreur lors de la sauvegarde');
  } finally {
   setLoading(false);
  }
 }

 const inputCls =
  'w-full border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent transition';

 return (
  <div
   className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
   onClick={closable ? undefined : (e) => e.stopPropagation()}
  >
   <div
    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
    onClick={(e) => e.stopPropagation()}
   >
    <div className="p-6 sm:p-8">
     {/* Header */}
     <div className="flex items-center justify-between mb-6">
      <div>
       <h2 className="text-2xl font-bold text-[#1A1A1A]">Complète ton profil</h2>
       <p className="text-sm text-gray-500 mt-1">Ces informations restent privées.</p>
      </div>
      {closable && onClose && (
       <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light ml-4"
        aria-label="Fermer"
       >
        ✕
       </button>
      )}
     </div>

     {error && (
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
       {error}
      </div>
     )}

     <form onSubmit={handleSubmit} className="space-y-4">
      {/* Prénom / Nom */}
      <div className="grid grid-cols-2 gap-4">
       <div>
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
         Prénom <span className="text-red-500">*</span>
        </label>
        <input
         type="text"
         required
         value={form.firstName}
         onChange={(e) => setForm({ ...form, firstName: e.target.value })}
         placeholder="Jean"
         className={inputCls}
        />
       </div>
       <div>
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
         Nom <span className="text-red-500">*</span>
        </label>
        <input
         type="text"
         required
         value={form.lastName}
         onChange={(e) => setForm({ ...form, lastName: e.target.value })}
         placeholder="Dupont"
         className={inputCls}
        />
       </div>
      </div>

      {/* Email réel */}
      <div>
       <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
        Email réel <span className="text-red-500">*</span>
       </label>
       <input
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="jean.dupont@gmail.com"
        className={inputCls}
       />
      </div>

      {/* Sélecteur rôle */}
      <div>
       <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
        Je suis <span className="text-red-500">*</span>
       </label>
       <div className="grid grid-cols-3 gap-3">
        {ROLES.map((r) => (
         <button
          key={r.value}
          type="button"
          onClick={() => setForm({ ...form, userRole: r.value })}
          className={`flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer transition-all text-sm font-medium ${
           form.userRole === r.value
            ? 'border-[#185FA5] bg-blue-50 text-[#185FA5]'
            : 'border-[#E8E8E8] hover:border-[#185FA5]/50 text-[#1A1A1A]'
          }`}
         >
          <span className="text-2xl mb-1">{r.emoji}</span>
          {r.label}
         </button>
        ))}
       </div>
      </div>

      {/* Téléphone */}
      <div>
       <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
        Téléphone
       </label>
       <input
        type="text"
        value={form.telephone}
        onChange={(e) => setForm({ ...form, telephone: e.target.value })}
        placeholder="06 00 00 00 00"
        className={inputCls}
       />
      </div>

      {/* Date de naissance */}
      <div>
       <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
        Date de naissance <span className="text-red-500">*</span>
       </label>
       <input
        type="date"
        required
        value={form.dateNaissance}
        onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })}
        className={inputCls}
       />
      </div>

      {/* Adresse */}
      <div>
       <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
        Adresse <span className="text-red-500">*</span>
       </label>
       <input
        type="text"
        required
        value={form.adresse}
        onChange={(e) => setForm({ ...form, adresse: e.target.value })}
        placeholder="123 rue de la Paix, 75001 Paris"
        className={inputCls}
       />
      </div>

      <button
       type="submit"
       disabled={loading}
       className="w-full py-3 bg-[#185FA5] text-white font-semibold rounded-lg hover:bg-[#1450a3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
      >
       {loading ? 'Sauvegarde...' : 'Valider mon profil'}
      </button>
     </form>
    </div>
   </div>
  </div>
 );
}
