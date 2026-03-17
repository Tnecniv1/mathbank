'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import VueGraphe from './VueGraphe';

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

type ChapitreOption = {
 id: string;
 titre: string;
 sujet_titre: string;
};

export default function ModalGererFeuillesScope({ membre, onClose, onUpdate }: Props) {
 const [loading, setLoading] = useState(true);
 const [niveaux, setNiveaux] = useState<Niveau[]>([]);
 const [modeVue, setModeVue] = useState<'scope' | 'graphe'>('scope');
 const [niveauSelectionne, setNiveauSelectionne] = useState<string>('');
 const [chapitreId, setChapitreId] = useState<string | null>(null);
 const [chapitresDisponibles, setChapitresDisponibles] = useState<ChapitreOption[]>([]);
 
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

 // 0. Charger les chapitres pour le sélecteur
 const { data: chapitresData } = await supabase
 .from('chapitre')
 .select('id, titre, sujet:sujet_id(titre, ordre), ordre')
 .order('ordre');

 const chapitresAvecSujet: ChapitreOption[] = (chapitresData || [])
 .map((c: any) => ({
 id: c.id,
 titre: c.titre,
 sujet_titre: c.sujet?.titre || '',
 _sujet_ordre: c.sujet?.ordre ?? 0,
 _chapitre_ordre: c.ordre ?? 0,
 }))
 .sort((a: any, b: any) => a._sujet_ordre - b._sujet_ordre || a._chapitre_ordre - b._chapitre_ordre)
 .map(({ id, titre, sujet_titre }: ChapitreOption) => ({ id, titre, sujet_titre }));

 setChapitresDisponibles(chapitresAvecSujet);

 // 1. Charger la structure hiérarchique SANS les feuilles
 const { data: niveauxData } = await supabase
 .from('niveau')
 .select(`
 id, titre, ordre,
 sujets:sujet (
 id, titre, ordre,
 chapitres:chapitre (
 id, titre, ordre
 )
 )
 `)
 .order('ordre');

 // 2. Charger TOUTES les feuilles séparément
 const { data: toutesLesFeuilles } = await supabase
 .from('feuille_entrainement')
 .select('id, titre, ordre, type, difficulte, chapitre_id')
 .not('type', 'is', null)
 .order('ordre');

 // 3. Organiser les feuilles par chapitre
 const feuillesParChapitre = new Map<string, any[]>();
 toutesLesFeuilles?.forEach((f: any) => {
 if (!feuillesParChapitre.has(f.chapitre_id)) {
 feuillesParChapitre.set(f.chapitre_id, []);
 }
 feuillesParChapitre.get(f.chapitre_id)!.push(f);
 });

 // 4. Charger les feuilles validées
 const { data: feuillesValidees } = await supabase
 .from('progression_feuille')
 .select('feuille_id')
 .eq('user_id', membre.user_id)
 .eq('est_termine', true);

 const idsValidees = new Set(feuillesValidees?.map(p => p.feuille_id) || []);

 // 5. Charger les feuilles autorisées
 const { data: feuillesAutorisees } = await supabase
 .from('feuilles_autorisees')
 .select('feuille_id')
 .eq('membre_id', membre.membre_id || membre.user_id);

 const idsAutorisees = new Set(feuillesAutorisees?.map(f => f.feuille_id) || []);

 // 6. Enrichir avec les feuilles
 const niveauxEnrichis: Niveau[] = (niveauxData || []).map((n: any) => ({
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
 feuilles: (feuillesParChapitre.get(c.id) || [])
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

 // Sélectionner le premier niveau par défaut
 if (niveauxEnrichis.length > 0 && !niveauSelectionne) {
 setNiveauSelectionne(niveauxEnrichis[0].id);
 }

 // 7. Identifier les feuilles autorisées
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

 const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
 p_membre_id: membre.membre_id || null,
 p_feuilles_a_ajouter: [feuilleId],
 p_feuilles_a_retirer: [],
 p_chapitre_id: chapitreId,
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
 if (!confirm('Retirer cette feuille des autorisations ?')) return;

 try {
 setSaving(true);

 const { data, error } = await supabase.rpc('gerer_feuilles_membre', {
 p_membre_id: membre.membre_id || null,
 p_feuilles_a_ajouter: [],
 p_feuilles_a_retirer: [feuilleId],
 p_chapitre_id: chapitreId,
 });

 if (error) throw error;

 if (data && !data.success) {
 throw new Error(data.error || 'Erreur lors du retrait');
 }

 await loadData();
 onUpdate();
 } catch (error: any) {
 console.error('Erreur retrait:', error);
 alert(error.message || 'Erreur lors du retrait');
 } finally {
 setSaving(false);
 }
 }

 async function handleReviser(feuille: Feuille) {
 if (!confirm(`Lancer une révision de cette feuille pour ${membre.membre_nom} ?`)) return;

 try {
 setSaving(true);

 const { data, error } = await supabase.rpc('autoriser_revision_feuille', {
 p_membre_id: membre.membre_id || membre.user_id,
 p_feuille_id: feuille.id,
 });

 if (error) throw error;

 if (data && !data.success) {
 throw new Error(data.error || 'Erreur lors de la révision');
 }

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
 const colors = {
 1: 'text-status-success',
 2: 'text-yellow-600',
 3: 'text-orange-600',
 4: 'text-red-600',
 5: 'text-red-800'
 };
 const labels = {
 1: '⭐',
 2: '⭐⭐',
 3: '⭐⭐⭐',
 4: '⭐⭐⭐⭐',
 5: '⭐⭐⭐⭐⭐'
 };
 return <span className={colors[diff as keyof typeof colors] || 'text-ink-light'}>{labels[diff as keyof typeof labels] || diff}</span>;
 }

 function renderAccordeon(typeFiltre: 'mecanique' | 'chaotique') {
 const expandedNiveaux = typeFiltre === 'mecanique' ? expandedNiveauxMeca : expandedNiveauxChaos;
 const expandedSujets = typeFiltre === 'mecanique' ? expandedSujetsMeca : expandedSujetsChaos;
 const expandedChapitres = typeFiltre === 'mecanique' ? expandedChapitresMeca : expandedChapitresChaos;

 const setExpandedNiveaux = typeFiltre === 'mecanique' ? setExpandedNiveauxMeca : setExpandedNiveauxChaos;
 const setExpandedSujets = typeFiltre === 'mecanique' ? setExpandedSujetsMeca : setExpandedSujetsChaos;
 const setExpandedChapitres = typeFiltre === 'mecanique' ? setExpandedChapitresMeca : setExpandedChapitresChaos;

 return (
 <div className="space-y-2">
 {niveaux.map((niveau) => {
 const sujetsFiltres = niveau.sujets.map(s => ({
 ...s,
 chapitres: s.chapitres.map(c => ({
 ...c,
 feuilles: c.feuilles.filter(f =>
 f.type === typeFiltre &&
 (!chapitreId || c.id === chapitreId)
 )
 })).filter(c => c.feuilles.length > 0)
 })).filter(s => s.chapitres.length > 0);

 if (sujetsFiltres.length === 0) return null;

 const totalFeuilles = sujetsFiltres.reduce((acc, s) => 
 acc + s.chapitres.reduce((acc2, c) => acc2 + c.feuilles.length, 0), 0
 );

 return (
 <div key={niveau.id} className="border border-border rounded-lg overflow-hidden">
 <button
 onClick={() => {
 const newSet = new Set(expandedNiveaux);
 if (newSet.has(niveau.id)) {
 newSet.delete(niveau.id);
 } else {
 newSet.add(niveau.id);
 }
 setExpandedNiveaux(newSet);
 }}
 className="w-full px-4 py-3 flex items-center justify-between bg-cream-100 hover:bg-cream-200 transition-colors"
 >
 <div className="flex items-center gap-2">
 <span className="text-xl">{expandedNiveaux.has(niveau.id) ? '▼' : '▶'}</span>
 <span className="font-semibold text-ink">
 🎓 {niveau.titre} ({totalFeuilles} feuille{totalFeuilles > 1 ? 's' : ''})
 </span>
 </div>
 </button>

 {expandedNiveaux.has(niveau.id) && (
 <div className="p-2 space-y-2 bg-cream-50">
 {sujetsFiltres.map((sujet) => {
 const totalFeuillesSujet = sujet.chapitres.reduce((acc, c) => acc + c.feuilles.length, 0);
 
 return (
 <div key={sujet.id} className="border border-border rounded-lg overflow-hidden">
 <button
 onClick={() => {
 const newSet = new Set(expandedSujets);
 if (newSet.has(sujet.id)) {
 newSet.delete(sujet.id);
 } else {
 newSet.add(sujet.id);
 }
 setExpandedSujets(newSet);
 }}
 className="w-full px-4 py-2 flex items-center justify-between bg-cream-100 hover:bg-cream-200 transition-colors"
 >
 <div className="flex items-center gap-2">
 <span className="text-sm">{expandedSujets.has(sujet.id) ? '▼' : '▶'}</span>
 <span className="font-medium text-gray-800">
 📚 {sujet.titre} ({totalFeuillesSujet})
 </span>
 </div>
 </button>

 {expandedSujets.has(sujet.id) && (
 <div className="p-2 space-y-1.5 bg-cream-50">
 {sujet.chapitres.map((chapitre) => {
 return (
 <div key={chapitre.id} className="border border-border rounded overflow-hidden">
 <button
 onClick={() => {
 const newSet = new Set(expandedChapitres);
 if (newSet.has(chapitre.id)) {
 newSet.delete(chapitre.id);
 } else {
 newSet.add(chapitre.id);
 }
 setExpandedChapitres(newSet);
 }}
 className="w-full px-3 py-2 flex items-center justify-between hover:bg-cream-100 transition-colors"
 >
 <div className="flex items-center gap-2 text-left">
 <span className="text-xs">{expandedChapitres.has(chapitre.id) ? '▼' : '▶'}</span>
 <span className="text-sm font-medium text-ink">
 📖 {chapitre.titre} ({chapitre.feuilles.length})
 </span>
 </div>
 </button>

 {expandedChapitres.has(chapitre.id) && (
 <div className="px-3 py-2 space-y-1.5 bg-cream-100/30">
 {chapitre.feuilles
 .map((feuille) => (
 <div
 key={feuille.id}
 className={`flex items-center justify-between py-2 px-3 rounded border transition-colors ${
 feuille.est_validee
 ? 'bg-status-success/30 border-status-success hover:border-status-success'
 : 'bg-cream-50 border-border hover:border-blue-400'
 }`}
 >
 <div className="flex-1 text-sm">
 <div className="font-medium text-gray-800 flex items-center gap-2">
 {typeFiltre === 'mecanique' ? '🔧' : '🎲'} #{feuille.ordre} - {feuille.titre}
 {feuille.difficulte && renderDifficulte(feuille.difficulte)}
 {feuille.est_validee && (
 <span className="px-2 py-0.5 bg-status-success text-ink text-xs font-bold rounded">
 ✓ Validée
 </span>
 )}
 </div>
 </div>
 {!feuille.est_autorisee && !feuille.est_validee && (
 <button
 onClick={() => handleAutoriser(feuille.id, typeFiltre)}
 disabled={saving}
 className="px-3 py-1 bg-accent-light0 hover:bg-accent disabled:bg-gray-300 text-ink text-xs font-medium rounded transition-colors"
 >
 Autoriser
 </button>
 )}
 {feuille.est_autorisee && (
 <button
 onClick={() => handleRetirer(feuille.id)}
 disabled={saving}
 className="px-3 py-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-ink text-xs font-medium rounded transition-colors"
 >
 Retirer
 </button>
 )}
 {feuille.est_validee && (
 <button
 onClick={() => handleReviser(feuille)}
 disabled={saving}
 className="px-3 py-1 bg-cream-200 hover:bg-cream-300 disabled:bg-gray-300 text-ink-light text-xs font-medium rounded transition-colors"
 >
 🔁 Réviser
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
 <div className="bg-cream-50 rounded-lg p-8">
 <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600 mx-auto"></div>
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
 <h2 className="text-2xl font-bold text-ink">
 Gérer les feuilles
 </h2>
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
 modeVue === 'scope'
 ? 'bg-accent text-ink'
 : 'bg-cream-200 text-ink hover:bg-cream-200'
 }`}
 >
 📚 Vue Scope
 </button>
 <button
 onClick={() => setModeVue('graphe')}
 className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
 modeVue === 'graphe'
 ? 'bg-accent text-ink'
 : 'bg-cream-200 text-ink hover:bg-cream-200'
 }`}
 >
 🗺️ Vue Graphe
 </button>
 </div>

 {/* Sélecteur de niveau (pour vue graphe) */}
 {modeVue === 'graphe' && (
 <div className="mt-4">
 <label className="block text-sm font-medium text-ink mb-2">
 Niveau à afficher :
 </label>
 <select
 value={niveauSelectionne}
 onChange={(e) => setNiveauSelectionne(e.target.value)}
 className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink"
 >
 {niveaux.map(niveau => (
 <option key={niveau.id} value={niveau.id}>
 {niveau.titre}
 </option>
 ))}
 </select>
 </div>
 )}
 </div>

 {/* Contenu selon le mode */}
 {modeVue === 'scope' ? (
 <div className="p-6 space-y-6">
 {/* Sélecteur de chapitre */}
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Nœud (chapitre) :
 </label>
 <select
 value={chapitreId ?? ''}
 onChange={(e) => setChapitreId(e.target.value || null)}
 className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent outline-none"
 >
 <option value="">-- Choisir un nœud (chapitre) --</option>
 {chapitresDisponibles.map(c => (
 <option key={c.id} value={c.id}>
 {c.sujet_titre} — {c.titre}
 </option>
 ))}
 </select>
 </div>

 {/* Section Mécanique */}
 <div className="border border-border rounded-lg p-4 /20">
 <h3 className="text-lg font-bold text-accent mb-4 flex items-center gap-2">
 🔧 Feuille Mécanique <span className="text-sm font-normal">(1 maximum)</span>
 </h3>

 {feuilleMecaAutorisee ? (
 <div className="mb-4 p-3 bg-green-50/30 border border-green-300 rounded-lg">
 <div className="flex items-center justify-between">
 <div>
 <div className="text-sm font-medium text-status-success">✅ Actuellement autorisée :</div>
 <div className="font-bold text-green-800 mt-1 flex items-center gap-2">
 #{feuilleMecaAutorisee.ordre} - {feuilleMecaAutorisee.titre}
 {feuilleMecaAutorisee.difficulte && renderDifficulte(feuilleMecaAutorisee.difficulte)}
 </div>
 </div>
 <button
 onClick={() => handleRetirer(feuilleMecaAutorisee.id)}
 disabled={saving}
 className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-ink text-sm font-medium rounded-lg transition-colors"
 >
 Retirer
 </button>
 </div>
 </div>
 ) : (
 <div className="mb-4 p-3 bg-cream-200 border border-border rounded-lg">
 <div className="text-sm text-ink-light">Aucune feuille mécanique autorisée</div>
 </div>
 )}

 {!feuilleMecaAutorisee && (
 <div>
 <label className="block text-sm font-medium text-accent mb-2">
 Choisir une feuille à autoriser :
 </label>
 {renderAccordeon('mecanique')}
 </div>
 )}
 </div>

 {/* Section Chaotique */}
 <div className="border border-purple-200 rounded-lg p-4 /20">
 <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
 🎲 Feuille Chaotique <span className="text-sm font-normal">(1 maximum)</span>
 </h3>

 {feuilleChaosAutorisee ? (
 <div className="mb-4 p-3 bg-green-50/30 border border-green-300 rounded-lg">
 <div className="flex items-center justify-between">
 <div>
 <div className="text-sm font-medium text-status-success">✅ Actuellement autorisée :</div>
 <div className="font-bold text-green-800 mt-1 flex items-center gap-2">
 #{feuilleChaosAutorisee.ordre} - {feuilleChaosAutorisee.titre}
 {feuilleChaosAutorisee.difficulte && renderDifficulte(feuilleChaosAutorisee.difficulte)}
 </div>
 </div>
 <button
 onClick={() => handleRetirer(feuilleChaosAutorisee.id)}
 disabled={saving}
 className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-ink text-sm font-medium rounded-lg transition-colors"
 >
 Retirer
 </button>
 </div>
 </div>
 ) : (
 <div className="mb-4 p-3 bg-cream-200 border border-border rounded-lg">
 <div className="text-sm text-ink-light">Aucune feuille chaotique autorisée</div>
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