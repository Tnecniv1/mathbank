'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ObjectifCard, { ObjectifData } from '@/components/ObjectifCard';
import ModalCreerObjectif from '@/components/ModalCreerObjectif';

/* ---------- Icons ---------- */
const IconArrowLeft = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Loader = () => (
  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"/>
  </svg>
);

/* ---------- Page ---------- */
export default function ObjectifsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [equipeId, setEquipeId] = useState<string | null>(null);
  const [membreId, setMembreId] = useState<string | null>(null);
  const [membreNom, setMembreNom] = useState('');
  const [equipeNom, setEquipeNom] = useState('');
  const [objectifs, setObjectifs] = useState<ObjectifData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isChef, setIsChef] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const membre = params.get('membre');
    setEquipeId(id);
    setMembreId(membre);
    if (id && membre) {
      loadObjectifs(id, membre);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadObjectifs(eqId: string, userId: string) {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/connexion');
        return;
      }

      // Charger l'equipe et vérifier le rôle
      const { data: equipeData } = await supabase
        .from('equipe')
        .select('nom, chef_id')
        .eq('id', eqId)
        .single();

      if (equipeData) {
        setEquipeNom(equipeData.nom);
        setIsChef(equipeData.chef_id === session.user.id);

        // Vérifier que l'utilisateur est chef OU le membre concerné
        if (equipeData.chef_id !== session.user.id && userId !== session.user.id) {
          setLoading(false);
          return;
        }
      }

      // Charger le nom du membre
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .single();

      if (profileData) setMembreNom(profileData.full_name);

      // Verifier les objectifs expires (cree les notifications si besoin)
      await supabase.rpc('verifier_objectifs_expires', { p_equipe_id: eqId });

      // Charger les objectifs de CE membre
      const { data, error } = await supabase.rpc('get_objectifs_membre', {
        p_equipe_id: eqId,
        p_membre_user_id: userId,
      });

      if (error) {
        console.error('Erreur chargement objectifs:', error);
        setObjectifs([]);
        setLoading(false);
        return;
      }

      const objectifsList: ObjectifData[] = data || [];

      // Calculer la progression pour les objectifs en cours
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const obj of objectifsList) {
        if (obj.statut !== 'en_cours') continue;
        const fin = new Date(obj.date_fin);
        fin.setHours(0, 0, 0, 0);
        if (fin >= today) {
          await supabase.rpc('calculer_progression_objectif', {
            p_objectif_id: obj.id,
          });
        }
      }

      // Recharger apres calcul de progression
      const { data: refreshed } = await supabase.rpc('get_objectifs_membre', {
        p_equipe_id: eqId,
        p_membre_user_id: userId,
      });

      setObjectifs(refreshed || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function handleCloturer(
    objectifId: string,
    statut: 'succes' | 'echec',
    commentaire?: string
  ) {
    try {
      const { error } = await supabase.rpc('cloturer_objectif', {
        p_objectif_id: objectifId,
        p_statut: statut,
        p_commentaire: commentaire || null,
      });

      if (error) throw error;

      if (equipeId && membreId) loadObjectifs(equipeId, membreId);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erreur lors de la cloture');
    }
  }

  async function handleBasculerMode(objectifId: string, mode: 'auto' | 'manuel') {
    try {
      const { error } = await supabase.rpc('basculer_mode_objectif', {
        p_objectif_id: objectifId,
        p_mode: mode,
      });

      if (error) throw error;

      if (equipeId && membreId) loadObjectifs(equipeId, membreId);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erreur lors du changement de mode');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!equipeId || !membreId) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <p className="text-ink-light">Parametres manquants</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-cream-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/gestion-equipe?id=${equipeId}`)}
            className="p-2 hover:bg-cream-200 rounded-lg transition-colors text-ink"
          >
            <IconArrowLeft />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-ink">
              🎯 Objectifs de {membreNom || 'ce membre'}
            </h1>
            {equipeNom && (
              <p className="text-sm text-ink-light">{equipeNom}</p>
            )}
          </div>
          {isChef && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-accent hover:bg-accent/80 text-white font-medium rounded-lg transition-colors"
            >
              + Nouvel objectif
            </button>
          )}
        </div>

        {/* Liste des objectifs */}
        {objectifs.length === 0 ? (
          <div className="text-center py-16 text-ink-muted">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-lg font-medium">Aucun objectif pour le moment</p>
            <p className="text-sm mt-1">Fixez un objectif hebdomadaire pour {membreNom || 'ce membre'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {objectifs.map((obj) => (
              <ObjectifCard
                key={obj.id}
                objectif={obj}
                isChef={isChef}
                onCloturer={isChef ? handleCloturer : undefined}
                onBasculerMode={isChef ? handleBasculerMode : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal creation */}
      {showModal && (
        <ModalCreerObjectif
          equipeId={equipeId}
          membreUserId={membreId}
          onClose={() => setShowModal(false)}
          onCreated={() => loadObjectifs(equipeId, membreId)}
        />
      )}
    </main>
  );
}
