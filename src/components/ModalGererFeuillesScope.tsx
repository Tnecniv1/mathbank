'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import VueGraphe from './VueGraphe';

/* ─── Types ─────────────────────────────────────────────────────────── */

type FeuilleOption = {
  id: string;
  titre: string;
  ordre: number;
  type: 'mecanique' | 'chaotique';
  difficulte: number | null;
  est_validee: boolean;
  est_autorisee: boolean;
  sujet_titre: string;
};

type NiveauSimple = {
  id: string;
  titre: string;
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

/* ─── Composant ─────────────────────────────────────────────────────── */

export default function ModalGererFeuillesScope({ membre, onClose, onUpdate }: Props) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [modeVue, setModeVue]   = useState<'scope' | 'graphe'>('scope');

  const [feuillesMeca,  setFeuillesMeca]  = useState<FeuilleOption[]>([]);
  const [feuillesChaos, setFeuillesChaos] = useState<FeuilleOption[]>([]);

  const [feuilleSelectMecaId,  setFeuilleSelectMecaId]  = useState('');
  const [feuilleSelectChaosId, setFeuilleSelectChaosId] = useState('');

  const [feuilleMecaAutorisee,  setFeuilleMecaAutorisee]  = useState<FeuilleOption | null>(null);
  const [feuilleChaosAutorisee, setFeuilleChaosAutorisee] = useState<FeuilleOption | null>(null);

  const [niveauxOptions,    setNiveauxOptions]    = useState<NiveauSimple[]>([]);
  const [niveauSelectionne, setNiveauSelectionne] = useState('');

  useEffect(() => { loadData(); }, [membre.user_id]);

  async function loadData() {
    try {
      setLoading(true);

      // Toutes les données hiérarchiques en une seule requête
      const [
        { data: tousNoeuds },
        { data: validees },
        { data: autorisees },
      ] = await Promise.all([
        supabase.from('noeud').select('id, parent_id, titre, ordre, type, difficulte').order('ordre'),
        supabase.from('progression_feuille').select('feuille_id').eq('user_id', membre.user_id).eq('est_termine', true),
        supabase.from('feuilles_autorisees').select('feuille_id').eq('membre_id', membre.membre_id || membre.user_id),
      ]);

      const noeuds = tousNoeuds || [];
      const noeudMap = new Map(noeuds.map((n: any) => [n.id, n]));

      const idsValidees   = new Set((validees   || []).map((p: any) => p.feuille_id));
      const idsAutorisees = new Set((autorisees || []).map((f: any) => f.feuille_id));

      // Remonter parent_id jusqu'au nœud de type 'sujet'
      function getSujetTitre(feuilleId: string): string {
        let n: any = noeudMap.get(feuilleId);
        while (n && n.type !== 'sujet') n = noeudMap.get(n.parent_id);
        return n?.titre ?? '—';
      }

      // Construire les options enrichies
      const feuilles: FeuilleOption[] = noeuds
        .filter((n: any) => n.type === 'mecanique' || n.type === 'chaotique')
        .map((f: any) => ({
          id:           f.id,
          titre:        f.titre,
          ordre:        f.ordre,
          type:         f.type as 'mecanique' | 'chaotique',
          difficulte:   f.difficulte,
          est_validee:  idsValidees.has(f.id),
          est_autorisee: idsAutorisees.has(f.id),
          sujet_titre:  getSujetTitre(f.id),
        }));

      setFeuillesMeca(feuilles.filter(f => f.type === 'mecanique'));
      setFeuillesChaos(feuilles.filter(f => f.type === 'chaotique'));

      // Feuilles actuellement autorisées et non validées
      setFeuilleMecaAutorisee(
        feuilles.find(f => f.type === 'mecanique' && f.est_autorisee && !f.est_validee) ?? null
      );
      setFeuilleChaosAutorisee(
        feuilles.find(f => f.type === 'chaotique' && f.est_autorisee && !f.est_validee) ?? null
      );

      // Niveaux pour le sélecteur Vue Graphe
      const niveaux: NiveauSimple[] = noeuds
        .filter((n: any) => n.type === 'niveau')
        .map((n: any) => ({ id: n.id, titre: n.titre }));
      setNiveauxOptions(niveaux);
      if (!niveauSelectionne && niveaux.length > 0) setNiveauSelectionne(niveaux[0].id);

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
      const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
        p_membre_id:          membre.membre_id || null,
        p_feuilles_a_ajouter: [feuilleId],
        p_feuilles_a_retirer: [],
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Erreur lors de l\'autorisation');
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
    if (!confirm('Retirer cette feuille des autorisations ?')) return;
    try {
      setSaving(true);
      const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
        p_membre_id:          membre.membre_id || null,
        p_feuilles_a_ajouter: [],
        p_feuilles_a_retirer: [feuilleId],
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Erreur lors du retrait');
      await loadData();
      onUpdate();
    } catch (error: any) {
      console.error('Erreur retrait:', error);
      alert(error.message || 'Erreur lors du retrait');
    } finally {
      setSaving(false);
    }
  }

  async function handleReviser(feuille: FeuilleOption) {
    if (!confirm(`Lancer une révision de cette feuille pour ${membre.membre_nom} ?`)) return;
    try {
      setSaving(true);
      const { data, error } = await supabase.rpc('autoriser_revision_feuille', {
        p_membre_id:  membre.membre_id || membre.user_id,
        p_feuille_id: feuille.id,
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Erreur lors de la révision');
      await loadData();
      onUpdate();
    } catch (error: any) {
      console.error('Erreur révision:', error);
      alert(error.message || 'Erreur lors de la révision');
    } finally {
      setSaving(false);
    }
  }

  function renderDifficulte(diff: number) {
    const colors = { 1: 'text-status-success', 2: 'text-yellow-600', 3: 'text-orange-600', 4: 'text-red-600', 5: 'text-red-800' };
    const labels = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐', 4: '⭐⭐⭐⭐', 5: '⭐⭐⭐⭐⭐' };
    return <span className={colors[diff as keyof typeof colors] || 'text-ink-light'}>{labels[diff as keyof typeof labels] || diff}</span>;
  }

  // Grouper les feuilles par sujet_titre pour les <optgroup>
  function groupBySujet(feuilles: FeuilleOption[]): Map<string, FeuilleOption[]> {
    const map = new Map<string, FeuilleOption[]>();
    for (const f of feuilles) {
      if (!map.has(f.sujet_titre)) map.set(f.sujet_titre, []);
      map.get(f.sujet_titre)!.push(f);
    }
    return map;
  }

  function renderSecteurFeuille(
    type: 'mecanique' | 'chaotique',
    feuilleAutorisee: FeuilleOption | null,
    feuilles: FeuilleOption[],
    selectId: string,
    setSelectId: (v: string) => void,
  ) {
    const isMeca   = type === 'mecanique';
    const emoji    = isMeca ? '🔧' : '🎲';
    const label    = isMeca ? 'Feuille mécanique' : 'Feuille chaotique';
    const border   = isMeca ? 'border-border' : 'border-purple-200';
    const titleCls = isMeca ? 'text-accent'    : 'text-purple-900';
    const labelCls = isMeca ? 'text-accent'    : 'text-purple-900';

    // Feuilles validées avec autorisation (éligibles à révision)
    const feuillesValidees = feuilles.filter(f => f.est_validee && f.est_autorisee);
    // Feuilles disponibles pour un nouveau select (non validées, non autorisées)
    const disponibles = feuilles.filter(f => !f.est_validee);
    const groupes = groupBySujet(disponibles);

    return (
      <div className={`border ${border} rounded-lg p-4`}>
        <h3 className={`text-lg font-bold ${titleCls} mb-4 flex items-center gap-2`}>
          {emoji} {label} <span className="text-sm font-normal">(1 maximum)</span>
        </h3>

        {/* Feuille actuellement autorisée */}
        {feuilleAutorisee ? (
          <div className="mb-4 p-3 bg-green-50/30 border border-green-300 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-status-success">✅ Actuellement autorisée :</div>
                <div className="font-bold text-green-800 mt-1 flex items-center gap-2">
                  {feuilleAutorisee.sujet_titre} — {feuilleAutorisee.titre}
                  {feuilleAutorisee.difficulte && renderDifficulte(feuilleAutorisee.difficulte)}
                </div>
              </div>
              <button
                onClick={() => handleRetirer(feuilleAutorisee.id)}
                disabled={saving}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-ink text-sm font-medium rounded-lg transition-colors"
              >
                Retirer
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-cream-200 border border-border rounded-lg">
              <div className="text-sm text-ink-light">Aucune {label.toLowerCase()} autorisée</div>
            </div>

            {/* Sélecteur + bouton Autoriser */}
            <div className="space-y-3">
              <label className={`block text-sm font-medium ${labelCls}`}>
                {label} :
              </label>
              <div className="flex gap-2">
                <select
                  value={selectId}
                  onChange={(e) => setSelectId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent outline-none text-sm"
                >
                  <option value="">-- Choisir une feuille --</option>
                  {Array.from(groupes.entries()).map(([sujet, items]) => (
                    <optgroup key={sujet} label={sujet}>
                      {items.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.titre}{f.difficulte ? ` (${'⭐'.repeat(f.difficulte)})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  onClick={() => selectId && handleAutoriser(selectId, type)}
                  disabled={saving || !selectId}
                  className="px-4 py-2 bg-accent-light0 hover:bg-accent disabled:bg-gray-300 disabled:cursor-not-allowed text-ink text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  Autoriser
                </button>
              </div>
            </div>
          </>
        )}

        {/* Feuilles validées — proposition de révision */}
        {feuillesValidees.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium text-ink-light uppercase tracking-wide">Feuilles validées</div>
            {feuillesValidees.map(f => (
              <div key={f.id} className="flex items-center justify-between py-2 px-3 rounded border bg-status-success/10 border-status-success/30">
                <div className="text-sm text-ink">
                  <span className="font-medium">{f.sujet_titre} — {f.titre}</span>
                  {f.difficulte && <span className="ml-2">{renderDifficulte(f.difficulte)}</span>}
                  <span className="ml-2 px-2 py-0.5 bg-status-success text-ink text-xs font-bold rounded">✓ Validée</span>
                </div>
                <button
                  onClick={() => handleReviser(f)}
                  disabled={saving}
                  className="px-3 py-1 bg-cream-200 hover:bg-cream-300 disabled:bg-gray-300 text-ink-light text-xs font-medium rounded transition-colors"
                >
                  🔁 Réviser
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─── Rendu ──────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-cream-50 rounded-lg p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600 mx-auto" />
          <p className="mt-4 text-ink-light text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cream-50 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="p-6 border-b-2 border-border sticky top-0 bg-cream-50 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-ink">Gérer les feuilles</h2>
              <p className="text-sm text-ink-light mt-1">
                {membre.membre_nom} • Maximum : 1 mécanique + 1 chaotique
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-cream-200 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Toggle Vue */}
          <div className="flex gap-2">
            <button
              onClick={() => setModeVue('scope')}
              className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
                modeVue === 'scope' ? 'bg-accent text-ink' : 'bg-cream-200 text-ink hover:bg-cream-200'
              }`}
            >
              📚 Vue Scope
            </button>
            <button
              onClick={() => setModeVue('graphe')}
              className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
                modeVue === 'graphe' ? 'bg-accent text-ink' : 'bg-cream-200 text-ink hover:bg-cream-200'
              }`}
            >
              🗺️ Vue Graphe
            </button>
          </div>

          {/* Sélecteur de niveau (vue graphe uniquement) */}
          {modeVue === 'graphe' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-ink mb-2">Niveau à afficher :</label>
              <select
                value={niveauSelectionne}
                onChange={(e) => setNiveauSelectionne(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink"
              >
                {niveauxOptions.map(n => (
                  <option key={n.id} value={n.id}>{n.titre}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Contenu selon le mode */}
        {modeVue === 'scope' ? (
          <div className="p-6 space-y-6">
            {renderSecteurFeuille('mecanique', feuilleMecaAutorisee, feuillesMeca, feuilleSelectMecaId, setFeuilleSelectMecaId)}
            {renderSecteurFeuille('chaotique', feuilleChaosAutorisee, feuillesChaos, feuilleSelectChaosId, setFeuilleSelectChaosId)}
          </div>
        ) : (
          <div className="p-6">
            <VueGraphe
              niveauId={niveauSelectionne}
              membreUserId={membre.user_id}
              onAutoriser={handleAutoriser}
              onRetirer={handleRetirer}
            />
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t-2 border-border sticky bottom-0 bg-cream-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-cream-200 hover:bg-cream-200 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
