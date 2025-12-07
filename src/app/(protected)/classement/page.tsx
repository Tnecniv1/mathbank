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
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Chargement...</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#18162a] p-6">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap');
        h1, h2, h3, h4, h5, h6, .font-mono { font-family: 'IBM Plex Mono', monospace; }
        body { font-family: 'Lora', serif; background-color: #18162a; }
        p, span, div { font-family: 'Lora', serif; }
      `}</style>
    <main className="bg-white rounded-2xl shadow-xl py-8 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🏆 Classement
            </h1>
            <p className="text-gray-600">
              Suivez les performances des équipes et des participants
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-gray-900 font-semibold rounded-xl shadow-lg transition-all"
          >
            📝 Demander création d'équipe
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-300">
          <button
            onClick={() => setActiveTab('equipes')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'equipes'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Équipes
            {activeTab === 'equipes' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('utilisateurs')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'utilisateurs'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Individuel
            {activeTab === 'utilisateurs' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
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
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-300">
        <div className="text-6xl mb-4">👥</div>
        <p className="text-gray-600">Aucune équipe pour le moment</p>
        <p className="text-sm text-gray-500 mt-2">
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
            className={`bg-white rounded-xl border-2 p-6 transition-all ${
              estMonEquipe
                ? 'border-blue-400 shadow-lg'
                : 'border-gray-300'
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
                    <h3 className="text-xl font-bold text-gray-900">
                      {equipe.equipe_nom}
                    </h3>
                    {estMonEquipe && (
                      <span className="text-xs font-medium px-2 py-1 bg-blue-100/50 text-blue-700 rounded-full">
                        Mon équipe
                      </span>
                    )}
                  </div>
                  {equipe.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {equipe.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-sm text-gray-500">
                      {equipe.nb_membres} membre{equipe.nb_membres > 1 ? 's' : ''}
                    </p>
                    <span className="text-slate-300">•</span>
                    <p className="text-sm text-gray-600">
                      👑 Chef : <span className="font-medium">{equipe.chef_nom || 'Inconnu'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats et action */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {equipe.score_total}
                  </div>
                  <div className="text-xs text-gray-500">Points</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    {equipe.nb_feuilles_validees}
                  </div>
                  <div className="text-xs text-gray-500">Validées</div>
                </div>

                {peutDemander && (
                  <button
                    onClick={() => onDemanderRejoindre(equipe)}
                    className="px-4 py-2 bg-green-100/20 hover:bg-green-200 text-green-700 font-medium rounded-lg transition-colors"
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
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-300">
        <div className="text-6xl mb-4">👤</div>
        <p className="text-gray-600">Aucun participant pour le moment</p>
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
            className={`bg-white rounded-xl border-2 p-4 transition-all ${
              estMoi
                ? 'border-blue-400 shadow-lg'
                : 'border-gray-300'
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
                    <span className="font-semibold text-gray-900">
                      {user.full_name || 'Utilisateur'}
                    </span>
                    {estMoi && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-blue-100/50 text-blue-700 rounded-full">
                        Vous
                      </span>
                    )}
                  </div>
                  {user.equipe_nom && (
                    <p className="text-sm text-gray-500">
                      {user.equipe_nom}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {user.score_total}
                  </div>
                  <div className="text-xs text-gray-500">Points</div>
                </div>
                
                <div>
                  <div className="font-semibold text-gray-900">
                    {user.nb_feuilles_validees}
                  </div>
                  <div className="text-xs text-gray-500">Validées</div>
                </div>

                <div>
                  <div className="font-semibold text-gray-900">
                    {user.score_moyen}
                  </div>
                  <div className="text-xs text-gray-500">Moy.</div>
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
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Demander la création d'une équipe
        </h2>
        <p className="text-sm text-gray-600 mb-4">
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
              className="w-full border border-gray-300 rounded-xl p-3 bg-white text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pourquoi souhaitez-vous créer cette équipe ?"
              rows={3}
              className="w-full border border-gray-300 rounded-xl p-3 bg-white text-gray-900"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onCreate(nom, description)}
              disabled={!nom.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-gray-900 font-semibold rounded-xl disabled:opacity-50 transition-all"
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
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Rejoindre {equipe.equipe_nom}
        </h2>

        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-8 rounded-full" style={{ backgroundColor: equipe.couleur }} />
              <div>
                <div className="font-semibold text-gray-900">
                  {equipe.equipe_nom}
                </div>
                <div className="text-sm text-gray-600">
                  {equipe.nb_membres} membre{equipe.nb_membres > 1 ? 's' : ''}
                </div>
              </div>
            </div>
            {equipe.description && (
              <p className="text-sm text-gray-600">
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
              className="w-full border border-gray-300 rounded-xl p-3 bg-white text-gray-900"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onDemander(equipe, message)}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-gray-900 font-semibold rounded-xl transition-all"
            >
              Envoyer la demande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}