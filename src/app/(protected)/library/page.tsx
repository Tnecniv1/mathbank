'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ParcoursTimeline from '@/components/ParcoursTimeline';

/* ---------- Types ---------- */
type FeuilleEntrainement = {
 id: string;
 ordre: number;
 ordre_dans_niveau: number;
 titre: string;
 description: string | null;
 pdf_url: string;
 difficulte: number | null;
 type: 'mecanique' | 'chaotique';
 nb_exercices: number | null;
};

type Chapitre = {
 id: string;
 ordre: number;
 titre: string;
 description: string | null;
 feuilles: FeuilleEntrainement[];
};

type Sujet = {
 id: string;
 ordre: number;
 titre: string;
 description: string | null;
 chapitres: Chapitre[];
 feuilles?: FeuilleEntrainement[];
};

type Niveau = {
 id: string;
 ordre: number;
 titre: string;
 description: string | null;
 sujets: Sujet[];
};

type NoeudRow = {
 id: string;
 parent_id: string | null;
 titre: string;
 ordre: number;
 type: 'niveau' | 'sujet' | 'chapitre' | 'mecanique' | 'chaotique';
 pdf_url: string | null;
 difficulte: number | null;
 profondeur: number;
 nb_exercices?: number | null;
};

type SessionTravail = {
 id: string;
 date: string;
 heure: string;
 duree: number;
 commentaire: string | null;
};

type Progression = {
 id: string;
 feuille_id: string;
 est_termine: boolean;
 en_cours?: boolean;
 score: number | null;
 score_moyen?: number | null;
 nb_exercices_valides?: number | null;
 temps_total: number;
 sessions: SessionTravail[];
 statut: string;
 commentaire_chef: string | null;
};

/* ---------- Icônes ---------- */
const Loader = () => (
 <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
 <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
 </svg>
);

const IconFile = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12V7l-4-4z" stroke="currentColor" strokeWidth="2" />
 <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" />
 </svg>
);

const IconCircleEmpty = () => (
 <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
 <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
 </svg>
);

const IconCircleFilled = () => (
 <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
 <circle cx="12" cy="12" r="10" />
 </svg>
);

const IconCheck = () => (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
 <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
);

const IconLock = () => (
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
 <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
 <path d="M12 15v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
 <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" />
 </svg>
);

/* ---------- Data fetch ---------- */
async function getParcoursComplet(niveauId: string) {
 console.log('🔄 Chargement du parcours niveau:', niveauId);
 try {
 const { data, error } = await supabase
 .rpc('get_arbre_noeud', { p_racine_id: niveauId });

 if (error) throw error;

 const rows = data as NoeudRow[];

 const niveauRow = rows.find(r => r.type === 'niveau');
 if (!niveauRow) throw new Error('Niveau introuvable');

 const sujets: Sujet[] = rows
 .filter(r => r.type === 'sujet')
 .sort((a, b) => a.ordre - b.ordre)
 .map(s => {
 const chapitres: Chapitre[] = rows
 .filter(r => r.type === 'chapitre' && r.parent_id === s.id)
 .sort((a, b) => a.ordre - b.ordre)
 .map(c => {
 const feuilles: FeuilleEntrainement[] = rows
 .filter(r => (r.type === 'mecanique' || r.type === 'chaotique') && r.parent_id === c.id)
 .sort((a, b) => a.ordre - b.ordre)
 .map(f => ({
 id: f.id,
 ordre: f.ordre,
 ordre_dans_niveau: 0,
 titre: f.titre,
 description: null,
 pdf_url: f.pdf_url ?? '',
 difficulte: f.difficulte,
 type: f.type as 'mecanique' | 'chaotique',
 nb_exercices: f.nb_exercices ?? null,
 }));
 return { id: c.id, ordre: c.ordre, titre: c.titre, description: null, feuilles };
 });
 const feuillesDirectes: FeuilleEntrainement[] = rows
 .filter(r => (r.type === 'mecanique' || r.type === 'chaotique') && r.parent_id === s.id)
 .sort((a, b) => a.ordre - b.ordre)
 .map(f => ({
 id: f.id,
 ordre: f.ordre,
 ordre_dans_niveau: 0,
 titre: f.titre,
 description: null,
 pdf_url: f.pdf_url ?? '',
 difficulte: f.difficulte,
 type: f.type as 'mecanique' | 'chaotique',
 nb_exercices: f.nb_exercices ?? null,
 }));
 return { id: s.id, ordre: s.ordre, titre: s.titre, description: null, chapitres, feuilles: feuillesDirectes };
 });

 // Recalculer ordre_dans_niveau
 let compteur = 1;
 for (const sujet of sujets) {
 for (const feuille of sujet.feuilles ?? [])
 feuille.ordre_dans_niveau = compteur++;
 for (const chapitre of sujet.chapitres)
 for (const feuille of chapitre.feuilles)
 feuille.ordre_dans_niveau = compteur++;
 }

 if (process.env.NODE_ENV === 'development')
 console.log(`📦 ${rows.length} nœuds chargés`);

 return {
 data: { id: niveauRow.id, ordre: niveauRow.ordre, titre: niveauRow.titre, description: null, sujets } as Niveau,
 error: null,
 };
 } catch (e: any) {
 console.error(e);
 return { data: null, error: e };
 }
}

async function getNiveaux() {
 try {
 const { data, error } = await supabase
 .from('noeud')
 .select('id, ordre, titre')
 .eq('type', 'niveau')
 .order('ordre', { ascending: true });

 if (error) throw error;
 return { data: data as Niveau[], error: null };
 } catch (e: any) {
 console.error(e);
 return { data: null, error: e };
 }
}

/* ---------- Composant Feuille ---------- */
function FeuilleCard({
 feuille,
 progression,
 typesActifs,
 feuillesDebloquees,
 feuillesAccessibles,
 onOpen,
 onUpdateProgression,
 onConclureDone,
}: {
 feuille: FeuilleEntrainement;
 progression: Progression | null;
 typesActifs: Set<string>;
 feuillesDebloquees: Set<string>;
 feuillesAccessibles: Set<string>;
 onOpen: () => void;
 onUpdateProgression: () => Promise<void>;
 onConclureDone: (type: 'mecanique' | 'chaotique') => void;
}) {
 const [showModal, setShowModal] = useState(false);
 const [adding, setAdding] = useState(false);
 const [typeBlockMsg, setTypeBlockMsg] = useState<string | null>(null);

 // ── Calcul des états ──────────────────────────────────────────────────
 const estTerminee = progression?.est_termine === true || progression?.statut === 'validee';
 const estEnCours = progression?.en_cours === true && !estTerminee;
 const nbExo = feuille.nb_exercices;
 const nbValides = progression?.nb_exercices_valides ?? 0;
 const scoreMoyen = progression?.score_moyen ?? 0;
 const seuilAtteint = nbExo != null && nbExo > 0 && nbValides >= nbExo && scoreMoyen >= 70;
 const pretAConclure = estEnCours && seuilAtteint;
 const estAccessible = feuillesAccessibles.has(feuille.id);
 const estVerrouilee = !estTerminee && !estEnCours && !estAccessible;
 const peutAjouter = estAccessible && !estEnCours && !estTerminee;
 const typeEstBloque = peutAjouter && typesActifs.has(feuille.type);

 // ── Handlers ──────────────────────────────────────────────────────────
 const handleAjouter = async (e: React.MouseEvent | React.KeyboardEvent) => {
 e.stopPropagation();
 if (typeEstBloque || adding) return;
 setAdding(true);
 setTypeBlockMsg(null);
 const { data: { session } } = await supabase.auth.getSession();
 if (session) {
 // Vérification contrainte : 1 feuille active par type
 const { data: actives } = await supabase
 .from('progression_feuille')
 .select('feuille_id')
 .eq('user_id', session.user.id)
 .eq('en_cours', true)
 .eq('est_termine', false);

 if (actives && actives.length > 0) {
 const ids = actives.map((f: any) => f.feuille_id);
 const { data: noeuds } = await supabase
 .from('noeud')
 .select('type')
 .in('id', ids);
 if (noeuds?.some((n: any) => n.type === feuille.type)) {
 const label = feuille.type === 'mecanique' ? 'mécanique' : 'chaotique';
 setTypeBlockMsg(`Tu as déjà une feuille ${label} en cours. Termine-la avant d'en commencer une nouvelle.`);
 setAdding(false);
 return;
 }
 }

 const { error } = await supabase
 .from('progression_feuille')
 .upsert(
 { user_id: session.user.id, feuille_id: feuille.id, en_cours: true, est_termine: false, auto_inscrit: true },
 { onConflict: 'user_id,feuille_id' }
 );
 if (!error) {
 // Enregistrer dans feuille_debloquee si c'était une première connexion
 if (!feuillesDebloquees.has(feuille.id)) {
 await supabase.from('feuille_debloquee').insert({ user_id: session.user.id, feuille_id: feuille.id });
 }
 onUpdateProgression();
 }
 }
 setAdding(false);
 };

 const handleConclure = async (e: React.MouseEvent | React.KeyboardEvent) => {
 e.stopPropagation();
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) return;
 await supabase
 .from('progression_feuille')
 .update({ en_cours: false, est_termine: true })
 .eq('user_id', session.user.id)
 .eq('feuille_id', feuille.id);
 await onUpdateProgression();
 onConclureDone(feuille.type);
 };

 return (
 <>
 <button
 onClick={estVerrouilee ? undefined : onOpen}
 disabled={estVerrouilee}
 className={`group relative flex items-center gap-4 w-full px-4 py-3 rounded-lg border transition-all duration-200 border-border bg-cream-50 ${
 estVerrouilee ? 'opacity-50 cursor-default' : 'hover:border-accent hover:shadow-sm'
 }`}
 >
 {/* Numéro d'ordre */}
 <div className="flex items-center justify-center w-10 h-10 rounded-full text-ink font-bold text-lg shadow-sm transition-transform bg-status-success group-hover:scale-110">
 {feuille.ordre_dans_niveau}
 </div>

 {/* Contenu */}
 <div className="flex-1 text-left min-w-0">
 <div className="flex items-center gap-2">
 <div className="font-medium text-ink truncate">{feuille.titre}</div>
 {feuille.difficulte && (
 <div className="flex items-center gap-1 px-2 py-1 bg-cream-200 rounded-md flex-shrink-0">
 <div className="grid grid-cols-2 gap-0.5">
 {[...Array(6)].map((_, i) => (
 <div
 key={i}
 className={`w-2 h-2 rounded-full transition-colors ${
 i < feuille.difficulte! ? 'bg-ink-light' : 'bg-slate-300'
 }`}
 />
 ))}
 </div>
 </div>
 )}
 </div>
 {feuille.description && (
 <div className="text-sm text-ink-light mt-0.5 line-clamp-1">{feuille.description}</div>
 )}
 {progression && progression.temps_total > 0 && (
 <div className="text-xs text-blue-500 mt-1">
 {progression.temps_total} min{progression.score !== null ? ` • Score: ${progression.score}` : ''}
 </div>
 )}
 </div>

 {/* Icône PDF */}
 <div className="text-ink-light group-hover:text-accent transition-colors">
 <IconFile />
 </div>

 {/* Pastille état */}
 <div className="absolute -top-2 -right-2" onClick={(e) => e.stopPropagation()}>
 {estTerminee ? (
 <div className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[11px] font-semibold rounded-full border border-blue-300">
 Terminée
 </div>
 ) : pretAConclure ? (
 <div
 role="button" tabIndex={0}
 onClick={() => setShowModal(true)}
 onKeyDown={(e) => e.key === 'Enter' && setShowModal(true)}
 className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-semibold rounded-full border border-amber-300 cursor-pointer hover:bg-amber-200 transition-colors"
 >
 Prêt à conclure
 </div>
 ) : estEnCours ? (
 <div
 role="button" tabIndex={0}
 onClick={() => setShowModal(true)}
 onKeyDown={(e) => e.key === 'Enter' && setShowModal(true)}
 className="px-2 py-0.5 bg-status-success/20 text-status-success text-[11px] font-semibold rounded-full border border-status-success/40 cursor-pointer hover:bg-status-success/30 transition-colors"
 >
 En cours
 </div>
 ) : estVerrouilee ? (
 <div className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[11px] font-semibold rounded-full border border-slate-200">
 🔒
 </div>
 ) : (
 <div className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[11px] font-semibold rounded-full border border-orange-200">
 Disponible
 </div>
 )}
 </div>
 </button>

 {/* Bouton Conclure (état prêt à conclure) */}
 {pretAConclure && (
 <div className="flex justify-end mt-1 pr-1">
 <div
 role="button" tabIndex={0}
 onClick={handleConclure}
 onKeyDown={(e) => e.key === 'Enter' && handleConclure(e)}
 className="text-xs px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-300 cursor-pointer hover:bg-amber-100 transition-colors"
 >
 Conclure cette feuille →
 </div>
 </div>
 )}

 {/* Bouton Ajouter (état débloquée) */}
 {peutAjouter && !typeEstBloque && (
 <div className="flex justify-end mt-1 pr-1">
 <div
 role="button" tabIndex={0}
 onClick={handleAjouter}
 onKeyDown={(e) => e.key === 'Enter' && handleAjouter(e)}
 className="text-xs px-3 py-1 bg-accent text-ink rounded-full border border-accent/30 cursor-pointer hover:bg-accent-hover transition-colors"
 >
 {adding ? '…' : '+ Ajouter'}
 </div>
 </div>
 )}

 {/* Message blocage type */}
 {(typeEstBloque || typeBlockMsg) && (
 <p className="mt-1 px-3 text-xs text-ink-muted italic">
 {typeBlockMsg ?? `Tu as déjà une feuille ${feuille.type === 'mecanique' ? 'mécanique' : 'chaotique'} en cours. Termine-la avant d'en commencer une nouvelle.`}
 </p>
 )}

 {/* Modal de progression */}
 {showModal && progression && (
 <ProgressionModal
 feuille={feuille}
 progression={progression}
 onClose={() => setShowModal(false)}
 />
 )}
 </>
 );
}

/* ---------- Modal de Progression ---------- */
function ProgressionModal({
 feuille,
 progression,
 onClose,
}: {
 feuille: FeuilleEntrainement;
 progression: Progression | null;
 onClose: () => void;
}) {
 const nbValides = progression?.nb_exercices_valides ?? 0;
 const scoreMoyen = progression?.score_moyen ?? 0;
 const nbTotal = feuille.nb_exercices;
 const seuilAtteint = nbTotal != null && nbTotal > 0 && nbValides >= nbTotal && scoreMoyen >= 70;
 const pourcentageExo = nbTotal != null && nbTotal > 0
 ? Math.min(100, Math.round((nbValides / nbTotal) * 100))
 : null;
 const pourcentageScore = Math.min(100, Math.round(scoreMoyen));

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-cream-50 rounded-lg shadow-2xl max-w-md w-full">
 {/* Header */}
 <div className="p-6 border-b border-border">
 <h2 className="text-xl font-bold text-ink">{feuille.titre}</h2>
 <p className="text-sm text-ink-muted mt-1 capitalize">{feuille.type}</p>
 </div>

 <div className="p-6 space-y-5">
 {/* Stats textuelles */}
 <div className="text-center">
 {nbTotal != null && nbTotal > 0 ? (
 <>
 <div className="text-3xl font-bold text-ink">
 {nbValides}
 <span className="text-ink-muted font-normal"> / {nbTotal}</span>
 </div>
 <div className="text-sm text-ink-muted mt-1">exercices validés</div>
 </>
 ) : (
 <>
 <div className="text-3xl font-bold text-ink">{nbValides}</div>
 <div className="text-sm text-ink-muted mt-1">exercice{nbValides !== 1 ? 's' : ''} validé{nbValides !== 1 ? 's' : ''}</div>
 </>
 )}
 <div className="text-sm text-ink-muted mt-2">
 Score moyen : <span className="font-semibold text-ink">{Math.round(scoreMoyen)}%</span>
 </div>
 </div>

 {/* Barre progression exercices */}
 {pourcentageExo !== null && (
 <div>
 <div className="flex justify-between text-xs text-ink-muted mb-1">
 <span>Exercices</span>
 <span>{pourcentageExo}%</span>
 </div>
 <div className="w-full h-3 bg-cream-200 rounded-full overflow-hidden">
 <div
 className="h-full rounded-full transition-all duration-500 bg-status-success"
 style={{ width: `${pourcentageExo}%` }}
 />
 </div>
 </div>
 )}

 {/* Barre score moyen */}
 <div>
 <div className="flex justify-between text-xs text-ink-muted mb-1">
 <span>Score moyen</span>
 <span>{Math.round(scoreMoyen)}% / 70% requis</span>
 </div>
 <div className="w-full h-3 bg-cream-200 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-500 ${scoreMoyen >= 70 ? 'bg-status-success' : 'bg-amber-400'}`}
 style={{ width: `${pourcentageScore}%` }}
 />
 </div>
 </div>

 {/* Message seuil atteint */}
 {seuilAtteint && (
 <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
 <div className="font-semibold text-green-700">Tu peux conclure cette feuille !</div>
 <div className="text-sm text-green-600 mt-1">Utilise le bouton "Conclure →" sur la feuille.</div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-border">
 <button
 onClick={onClose}
 className="w-full px-4 py-2 bg-cream-200 hover:bg-cream-300 text-ink font-medium rounded-lg transition-colors"
 >
 Fermer
 </button>
 </div>
 </div>
 </div>
 );
}


/* ---------- Modal de Déblocage ---------- */
function DeblocageModal({
 type,
 parcours,
 progressions,
 feuillesAccessibles,
 onDebloquer,
 onClose,
}: {
 type: 'mecanique' | 'chaotique';
 parcours: Niveau | null;
 progressions: Map<string, Progression>;
 feuillesAccessibles: Set<string>;
 onDebloquer: (feuilleId: string) => void;
 onClose: () => void;
}) {
 const toutes: FeuilleEntrainement[] = [];
 if (parcours) {
 parcours.sujets.forEach(sujet => {
 (sujet.feuilles ?? []).forEach(f => { if (f.type === type) toutes.push(f); });
 sujet.chapitres.forEach(ch => ch.feuilles.forEach(f => { if (f.type === type) toutes.push(f); }));
 });
 }

 const disponibles = toutes.filter(f => {
 const prog = progressions.get(f.id);
 const estFinie = prog?.est_termine === true || prog?.statut === 'validee';
 const estActive = prog?.en_cours === true && !estFinie;
 return !estFinie && !estActive && !feuillesAccessibles.has(f.id);
 });

 const label = type === 'mecanique' ? 'mécanique' : 'chaotique';

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-cream-50 rounded-lg shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
 <div className="p-6 border-b border-border">
 <h2 className="text-xl font-bold text-ink">Quelle feuille veux-tu débloquer ?</h2>
 <p className="text-sm text-ink-muted mt-1">Feuille {label}</p>
 </div>
 <div className="flex-1 overflow-y-auto p-6 space-y-3">
 {disponibles.length === 0 ? (
 <p className="text-center text-ink-muted py-8">
 Bravo ! Tu as terminé toutes les feuilles de ce type.
 </p>
 ) : (
 disponibles.map(f => (
 <div key={f.id} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-cream-100 hover:border-accent transition-colors">
 <div className="flex-1 min-w-0">
 <div className="font-medium text-ink truncate">{f.titre}</div>
 {f.difficulte && (
 <div className="flex items-center gap-0.5 mt-1">
 {[...Array(6)].map((_, i) => (
 <div key={i} className={`w-2 h-2 rounded-full ${i < f.difficulte! ? 'bg-ink-light' : 'bg-slate-300'}`} />
 ))}
 </div>
 )}
 </div>
 <button
 onClick={() => onDebloquer(f.id)}
 className="flex-shrink-0 px-3 py-1.5 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg border border-orange-200 hover:bg-orange-200 transition-colors"
 >
 Débloquer →
 </button>
 </div>
 ))
 )}
 </div>
 <div className="p-6 border-t border-border flex justify-end">
 <button
 onClick={onClose}
 className="px-4 py-2 bg-cream-200 hover:bg-cream-300 text-ink rounded-lg transition-colors"
 >
 Plus tard
 </button>
 </div>
 </div>
 </div>
 );
}


/* ---------- Composant Chapitre ---------- */
function ChapitreSection({ chapitre, progressions, typesActifs, feuillesDebloquees, feuillesAccessibles, onOpenPdf, onProgressionUpdate, onConclureDone }: { chapitre: Chapitre; progressions: Map<string, Progression>; typesActifs: Set<string>; feuillesDebloquees: Set<string>; feuillesAccessibles: Set<string>; onOpenPdf: (url: string) => void; onProgressionUpdate: () => Promise<void>; onConclureDone: (type: 'mecanique' | 'chaotique') => void }) {
 const [isOpen, setIsOpen] = useState(false);
 
 return (
 <div className="mb-4">
 {/* Header cliquable du chapitre */}
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="w-full flex items-center justify-between gap-3 p-4 bg-cream-100 hover:bg-cream-200 rounded-lg transition-colors border border-border"
 >
 <div className="flex items-center gap-3">
 <div className="w-1 h-8 rounded-full"></div>
 <h3 className="text-lg font-bold text-ink">{chapitre.titre}</h3>
 <span className="text-sm text-ink-muted">
 ({chapitre.feuilles.length} feuille{chapitre.feuilles.length > 1 ? 's' : ''})
 </span>
 </div>
 
 {/* Icône chevron */}
 <svg 
 className={`w-5 h-5 text-ink-light transition-transform ${isOpen ? 'rotate-180' : ''}`}
 fill="none" 
 viewBox="0 0 24 24" 
 stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {/* Contenu dépliable */}
 {isOpen && (
 <div className="mt-3 ml-6">
 {chapitre.feuilles.length > 0 ? (
 <div className="space-y-3">
 {chapitre.feuilles.map((feuille) => (
 <FeuilleCard
 key={feuille.id}
 feuille={feuille}
 progression={progressions.get(feuille.id) || null}
 typesActifs={typesActifs}
 feuillesDebloquees={feuillesDebloquees}
 feuillesAccessibles={feuillesAccessibles}
 onOpen={() => onOpenPdf(feuille.pdf_url)}
 onUpdateProgression={onProgressionUpdate}
 onConclureDone={onConclureDone}
 />
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-ink-light border border-dashed border-border rounded-lg bg-cream-100">
 Aucune feuille d'entraînement pour ce chapitre
 </div>
 )}
 </div>
 )}
 </div>
 );
}


/* ---------- Composant Sujet ---------- */
function SujetSection({ sujet, progressions, typesActifs, feuillesDebloquees, feuillesAccessibles, onOpenPdf, onProgressionUpdate, onConclureDone }: { sujet: Sujet; progressions: Map<string, Progression>; typesActifs: Set<string>; feuillesDebloquees: Set<string>; feuillesAccessibles: Set<string>; onOpenPdf: (url: string) => void; onProgressionUpdate: () => Promise<void>; onConclureDone: (type: 'mecanique' | 'chaotique') => void }) {
 return (
 <div className="mb-12">
 {/* En-tête du sujet */}
 <div className="inline-block mb-6 px-6 py-3 rounded-full from-accent text-ink font-bold text-xl shadow-sm">
 {sujet.titre}
 </div>

 {/* Feuilles directes sous le sujet (sans chapitre intermédiaire) */}
 {(sujet.feuilles ?? []).length > 0 && (
 <div className="space-y-3 mb-8">
 {(sujet.feuilles ?? []).map((feuille) => (
 <FeuilleCard
 key={feuille.id}
 feuille={feuille}
 progression={progressions.get(feuille.id) || null}
 typesActifs={typesActifs}
 feuillesDebloquees={feuillesDebloquees}
 feuillesAccessibles={feuillesAccessibles}
 onOpen={() => onOpenPdf(feuille.pdf_url)}
 onUpdateProgression={onProgressionUpdate}
 onConclureDone={onConclureDone}
 />
 ))}
 </div>
 )}

 {/* Chapitres */}
 {sujet.chapitres.length > 0 ? (
 <div className="space-y-8">
 {sujet.chapitres.map((chapitre) => (
 <ChapitreSection key={chapitre.id} chapitre={chapitre} progressions={progressions} typesActifs={typesActifs} feuillesDebloquees={feuillesDebloquees} feuillesAccessibles={feuillesAccessibles} onOpenPdf={onOpenPdf} onProgressionUpdate={onProgressionUpdate} onConclureDone={onConclureDone} />
 ))}
 </div>
 ) : (sujet.feuilles ?? []).length === 0 ? (
 <div className="text-center py-12 text-ink-light border border-dashed border-border rounded-lg">
 Aucun chapitre pour ce sujet
 </div>
 ) : null}
 </div>
 );
}

/* ---------- Page principale ---------- */
export default function LibraryPage() {
 const router = useRouter();
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [niveaux, setNiveaux] = useState<Niveau[]>([]);
 const [niveauSelectionne, setNiveauSelectionne] = useState<string | null>(null);
 const [parcours, setParcours] = useState<Niveau | null>(null);
 const [progressions, setProgressions] = useState<Map<string, Progression>>(new Map());
 const [feuillesEnProgression, setFeuillesEnProgression] = useState<Array<{
 feuille: FeuilleEntrainement;
 progression: Progression;
 chapitre: string;
 }>>([]);
 const [progressionOuverte, setProgressionOuverte] = useState(false);
 const [parcoursOuvert, setParcoursOuvert] = useState(true);
 const [etapesParcours, setEtapesParcours] = useState<{numero: number; titre_snapshot: string; statut: string; validee_at: string | null}[]>([]);;
 const [typesActifs, setTypesActifs] = useState<Set<string>>(new Set());
 const [feuillesDebloquees, setFeuillesDebloquees] = useState<Set<string>>(new Set());
 const [feuillesAccessibles, setFeuillesAccessibles] = useState<Set<string>>(new Set());
 const [deblocageModal, setDeblocageModal] = useState<{ type: 'mecanique' | 'chaotique' } | null>(null);

 // Chargement initial des niveaux
 useEffect(() => {
 (async () => {
 const result = await getNiveaux();
 if (result.error) {
 setError(result.error.message || 'Erreur lors du chargement');
 setLoading(false);
 return;
 }

 if (result.data && result.data.length > 0) {
 setNiveaux(result.data);
 // Sélectionner automatiquement le premier niveau
 setNiveauSelectionne(result.data[0].id);
 } else {
 setLoading(false);
 }
 })();
 }, []);

 // Chargement des feuilles en progression + parcours
 useEffect(() => {
 loadFeuillesEnProgression();
 (async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const { data } = await supabase
  .from('etape_parcours')
  .select('numero, titre_snapshot, statut, validee_at, chapitre_snapshot, clot_noeud, type')
  .eq('user_id', session.user.id)
  .order('numero', { ascending: true });
  if (data) setEtapesParcours(data);
 })();
 }, []);

 // Chargement du parcours quand un niveau est sélectionné
 useEffect(() => {
 if (!niveauSelectionne) return;

 (async () => {
 setLoading(true);
 
 // Récupérer la session (plus fiable que getUser)
 const { data: { session } } = await supabase.auth.getSession();
 
 if (!session || !session.user) {
 setError('Vous devez être connecté');
 setLoading(false);
 return;
 }

 const user = session.user;

 // Charger le parcours
 const result = await getParcoursComplet(niveauSelectionne);
 if (result.error) {
 setError(result.error.message || 'Erreur lors du chargement du parcours');
 } else {
 setParcours(result.data);
 
 if (result.data) {
 // Charger progressions directement
 const { data: progressionsData } = await supabase
 .from('progression_feuille')
 .select(`
 *,
 sessions:session_travail(*)
 `)
 .eq('user_id', user.id);

 const progMap = new Map<string, Progression>();

 if (progressionsData) {
 progressionsData.forEach((prog: any) => {
 progMap.set(prog.feuille_id, {
 id: prog.id,
 feuille_id: prog.feuille_id,
 est_termine: prog.est_termine,
 en_cours: prog.en_cours,
 score: prog.score,
 score_moyen: prog.score_moyen,
 nb_exercices_valides: prog.nb_exercices_valides,
 temps_total: prog.temps_total || 0,
 sessions: prog.sessions || [],
 statut: prog.statut,
 commentaire_chef: prog.commentaire_chef,
 });
 });
 }

 // Calculer les types actuellement actifs
 const ftm = new Map<string, 'mecanique' | 'chaotique'>();
 result.data.sujets.forEach((sujet: any) => {
 (sujet.feuilles ?? []).forEach((f: any) => ftm.set(f.id, f.type));
 sujet.chapitres.forEach((ch: any) => ch.feuilles.forEach((f: any) => ftm.set(f.id, f.type)));
 });
 const ta = new Set<string>();
 progMap.forEach((prog, feuilleId) => {
 if (prog.en_cours && !prog.est_termine) {
 const t = ftm.get(feuilleId);
 if (t) ta.add(t);
 }
 });
 setTypesActifs(ta);
 setProgressions(progMap);

 // Charger les feuilles débloquées et calculer les accessibles
 const { data: debloquees } = await supabase
 .from('feuille_debloquee')
 .select('feuille_id')
 .eq('user_id', user.id);
 const debSet = new Set<string>(debloquees?.map((d: any) => d.feuille_id) ?? []);
 setFeuillesDebloquees(debSet);

 const accessibles = new Set<string>(debSet);
 for (const tp of ['mecanique', 'chaotique'] as const) {
 const ids = [...ftm.entries()].filter(([_, t]) => t === tp).map(([id]) => id);
 if (!ids.some(id => debSet.has(id)) && !ids.some(id => progMap.has(id))) {
 ids.forEach(id => accessibles.add(id));
 }
 }
 setFeuillesAccessibles(accessibles);
 }
 }
 setLoading(false);
 })();
 }, [niveauSelectionne]);

 // Ouvrir un PDF
 const handleOpenPdf = (url: string) => {
 window.open(url, '_blank');
 };

 // Recharger la progression après mise à jour
 const handleProgressionUpdate = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !session.user) return;
 
 // Recharger UNIQUEMENT les progressions
 const { data: progressionsData } = await supabase
 .from('progression_feuille')
 .select(`
 *,
 sessions:session_travail(*)
 `)
 .eq('user_id', session.user.id);

 if (!progressionsData) return;

 // Mettre à jour la Map locale
 const newProgMap = new Map(progressions);

 progressionsData.forEach((prog: any) => {
 newProgMap.set(prog.feuille_id, {
 id: prog.id,
 feuille_id: prog.feuille_id,
 est_termine: prog.est_termine,
 en_cours: prog.en_cours,
 score: prog.score,
 score_moyen: prog.score_moyen,
 nb_exercices_valides: prog.nb_exercices_valides,
 temps_total: prog.temps_total || 0,
 sessions: prog.sessions || [],
 statut: prog.statut || 'en_cours',
 commentaire_chef: prog.commentaire_chef,
 });
 });

 // Recalculer typesActifs
 const ftm = new Map<string, 'mecanique' | 'chaotique'>();
 if (parcours) {
 parcours.sujets.forEach(sujet => {
 (sujet.feuilles ?? []).forEach(f => ftm.set(f.id, f.type));
 sujet.chapitres.forEach(ch => ch.feuilles.forEach(f => ftm.set(f.id, f.type)));
 });
 }
 const ta = new Set<string>();
 newProgMap.forEach((prog, feuilleId) => {
 if (prog.en_cours && !prog.est_termine) {
 const t = ftm.get(feuilleId);
 if (t) ta.add(t);
 }
 });
 setTypesActifs(ta);
 setProgressions(newProgMap);

 // Recharger les feuilles débloquées et recalculer les accessibles
 const { data: debloquees } = await supabase
 .from('feuille_debloquee')
 .select('feuille_id')
 .eq('user_id', session.user.id);
 const debSet = new Set<string>(debloquees?.map((d: any) => d.feuille_id) ?? []);
 setFeuillesDebloquees(debSet);

 const accessibles = new Set<string>(debSet);
 for (const tp of ['mecanique', 'chaotique'] as const) {
 const ids = [...ftm.entries()].filter(([_, t]) => t === tp).map(([id]) => id);
 if (!ids.some(id => debSet.has(id)) && !ids.some(id => newProgMap.has(id))) {
 ids.forEach(id => accessibles.add(id));
 }
 }
 setFeuillesAccessibles(accessibles);

 await loadFeuillesEnProgression();
 };

 const handleConclureDone = (type: 'mecanique' | 'chaotique') => {
 setDeblocageModal({ type });
 };

 const handleDebloquer = async (feuilleId: string) => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) return;
 await supabase.from('feuille_debloquee').insert({ user_id: session.user.id, feuille_id: feuilleId });
 setDeblocageModal(null);
 await handleProgressionUpdate();
 };

 const loadFeuillesEnProgression = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !session.user) return;

 const { data, error } = await supabase
 .from('progression_feuille')
 .select(`
 id,
 feuille_id,
 statut,
 en_cours,
 est_termine,
 score,
 score_moyen,
 nb_exercices_valides,
 temps_total,
 commentaire_chef,
 noeud:noeud(
 id,
 titre,
 pdf_url,
 ordre,
 difficulte,
 type,
 nb_exercices
 )
 `)
 .eq('user_id', session.user.id)
 .eq('en_cours', true);

 if (error) {
 console.error('Erreur chargement feuilles en progression:', error);
 return;
 }

 const feuilles = data?.map((item: any) => ({
 feuille: {
 id: item.noeud.id,
 titre: item.noeud.titre,
 description: null,
 pdf_url: item.noeud.pdf_url,
 ordre: item.noeud.ordre,
 ordre_dans_niveau: 0,
 difficulte: item.noeud.difficulte,
 type: item.noeud.type as 'mecanique' | 'chaotique',
 nb_exercices: item.noeud.nb_exercices ?? null,
 },
 progression: {
 id: item.id,
 feuille_id: item.feuille_id,
 est_termine: item.est_termine,
 en_cours: item.en_cours,
 score: item.score,
 score_moyen: item.score_moyen,
 nb_exercices_valides: item.nb_exercices_valides,
 temps_total: item.temps_total,
 sessions: [],
 statut: item.statut || 'en_cours',
 commentaire_chef: item.commentaire_chef,
 },
 chapitre: 'Chapitre inconnu',
 })) || [];

 setFeuillesEnProgression(feuilles);
 };

 /* ---------- États de chargement / erreur ---------- */
 if (loading) {
 return (
 <div className="min-h-screen bg-cream-50 flex items-center justify-center">
 <div className="flex items-center gap-3 text-accent">
 <Loader />
 <span className="text-lg text-ink">Chargement du parcours…</span>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
 <div className="bg-red-100/30 border border-red-300/40 rounded-lg p-6 max-w-md">
 <h2 className="text-red-600 font-semibold mb-2">Erreur</h2>
 <p className="text-ink">{error}</p>
 <button
 onClick={() => location.reload()}
 className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-ink"
 >
 Réessayer
 </button>
 </div>
 </div>
 );
 }

 /* ---------- Rendu principal ---------- */
 return (
 <main className="min-h-screen bg-cream-50 text-ink transition-colors">
 <style jsx global>{`
 @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap');
 h1, h2, h3, h4, h5, h6, .font-mono { font-family: 'IBM Plex Mono', monospace; }
 body { font-family: 'Lora', serif; }
 p, span, div { font-family: 'Lora', serif; }
 `}</style>
 <div className="max-w-4xl mx-auto px-6 py-8">
 {/* Header */}
 <header className="mb-10">
 <div>
 <h1 className="text-3xl md:text-4xl font-[\'IBM_Plex_Mono\'] font-extrabold tracking-tight">
 <span className="text-ink">Parcours de </span>
 <span className="text-blue-500">Mathématiques</span>
 </h1>
 <p className="text-ink-light mt-2">Suis le chemin d'apprentissage étape par étape</p>
 </div>
 </header>

 {/* Section En Progression (pliable) */}
 {feuillesEnProgression.length > 0 && (
 <div className="mb-8 rounded-lg border border-status-success/30">
 <button
  onClick={() => setProgressionOuverte(v => !v)}
  className="w-full flex items-center justify-between px-6 py-4 rounded-lg hover:bg-status-success/5 transition-colors"
 >
  <h2 className="text-2xl font-['IBM_Plex_Mono'] font-bold text-status-success flex items-center gap-2">
  🔥 En Progression
  <span className="text-sm font-normal text-status-success/70">
   ({feuillesEnProgression.length})
  </span>
  </h2>
  <span className="text-status-success text-lg">{progressionOuverte ? '▼' : '▶'}</span>
 </button>
 {progressionOuverte && (
  <div className="px-6 pb-6 space-y-2">
  {feuillesEnProgression.map(({ feuille, progression }) => (
   <FeuilleCard
   key={feuille.id}
   feuille={feuille}
   progression={progression}
   typesActifs={typesActifs}
   feuillesDebloquees={feuillesDebloquees}
   feuillesAccessibles={feuillesAccessibles}
   onOpen={() => handleOpenPdf(feuille.pdf_url)}
   onUpdateProgression={handleProgressionUpdate}
   onConclureDone={handleConclureDone}
   />
  ))}
  </div>
 )}
 </div>
 )}

 {/* Section Mon Parcours (pliable) */}
 <div className="mb-8 rounded-lg border border-border">
 <button
  onClick={() => setParcoursOuvert(v => !v)}
  className="w-full flex items-center justify-between px-6 py-4 rounded-lg hover:bg-cream-100 transition-colors"
 >
  <h2 className="text-2xl font-['IBM_Plex_Mono'] font-bold text-ink flex items-center gap-2">
  🗺 Mon Parcours
  {etapesParcours.length > 0 && (
   <span className="text-sm font-normal text-ink-muted">
   ({etapesParcours.length} étape{etapesParcours.length > 1 ? 's' : ''})
   </span>
  )}
  </h2>
  <span className="text-ink-light text-lg">{parcoursOuvert ? '▼' : '▶'}</span>
 </button>
 {parcoursOuvert && (
  <div className="pb-4">
   <ParcoursTimeline etapes={etapesParcours} />
  </div>
 )}
 </div>

 {/* Sélecteur de niveau (si plusieurs niveaux disponibles) */}
 {niveaux.length > 1 && (
 <div className="mb-8">
 <label className="block text-sm font-medium mb-2 text-ink">Niveau</label>
 <select
 value={niveauSelectionne || ''}
 onChange={(e) => setNiveauSelectionne(e.target.value)}
 className="w-full max-w-xs px-4 py-2 rounded-lg border border-accent/30 bg-cream-50 border border-accent/30 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
 >
 {niveaux.map((niveau) => (
 <option key={niveau.id} value={niveau.id}>
 {niveau.titre}
 </option>
 ))}
 </select>
 </div>
 )}



 {/* Contenu du parcours */}
 {!parcours || !parcours.sujets || parcours.sujets.length === 0 ? (
 <div className="text-center text-ink-light py-20 bg-cream-50 bg-cream-50/50 rounded-lg border border-dashed border-border">
 <p className="text-lg mb-2">Aucun contenu disponible pour le moment</p>
 <p className="text-sm">Le parcours sera bientôt enrichi avec des exercices</p>
 </div>
 ) : (
 <div className="space-y-12">
 {parcours.sujets.map((sujet) => (
 <SujetSection key={sujet.id} sujet={sujet} progressions={progressions} typesActifs={typesActifs} feuillesDebloquees={feuillesDebloquees} feuillesAccessibles={feuillesAccessibles} onOpenPdf={handleOpenPdf} onProgressionUpdate={handleProgressionUpdate} onConclureDone={handleConclureDone} />
 ))}
 </div>
 )}
 </div>

 {/* Modal de déblocage */}
 {deblocageModal && (
 <DeblocageModal
 type={deblocageModal.type}
 parcours={parcours}
 progressions={progressions}
 feuillesAccessibles={feuillesAccessibles}
 onDebloquer={handleDebloquer}
 onClose={() => setDeblocageModal(null)}
 />
 )}
 </main>
 );
}