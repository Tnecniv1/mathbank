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
      const { data: monMembre } = await supabase
        .from('membre_equipe')
        .select('equipe_id')
        .eq('user_id', session.user.id)
        .single();

      if (monMembre) {
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

  async function handleCreateEquipe(nom: string, description: string, couleur: string) {
    try {
      const { data, error } = await supabase.rpc('create_equipe', {
        p_nom: nom,
        p_description: description,
        p_couleur: couleur,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('✅ Équipe créée avec succès !');
      setShowCreateModal(false);
      loadClassement();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de la création');
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
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Chargement...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              🏆 Classement
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Suivez les performances des équipes et des participants
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg transition-all"
          >
            ➕ Créer une équipe
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('equipes')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'equipes'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Équipes
            {activeTab === 'equipes' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('utilisateurs')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'utilisateurs'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Individuel
            {activeTab === 'utilisateurs' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
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
            onCreate={handleCreateEquipe}
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
      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="text-6xl mb-4">👥</div>
        <p className="text-slate-600 dark:text-slate-400">Aucune équipe pour le moment</p>
        <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
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
            className={`bg-white dark:bg-slate-900 rounded-xl border-2 p-6 transition-all ${
              estMonEquipe
                ? 'border-blue-400 dark:border-blue-600 shadow-lg'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              {/* Rang et nom */}
              <div className="flex items-center gap-4 flex-1">
                <div className="text-3xl font-bold w-12 text-center">
                  {getMedaille(rang)}
                </div>
                
                <div
                  className="w-3 h-12 rounded-full flex-shrink-0"
                  style={{ backgroundColor: equipe.couleur }}
                />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {equipe.equipe_nom}
                    </h3>
                    {estMonEquipe && (
                      <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
                        Mon équipe
                      </span>
                    )}
                  </div>
                  {equipe.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {equipe.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                      {equipe.nb_membres} membre{equipe.nb_membres > 1 ? 's' : ''}
                    </p>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      👑 Chef : <span className="font-medium">{equipe.chef_nom || 'Inconnu'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats et action */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {equipe.score_total}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Points</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {equipe.nb_feuilles_validees}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Validées</div>
                </div>

                {peutDemander && (
                  <button
                    onClick={() => onDemanderRejoindre(equipe)}
                    className="px-4 py-2 bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 font-medium rounded-lg transition-colors"
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
      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="text-6xl mb-4">👤</div>
        <p className="text-slate-600 dark:text-slate-400">Aucun participant pour le moment</p>
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
            className={`bg-white dark:bg-slate-900 rounded-xl border-2 p-4 transition-all ${
              estMoi
                ? 'border-blue-400 dark:border-blue-600 shadow-lg'
                : 'border-slate-200 dark:border-slate-800'
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
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {user.full_name || 'Utilisateur'}
                    </span>
                    {estMoi && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
                        Vous
                      </span>
                    )}
                  </div>
                  {user.equipe_nom && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {user.equipe_nom}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {user.score_total}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Points</div>
                </div>
                
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {user.nb_feuilles_validees}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Validées</div>
                </div>

                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {user.score_moyen}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Moy.</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Modal : Créer une équipe
function ModalCreateEquipe({ onClose, onCreate }: any) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [couleur, setCouleur] = useState('#3B82F6');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Créer une équipe
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Les Matheux"
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de l'équipe..."
              rows={3}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Couleur</label>
            <input
              type="color"
              value={couleur}
              onChange={(e) => setCouleur(e.target.value)}
              className="w-full h-12 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onCreate(nom, description, couleur)}
              disabled={!nom}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-all"
            >
              Créer
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Rejoindre {equipe.equipe_nom}
        </h2>

        <div className="space-y-4">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-8 rounded-full" style={{ backgroundColor: equipe.couleur }} />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {equipe.equipe_nom}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {equipe.nb_membres} membre{equipe.nb_membres > 1 ? 's' : ''}
                </div>
              </div>
            </div>
            {equipe.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
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
              onClick={() => onDemander(equipe, message)}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all"
            >
              Envoyer la demande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}