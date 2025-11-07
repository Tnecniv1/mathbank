'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

type Lecon = {
  id: string;
  ordre: number;
  titre: string;
  description: string | null;
};

type Chapitre = {
  id: string;
  ordre: number;
  titre: string;
  description: string | null;
  lecons?: Lecon[];
};

type Sujet = {
  id: string;
  ordre: number;
  titre: string;
  description: string | null;
  chapitres?: Chapitre[];
};

type Niveau = {
  id: string;
  ordre: number;
  titre: string;
  description: string | null;
  sujets?: Sujet[];
};

type ModalType = 'niveau' | 'sujet' | 'chapitre' | 'lecon' | null;

const ChevronDown = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export default function GestionScopePage() {
  const [bibliotheque, setBibliotheque] = useState<Niveau[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNiveaux, setExpandedNiveaux] = useState<string[]>([]);
  const [expandedSujets, setExpandedSujets] = useState<string[]>([]);
  const [expandedChapitres, setExpandedChapitres] = useState<string[]>([]);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({ id: '', titre: '', description: '', ordre: 1 });
  const [parentId, setParentId] = useState<string | null>(null);

  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    loadBibliotheque();
  }, []);

  const loadBibliotheque = async () => {
    setLoading(true);
    try {
      const { data: niveaux, error } = await supabase
        .from('niveau')
        .select(`
          id, ordre, titre, description,
          sujets:sujet (
            id, ordre, titre, description,
            chapitres:chapitre (
              id, ordre, titre, description,
              lecons:lecon (id, ordre, titre, description)
            )
          )
        `)
        .order('ordre', { ascending: true });

      if (error) throw error;

      niveaux?.forEach((n: any) => {
        n.sujets?.sort((a: any, b: any) => a.ordre - b.ordre);
        n.sujets?.forEach((s: any) => {
          s.chapitres?.sort((a: any, b: any) => a.ordre - b.ordre);
          s.chapitres?.forEach((c: any) => {
            c.lecons?.sort((a: any, b: any) => a.ordre - b.ordre);
          });
        });
      });

      setBibliotheque(niveaux || []);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = (type: ModalType, parent: string | null = null) => {
    setModalType(type);
    setModalMode('create');
    setParentId(parent);
    setFormData({ id: '', titre: '', description: '', ordre: 1 });
    setShowModal(true);
  };

  const openEditModal = (type: ModalType, item: any) => {
    setModalType(type);
    setModalMode('edit');
    setFormData({
      id: item.id,
      titre: item.titre,
      description: item.description || '',
      ordre: item.ordre
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const table = modalType as string;
      const data: any = {
        titre: formData.titre,
        description: formData.description || null,
        ordre: formData.ordre
      };

      if (modalMode === 'create') {
        // Ajouter la FK parent
        if (modalType === 'sujet' && parentId) data.niveau_id = parentId;
        if (modalType === 'chapitre' && parentId) data.sujet_id = parentId;
        if (modalType === 'lecon' && parentId) data.chapitre_id = parentId;

        const { error } = await supabase.from(table).insert(data);
        if (error) throw error;
        setMessage({ type: 'success', text: `${modalType} créé avec succès !` });
      } else {
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', formData.id);
        if (error) throw error;
        setMessage({ type: 'success', text: `${modalType} modifié avec succès !` });
      }

      setShowModal(false);
      loadBibliotheque();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDelete = async (type: string, id: string, titre: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${titre}" ?\n\nAttention : Tous les éléments enfants seront également supprimés.`)) {
      return;
    }

    try {
      const { error } = await supabase.from(type).delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: `Supprimé avec succès !` });
      loadBibliotheque();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-green-900 flex items-center justify-center">
        <p className="text-green-300 text-xl">Chargement...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-green-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
            Gestion de l'Arbre du Scope
          </h1>
          <button
            onClick={() => openCreateModal('niveau')}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-lg shadow-green-500/30"
          >
            <PlusIcon />
            Ajouter un Niveau
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-500' : 'bg-red-900/50 text-red-300 border border-red-500'}`}>
            {message.text}
          </div>
        )}

        {/* Arbre */}
        <div className="space-y-4">
          {bibliotheque.map(niveau => (
            <div key={niveau.id} className="bg-gray-800 border-2 border-green-400 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button onClick={() => setExpandedNiveaux(prev => prev.includes(niveau.id) ? prev.filter(i => i !== niveau.id) : [...prev, niveau.id])}>
                    {expandedNiveaux.includes(niveau.id) ? <ChevronDown /> : <ChevronRight />}
                  </button>
                  <span className="text-green-300 font-bold text-lg">{niveau.ordre}. {niveau.titre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal('niveau', niveau)} className="p-2 hover:bg-gray-700 rounded" title="Modifier">
                    <EditIcon />
                  </button>
                  <button onClick={() => openCreateModal('sujet', niveau.id)} className="p-2 hover:bg-gray-700 rounded text-green-400" title="Ajouter un sujet">
                    <PlusIcon />
                  </button>
                  <button onClick={() => handleDelete('niveau', niveau.id, niveau.titre)} className="p-2 hover:bg-gray-700 rounded text-red-400" title="Supprimer">
                    <TrashIcon />
                  </button>
                </div>
              </div>

              {/* Sujets */}
              {expandedNiveaux.includes(niveau.id) && niveau.sujets && (
                <div className="ml-8 mt-3 space-y-3">
                  {niveau.sujets.map(sujet => (
                    <div key={sujet.id} className="bg-gray-700/50 border-l-4 border-yellow-400 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <button onClick={() => setExpandedSujets(prev => prev.includes(sujet.id) ? prev.filter(i => i !== sujet.id) : [...prev, sujet.id])}>
                            {expandedSujets.includes(sujet.id) ? <ChevronDown /> : <ChevronRight />}
                          </button>
                          <span className="text-yellow-300 font-semibold">{sujet.ordre}. {sujet.titre}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditModal('sujet', sujet)} className="p-2 hover:bg-gray-600 rounded" title="Modifier">
                            <EditIcon />
                          </button>
                          <button onClick={() => openCreateModal('chapitre', sujet.id)} className="p-2 hover:bg-gray-600 rounded text-yellow-400" title="Ajouter un chapitre">
                            <PlusIcon />
                          </button>
                          <button onClick={() => handleDelete('sujet', sujet.id, sujet.titre)} className="p-2 hover:bg-gray-600 rounded text-red-400" title="Supprimer">
                            <TrashIcon />
                          </button>
                        </div>
                      </div>

                      {/* Chapitres */}
                      {expandedSujets.includes(sujet.id) && sujet.chapitres && (
                        <div className="ml-8 mt-3 space-y-2">
                          {sujet.chapitres.map(chapitre => (
                            <div key={chapitre.id} className="bg-gray-600/50 border-l-4 border-pink-400 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <button onClick={() => setExpandedChapitres(prev => prev.includes(chapitre.id) ? prev.filter(i => i !== chapitre.id) : [...prev, chapitre.id])}>
                                    {expandedChapitres.includes(chapitre.id) ? <ChevronDown /> : <ChevronRight />}
                                  </button>
                                  <span className="text-pink-300 font-semibold">{chapitre.ordre}. {chapitre.titre}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => openEditModal('chapitre', chapitre)} className="p-2 hover:bg-gray-500 rounded" title="Modifier">
                                    <EditIcon />
                                  </button>
                                  <button onClick={() => openCreateModal('lecon', chapitre.id)} className="p-2 hover:bg-gray-500 rounded text-pink-400" title="Ajouter une leçon">
                                    <PlusIcon />
                                  </button>
                                  <button onClick={() => handleDelete('chapitre', chapitre.id, chapitre.titre)} className="p-2 hover:bg-gray-500 rounded text-red-400" title="Supprimer">
                                    <TrashIcon />
                                  </button>
                                </div>
                              </div>

                              {/* Leçons */}
                              {expandedChapitres.includes(chapitre.id) && chapitre.lecons && (
                                <div className="ml-8 mt-2 space-y-1">
                                  {chapitre.lecons.map(lecon => (
                                    <div key={lecon.id} className="flex items-center justify-between p-2 bg-gray-500/50 border-l-2 border-green-400 rounded">
                                      <span className="text-green-300 text-sm">{lecon.ordre}. {lecon.titre}</span>
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => openEditModal('lecon', lecon)} className="p-1 hover:bg-gray-400 rounded" title="Modifier">
                                          <EditIcon />
                                        </button>
                                        <button onClick={() => handleDelete('lecon', lecon.id, lecon.titre)} className="p-1 hover:bg-gray-400 rounded text-red-400" title="Supprimer">
                                          <TrashIcon />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border-2 border-green-400 rounded-xl p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-green-300 mb-4">
                {modalMode === 'create' ? 'Ajouter' : 'Modifier'} {modalType}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Titre *</label>
                  <input
                    type="text"
                    value={formData.titre}
                    onChange={(e) => setFormData({...formData, titre: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Ordre *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.ordre}
                    onChange={(e) => setFormData({...formData, ordre: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition-colors">
                    {modalMode === 'create' ? 'Créer' : 'Modifier'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg transition-colors">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}