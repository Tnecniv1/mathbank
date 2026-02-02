'use client';

import React, { useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabaseClient';

type FeuilleGraphe = {
 id: string;
 titre: string;
 ordre: number;
 type: 'mecanique' | 'chaotique';
 difficulte: number | null;
 est_validee: boolean;
 est_autorisee: boolean;
 prerequis: string[];
};

type Props = {
 niveauId: string;
 membreUserId: string;
 onAutoriser: (feuilleId: string, type: 'mecanique' | 'chaotique') => void;
 onRetirer: (feuilleId: string) => void;
};

export default function VueGraphe({ niveauId, membreUserId, onAutoriser, onRetirer }: Props) {
 const [loading, setLoading] = useState(true);
 const [feuilles, setFeuilles] = useState<FeuilleGraphe[]>([]);
 const [nodes, setNodes, onNodesChange] = useNodesState([]);
 const [edges, setEdges, onEdgesChange] = useEdgesState([]);

 useEffect(() => {
 if (niveauId) {
 loadGraphData();
 }
 }, [niveauId, membreUserId]);

 async function loadGraphData() {
 try {
 setLoading(true);

 // 1. Charger toutes les feuilles du niveau
 const { data: feuillesData } = await supabase
 .from('feuille_entrainement')
 .select(`
 id, titre, ordre, type, difficulte,
 chapitre!inner(
 sujet!inner(
 niveau_id
 )
 )
 `)
 .eq('chapitre.sujet.niveau_id', niveauId);

 if (!feuillesData) {
 setFeuilles([]);
 return;
 }

 // 2. Charger les feuilles validées
 const { data: feuillesValidees } = await supabase
 .from('progression_feuille')
 .select('feuille_id')
 .eq('user_id', membreUserId)
 .eq('est_termine', true);

 const idsValidees = new Set(feuillesValidees?.map(p => p.feuille_id) || []);

 // 3. Charger les feuilles autorisées
 const { data: feuillesAutorisees } = await supabase
 .from('feuilles_autorisees')
 .select('feuille_id, membre_id')
 .eq('user_id', membreUserId);

 const idsAutorisees = new Set(feuillesAutorisees?.map(f => f.feuille_id) || []);

 // 4. Charger les prérequis
 const feuilleIds = feuillesData.map((f: any) => f.id);
 const { data: prerequisData } = await supabase
 .from('prerequis')
 .select('feuille_id, prerequis_id, obligatoire')
 .in('feuille_id', feuilleIds);

 // Construire une map des prérequis
 const prerequisMap = new Map<string, string[]>();
 prerequisData?.forEach((p: any) => {
 if (!prerequisMap.has(p.feuille_id)) {
 prerequisMap.set(p.feuille_id, []);
 }
 prerequisMap.get(p.feuille_id)!.push(p.prerequis_id);
 });

 // 5. Enrichir les feuilles
 const feuillesEnrichies: FeuilleGraphe[] = feuillesData.map((f: any) => ({
 id: f.id,
 titre: f.titre,
 ordre: f.ordre,
 type: f.type,
 difficulte: f.difficulte,
 est_validee: idsValidees.has(f.id),
 est_autorisee: idsAutorisees.has(f.id),
 prerequis: prerequisMap.get(f.id) || [],
 }));

 setFeuilles(feuillesEnrichies);

 // 6. Créer les nœuds et arêtes
 createNodesAndEdges(feuillesEnrichies);

 } catch (error) {
 console.error('Erreur chargement graphe:', error);
 alert('Erreur lors du chargement du graphe');
 } finally {
 setLoading(false);
 }
 }

 function createNodesAndEdges(feuilles: FeuilleGraphe[]) {
 // Créer les nœuds avec layout automatique simple
 const newNodes: Node[] = feuilles.map((feuille, index) => {
 // Position simple : grille
 const col = index % 5;
 const row = Math.floor(index / 5);

 // Couleur selon statut
 let backgroundColor = '#f3f4f6'; // Gris (disponible)
 let borderColor = '#d1d5db';
 
 if (feuille.est_validee) {
 backgroundColor = '#d1fae5'; // Vert (validée)
 borderColor = '#10b981';
 } else if (feuille.est_autorisee) {
 backgroundColor = '#fef3c7'; // Jaune (autorisée)
 borderColor = '#f59e0b';
 }

 return {
 id: feuille.id,
 type: 'default',
 position: { x: col * 250, y: row * 150 },
 data: {
 label: (
 <div className="text-center">
 <div className="text-xs font-bold text-ink">
 #{feuille.ordre}
 </div>
 <div className="text-sm font-medium text-ink max-w-[150px] truncate">
 {feuille.titre}
 </div>
 <div className="text-xs text-ink-light mt-1">
 {feuille.type === 'mecanique' ? '🔧' : '🎲'}
 {feuille.difficulte && ` • Diff: ${feuille.difficulte}`}
 </div>
 </div>
 ),
 },
 style: {
 backgroundColor,
 border: `2px solid ${borderColor}`,
 borderRadius: '8px',
 padding: '12px',
 width: 180,
 },
 };
 });

 // Créer les arêtes (prérequis)
 const newEdges: Edge[] = [];
 feuilles.forEach(feuille => {
 feuille.prerequis.forEach(prerequisId => {
 newEdges.push({
 id: `${prerequisId}-${feuille.id}`,
 source: prerequisId,
 target: feuille.id,
 type: 'smoothstep',
 animated: true,
 markerEnd: {
 type: MarkerType.ArrowClosed,
 width: 20,
 height: 20,
 color: '#6366f1',
 },
 style: {
 stroke: '#6366f1',
 strokeWidth: 2,
 },
 });
 });
 });

 setNodes(newNodes);
 setEdges(newEdges);
 }

 function handleNodeClick(event: any, node: Node) {
 const feuille = feuilles.find(f => f.id === node.id);
 if (!feuille) return;

 // Afficher un menu contextuel
 const action = confirm(
 `${feuille.titre}\n\n` +
 `Type: ${feuille.type === 'mecanique' ? '🔧 Mécanique' : '🎲 Chaotique'}\n` +
 `Statut: ${feuille.est_validee ? '✅ Validée' : feuille.est_autorisee ? '🟡 Autorisée' : '⚪ Disponible'}\n` +
 `Difficulté: ${feuille.difficulte || 'N/A'}\n\n` +
 (feuille.est_autorisee 
 ? 'Voulez-vous RETIRER cette feuille ?'
 : 'Voulez-vous AUTORISER cette feuille ?')
 );

 if (action) {
 if (feuille.est_autorisee) {
 onRetirer(feuille.id);
 } else {
 onAutoriser(feuille.id, feuille.type);
 }
 }
 }

 if (loading) {
 return (
 <div className="h-96 flex items-center justify-center">
 <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600"></div>
 </div>
 );
 }

 if (feuilles.length === 0) {
 return (
 <div className="h-96 flex items-center justify-center text-ink-muted">
 <div className="text-center">
 <div className="text-6xl mb-4">📚</div>
 <p>Aucune feuille dans ce niveau</p>
 </div>
 </div>
 );
 }

 return (
 <div style={{ height: '70vh', width: '100%' }} className="border border-border rounded-lg overflow-hidden relative">
 <ReactFlow
 nodes={nodes}
 edges={edges}
 onNodesChange={onNodesChange}
 onEdgesChange={onEdgesChange}
 onNodeClick={handleNodeClick}
 fitView
 fitViewOptions={{ padding: 0.2 }}
 >
 <Background />
 <Controls />
 </ReactFlow>

 {/* Légende */}
 <div className="absolute bottom-4 left-4 bg-cream-50 p-3 rounded-lg shadow-sm border border-border text-xs">
 <div className="font-bold text-ink mb-2">Légende</div>
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 rounded bg-green-200 border border-status-success"></div>
 <span>Validée</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 rounded bg-yellow-200 border border-yellow-500"></div>
 <span>Autorisée</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 rounded bg-cream-200 border border-gray-400"></div>
 <span>Disponible</span>
 </div>
 </div>
 </div>
 </div>
 );
}