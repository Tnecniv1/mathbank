'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

type ScopeType = 'niveau' | 'sujet' | 'chapitre' | 'lecon';
type Mode = 'entrainement' | 'variante';

export default function AjouterEntrainementPage() {
  const [mode, setMode] = useState<Mode>('entrainement');
  
  // États pour le scope
  const [scopeType, setScopeType] = useState<ScopeType>('lecon');
  const [niveaux, setNiveaux] = useState<any[]>([]);
  const [sujets, setSujets] = useState<any[]>([]);
  const [chapitres, setChapitres] = useState<any[]>([]);
  const [lecons, setLecons] = useState<any[]>([]);
  
  const [selectedNiveau, setSelectedNiveau] = useState('');
  const [selectedSujet, setSelectedSujet] = useState('');
  const [selectedChapitre, setSelectedChapitre] = useState('');
  const [selectedLecon, setSelectedLecon] = useState('');
  
  // États pour l'entraînement
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  
  // États pour la variante
  const [entrainements, setEntrainements] = useState<any[]>([]);
  const [selectedEntrainement, setSelectedEntrainement] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [varianteNo, setVarianteNo] = useState(1);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Charger les niveaux au montage
  useEffect(() => {
    loadNiveaux();
  }, []);

  // Charger les entraînements quand on passe en mode variante
  useEffect(() => {
    if (mode === 'variante') {
      loadEntrainements();
    }
  }, [mode]);

  // Charger les sujets quand un niveau est sélectionné
  useEffect(() => {
    if (selectedNiveau) {
      loadSujets(selectedNiveau);
    } else {
      setSujets([]);
      setSelectedSujet('');
    }
  }, [selectedNiveau]);

  // Charger les chapitres quand un sujet est sélectionné
  useEffect(() => {
    if (selectedSujet) {
      loadChapitres(selectedSujet);
    } else {
      setChapitres([]);
      setSelectedChapitre('');
    }
  }, [selectedSujet]);

  // Charger les leçons quand un chapitre est sélectionné
  useEffect(() => {
    if (selectedChapitre) {
      loadLecons(selectedChapitre);
    } else {
      setLecons([]);
      setSelectedLecon('');
    }
  }, [selectedChapitre]);

  const loadNiveaux = async () => {
    const { data } = await supabase
      .from('niveau')
      .select('id, titre, ordre')
      .order('ordre');
    setNiveaux(data || []);
  };

  const loadSujets = async (niveauId: string) => {
    const { data } = await supabase
      .from('sujet')
      .select('id, titre, ordre')
      .eq('niveau_id', niveauId)
      .order('ordre');
    setSujets(data || []);
  };

  const loadChapitres = async (sujetId: string) => {
    const { data } = await supabase
      .from('chapitre')
      .select('id, titre, ordre')
      .eq('sujet_id', sujetId)
      .order('ordre');
    setChapitres(data || []);
  };

  const loadLecons = async (chapitreId: string) => {
    const { data } = await supabase
      .from('lecon')
      .select('id, titre, ordre')
      .eq('chapitre_id', chapitreId)
      .order('ordre');
    setLecons(data || []);
  };

  const loadEntrainements = async () => {
    const { data } = await supabase
      .from('entrainement')
      .select('id, titre')
      .order('titre');
    setEntrainements(data || []);
  };

  const handleSubmitEntrainement = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Valider qu'un scope est sélectionné
      let scopeData: any = {
        niveau_id: null,
        sujet_id: null,
        chapitre_id: null,
        lecon_id: null
      };
      
      switch(scopeType) {
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

      // Créer l'entraînement (sans PDF)
      const { data: entrainement, error: entrainementError } = await supabase
        .from('entrainement')
        .insert({
          titre,
          description: description || null,
          ...scopeData
        })
        .select()
        .single();

      if (entrainementError) {
        throw new Error(entrainementError.message || 'Erreur lors de la création de l\'entraînement');
      }

      setMessage({ type: 'success', text: 'Entraînement créé avec succès ! Vous pouvez maintenant ajouter des variantes PDF.' });
      
      // Réinitialiser le formulaire
      setTitre('');
      setDescription('');
      
    } catch (error: any) {
      console.error('Erreur complète:', error);
      const errorMessage = error?.message || error?.toString() || 'Une erreur est survenue';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitVariante = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!selectedEntrainement) throw new Error('Veuillez sélectionner un entraînement');
      if (!pdfFile) throw new Error('Veuillez sélectionner un fichier PDF');

      // Upload du PDF
      const fileExt = pdfFile.name.split('.').pop();
      const fileName = `${selectedEntrainement}_v${varianteNo}.${fileExt}`;
      const filePath = `entrainements/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, pdfFile, {
          upsert: false // Ne pas écraser si existe déjà
        });

      if (uploadError) {
        throw new Error('Erreur lors de l\'upload du PDF: ' + uploadError.message);
      }

      // Créer la variante
      const { error: varianteError } = await supabase
        .from('entrainement_variante')
        .insert({
          entrainement_id: selectedEntrainement,
          publication: filePath,
          variante_no: varianteNo
        });

      if (varianteError) {
        throw new Error('Erreur lors de la création de la variante: ' + varianteError.message);
      }

      setMessage({ type: 'success', text: 'Variante PDF ajoutée avec succès !' });
      
      // Réinitialiser le formulaire
      setSelectedEntrainement('');
      setPdfFile(null);
      setVarianteNo(1);
      
    } catch (error: any) {
      console.error('Erreur complète:', error);
      const errorMessage = error?.message || error?.toString() || 'Une erreur est survenue';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-green-900 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400 mb-8">
          Gestion des Entraînements
        </h1>

        {/* Sélecteur de mode */}
        <div className="mb-6 inline-flex rounded-lg border-2 border-green-400 overflow-hidden">
          <button
            onClick={() => setMode('entrainement')}
            className={`px-6 py-3 font-semibold transition-colors ${
              mode === 'entrainement'
                ? 'bg-green-500 text-white'
                : 'bg-gray-800 text-green-300 hover:bg-gray-700'
            }`}
          >
            1. Créer un Entraînement
          </button>
          <button
            onClick={() => setMode('variante')}
            className={`px-6 py-3 font-semibold transition-colors ${
              mode === 'variante'
                ? 'bg-cyan-500 text-white'
                : 'bg-gray-800 text-cyan-300 hover:bg-gray-700'
            }`}
          >
            2. Ajouter une Variante PDF
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/50 text-green-300 border-2 border-green-500'
              : 'bg-red-900/50 text-red-300 border-2 border-red-500'
          }`}>
            {message.text}
          </div>
        )}

        {/* Formulaire MODE ENTRAINEMENT */}
        {mode === 'entrainement' && (
          <form onSubmit={handleSubmitEntrainement} className="bg-gray-800 border-2 border-green-400 rounded-xl shadow-lg p-6 space-y-6">
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 mb-4">
              <p className="text-green-300 text-sm">
                ℹ️ <strong>Étape 1</strong> : Créez d'abord la "famille" d'entraînement (titre + scope). Vous pourrez ensuite ajouter les PDFs (variantes) à l'étape 2.
              </p>
            </div>

            {/* Type de scope */}
            <div>
              <label className="block text-sm font-semibold text-green-300 mb-2">
                Type d'ancrage
              </label>
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
                  {niveaux.map(n => (
                    <option key={n.id} value={n.id}>{n.titre}</option>
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
                    {sujets.map(s => (
                      <option key={s.id} value={s.id}>{s.titre}</option>
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
                    {chapitres.map(c => (
                      <option key={c.id} value={c.id}>{c.titre}</option>
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
                    {lecons.map(l => (
                      <option key={l.id} value={l.id}>{l.titre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Informations de l'entraînement */}
            <div>
              <label className="block text-sm font-semibold text-green-300 mb-2">
                Titre de l'entraînement *
              </label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                placeholder="Ex: Matrice de calcul mental"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-green-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-green-400 focus:outline-none"
                rows={3}
                placeholder="Description optionnelle de l'entraînement"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30"
            >
              {loading ? 'Création en cours...' : 'Créer l\'Entraînement'}
            </button>
          </form>
        )}

        {/* Formulaire MODE VARIANTE */}
        {mode === 'variante' && (
          <form onSubmit={handleSubmitVariante} className="bg-gray-800 border-2 border-cyan-400 rounded-xl shadow-lg p-6 space-y-6">
            <div className="bg-cyan-900/30 border border-cyan-500/50 rounded-lg p-4 mb-4">
              <p className="text-cyan-300 text-sm">
                ℹ️ <strong>Étape 2</strong> : Sélectionnez un entraînement existant et ajoutez-y un PDF (variante).
              </p>
            </div>

            {/* Sélection de l'entraînement */}
            <div>
              <label className="block text-sm font-semibold text-cyan-300 mb-2">
                Entraînement *
              </label>
              <select
                value={selectedEntrainement}
                onChange={(e) => setSelectedEntrainement(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:outline-none"
                required
              >
                <option value="">Sélectionner un entraînement</option>
                {entrainements.map(e => (
                  <option key={e.id} value={e.id}>{e.titre}</option>
                ))}
              </select>
            </div>

            {/* Upload PDF */}
            <div>
              <label className="block text-sm font-semibold text-cyan-300 mb-2">
                Fichier PDF *
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:outline-none"
                required
              />
              {pdfFile && (
                <p className="text-sm text-green-400 mt-1">✓ {pdfFile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-cyan-300 mb-2">
                Numéro de variante *
              </label>
              <input
                type="number"
                min="1"
                value={varianteNo}
                onChange={(e) => setVarianteNo(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border-2 border-gray-600 text-white rounded-lg focus:border-cyan-400 focus:outline-none"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Numérotez séquentiellement : 1, 2, 3, etc.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30"
            >
              {loading ? 'Ajout en cours...' : 'Ajouter la Variante PDF'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}