'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ReactFlow, {
 Node,
 Edge,
 Controls,
 Background,
 useNodesState,
 useEdgesState,
 MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

type Feuille = {
 id: string;
 titre: string;
 ordre: number;
 chapitre_id: string;
 chapitre_titre: string;
 sujet_titre: string;
 niveau_titre: string;
};

type Prerequis = {
 id?: string;
 feuille_id: string;
 prerequis_id: string;
 obligatoire: boolean;
 prerequis_titre?: string;
};

export default function GestionPrerequisAdmin() {
 const [loading, setLoading] = useState(true);
 const [feuilles, setFeuilles] = useState<Feuille[]>([]);
 const [feuilleSelectionnee, setFeuilleSelectionnee] = useState<string>('');
 const [prerequisActuels, setPrerequisActuels] = useState<Prerequis[]>([]);
 const [nouveauPrerequisId, setNouveauPrerequisId] = useState<string>('');
 const [estObligatoire, setEstObligatoire] = useState(true);
 const [saving, setSaving] = useState(false);

 // États pour le graphe
 const [nodes, setNodes, onNodesChange] = useNodesState([]);
 const [edges, setEdges, onEdgesChange] = useEdgesState([]);

 // États pour l'accordéon de sélection
 const [openNiveaux, setOpenNiveaux] = useState<Set<string>>(new Set());
 const [openSujets, setOpenSujets] = useState<Set<string>>(new Set());
 const [openChapitres, setOpenChapitres] = useState<Set<string>>(new Set());

 // Organiser les feuilles par hiérarchie
 const hierarchie = React.useMemo(() => {
 const result: any = {};
 feuilles.forEach(f => {
 if (!result[f.niveau_titre]) result[f.niveau_titre] = {};
 if (!result[f.niveau_titre][f.sujet_titre]) result[f.niveau_titre][f.sujet_titre] = {};
 if (!result[f.niveau_titre][f.sujet_titre][f.chapitre_titre]) {
 result[f.niveau_titre][f.sujet_titre][f.chapitre_titre] = [];
 }
 result[f.niveau_titre][f.sujet_titre][f.chapitre_titre].push(f);
 });
 return result;
 }, [feuilles]);

 useEffect(() => {
 loadFeuilles();
 }, []);

 useEffect(() => {
 if (feuilleSelectionnee) {
 loadPrerequisActuels();
 }
 }, [feuilleSelectionnee]);

 async function loadFeuilles() {
 try {
 setLoading(true);

 const { data } = await supabase
 .from('feuille_entrainement')
 .select(`
 id, titre, ordre, chapitre_id,
 chapitre!inner(
 titre,
 sujet!inner(
 titre,
 niveau!inner(titre)
 )
 )
 `)
 .order('ordre');

 if (data) {
 const feuillesFormatees: Feuille[] = data.map((f: any) => ({
 id: f.id,
 titre: f.titre,
 ordre: f.ordre,
 chapitre_id: f.chapitre_id,
 chapitre_titre: f.chapitre?.titre || 'N/A',
 sujet_titre: f.chapitre?.sujet?.titre || 'N/A',
 niveau_titre: f.chapitre?.sujet?.niveau?.titre || 'N/A',
 }));
 setFeuilles(feuillesFormatees);
 }
 } catch (error) {
 console.error('Erreur chargement feuilles:', error);
 alert('Erreur lors du chargement');
 } finally {
 setLoading(false);
 }
 }

 async function loadPrerequisActuels() {
 try {
 const { data } = await supabase
 .from('prerequis')
 .select(`
 feuille_id, prerequis_id, obligatoire,
 prerequis:feuille_entrainement!prerequis_prerequis_id_fkey(titre)
 `)
 .eq('feuille_id', feuilleSelectionnee);

 if (data) {
 const prerequisFormates: Prerequis[] = data.map((p: any) => ({
 feuille_id: p.feuille_id,
 prerequis_id: p.prerequis_id,
 obligatoire: p.obligatoire,
 prerequis_titre: p.prerequis?.titre || 'Inconnu',
 }));
 setPrerequisActuels(prerequisFormates);
 
 // Mettre à jour le graphe
 updateGraphe(feuilleSelectionnee, prerequisFormates);
 }
 } catch (error) {
 console.error('Erreur chargement prérequis:', error);
 }
 }

 function updateGraphe(feuilleId: string, prerequis: Prerequis[]) {
 // Nœud principal (feuille sélectionnée)
 const feuilleSelec = feuilles.find(f => f.id === feuilleId);
 if (!feuilleSelec) return;

 const newNodes: Node[] = [
 {
 id: feuilleId,
 type: 'default',
 position: { x: 400, y: 200 },
 data: {
 label: (
 <div className="text-center">
 <div className="font-bold text-accent">Feuille sélectionnée</div>
 <div className="text-sm">#{feuilleSelec.ordre} - {feuilleSelec.titre}</div>
 </div>
 ),
 },
 style: {
 backgroundColor: '#dbeafe',
 border: '3px solid #3b82f6',
 borderRadius: '8px',
 padding: '12px',
 width: 220,
 },
 },
 ];

 // Nœuds des prérequis
 prerequis.forEach((p, index) => {
 const angle = (index / prerequis.length) * 2 * Math.PI;
 const radius = 200;
 const x = 400 + radius * Math.cos(angle);
 const y = 200 + radius * Math.sin(angle);

 newNodes.push({
 id: p.prerequis_id,
 type: 'default',
 position: { x, y },
 data: {
 label: (
 <div className="text-center text-xs">
 <div className="font-medium">{p.prerequis_titre}</div>
 <div className="text-ink-muted">
 {p.obligatoire ? '🔴 Obligatoire' : '🟡 Recommandé'}
 </div>
 </div>
 ),
 },
 style: {
 backgroundColor: p.obligatoire ? '#fee2e2' : '#fef3c7',
 border: `2px solid ${p.obligatoire ? '#ef4444' : '#f59e0b'}`,
 borderRadius: '8px',
 padding: '8px',
 width: 180,
 },
 });
 });

 // Arêtes (connexions)
 const newEdges: Edge[] = prerequis.map(p => ({
 id: `${p.prerequis_id}-${feuilleId}`,
 source: p.prerequis_id,
 target: feuilleId,
 type: 'smoothstep',
 animated: true,
 markerEnd: {
 type: MarkerType.ArrowClosed,
 width: 20,
 height: 20,
 color: p.obligatoire ? '#ef4444' : '#f59e0b',
 },
 style: {
 stroke: p.obligatoire ? '#ef4444' : '#f59e0b',
 strokeWidth: 2,
 },
 label: p.obligatoire ? 'Obligatoire' : 'Recommandé',
 labelStyle: { fontSize: 10, fontWeight: 600 },
 labelBgStyle: { fill: 'white' },
 }));

 setNodes(newNodes);
 setEdges(newEdges);
 }

 async function ajouterPrerequis() {
 if (!feuilleSelectionnee || !nouveauPrerequisId) {
 alert('Sélectionnez une feuille et un prérequis');
 return;
 }

 if (feuilleSelectionnee === nouveauPrerequisId) {
 alert('Une feuille ne peut pas être son propre prérequis');
 return;
 }

 // Vérifier si le prérequis existe déjà
 const existe = prerequisActuels.some(p => p.prerequis_id === nouveauPrerequisId);
 if (existe) {
 alert('Ce prérequis existe déjà');
 return;
 }

 // TODO: Vérifier les cycles (A → B → A)

 try {
 setSaving(true);

 const { error } = await supabase
 .from('prerequis')
 .insert({
 feuille_id: feuilleSelectionnee,
 prerequis_id: nouveauPrerequisId,
 obligatoire: estObligatoire,
 });

 if (error) throw error;

 alert('✅ Prérequis ajouté');
 setNouveauPrerequisId('');
 await loadPrerequisActuels();
 } catch (error: any) {
 console.error('Erreur ajout prérequis:', error);
 alert('Erreur : ' + error.message);
 } finally {
 setSaving(false);
 }
 }

 async function retirerPrerequis(prerequisId: string) {
 if (!confirm('Retirer ce prérequis ?')) return;

 try {
 setSaving(true);

 const { error } = await supabase
 .from('prerequis')
 .delete()
 .eq('feuille_id', feuilleSelectionnee)
 .eq('prerequis_id', prerequisId);

 if (error) throw error;

 alert('✅ Prérequis retiré');
 await loadPrerequisActuels();
 } catch (error: any) {
 console.error('Erreur retrait prérequis:', error);
 alert('Erreur : ' + error.message);
 } finally {
 setSaving(false);
 }
 }

 const toggleNiveau = (niveau: string) => {
 const newSet = new Set(openNiveaux);
 newSet.has(niveau) ? newSet.delete(niveau) : newSet.add(niveau);
 setOpenNiveaux(newSet);
 };

 const toggleSujet = (sujet: string) => {
 const newSet = new Set(openSujets);
 newSet.has(sujet) ? newSet.delete(sujet) : newSet.add(sujet);
 setOpenSujets(newSet);
 };

 const toggleChapitre = (chapitre: string) => {
 const newSet = new Set(openChapitres);
 newSet.has(chapitre) ? newSet.delete(chapitre) : newSet.add(chapitre);
 setOpenChapitres(newSet);
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center py-12">
 <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600"></div>
 </div>
 );
 }

 const feuilleSelec = feuilles.find(f => f.id === feuilleSelectionnee);

 return (
 <div className="space-y-6">
 {/* Sélection de la feuille avec accordéon */}
 <div className="bg-cream-50 rounded-lg p-6 border border-border">
 <h2 className="text-xl font-bold text-ink mb-4">
 1️⃣ Sélectionner une feuille
 </h2>
 
 {feuilleSelectionnee && (
 <div className="mb-4 p-3 bg-accent-light border border-blue-300 rounded-lg">
 <div className="text-sm font-medium text-accent">
 ✅ Feuille sélectionnée :
 </div>
 <div className="font-bold text-blue-800 mt-1">
 {feuilleSelec?.niveau_titre} › {feuilleSelec?.sujet_titre} › {feuilleSelec?.chapitre_titre} › #{feuilleSelec?.ordre} - {feuilleSelec?.titre}
 </div>
 <button
 onClick={() => setFeuilleSelectionnee('')}
 className="mt-2 px-3 py-1 bg-accent hover:bg-accent-hover text-ink text-sm font-medium rounded"
 >
 Changer de feuille
 </button>
 </div>
 )}

 {!feuilleSelectionnee && (
 <div className="space-y-2">
 {Object.entries(hierarchie).map(([niveau, sujets]) => (
 <div key={niveau} className="border border-border rounded-lg overflow-hidden">
 <button
 onClick={() => toggleNiveau(niveau)}
 className="w-full px-4 py-3 bg-cream-100 hover:bg-cream-200 flex items-center justify-between text-left transition-colors"
 >
 <span className="font-semibold text-ink">
 📚 {niveau}
 </span>
 <span className="text-ink-muted">
 {openNiveaux.has(niveau) ? '▼' : '▶'}
 </span>
 </button>

 {openNiveaux.has(niveau) && (
 <div className="p-2 space-y-2 bg-cream-50">
 {Object.entries(sujets as any).map(([sujet, chapitres]) => (
 <div key={sujet} className="border border-border rounded-lg overflow-hidden">
 <button
 onClick={() => toggleSujet(`${niveau}-${sujet}`)}
 className="w-full px-3 py-2 bg-cream-100 hover:bg-cream-200 flex items-center justify-between text-left text-sm transition-colors"
 >
 <span className="font-medium text-slate-800">
 📖 {sujet}
 </span>
 <span className="text-ink-muted">
 {openSujets.has(`${niveau}-${sujet}`) ? '▼' : '▶'}
 </span>
 </button>

 {openSujets.has(`${niveau}-${sujet}`) && (
 <div className="p-2 space-y-1 bg-cream-50">
 {Object.entries(chapitres as any).map(([chapitre, feuillesList]) => (
 <div key={chapitre} className="border border-slate-100 rounded overflow-hidden">
 <button
 onClick={() => toggleChapitre(`${niveau}-${sujet}-${chapitre}`)}
 className="w-full px-3 py-2 bg-cream-100 hover:bg-cream-200 flex items-center justify-between text-left text-sm transition-colors"
 >
 <span className="text-ink">
 📑 {chapitre}
 </span>
 <span className="text-ink-muted text-xs">
 {openChapitres.has(`${niveau}-${sujet}-${chapitre}`) ? '▼' : '▶'}
 </span>
 </button>

 {openChapitres.has(`${niveau}-${sujet}-${chapitre}`) && (
 <div className="p-2 space-y-1 bg-cream-50">
 {(feuillesList as Feuille[]).map(feuille => (
 <button
 key={feuille.id}
 onClick={() => setFeuilleSelectionnee(feuille.id)}
 className="w-full text-left px-3 py-2 rounded text-sm bg-cream-50 border border-border hover:bg-accent-light hover:border-blue-300 transition-colors"
 >
 <span className="text-ink">
 #{feuille.ordre} - {feuille.titre}
 </span>
 </button>
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
 )}
 </div>

 {feuilleSelectionnee && feuilleSelec && (
 <>
 {/* Prérequis actuels */}
 <div className="bg-cream-50 rounded-lg p-6 border border-border">
 <h2 className="text-xl font-bold text-ink mb-4">
 2️⃣ Prérequis actuels
 </h2>

 {prerequisActuels.length === 0 ? (
 <div className="text-center py-8 text-ink-muted">
 Aucun prérequis défini pour cette feuille
 </div>
 ) : (
 <div className="space-y-2">
 {prerequisActuels.map(p => (
 <div
 key={p.prerequis_id}
 className="flex items-center justify-between p-3 bg-cream-100 rounded-lg"
 >
 <div className="flex items-center gap-3">
 <span className={`text-2xl ${p.obligatoire ? '🔴' : '🟡'}`}>
 {p.obligatoire ? '🔴' : '🟡'}
 </span>
 <div>
 <div className="font-medium text-ink">
 {p.prerequis_titre}
 </div>
 <div className="text-sm text-ink-muted">
 {p.obligatoire ? 'Obligatoire' : 'Recommandé'}
 </div>
 </div>
 </div>
 <button
 onClick={() => retirerPrerequis(p.prerequis_id)}
 disabled={saving}
 className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-ink text-sm font-medium rounded-lg transition-colors"
 >
 Retirer
 </button>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Ajouter un prérequis */}
 <div className="bg-cream-50 rounded-lg p-6 border border-border">
 <h2 className="text-xl font-bold text-ink mb-4">
 3️⃣ Ajouter un prérequis
 </h2>
 
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-ink mb-2">
 Feuille prérequise :
 </label>
 
 {nouveauPrerequisId ? (
 <div className="mb-3 p-3 bg-green-50 border border-green-300 rounded-lg">
 <div className="text-sm font-medium text-status-success">
 ✅ Prérequis sélectionné :
 </div>
 <div className="font-bold text-green-800 mt-1">
 {feuilles.find(f => f.id === nouveauPrerequisId)?.niveau_titre} › {' '}
 {feuilles.find(f => f.id === nouveauPrerequisId)?.sujet_titre} › {' '}
 {feuilles.find(f => f.id === nouveauPrerequisId)?.chapitre_titre} › {' '}
 #{feuilles.find(f => f.id === nouveauPrerequisId)?.ordre} - {feuilles.find(f => f.id === nouveauPrerequisId)?.titre}
 </div>
 <button
 onClick={() => setNouveauPrerequisId('')}
 className="mt-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-ink text-sm font-medium rounded"
 >
 Changer de feuille
 </button>
 </div>
 ) : (
 <div className="space-y-2 max-h-96 overflow-y-auto border border-border rounded-lg p-2">
 {Object.entries(hierarchie).map(([niveau, sujets]) => (
 <div key={niveau} className="border border-border rounded-lg overflow-hidden">
 <button
 onClick={() => toggleNiveau(niveau)}
 className="w-full px-4 py-3 bg-cream-100 hover:bg-cream-200 flex items-center justify-between text-left transition-colors"
 >
 <span className="font-semibold text-ink">
 📚 {niveau}
 </span>
 <span className="text-ink-muted">
 {openNiveaux.has(niveau) ? '▼' : '▶'}
 </span>
 </button>

 {openNiveaux.has(niveau) && (
 <div className="p-2 space-y-2 bg-cream-50">
 {Object.entries(sujets as any).map(([sujet, chapitres]) => (
 <div key={sujet} className="border border-border rounded-lg overflow-hidden">
 <button
 onClick={() => toggleSujet(`${niveau}-${sujet}`)}
 className="w-full px-3 py-2 bg-cream-100 hover:bg-cream-200 flex items-center justify-between text-left text-sm transition-colors"
 >
 <span className="font-medium text-slate-800">
 📖 {sujet}
 </span>
 <span className="text-ink-muted">
 {openSujets.has(`${niveau}-${sujet}`) ? '▼' : '▶'}
 </span>
 </button>

 {openSujets.has(`${niveau}-${sujet}`) && (
 <div className="p-2 space-y-1 bg-cream-50">
 {Object.entries(chapitres as any).map(([chapitre, feuillesList]) => (
 <div key={chapitre} className="border border-slate-100 rounded overflow-hidden">
 <button
 onClick={() => toggleChapitre(`${niveau}-${sujet}-${chapitre}`)}
 className="w-full px-3 py-2 bg-cream-100 hover:bg-cream-200 flex items-center justify-between text-left text-sm transition-colors"
 >
 <span className="text-ink">
 📑 {chapitre}
 </span>
 <span className="text-ink-muted text-xs">
 {openChapitres.has(`${niveau}-${sujet}-${chapitre}`) ? '▼' : '▶'}
 </span>
 </button>

 {openChapitres.has(`${niveau}-${sujet}-${chapitre}`) && (
 <div className="p-2 space-y-1 bg-cream-50">
 {(feuillesList as Feuille[])
 .filter(f => f.id !== feuilleSelectionnee)
 .map(feuille => (
 <button
 key={feuille.id}
 onClick={() => setNouveauPrerequisId(feuille.id)}
 disabled={prerequisActuels.some(p => p.prerequis_id === feuille.id)}
 className="w-full text-left px-3 py-2 rounded text-sm bg-cream-50 border border-border hover:bg-green-50 hover:border-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 <span className="text-ink">
 #{feuille.ordre} - {feuille.titre}
 </span>
 {prerequisActuels.some(p => p.prerequis_id === feuille.id) && (
 <span className="ml-2 text-xs text-ink-muted">(déjà ajouté)</span>
 )}
 </button>
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
 )}
 </div>

 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="obligatoire"
 checked={estObligatoire}
 onChange={(e) => setEstObligatoire(e.target.checked)}
 className="w-5 h-5 rounded border-border"
 disabled={saving}
 />
 <label htmlFor="obligatoire" className="text-sm font-medium text-ink">
 Prérequis obligatoire (sinon recommandé)
 </label>
 </div>

 <button
 onClick={ajouterPrerequis}
 disabled={!nouveauPrerequisId || saving}
 className="w-full px-4 py-3 bg-accent hover:bg-accent disabled:bg-slate-300 text-ink font-semibold rounded-lg transition-colors"
 >
 {saving ? 'Ajout...' : '➕ Ajouter ce prérequis'}
 </button>
 </div>
 </div>

 {/* Visualisation graphe */}
 {prerequisActuels.length > 0 && (
 <div className="bg-cream-50 rounded-lg p-6 border border-border">
 <h2 className="text-xl font-bold text-ink mb-4">
 4️⃣ Visualisation des dépendances
 </h2>
 <div style={{ height: '400px', width: '100%' }} className="border border-border rounded-lg overflow-hidden">
 <ReactFlow
 nodes={nodes}
 edges={edges}
 onNodesChange={onNodesChange}
 onEdgesChange={onEdgesChange}
 fitView
 fitViewOptions={{ padding: 0.2 }}
 >
 <Background />
 <Controls />
 </ReactFlow>
 </div>
 </div>
 )}
 </>
 )}
 </div>
 );
}