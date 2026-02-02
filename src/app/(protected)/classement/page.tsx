'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

type EquipeClassement = {
 equipe_id: string;
 equipe_nom: string;
 description: string | null;
 couleur: string;
 chef_id: string;
 chef_nom: string; // NOUVEAU
 nb_membres: number;
 nb_feuilles_validees: number;
 score_total: number;
};

type UtilisateurClassement = {
 user_id: string;
 full_name: string;
 equipe_id: string | null;
 equipe_nom: string | null;
 nb_feuilles_validees: number;
 score_total: number;
 score_moyen: number;
};

export default function ClassementPage() {
 const router = useRouter();
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<'equipes' | 'utilisateurs'>('equipes');
 
 const [equipes, setEquipes] = useState<EquipeClassement[]>([]);
 const [utilisateurs, setUtilisateurs] = useState<UtilisateurClassement[]>([]);
 const [monEquipeId, setMonEquipeId] = useState<string | null>(null);
 const [monUserId, setMonUserId] = useState<string | null>(null);
 
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showDemandeModal, setShowDemandeModal] = useState(false);
 const [equipeSelectionnee, setEquipeSelectionnee] = useState<EquipeClassement | null>(null);

 useEffect(() => {
 loadClassement();
 }, []);

 async function loadClassement() {
 try {
 setLoading(true);

 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !session.user) {
 router.push('/auth');
 return;
 }

 setMonUserId(session.user.id);

 // Récupérer mon équipe
 const { data: monMembre, error: membreError } = await supabase
 .from('membre_equipe')
 .select('equipe_id')
 .eq('user_id', session.user.id)
 .maybeSingle(); // maybeSingle() au lieu de single() pour gérer l'absence

 // Ignorer l'erreur si l'utilisateur n'est dans aucune équipe
 if (monMembre && !membreError) {
 setMonEquipeId(monMembre.equipe_id);
 }

 // Charger le classement des équipes
 const { data: equipesData, error: equipesError } = await supabase
 .from('v_classement_equipes')
 .select('*');

 if (equipesError) throw equipesError;
 setEquipes(equipesData || []);

 // Charger le classement des utilisateurs
 const { data: usersData, error: usersError } = await supabase
 .from('v_classement_utilisateurs')
 .select('*');

 if (usersError) throw usersError;
 setUtilisateurs(usersData || []);

 } catch (error: any) {
 console.error('Erreur chargement classement:', error);
 alert('Erreur de chargement');
 } finally {
 setLoading(false);
 }
 }

 async function handleDemanderCreation(nom: string, description: string) {
 try {
 const { data, error } = await supabase.rpc('demander_creation_equipe', {
 p_nom_equipe: nom,
 p_description: description || null,
 });

 if (error) throw error;

 if (!data.success) {
 alert(data.error);
 return;
 }

 alert('✅ Demande envoyée ! Un administrateur va examiner votre demande.');
 setShowCreateModal(false);
 loadClassement();
 } catch (error: any) {
 console.error(error);
 alert('Erreur lors de l\'envoi de la demande');
 }
 }

 async function handleDemanderRejoindre(equipe: EquipeClassement, message: string) {
 try {
 const { data, error } = await supabase.rpc('demander_rejoindre_equipe', {
 p_equipe_id: equipe.equipe_id,
 p_message: message || null,
 });

 if (error) throw error;

 if (!data.success) {
 alert(data.error);
 return;
 }

 alert(`✅ Demande envoyée à ${equipe.equipe_nom} !`);
 setShowDemandeModal(false);
 setEquipeSelectionnee(null);
 } catch (error: any) {
 console.error(error);
 alert('Erreur lors de l\'envoi de la demande');
 }
 }

 if (loading) {
 return (
 <main className="min-h-screen bg-cream-50 flex items-center justify-center">
 <div className="text-ink-light">Chargement...</div>
 </main>
 );
 }

 return (
 <div className="min-h-screen bg-cream-100 p-6">
 <style jsx global>{`
 @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap');
 h1, h2, h3, h4, h5, h6, .font-mono { font-family: 'IBM Plex Mono', monospace; }
 body { font-family: 'Lora', serif; background-color: var(--cream-100); }
 p, span, div { font-family: 'Lora', serif; }
 `}</style>
 <main className="bg-cream-50 rounded-lg shadow-sm py-8 px-6">
 <div className="max-w-6xl mx-auto">
 {/* Header */}
 <div className="mb-8 flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold text-ink mb-2">
 🏆 Classement
 </h1>
 <p className="text-ink-light">
 Suivez les performances des équipes et des participants
 </p>
 </div>

 <button
 onClick={() => setShowCreateModal(true)}
 className="px-6 py-3 bg-accent hover:hover:text-ink font-semibold rounded-lg shadow-sm transition-all"
 >
 📝 Demander création d'équipe
 </button>
 </div>

 {/* Tabs */}
 <div className="flex gap-2 mb-6 border-b border-border">
 <button
 onClick={() => setActiveTab('equipes')}
 className={`px-6 py-3 font-medium transition-colors relative ${
 activeTab === 'equipes'
 ? 'text-accent'
 : 'text-ink-light hover:text-ink'
 }`}
 >
 Équipes
 {activeTab === 'equipes' && (
 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
 )}
 </button>
 <button
 onClick={() => setActiveTab('utilisateurs')}
 className={`px-6 py-3 font-medium transition-colors relative ${
 activeTab === 'utilisateurs'
 ? 'text-accent'
 : 'text-ink-light hover:text-ink'
 }`}
 >
 Individuel
 {activeTab === 'utilisateurs' && (
 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
 )}
 </button>
 </div>

 {/* Contenu */}
 {activeTab === 'equipes' ? (
 <ClassementEquipes 
 equipes={equipes} 
 monEquipeId={monEquipeId}
 onDemanderRejoindre={(equipe) => {
 setEquipeSelectionnee(equipe);
 setShowDemandeModal(true);
 }}
 />
 ) : (
 <ClassementUtilisateurs 
 utilisateurs={utilisateurs} 
 monUserId={monUserId} 
 />
 )}

 {/* Modals */}
 {showCreateModal && (
 <ModalCreateEquipe
 onClose={() => setShowCreateModal(false)}
 onCreate={handleDemanderCreation}
 />
 )}

 {showDemandeModal && equipeSelectionnee && (
 <ModalDemandeRejoindre
 equipe={equipeSelectionnee}
 onClose={() => {
 setShowDemandeModal(false);
 setEquipeSelectionnee(null);
 }}
 onDemander={handleDemanderRejoindre}
 />
 )}
 </div>
 </main>
 </div>
 );
}

// Composant : Classement des équipes
function ClassementEquipes({ 
 equipes, 
 monEquipeId,
 onDemanderRejoindre
}: { 
 equipes: EquipeClassement[]; 
 monEquipeId: string | null;
 onDemanderRejoindre: (equipe: EquipeClassement) => void;
}) {
 const getMedaille = (rang: number) => {
 if (rang === 1) return '🥇';
 if (rang === 2) return '🥈';
 if (rang === 3) return '🥉';
 return `#${rang}`;
 };

 if (equipes.length === 0) {
 return (
 <div className="text-center py-12 bg-cream-50 rounded-lg border border-border">
 <div className="text-6xl mb-4">👥</div>
 <p className="text-ink-light">Aucune équipe pour le moment</p>
 <p className="text-sm text-ink-muted mt-2">
 Créez la première équipe !
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-3">
 {equipes.map((equipe, index) => {
 const rang = index + 1;
 const estMonEquipe = equipe.equipe_id === monEquipeId;
 const peutDemander = !monEquipeId && !estMonEquipe;

 return (
 <div
 key={equipe.equipe_id}
 className={`bg-cream-50 rounded-lg border p-4 sm:p-6 transition-all ${
 estMonEquipe
 ? 'border-blue-400 shadow-sm'
 : 'border-border'
 }`}
 >
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 {/* Rang et nom */}
 <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
 <div className="text-2xl sm:text-3xl font-bold w-10 sm:w-12 text-center flex-shrink-0">
 {getMedaille(rang)}
 </div>
 
 <div
 className="w-2 sm:w-3 h-10 sm:h-12 rounded-full flex-shrink-0"
 style={{ backgroundColor: equipe.couleur }}
 />
 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="text-lg sm:text-xl font-bold text-ink">
 {equipe.equipe_nom}
 </h3>
 {estMonEquipe && (
 <span className="text-xs font-medium px-2 py-1 bg-accent-light/50 text-accent rounded-full whitespace-nowrap">
 Mon équipe
 </span>
 )}
 </div>
 {equipe.description && (
 <p className="text-xs sm:text-sm text-ink-light mt-1 line-clamp-2">
 {equipe.description}
 </p>
 )}
 <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap text-xs sm:text-sm">
 <p className="text-ink-muted">
 {equipe.nb_membres} membre{equipe.nb_membres > 1 ? 's' : ''}
 </p>
 <span className="text-ink-muted">•</span>
 <p className="text-ink-light">
 👑 Chef : <span className="font-medium">{equipe.chef_nom || 'Inconnu'}</span>
 </p>
 </div>
 </div>
 </div>

 {/* Stats et action */}
 <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 flex-shrink-0">
 <div className="text-center">
 <div className="text-3xl font-bold text-accent">
 {equipe.score_total}
 </div>
 <div className="text-xs text-ink-muted">Points</div>
 </div>
 
 <div className="text-center">
 <div className="text-lg font-semibold text-ink">
 {equipe.nb_feuilles_validees}
 </div>
 <div className="text-xs text-ink-muted">Validées</div>
 </div>

 {peutDemander && (
 <button
 onClick={() => onDemanderRejoindre(equipe)}
 className="px-4 py-2 bg-green-50/20 hover:bg-green-200 text-status-success font-medium rounded-lg transition-colors"
 >
 Rejoindre
 </button>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 );
}

// Composant : Classement des utilisateurs
function ClassementUtilisateurs({ 
 utilisateurs, 
 monUserId 
}: { 
 utilisateurs: UtilisateurClassement[]; 
 monUserId: string | null;
}) {
 const getMedaille = (rang: number) => {
 if (rang === 1) return '🥇';
 if (rang === 2) return '🥈';
 if (rang === 3) return '🥉';
 return `#${rang}`;
 };

 if (utilisateurs.length === 0) {
 return (
 <div className="text-center py-12 bg-cream-50 rounded-lg border border-border">
 <div className="text-6xl mb-4">👤</div>
 <p className="text-ink-light">Aucun participant pour le moment</p>
 </div>
 );
 }

 return (
 <div className="space-y-2">
 {utilisateurs.map((user, index) => {
 const rang = index + 1;
 const estMoi = user.user_id === monUserId;

 return (
 <div
 key={user.user_id}
 className={`bg-cream-50 rounded-lg border p-4 transition-all ${
 estMoi
 ? 'border-blue-400 shadow-sm'
 : 'border-border'
 }`}
 >
 <div className="flex items-center justify-between">
 {/* Rang et nom */}
 <div className="flex items-center gap-4 flex-1">
 <div className="text-2xl font-bold w-10 text-center">
 {getMedaille(rang)}
 </div>
 
 <div>
 <div className="flex items-center gap-2">
 <span className="font-semibold text-ink">
 {user.full_name || 'Utilisateur'}
 </span>
 {estMoi && (
 <span className="text-xs font-medium px-2 py-0.5 bg-accent-light/50 text-accent rounded-full">
 Vous
 </span>
 )}
 </div>
 {user.equipe_nom && (
 <p className="text-sm text-ink-muted">
 {user.equipe_nom}
 </p>
 )}
 </div>
 </div>

 {/* Stats */}
 <div className="flex gap-6 text-center">
 <div>
 <div className="text-2xl font-bold text-accent">
 {user.score_total}
 </div>
 <div className="text-xs text-ink-muted">Points</div>
 </div>
 
 <div>
 <div className="font-semibold text-ink">
 {user.nb_feuilles_validees}
 </div>
 <div className="text-xs text-ink-muted">Validées</div>
 </div>

 <div>
 <div className="font-semibold text-ink">
 {user.score_moyen}
 </div>
 <div className="text-xs text-ink-muted">Moy.</div>
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 );
}

// Modal : Demander création d'équipe
function ModalCreateEquipe({ onClose, onCreate }: any) {
 const [nom, setNom] = useState('');
 const [description, setDescription] = useState('');

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-cream-50 rounded-lg p-6 max-w-md w-full">
 <h2 className="text-2xl font-bold text-ink mb-2">
 Demander la création d'une équipe
 </h2>
 <p className="text-sm text-ink-light mb-4">
 Votre demande sera examinée par un administrateur
 </p>

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-1">
 Nom de l'équipe <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 required
 value={nom}
 onChange={(e) => setNom(e.target.value)}
 placeholder="Les Matheux"
 className="w-full border border-border rounded-lg p-3 bg-cream-50 text-ink"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1">Description (optionnelle)</label>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Pourquoi souhaitez-vous créer cette équipe ?"
 rows={3}
 className="w-full border border-border rounded-lg p-3 bg-cream-50 text-ink"
 />
 </div>

 <div className="flex gap-3 pt-2">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-3 bg-cream-50 hover:bg-cream-200 text-ink font-semibold rounded-lg transition-colors"
 >
 Annuler
 </button>
 <button
 onClick={() => onCreate(nom, description)}
 disabled={!nom.trim()}
 className="flex-1 px-4 py-3 bg-accent hover:hover:text-ink font-semibold rounded-lg disabled:opacity-50 transition-all"
 >
 📝 Envoyer la demande
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}

// Modal : Demander à rejoindre
function ModalDemandeRejoindre({ equipe, onClose, onDemander }: any) {
 const [message, setMessage] = useState('');

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-cream-50 rounded-lg p-6 max-w-md w-full">
 <h2 className="text-2xl font-bold text-ink mb-4">
 Rejoindre {equipe.equipe_nom}
 </h2>

 <div className="space-y-4">
 <div className="p-4 bg-cream-50 rounded-lg">
 <div className="flex items-center gap-3 mb-2">
 <div className="w-3 h-8 rounded-full" style={{ backgroundColor: equipe.couleur }} />
 <div>
 <div className="font-semibold text-ink">
 {equipe.equipe_nom}
 </div>
 <div className="text-sm text-ink-light">
 {equipe.nb_membres} membre{equipe.nb_membres > 1 ? 's' : ''}
 </div>
 </div>
 </div>
 {equipe.description && (
 <p className="text-sm text-ink-light">
 {equipe.description}
 </p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium mb-1">
 Message (optionnel)
 </label>
 <textarea
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 placeholder="Bonjour, je souhaite rejoindre votre équipe..."
 rows={3}
 className="w-full border border-border rounded-lg p-3 bg-cream-50 text-ink"
 />
 </div>

 <div className="flex gap-3">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-3 bg-cream-50 hover:bg-cream-200 text-ink font-semibold rounded-lg transition-colors"
 >
 Annuler
 </button>
 <button
 onClick={() => onDemander(equipe, message)}
 className="flex-1 px-4 py-3 from-green-600 to-emerald-600 text-ink font-semibold rounded-lg transition-all"
 >
 Envoyer la demande
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}