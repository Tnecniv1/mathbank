'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Feuille = {
  id: string;
  titre: string;
  ordre: number;
  type: 'mecanique' | 'chaotique';
  difficulte: number | null;
  est_validee: boolean;
  est_autorisee: boolean;
  peut_acceder: boolean;
};

type Chapitre = {
  id: string;
  titre: string;
  ordre: number;
  feuilles: Feuille[];
};

type Sujet = {
  id: string;
  titre: string;
  ordre: number;
  chapitres: Chapitre[];
};

type Niveau = {
  id: string;
  titre: string;
  ordre: number;
  sujets: Sujet[];
};

type Props = {
  membre: {
    user_id: string;
    membre_id?: string;
    equipe_id: string;
    membre_nom: string;
  };
  onClose: () => void;
  onUpdate: () => void;
};

export default function ModalGererFeuillesScope({ membre, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState(true);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  
  // États pour les feuilles autorisées
  const [feuilleMecaAutorisee, setFeuilleMecaAutorisee] = useState<Feuille | null>(null);
  const [feuilleChaosAutorisee, setFeuilleChaosAutorisee] = useState<Feuille | null>(null);
  
  // États pour l'accordéon (séparés par type)
  const [expandedNiveauxMeca, setExpandedNiveauxMeca] = useState<Set<string>>(new Set());
  const [expandedSujetsMeca, setExpandedSujetsMeca] = useState<Set<string>>(new Set());
  const [expandedChapitresMeca, setExpandedChapitresMeca] = useState<Set<string>>(new Set());
  
  const [expandedNiveauxChaos, setExpandedNiveauxChaos] = useState<Set<string>>(new Set());
  const [expandedSujetsChaos, setExpandedSujetsChaos] = useState<Set<string>>(new Set());
  const [expandedChapitresChaos, setExpandedChapitresChaos] = useState<Set<string>>(new Set());
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [membre.user_id]);

  async function loadData() {
    try {
      setLoading(true);

      // 1. Charger toute la structure hiérarchique
      const { data: niveauxData } = await supabase
        .from('niveau')
        .select(`
          id, titre, ordre,
          sujets:sujet (
            id, titre, ordre,
            chapitres:chapitre (
              id, titre, ordre,
              feuilles:feuille_entrainement (
                id, titre, ordre, type, difficulte
              )
            )
          )
        `)
        .order('ordre');

      if (!niveauxData) {
        setNiveaux([]);
        return;
      }

      // 2. Charger les feuilles validées par ce membre
      const { data: feuillesValidees } = await supabase
        .from('progression_feuille')
        .select('feuille_id')
        .eq('user_id', membre.user_id)
        .eq('est_termine', true);

      const idsValidees = new Set(feuillesValidees?.map(p => p.feuille_id) || []);

      // 3. Charger les feuilles actuellement autorisées
      // Note: La table feuilles_autorisees utilise membre_id, pas user_id
      const { data: feuillesAutorisees } = await supabase
        .from('feuilles_autorisees')
        .select('feuille_id')
        .eq('membre_id', membre.membre_id || membre.user_id);

      const idsAutorisees = new Set(feuillesAutorisees?.map(f => f.feuille_id) || []);

      // 4. Enrichir les données avec les statuts
      const niveauxEnrichis: Niveau[] = niveauxData.map((n: any) => ({
        id: n.id,
        titre: n.titre,
        ordre: n.ordre,
        sujets: (n.sujets || []).map((s: any) => ({
          id: s.id,
          titre: s.titre,
          ordre: s.ordre,
          chapitres: (s.chapitres || []).map((c: any) => ({
            id: c.id,
            titre: c.titre,
            ordre: c.ordre,
            feuilles: (c.feuilles || [])
              .filter((f: any) => f.type) // Filtrer les feuilles sans type
              .map((f: any) => ({
                id: f.id,
                titre: f.titre,
                ordre: f.ordre,
                type: f.type,
                difficulte: f.difficulte,
                est_validee: idsValidees.has(f.id),
                est_autorisee: idsAutorisees.has(f.id),
                peut_acceder: true,
              }))
              .sort((a: any, b: any) => a.ordre - b.ordre),
          }))
          .filter((c: any) => c.feuilles.length > 0)
          .sort((a: any, b: any) => a.ordre - b.ordre),
        }))
        .filter((s: any) => s.chapitres.length > 0)
        .sort((a: any, b: any) => a.ordre - b.ordre),
      }))
      .filter((n: any) => n.sujets.length > 0);

      setNiveaux(niveauxEnrichis);

      // 5. Identifier les feuilles autorisées
      let mecaAutorisee: Feuille | null = null;
      let chaosAutorisee: Feuille | null = null;

      for (const niveau of niveauxEnrichis) {
        for (const sujet of niveau.sujets) {
          for (const chapitre of sujet.chapitres) {
            for (const feuille of chapitre.feuilles) {
              if (feuille.est_autorisee && !feuille.est_validee) {
                if (feuille.type === 'mecanique') {
                  mecaAutorisee = feuille;
                } else if (feuille.type === 'chaotique') {
                  chaosAutorisee = feuille;
                }
              }
            }
          }
        }
      }

      setFeuilleMecaAutorisee(mecaAutorisee);
      setFeuilleChaosAutorisee(chaosAutorisee);

    } catch (error) {
      console.error('Erreur chargement:', error);
      alert('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoriser(feuilleId: string, type: 'mecanique' | 'chaotique') {
    try {
      setSaving(true);

      // Utiliser la RPC fonction existante
      const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
        p_membre_id: membre.membre_id || null,
        p_feuilles_a_ajouter: [feuilleId],
        p_feuilles_a_retirer: [],
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Erreur lors de l\'autorisation');
      }

      await loadData();
      onUpdate();
    } catch (error: any) {
      console.error('Erreur autorisation:', error);
      alert(error.message || 'Erreur lors de l\'autorisation');
    } finally {
      setSaving(false);
    }
  }

  async function handleRetirer(feuilleId: string) {
    try {
      setSaving(true);

      const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
        p_membre_id: membre.membre_id || null,
        p_feuilles_a_ajouter: [],
        p_feuilles_a_retirer: [feuilleId],
      });

      if (error) throw error;

      await loadData();
      onUpdate();
    } catch (error: any) {
      console.error('Erreur retrait:', error);
      alert(error.message || 'Erreur lors du retrait');
    } finally {
      setSaving(false);
    }
  }

  function toggleNiveau(niveauId: string, type: 'mecanique' | 'chaotique') {
    if (type === 'mecanique') {
      const newSet = new Set(expandedNiveauxMeca);
      newSet.has(niveauId) ? newSet.delete(niveauId) : newSet.add(niveauId);
      setExpandedNiveauxMeca(newSet);
    } else {
      const newSet = new Set(expandedNiveauxChaos);
      newSet.has(niveauId) ? newSet.delete(niveauId) : newSet.add(niveauId);
      setExpandedNiveauxChaos(newSet);
    }
  }

  function toggleSujet(sujetId: string, type: 'mecanique' | 'chaotique') {
    if (type === 'mecanique') {
      const newSet = new Set(expandedSujetsMeca);
      newSet.has(sujetId) ? newSet.delete(sujetId) : newSet.add(sujetId);
      setExpandedSujetsMeca(newSet);
    } else {
      const newSet = new Set(expandedSujetsChaos);
      newSet.has(sujetId) ? newSet.delete(sujetId) : newSet.add(sujetId);
      setExpandedSujetsChaos(newSet);
    }
  }

  function toggleChapitre(chapitreId: string, type: 'mecanique' | 'chaotique') {
    if (type === 'mecanique') {
      const newSet = new Set(expandedChapitresMeca);
      newSet.has(chapitreId) ? newSet.delete(chapitreId) : newSet.add(chapitreId);
      setExpandedChapitresMeca(newSet);
    } else {
      const newSet = new Set(expandedChapitresChaos);
      newSet.has(chapitreId) ? newSet.delete(chapitreId) : newSet.add(chapitreId);
      setExpandedChapitresChaos(newSet);
    }
  }

  function compterFeuilles(sujets: Sujet[], type: 'mecanique' | 'chaotique'): number {
    return sujets.reduce((acc, s) => 
      acc + s.chapitres.reduce((acc2, c) => 
        acc2 + c.feuilles.filter(f => 
          !f.est_validee && f.type === type
        ).length
      , 0)
    , 0);
  }

  function compterFeuillesSujet(chapitres: Chapitre[], type: 'mecanique' | 'chaotique'): number {
    return chapitres.reduce((acc, c) => 
      acc + c.feuilles.filter(f => 
        !f.est_validee && f.type === type
      ).length
    , 0);
  }

  function compterFeuillesChapitre(feuilles: Feuille[], type: 'mecanique' | 'chaotique'): number {
    return feuilles.filter(f => 
      !f.est_validee && f.type === type
    ).length;
  }

  function renderDifficulte(difficulte: number | null) {
    if (difficulte === null) return null;
    
    const rows = 2;
    const cols = 3;
    const total = rows * cols;
    
    return (
      <div className="inline-flex gap-0.5">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex flex-col gap-0.5">
            {Array.from({ length: cols }).map((_, colIdx) => {
              const index = rowIdx * cols + colIdx;
              const isFilled = index < difficulte;
              return (
                <div
                  key={colIdx}
                  className={`w-1.5 h-1.5 rounded-sm ${
                    isFilled ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  function renderAccordeon(type: 'mecanique' | 'chaotique') {
    const expandedNiveaux = type === 'mecanique' ? expandedNiveauxMeca : expandedNiveauxChaos;
    const expandedSujets = type === 'mecanique' ? expandedSujetsMeca : expandedSujetsChaos;
    const expandedChapitres = type === 'mecanique' ? expandedChapitresMeca : expandedChapitresChaos;

    return (
      <div className="space-y-2">
        {niveaux.map(niveau => {
          const nbFeuilles = compterFeuilles(niveau.sujets, type);
          if (nbFeuilles === 0) return null;

          return (
            <div key={niveau.id} className="border-2 border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleNiveau(niveau.id, type)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  📚 {niveau.titre} ({nbFeuilles} feuille{nbFeuilles > 1 ? 's' : ''})
                </span>
                <span className="text-gray-500">
                  {expandedNiveaux.has(niveau.id) ? '▼' : '▶'}
                </span>
              </button>

              {expandedNiveaux.has(niveau.id) && (
                <div className="p-2 space-y-2 bg-white">
                  {niveau.sujets.map(sujet => {
                    const nbFeuillesSujet = compterFeuillesSujet(sujet.chapitres, type);
                    if (nbFeuillesSujet === 0) return null;

                    return (
                      <div key={sujet.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSujet(sujet.id, type)}
                          className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left text-sm transition-colors"
                        >
                          <span className="font-medium text-gray-800">
                            📖 {sujet.titre} ({nbFeuillesSujet})
                          </span>
                          <span className="text-gray-400">
                            {expandedSujets.has(sujet.id) ? '▼' : '▶'}
                          </span>
                        </button>

                        {expandedSujets.has(sujet.id) && (
                          <div className="p-2 space-y-1 bg-white">
                            {sujet.chapitres.map(chapitre => {
                              const nbFeuillesChapitre = compterFeuillesChapitre(chapitre.feuilles, type);
                              if (nbFeuillesChapitre === 0) return null;

                              return (
                                <div key={chapitre.id} className="border border-gray-100 rounded overflow-hidden">
                                  <button
                                    onClick={() => toggleChapitre(chapitre.id, type)}
                                    className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left text-sm transition-colors"
                                  >
                                    <span className="text-gray-700">
                                      📑 {chapitre.titre} ({nbFeuillesChapitre})
                                    </span>
                                    <span className="text-gray-400 text-xs">
                                      {expandedChapitres.has(chapitre.id) ? '▼' : '▶'}
                                    </span>
                                  </button>

                                  {expandedChapitres.has(chapitre.id) && (
                                    <div className="p-2 space-y-1 bg-white">
                                      {chapitre.feuilles
                                        .filter(f => f.type === type && !f.est_validee)
                                        .map(feuille => (
                                          <div
                                            key={feuille.id}
                                            className={`flex items-center justify-between p-2 rounded text-sm ${
                                              feuille.est_autorisee
                                                ? 'bg-green-50 border border-green-200'
                                                : 'bg-white border border-gray-200 hover:bg-gray-50'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              {feuille.est_autorisee ? (
                                                <span className="text-green-600">🟢</span>
                                              ) : (
                                                <span className="text-gray-400">⚪</span>
                                              )}
                                              <span className="text-gray-900">
                                                #{feuille.ordre} - {feuille.titre}
                                              </span>
                                              {feuille.difficulte && renderDifficulte(feuille.difficulte)}
                                            </div>
                                            {!feuille.est_autorisee ? (
                                              <button
                                                onClick={() => handleAutoriser(feuille.id, type)}
                                                disabled={saving}
                                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-medium rounded transition-colors"
                                              >
                                                Autoriser
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() => handleRetirer(feuille.id)}
                                                disabled={saving}
                                                className="px-3 py-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white text-xs font-medium rounded transition-colors"
                                              >
                                                Retirer
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 border-b-2 border-gray-300 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Gérer les feuilles
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {membre.membre_nom} • Maximum : 1 mécanique + 1 chaotique
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Section Mécanique */}
          <div className="border-2 border-blue-200 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-blue-100/20">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              🔧 Feuille Mécanique <span className="text-sm font-normal">(1 maximum)</span>
            </h3>

            {feuilleMecaAutorisee ? (
              <div className="mb-4 p-3 bg-green-100/30 border-2 border-green-300 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-green-900">✅ Actuellement autorisée :</div>
                    <div className="font-bold text-green-800 mt-1 flex items-center gap-2">
                      #{feuilleMecaAutorisee.ordre} - {feuilleMecaAutorisee.titre}
                      {feuilleMecaAutorisee.difficulte && renderDifficulte(feuilleMecaAutorisee.difficulte)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRetirer(feuilleMecaAutorisee.id)}
                    disabled={saving}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-100 border-2 border-gray-300 rounded-lg">
                <div className="text-sm text-gray-600">Aucune feuille mécanique autorisée</div>
              </div>
            )}

            {!feuilleMecaAutorisee && (
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Choisir une feuille à autoriser :
                </label>
                {renderAccordeon('mecanique')}
              </div>
            )}
          </div>

          {/* Section Chaotique */}
          <div className="border-2 border-purple-200 rounded-xl p-4 bg-gradient-to-br from-purple-50 to-purple-100/20">
            <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
              🎲 Feuille Chaotique <span className="text-sm font-normal">(1 maximum)</span>
            </h3>

            {feuilleChaosAutorisee ? (
              <div className="mb-4 p-3 bg-green-100/30 border-2 border-green-300 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-green-900">✅ Actuellement autorisée :</div>
                    <div className="font-bold text-green-800 mt-1 flex items-center gap-2">
                      #{feuilleChaosAutorisee.ordre} - {feuilleChaosAutorisee.titre}
                      {feuilleChaosAutorisee.difficulte && renderDifficulte(feuilleChaosAutorisee.difficulte)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRetirer(feuilleChaosAutorisee.id)}
                    disabled={saving}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-100 border-2 border-gray-300 rounded-lg">
                <div className="text-sm text-gray-600">Aucune feuille chaotique autorisée</div>
              </div>
            )}

            {!feuilleChaosAutorisee && (
              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Choisir une feuille à autoriser :
                </label>
                {renderAccordeon('chaotique')}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-gray-300 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}