'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

type ScopeType = 'niveau' | 'sujet' | 'chapitre' | 'lecon';
type Mode = 'cours' | 'fichier';

export default function AjouterCoursPage() {
  const [mode, setMode] = useState<Mode>('cours');

  // Sélection scope
  const [scopeType, setScopeType] = useState<ScopeType>('lecon');
  const [niveaux, setNiveaux] = useState<any[]>([]);
  const [sujets, setSujets] = useState<any[]>([]);
  const [chapitres, setChapitres] = useState<any[]>([]);
  const [lecons, setLecons] = useState<any[]>([]);

  const [selectedNiveau, setSelectedNiveau] = useState('');
  const [selectedSujet, setSelectedSujet] = useState('');
  const [selectedChapitre, setSelectedChapitre] = useState('');
  const [selectedLecon, setSelectedLecon] = useState('');

  // Création cours
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');

  // Ajout fichier
  const [coursList, setCoursList] = useState<any[]>([]);
  const [selectedCours, setSelectedCours] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [ordre, setOrdre] = useState<number>(1);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /* ---------- Chargement hiérarchie ---------- */
  useEffect(() => { loadNiveaux(); }, []);

  useEffect(() => {
    if (selectedNiveau) loadSujets(selectedNiveau);
    else { setSujets([]); setSelectedSujet(''); }
  }, [selectedNiveau]);

  useEffect(() => {
    if (selectedSujet) loadChapitres(selectedSujet);
    else { setChapitres([]); setSelectedChapitre(''); }
  }, [selectedSujet]);

  useEffect(() => {
    if (selectedChapitre) loadLecons(selectedChapitre);
    else { setLecons([]); setSelectedLecon(''); }
  }, [selectedChapitre]);

  /* ---------- Quand on passe en mode "fichier", on charge la liste des cours ---------- */
  useEffect(() => {
    if (mode === 'fichier') loadCoursList();
  }, [mode]);

  const loadNiveaux = async () => {
    const { data, error } = await supabase.from('niveau').select('id, titre, ordre').order('ordre');
    if (!error) setNiveaux(data || []);
  };
  const loadSujets = async (niveauId: string) => {
    const { data } = await supabase.from('sujet').select('id, titre, ordre').eq('niveau_id', niveauId).order('ordre');
    setSujets(data || []);
  };
  const loadChapitres = async (sujetId: string) => {
    const { data } = await supabase.from('chapitre').select('id, titre, ordre').eq('sujet_id', sujetId).order('ordre');
    setChapitres(data || []);
  };
  const loadLecons = async (chapitreId: string) => {
    const { data } = await supabase.from('lecon').select('id, titre, ordre').eq('chapitre_id', chapitreId).order('ordre');
    setLecons(data || []);
  };

  const loadCoursList = async () => {
    const { data, error } = await supabase
      .from('cours')
      .select('id, titre')
      .order('titre');
    if (!error) setCoursList(data || []);
  };

  /* ---------- Submit Cours (mode 1) ---------- */
  const handleSubmitCours = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const scopeData: any = {
        niveau_id: null,
        sujet_id: null,
        chapitre_id: null,
        lecon_id: null,
      };

      switch (scopeType) {
        case 'niveau':
          if (!selectedNiveau) throw new Error('Veuillez sélectionner un niveau');
          scopeData.niveau_id = selectedNiveau;
          break;
        case 'sujet':
          if (!selectedSujet) throw new Error('Veuillez sélectionner un sujet');
          scopeData.sujet_id = selectedSujet;
          break;
        case 'chapitre':
          if (!selectedChapitre) throw new Error('Veuillez sélectionner un chapitre');
          scopeData.chapitre_id = selectedChapitre;
          break;
        case 'lecon':
          if (!selectedLecon) throw new Error('Veuillez sélectionner une leçon');
          scopeData.lecon_id = selectedLecon;
          break;
      }

      const { error: insertError } = await supabase
        .from('cours')
        .insert({
          titre,
          description: description || null,
          ...scopeData,
        });

      if (insertError) throw new Error(insertError.message);

      setMessage({ type: 'success', text: 'Cours créé avec succès ! Vous pouvez maintenant y ajouter des fichiers.' });
      setTitre('');
      setDescription('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Erreur lors de la création du cours' });
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Submit Fichier (mode 2) ---------- */
  const handleSubmitFichier = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!selectedCours) throw new Error('Veuillez sélectionner un cours');
      if (!file) throw new Error('Veuillez sélectionner un fichier');

      const ext = file.name.split('.').pop();
      const safeName = file.name.replace(/\s+/g, '_');
      const filePath = `cours/${selectedCours}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('cours')              // <— Bucket "cours"
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await supabase
        .from('cours_fichier')
        .insert({
          cours_id: selectedCours,
          label: label || null,
          path: filePath,
          ordre: ordre || 1,
        });

      if (insertError) throw new Error(insertError.message);

      setMessage({ type: 'success', text: 'Fichier ajouté au cours avec succès !' });
      setSelectedCours('');
      setLabel('');
      setFile(null);
      setOrdre(1);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Erreur lors de l’ajout du fichier' });
    } finally {
      setLoading(false);
    }
  };

  /* ---------- UI ---------- */
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-green-900 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400 mb-8">
          Admin — Ajouter un Cours
        </h1>

        {/* Sélecteur de mode */}
        <div className="mb-6 inline-flex rounded-lg border-2 border-green-400 overflow-hidden">
          <button
            onClick={() => setMode('cours')}
            className={`px-6 py-3 font-semibold transition-colors ${
              mode === 'cours' ? 'bg-green-500 text-white' : 'bg-gray-800 text-green-300 hover:bg-gray-700'
            }`}
          >
            1. Créer le Cours
          </button>
          <button
            onClick={() => setMode('fichier')}
            className={`px-6 py-3 font-semibold transition-colors ${
              mode === 'fichier' ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-cyan-300 hover:bg-gray-700'
            }`}
          >
            2. Ajouter un Fichier
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/50 text-green-300 border-2 border-green-500'
                : 'bg-red-900/50 text-red-300 border-2 border-red-500'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* MODE 1 : créer le cours */}
        {mode === 'cours' && (
          <form onSubmit={handleSubmitCours} className="bg-gray-800 border-2 border-green-400 rounded-xl shadow-lg p-6 space-y-6">
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 mb-4">
              <p className="text-green-300 text-sm">
                ℹ️ <strong>Étape 1</strong> : crée un cours (titre + scope). Tu pourras ensuite lui associer des fichiers (PDF, images, etc.).
              </p>
            </div>

            {/* Type de scope */}
            <div>
              <label className="block text-sm font-semibold text-green-300 mb-2">Type d’ancrage</label>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value as ScopeType)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
              >
                <option value="lecon">Leçon</option>
                <option value="chapitre">Chapitre</option>
                <option value="sujet">Sujet</option>
                <option value="niveau">Niveau</option>
              </select>
            </div>

            {/* Sélection hiérarchique */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-green-300 mb-2">Niveau</label>
                <select
                  value={selectedNiveau}
                  onChange={(e) => setSelectedNiveau(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                  required
                >
                  <option value="">Sélectionner un niveau</option>
                  {niveaux.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.titre}
                    </option>
                  ))}
                </select>
              </div>

              {scopeType !== 'niveau' && (
                <div>
                  <label className="block text-sm font-semibold text-green-300 mb-2">Sujet</label>
                  <select
                    value={selectedSujet}
                    onChange={(e) => setSelectedSujet(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                    disabled={!selectedNiveau}
                    required
                  >
                    <option value="">Sélectionner un sujet</option>
                    {sujets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(scopeType === 'chapitre' || scopeType === 'lecon') && (
                <div>
                  <label className="block text-sm font-semibold text-green-300 mb-2">Chapitre</label>
                  <select
                    value={selectedChapitre}
                    onChange={(e) => setSelectedChapitre(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                    disabled={!selectedSujet}
                    required
                  >
                    <option value="">Sélectionner un chapitre</option>
                    {chapitres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.titre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scopeType === 'lecon' && (
                <div>
                  <label className="block text-sm font-semibold text-green-300 mb-2">Leçon</label>
                  <select
                    value={selectedLecon}
                    onChange={(e) => setSelectedLecon(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                    disabled={!selectedChapitre}
                    required
                  >
                    <option value="">Sélectionner une leçon</option>
                    {lecons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.titre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Infos cours */}
            <div>
              <label className="block text-sm font-semibold text-green-300 mb-2">Titre du cours *</label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                placeholder="Ex: Les fractions — rappel de cours"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-green-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                rows={3}
                placeholder="Description optionnelle du cours"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30"
            >
              {loading ? 'Création en cours…' : 'Créer le cours'}
            </button>
          </form>
        )}

        {/* MODE 2 : ajouter un fichier */}
        {mode === 'fichier' && (
          <form onSubmit={handleSubmitFichier} className="bg-gray-800 border-2 border-cyan-400 rounded-xl shadow-lg p-6 space-y-6">
            <div className="bg-cyan-900/30 border border-cyan-500/50 rounded-lg p-4 mb-4">
              <p className="text-cyan-300 text-sm">
                ℹ️ <strong>Étape 2</strong> : choisis un cours puis uploade un fichier (PDF, image…).
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-cyan-300 mb-2">Cours *</label>
              <select
                value={selectedCours}
                onChange={(e) => setSelectedCours(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:outline-none"
                required
              >
                <option value="">Sélectionner un cours</option>
                {coursList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-cyan-300 mb-2">Fichier *</label>
                <input
                  type="file"
                  accept=".pdf,image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-cyan-300 mb-2">Ordre</label>
                <input
                  type="number"
                  min={1}
                  value={ordre}
                  onChange={(e) => setOrdre(parseInt(e.target.value || '1'))}
                  className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-cyan-300 mb-2">Label (optionnel)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:outline-none"
                placeholder="Ex : PDF élève, Diapo, Vidéo 1…"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30"
            >
              {loading ? 'Ajout en cours…' : 'Ajouter le fichier au cours'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
