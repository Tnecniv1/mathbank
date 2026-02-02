'use client';

import Link from"next/link";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Types
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

type BadgesData = {
 badges_niveau: BadgeNiveau[];
 badges_comportement: BadgeComportement[];
 badges_performance: BadgePerformance[];
 progression_niveaux: any[];
};

function BadgeCard({ badge, type }: {
 badge: BadgeNiveau | BadgeComportement | BadgePerformance;
 type: 'niveau' | 'comportement' | 'performance'
}) {
 const obtenu = badge.obtenu;
 const hasPalier = badge.palier > 1;

 return (
 <div
 className={`relative flex flex-col items-center p-3 rounded-lg border transition-all duration-200 min-w-[90px] ${
 obtenu
 ? 'bg-cream-50 border-status-success'
 : 'bg-cream-200 border-border opacity-50'
 }`}
 title={('description' in badge) ? badge.description : ''}
 >
 <div className={`text-4xl mb-1 relative ${obtenu ? '' : 'grayscale'}`}>
 {badge.emoji}
 {hasPalier && obtenu && (
 <span className="absolute -top-1 -right-1 text-xs font-bold bg-accent text-ink rounded-full w-5 h-5 flex items-center justify-center">
 {badge.palier}
 </span>
 )}
 </div>

 <div className={`text-xs font-medium text-center ${
 obtenu ? 'text-ink' : 'text-ink-muted'
 }`}>
 {badge.nom}
 </div>

 {type === 'niveau' && 'titre' in badge && (
 <div className="text-[10px] text-ink-muted mt-0.5">
 {badge.titre}
 </div>
 )}

 {obtenu && (
 <>
 {'heures_total' in badge && badge.heures_total !== undefined && (
 <div className="text-[10px] text-accent mt-1">
 {Math.floor(badge.heures_total)}h
 </div>
 )}
 {'nb_feuilles' in badge && badge.nb_feuilles !== undefined && (
 <div className="text-[10px] text-accent mt-1">
 {badge.nb_feuilles} validées
 </div>
 )}
 {'amelioration_pct' in badge && badge.amelioration_pct !== undefined && (
 <div className="text-[10px] text-accent mt-1">
 +{Math.floor(badge.amelioration_pct)}%
 </div>
 )}
 </>
 )}
 </div>
 );
}

function BadgesSection() {
 const [loading, setLoading] = useState(true);
 const [data, setData] = useState<BadgesData | null>(null);
 const [showModal, setShowModal] = useState(false);

 useEffect(() => {
 loadBadges();
 }, []);

 async function loadBadges() {
 try {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) {
 setLoading(false);
 return;
 }

 const { data: result, error } = await supabase.rpc('get_badges_utilisateur_complet', {
 p_user_id: session.user.id
 });

 if (error) {
 console.error('Erreur RPC badges:', error);
 setData({
 badges_niveau: [
 { code: 'niveau_1', emoji: '🐛', nom: 'Asticot', titre: 'Élémentaire', palier: 1, obtenu: false },
 { code: 'niveau_2', emoji: '🐝', nom: 'Abeille', titre: 'Collège', palier: 1, obtenu: false },
 { code: 'niveau_3', emoji: '🐻', nom: 'Ours', titre: 'Lycée', palier: 1, obtenu: false },
 { code: 'niveau_4', emoji: '🐋', nom: 'Baleine', titre: 'Licence', palier: 1, obtenu: false },
 { code: 'niveau_5', emoji: '🦄', nom: 'Licorne', titre: 'Master', palier: 1, obtenu: false },
 { code: 'niveau_6', emoji: '🐉', nom: 'Dragon', titre: 'Doctorat', palier: 1, obtenu: false },
 ],
 badges_comportement: [
 { code: 'discipline_fer', emoji: '💪', nom: 'Discipline', description: '5+ entraînements/semaine × 4 semaines', palier: 1, obtenu: false },
 { code: 'concentration', emoji: '⚡', nom: 'Concentration', description: 'Paliers de 50h', palier: 0, obtenu: false },
 { code: 'score_feu', emoji: '🔥', nom: 'Score de feu', description: '≥2 chapitres par niveau', palier: 1, obtenu: false },
 { code: 'progression', emoji: '📈', nom: 'Progression', description: 'Score toujours croissant', palier: 1, obtenu: false },
 ],
 badges_performance: [
 { code: 'etoile_montante', emoji: '🌟', nom: 'Étoile', description: '1 feuille/2 semaines', palier: 1, obtenu: false },
 { code: 'precision', emoji: '🎯', nom: 'Précision', description: 'Feuilles du 1er coup', palier: 0, obtenu: false },
 { code: 'fusee', emoji: '🚀', nom: 'Fusée', description: 'Amélioration +30%', palier: 0, obtenu: false },
 { code: 'champion', emoji: '🏅', nom: 'Champion', description: 'Top 3 de l\'équipe', palier: 1, obtenu: false },
 ],
 progression_niveaux: []
 });
 } else {
 setData(result);
 }
 } catch (error) {
 console.error('Erreur chargement badges:', error);
 setData({
 badges_niveau: [
 { code: 'niveau_1', emoji: '🐛', nom: 'Asticot', titre: 'Élémentaire', palier: 1, obtenu: false },
 { code: 'niveau_2', emoji: '🐝', nom: 'Abeille', titre: 'Collège', palier: 1, obtenu: false },
 { code: 'niveau_3', emoji: '🐻', nom: 'Ours', titre: 'Lycée', palier: 1, obtenu: false },
 { code: 'niveau_4', emoji: '🐋', nom: 'Baleine', titre: 'Licence', palier: 1, obtenu: false },
 { code: 'niveau_5', emoji: '🦄', nom: 'Licorne', titre: 'Master', palier: 1, obtenu: false },
 { code: 'niveau_6', emoji: '🐉', nom: 'Dragon', titre: 'Doctorat', palier: 1, obtenu: false },
 ],
 badges_comportement: [
 { code: 'discipline_fer', emoji: '💪', nom: 'Discipline', description: '5+ entraînements/semaine × 4 semaines', palier: 1, obtenu: false },
 { code: 'concentration', emoji: '⚡', nom: 'Concentration', description: 'Paliers de 50h', palier: 0, obtenu: false },
 { code: 'score_feu', emoji: '🔥', nom: 'Score de feu', description: '≥2 chapitres par niveau', palier: 1, obtenu: false },
 { code: 'progression', emoji: '📈', nom: 'Progression', description: 'Score toujours croissant', palier: 1, obtenu: false },
 ],
 badges_performance: [
 { code: 'etoile_montante', emoji: '🌟', nom: 'Étoile', description: '1 feuille/2 semaines', palier: 1, obtenu: false },
 { code: 'precision', emoji: '🎯', nom: 'Précision', description: 'Feuilles du 1er coup', palier: 0, obtenu: false },
 { code: 'fusee', emoji: '🚀', nom: 'Fusée', description: 'Amélioration +30%', palier: 0, obtenu: false },
 { code: 'champion', emoji: '🏅', nom: 'Champion', description: 'Top 3 de l\'équipe', palier: 1, obtenu: false },
 ],
 progression_niveaux: []
 });
 } finally {
 setLoading(false);
 }
 }

 if (loading) {
 return (
 <div className="bg-cream-50 rounded-lg p-4 border border-border">
 <div className="flex items-center justify-center py-4">
 <div className="animate-spin rounded-full h-6 w-6 border border-accent border-t-transparent"></div>
 </div>
 </div>
 );
 }

 if (!data) return null;

 const niveauObtenus = data.badges_niveau?.filter(b => b.obtenu).length || 0;
 const comportementObtenus = data.badges_comportement?.filter(b => b.obtenu).length || 0;
 const performanceObtenus = data.badges_performance?.filter(b => b.obtenu).length || 0;
 const totalObtenus = niveauObtenus + comportementObtenus + performanceObtenus;

 const badgesObtenus = [
 ...data.badges_niveau.filter(b => b.obtenu),
 ...data.badges_comportement.filter(b => b.obtenu),
 ...data.badges_performance.filter(b => b.obtenu),
 ].slice(0, 5);

 return (
 <>
 <button
 onClick={() => setShowModal(true)}
 className="w-full bg-cream-50 rounded-lg p-4 border border-border hover:border-accent transition-colors group"
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="text-3xl">🏆</div>
 <div className="text-left">
 <h2 className="text-lg font-semibold text-ink">
 Vos Badges
 </h2>
 <p className="text-sm text-ink-muted">
 {totalObtenus}/14 badges débloqués
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {badgesObtenus.length > 0 ? (
 <>
 {badgesObtenus.map((badge, idx) => (
 <div key={idx} className="text-2xl">
 {badge.emoji}
 </div>
 ))}
 {totalObtenus > 5 && (
 <div className="text-sm text-ink-muted">
 +{totalObtenus - 5}
 </div>
 )}
 </>
 ) : (
 <div className="text-sm text-ink-muted">
 Aucun badge débloqué
 </div>
 )}
 <div className="text-ink-muted group-hover:text-accent transition-colors ml-2">
 →
 </div>
 </div>
 </div>
 </button>

 {showModal && (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
 <div className="bg-cream-50 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-border" onClick={(e) => e.stopPropagation()}>

 <div className="sticky top-0 bg-cream-50 border-b border-border p-6 flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-semibold text-ink flex items-center gap-2">
 🏆 Vos Badges
 </h2>
 <p className="text-sm text-ink-muted mt-1">
 {totalObtenus}/14 badges débloqués
 </p>
 </div>
 <button
 onClick={() => setShowModal(false)}
 className="text-ink-muted hover:text-ink transition-colors text-2xl"
 >
 ✕
 </button>
 </div>

 <div className="p-6 space-y-6">

 <div className="grid grid-cols-3 gap-4">
 <div className="bg-cream-100 rounded-lg p-3 border border-border">
 <div className="text-sm text-ink-muted mb-1">Niveau</div>
 <div className="text-xl font-semibold text-ink">
 {niveauObtenus}/6
 </div>
 </div>
 <div className="bg-cream-100 rounded-lg p-3 border border-border">
 <div className="text-sm text-ink-muted mb-1">Comportement</div>
 <div className="text-xl font-semibold text-ink">
 {comportementObtenus}/4
 </div>
 </div>
 <div className="bg-cream-100 rounded-lg p-3 border border-border">
 <div className="text-sm text-ink-muted mb-1">Performance</div>
 <div className="text-xl font-semibold text-ink">
 {performanceObtenus}/4
 </div>
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">
 Badges de Niveau ({niveauObtenus}/6)
 </h3>
 <div className="flex gap-3 flex-wrap">
 {data.badges_niveau?.map((badge) => (
 <BadgeCard key={badge.code} badge={badge} type="niveau" />
 ))}
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">
 Badges de Comportement ({comportementObtenus}/4)
 </h3>
 <div className="flex gap-3 flex-wrap">
 {data.badges_comportement?.map((badge) => (
 <BadgeCard key={badge.code} badge={badge} type="comportement" />
 ))}
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold text-ink mb-3">
 Badges de Performance ({performanceObtenus}/4)
 </h3>
 <div className="flex gap-3 flex-wrap">
 {data.badges_performance?.map((badge) => (
 <BadgeCard key={badge.code} badge={badge} type="performance" />
 ))}
 </div>
 </div>

 <div className="bg-cream-100 rounded-lg p-4 border border-border">
 <h4 className="text-sm font-semibold text-ink mb-2">
 Badges à paliers progressifs
 </h4>
 <div className="text-sm text-ink-muted space-y-1">
 <div><span className="text-accent">Concentration</span> : +1 palier toutes les 50h</div>
 <div><span className="text-accent">Précision</span> : +1 palier toutes les 5 feuilles du 1er coup</div>
 <div><span className="text-accent">Fusée</span> : +1 palier pour chaque +30% d'amélioration</div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </>
 );
}

const navItems = [
 { href: '/library', emoji: '📚', title: 'Bibliothèque', description: 'Feuilles d\'entraînement et parcours' },
 { href: '/library/sessions', emoji: '📝', title: 'Mes Sessions', description: 'Entraînements quotidiens et historique' },
 { href: '/progression', emoji: '📊', title: 'Progression', description: 'Statistiques et évolution' },
 { href: '/classement', emoji: '🏆', title: 'Classement', description: 'Performances et équipes' },
 { href: '/personnel', emoji: '👤', title: 'Personnel', description: 'Équipe et notifications' },
 { href: '/admin', emoji: '⚙️', title: 'Administration', description: 'Gestion des contenus' },
];

export default function HomePage() {
 return (
 <main className="min-h-screen p-6">
 <div className="max-w-4xl mx-auto space-y-8">

 <BadgesSection />

 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
 {navItems.map((item) => (
 <Link
 key={item.href}
 href={item.href}
 className="group p-6 rounded-lg border border-border bg-cream-50 hover:border-accent hover:bg-cream-100 transition-all duration-200"
 >
 <div className="text-4xl mb-3">{item.emoji}</div>
 <h2 className="text-xl font-semibold text-ink mb-1 group-hover:text-accent transition-colors">
 {item.title}
 </h2>
 <p className="text-ink-light text-sm">
 {item.description}
 </p>
 </Link>
 ))}
 </div>

 <div className="text-center text-sm text-ink-muted pt-4">
 <p>Système d'apprentissage collaboratif</p>
 </div>
 </div>
 </main>
 );
}
