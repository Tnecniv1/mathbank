'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type BadgeNiveau = {
 code: string;
 emoji: string;
 nom: string;
 titre: string;
 palier: number;
 obtenu: boolean;
};

type BadgeComportement = {
 code: string;
 emoji: string;
 nom: string;
 description: string;
 palier: number;
 obtenu: boolean;
 heures_total?: number;
};

type BadgePerformance = {
 code: string;
 emoji: string;
 nom: string;
 description: string;
 palier: number;
 obtenu: boolean;
 nb_feuilles?: number;
 amelioration_pct?: number;
};

type ProgressionNiveau = {
 niveau_id: string;
 niveau_titre: string;
 niveau_ordre: number;
 total_feuilles: number;
 feuilles_validees: number;
 pourcentage: number;
 badge: string;
};

type BadgesData = {
 badges_niveau: BadgeNiveau[];
 badges_comportement: BadgeComportement[];
 badges_performance: BadgePerformance[];
 progression_niveaux: ProgressionNiveau[];
};

export default function PixelProgressionBlock() {
 const [loading, setLoading] = useState(true);
 const [data, setData] = useState<BadgesData | null>(null);
 const [niveauSelectionne, setNiveauSelectionne] = useState<number>(1);

 useEffect(() => {
 loadProgression();
 }, []);

 async function loadProgression() {
 try {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) return;

 const { data: result, error } = await supabase.rpc('get_badges_utilisateur_complet', {
 p_user_id: session.user.id
 });

 if (error) throw error;
 setData(result);

 if (result?.progression_niveaux?.length > 0) {
 setNiveauSelectionne(result.progression_niveaux[0].niveau_ordre);
 }
 } catch (error) {
 console.error('Erreur chargement progression:', error);
 } finally {
 setLoading(false);
 }
 }

 if (loading) {
 return (
 <div className="bg-cream-50 rounded-lg p-8 border border-border">
 <div className="flex items-center justify-center py-12">
 <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
 </div>
 </div>
 );
 }

 if (!data) return null;

 const niveauActuel = data.progression_niveaux?.find(n => n.niveau_ordre === niveauSelectionne);

 const renderBadge = (
 badge: BadgeNiveau | BadgeComportement | BadgePerformance,
 type: 'niveau' | 'comportement' | 'performance'
 ) => {
 const obtenu = badge.obtenu;
 const hasPalier = badge.palier > 1;

 return (
 <div
 key={badge.code}
 className={`flex flex-col items-center p-4 rounded-lg border transition-all min-w-[140px] ${
 obtenu
 ? 'bg-cream-50 border-status-success'
 : 'bg-cream-200 border-border opacity-50'
 }`}
 title={('description' in badge) ? badge.description : ''}
 >
 <div className={`text-5xl mb-2 relative ${obtenu ? '' : 'grayscale'}`}>
 {badge.emoji}
 {hasPalier && obtenu && (
 <span className="absolute -top-1 -right-1 text-lg font-bold bg-accent text-white rounded-full w-6 h-6 flex items-center justify-center">
 {badge.palier}
 </span>
 )}
 </div>
 <div className={`text-sm font-semibold text-center ${obtenu ? 'text-ink' : 'text-ink-muted'}`}>
 {badge.nom}
 </div>
 {type === 'niveau' && 'titre' in badge && (
 <div className="text-sm text-ink-light mt-1">
 {badge.titre}
 </div>
 )}
 {obtenu && (
 <div className="mt-2 text-status-success text-sm font-medium flex items-center gap-1">
 <span>Obtenu</span>
 </div>
 )}
 {obtenu && 'heures_total' in badge && badge.heures_total !== undefined && (
 <div className="text-sm text-accent mt-1">
 {Math.floor(badge.heures_total)}h
 </div>
 )}
 {obtenu && 'nb_feuilles' in badge && badge.nb_feuilles !== undefined && (
 <div className="text-sm text-accent mt-1">
 {badge.nb_feuilles} feuilles
 </div>
 )}
 {obtenu && 'amelioration_pct' in badge && badge.amelioration_pct !== undefined && (
 <div className="text-sm text-accent mt-1">
 +{Math.floor(badge.amelioration_pct)}%
 </div>
 )}
 </div>
 );
 };

 return (
 <div className="bg-cream-50 rounded-lg p-8 border border-border">

 {/* Badges de Niveau */}
 <div className="mb-8">
 <h2 className="text-2xl font-semibold text-ink mb-4">
 Badges de Niveau
 </h2>
 <p className="text-sm text-ink-light mb-4">
 Complétez 100% d'un niveau pour débloquer son badge
 </p>
 <div className="flex gap-4 flex-wrap">
 {data.badges_niveau?.map((badge) => renderBadge(badge, 'niveau'))}
 </div>
 </div>

 {/* Badges de Comportement */}
 <div className="mb-8">
 <h2 className="text-2xl font-semibold text-ink mb-4">
 Badges de Comportement
 </h2>
 <p className="text-sm text-ink-light mb-4">
 Récompenses pour votre régularité et discipline
 </p>
 <div className="flex gap-4 flex-wrap">
 {data.badges_comportement?.map((badge) => renderBadge(badge, 'comportement'))}
 </div>
 </div>

 {/* Badges de Performance */}
 <div className="mb-8">
 <h2 className="text-2xl font-semibold text-ink mb-4">
 Badges de Performance
 </h2>
 <p className="text-sm text-ink-light mb-4">
 Récompenses pour vos exploits et progrès
 </p>
 <div className="flex gap-4 flex-wrap">
 {data.badges_performance?.map((badge) => renderBadge(badge, 'performance'))}
 </div>
 </div>

 {/* Sélection Niveau */}
 <div className="mb-8">
 <h3 className="text-xl font-semibold text-ink mb-3">
 Sélectionnez un niveau
 </h3>
 <div className="flex gap-2 flex-wrap">
 {data.progression_niveaux?.map((niveau) => (
 <button
 key={niveau.niveau_id}
 onClick={() => setNiveauSelectionne(niveau.niveau_ordre)}
 className={`px-4 py-2 rounded-lg font-medium transition-all ${
 niveauSelectionne === niveau.niveau_ordre
 ? 'bg-accent text-white'
 : 'bg-cream-200 text-ink hover:bg-cream-100'
 }`}
 >
 {niveau.niveau_titre}
 </button>
 ))}
 </div>
 </div>

 {/* Pixel Grid */}
 {niveauActuel && (
 <div className="bg-cream-100 rounded-lg p-6 border border-border">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-semibold text-ink">
 {niveauActuel.niveau_titre}
 </h3>
 <div className="text-4xl">
 {niveauActuel.badge.split(' ')[0]}
 </div>
 </div>

 <div className="bg-cream-200 rounded-lg p-4 mb-4">
 <div className="grid grid-cols-10 gap-1">
 {Array.from({ length: niveauActuel.total_feuilles }, (_, i) => (
 <div
 key={i}
 className={`aspect-square rounded-sm transition-all ${
 i < niveauActuel.feuilles_validees
 ? 'bg-accent'
 : 'bg-cream-100'
 }`}
 title={`Feuille ${i + 1} ${i < niveauActuel.feuilles_validees ? '(validée)' : ''}`}
 />
 ))}
 </div>
 </div>

 <div className="space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-ink font-medium">Progression</span>
 <span className="text-2xl font-semibold text-accent">
 {niveauActuel.pourcentage}%
 </span>
 </div>

 <div className="flex justify-between items-center text-sm">
 <span className="text-ink-light">Feuilles validées</span>
 <span className="font-semibold text-ink">
 {niveauActuel.feuilles_validees} / {niveauActuel.total_feuilles}
 </span>
 </div>

 <div className="w-full bg-cream-200 rounded-full h-2 overflow-hidden">
 <div
 className="h-full bg-accent transition-all duration-500 rounded-full"
 style={{ width: `${niveauActuel.pourcentage}%` }}
 />
 </div>

 {niveauActuel.pourcentage === 100 ? (
 <div className="mt-4 p-4 bg-green-50 border border-status-success rounded-lg text-center">
 <div className="font-semibold text-status-success">
 Badge {niveauActuel.badge} débloqué !
 </div>
 </div>
 ) : (
 <div className="mt-4 p-4 bg-accent-light border border-accent/20 rounded-lg">
 <div className="text-sm text-ink">
 <strong>Prochain badge :</strong> {niveauActuel.badge}
 </div>
 <div className="text-sm text-ink-light mt-1">
 Encore <strong>{niveauActuel.total_feuilles - niveauActuel.feuilles_validees}</strong> feuilles à valider
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Légende */}
 <div className="mt-8 p-4 bg-cream-100 border border-border rounded-lg">
 <h4 className="text-sm font-semibold text-ink mb-2">
 Badges à paliers
 </h4>
 <div className="text-sm text-ink-muted space-y-1">
 <div><span className="text-accent">Concentration</span> : +1 palier toutes les 50 heures</div>
 <div><span className="text-accent">Précision</span> : +1 palier toutes les 5 feuilles réussies du 1er coup</div>
 <div><span className="text-accent">Fusée</span> : +1 palier pour chaque +30% d'amélioration</div>
 </div>
 </div>
 </div>
 );
}
