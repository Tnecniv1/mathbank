'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';


/* ---------- Types ---------- */
type FeuilleEntrainement = {
  id: string;
  ordre: number;
  titre: string;
  description: string | null;
  pdf_url: string;
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
};

type Niveau = {
  id: string;
  ordre: number;
  titre: string;
  description: string | null;
  sujets: Sujet[];
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
  score: number | null;
  temps_total: number;
  sessions: SessionTravail[];
};

/* ---------- Icônes ---------- */
const Loader = () => (
  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
  </svg>
);

const IconSun = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h1M22 12h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7M12 8a4 4 0 000 8 4 4 0 000-8z"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const IconMoon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" stroke="currentColor" strokeWidth="2" />
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

/* ---------- Theme Toggle ---------- */
function ThemeToggle({ theme, toggle }: { theme: 'light' | 'dark'; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/40 transition-colors"
      title="Changer de thème"
    >
      {theme === 'dark' ? (
        <span className="text-yellow-400">
          <IconSun />
        </span>
      ) : (
        <span className="text-slate-800">
          <IconMoon />
        </span>
      )}
    </button>
  );
}

/* ---------- Data fetch ---------- */
async function getParcoursComplet(niveauId: string) {
  try {
    const { data, error } = await supabase
      .from('niveau')
      .select(
        `
        id, ordre, titre, description,
        sujets:sujet (
          id, ordre, titre, description,
          chapitres:chapitre (
            id, ordre, titre, description,
            feuilles:feuille_entrainement (
              id, ordre, titre, description, pdf_url
            )
          )
        )
      `
      )
      .eq('id', niveauId)
      .single();

    if (error) throw error;

    // Tri des éléments par ordre
    if (data?.sujets) {
      data.sujets.sort((a: any, b: any) => a.ordre - b.ordre);
      data.sujets.forEach((s: any) => {
        if (s.chapitres) {
          s.chapitres.sort((a: any, b: any) => a.ordre - b.ordre);
          s.chapitres.forEach((c: any) => {
            if (c.feuilles) {
              c.feuilles.sort((a: any, b: any) => a.ordre - b.ordre);
            }
          });
        }
      });
    }

    return { data: data as Niveau, error: null };
  } catch (e: any) {
    console.error(e);
    return { data: null, error: e };
  }
}

async function getNiveaux() {
  try {
    const { data, error } = await supabase
      .from('niveau')
      .select('id, ordre, titre, description')
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
  onOpen, 
  onUpdateProgression 
}: { 
  feuille: FeuilleEntrainement; 
  progression: Progression | null;
  onOpen: () => void;
  onUpdateProgression: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const handlePastilleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  return (
    <>
      <button
        onClick={onOpen}
        className="group relative flex items-center gap-4 w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-md transition-all duration-200"
      >
        {/* Numéro d'ordre avec pastille */}
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 dark:from-teal-600 dark:dark:to-teal-700 text-white font-bold text-lg shadow-md group-hover:scale-110 transition-transform">
          {feuille.ordre}
        </div>

        {/* Contenu */}
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{feuille.titre}</div>
          {feuille.description && (
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{feuille.description}</div>
          )}
          {progression && progression.temps_total > 0 && (
            <div className="text-xs text-teal-600 dark:text-teal-400 mt-1">
              {progression.temps_total} min • {progression.score !== null ? `Score: ${progression.score}` : 'Pas de score'}
            </div>
          )}
        </div>

        {/* Icône PDF */}
        <div className="text-slate-400 group-hover:text-teal-500 transition-colors">
          <IconFile />
        </div>

        {/* Pastille de progression */}
        <div
          onClick={handlePastilleClick}
          className="absolute -top-2 -right-2 cursor-pointer hover:scale-110 transition-transform"
        >
          {progression?.est_termine ? (
            <div className="text-purple-600 dark:text-purple-400 drop-shadow-md">
              <IconCircleFilled />
            </div>
          ) : (
            <div className="text-slate-400 dark:text-slate-600 hover:text-purple-400 dark:hover:text-purple-500 transition-colors">
              <IconCircleEmpty />
            </div>
          )}
        </div>
      </button>

      {/* Modal de progression */}
      {showModal && (
        <ProgressionModal
          feuille={feuille}
          progression={progression}
          onClose={() => setShowModal(false)}
          onSave={onUpdateProgression}
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
  onSave,
}: {
  feuille: FeuilleEntrainement;
  progression: Progression | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [score, setScore] = useState(progression?.score?.toString() || '');
  const [sessions, setSessions] = useState<SessionTravail[]>(progression?.sessions || []);
  const [newSession, setNewSession] = useState({
    date: new Date().toISOString().split('T')[0],
    heure: new Date().toTimeString().split(' ')[0].slice(0, 5),
    duree: '',
    commentaire: '',
  });
  const [saving, setSaving] = useState(false);

  const tempsTotalCalcule = sessions.reduce((sum, s) => sum + s.duree, 0);

  const handleAjouterSession = () => {
    if (!newSession.duree || parseInt(newSession.duree) <= 0) {
      alert('Veuillez entrer une durée valide');
      return;
    }

    const session: SessionTravail = {
      id: `temp-${Date.now()}`,
      date: newSession.date,
      heure: newSession.heure,
      duree: parseInt(newSession.duree),
      commentaire: newSession.commentaire || null,
    };

    setSessions([...sessions, session]);
    setNewSession({
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toTimeString().split(' ')[0].slice(0, 5),
      duree: '',
      commentaire: '',
    });
  };

  const handleSupprimerSession = (index: number) => {
    setSessions(sessions.filter((_, i) => i !== index));
  };

  const handleValider = async () => {
    if (sessions.length === 0) {
      alert('Veuillez ajouter au moins une session de travail');
      return;
    }

    setSaving(true);
    try {
      // Récupérer la session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.user) {
        alert('Vous devez être connecté');
        return;
      }

      // Marquer comme terminé et sauvegarder le score
      const { data: progressionData, error: progError } = await supabase
        .from('progression_feuille')
        .upsert({
          user_id: session.user.id,
          feuille_id: feuille.id,
          est_termine: true,
          score: score ? parseInt(score) : null,
        }, {
          onConflict: 'user_id,feuille_id'
        })
        .select()
        .single();

      if (progError) throw progError;

      // Supprimer les anciennes sessions (si modification)
      if (progression?.id) {
        await supabase
          .from('session_travail')
          .delete()
          .eq('progression_id', progression.id);
      }

      // Ajouter les nouvelles sessions
      const sessionsToInsert = sessions.map(s => ({
        progression_id: progressionData.id,
        date: s.date,
        heure: s.heure,
        duree: s.duree,
        commentaire: s.commentaire,
      }));

      const { error: sessionError } = await supabase
        .from('session_travail')
        .insert(sessionsToInsert);

      if (sessionError) throw sessionError;

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Progression - {feuille.titre}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Score */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
              Score (optionnel)
            </label>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Ex: 85"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Temps total */}
          <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
            <div className="text-sm font-medium text-teal-800 dark:text-teal-300 mb-1">Temps total</div>
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {tempsTotalCalcule} minutes
            </div>
          </div>

          {/* Ajouter une session */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Ajouter une session</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Date</label>
                <input
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Heure</label>
                <input
                  type="time"
                  value={newSession.heure}
                  onChange={(e) => setNewSession({ ...newSession, heure: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                Durée (minutes) *
              </label>
              <input
                type="number"
                value={newSession.duree}
                onChange={(e) => setNewSession({ ...newSession, duree: e.target.value })}
                placeholder="Ex: 30"
                min="1"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                Commentaire (optionnel)
              </label>
              <input
                type="text"
                value={newSession.commentaire}
                onChange={(e) => setNewSession({ ...newSession, commentaire: e.target.value })}
                placeholder="Ex: Révision des exercices 1-5"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              onClick={handleAjouterSession}
              className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
            >
              + Ajouter cette session
            </button>
          </div>

          {/* Liste des sessions */}
          {sessions.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                Sessions ({sessions.length})
              </h3>
              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {new Date(session.date).toLocaleDateString('fr-FR')} à {session.heure}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      <span className="font-semibold text-teal-600 dark:text-teal-400">{session.duree} min</span>
                      {session.commentaire && (
                        <span className="ml-2">• {session.commentaire}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSupprimerSession(index)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-3">
          <button
            onClick={handleValider}
            disabled={saving || sessions.length === 0}
            className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader />
                Enregistrement...
              </>
            ) : (
              <>
                <IconCheck />
                Valider et marquer comme terminé
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-medium rounded-lg transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
function ChapitreSection({ chapitre, progressions, onOpenPdf, onProgressionUpdate }: { chapitre: Chapitre; progressions: Map<string, Progression>; onOpenPdf: (url: string) => void; onProgressionUpdate: () => void }) {
  return (
    <div className="mb-8">
      {/* En-tête du chapitre */}
      <div className="inline-block mb-4 px-4 py-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 dark:from-rose-600 dark:to-pink-700 text-white font-semibold shadow-md">
        {chapitre.titre}
      </div>

      {/* Feuilles */}
      {chapitre.feuilles.length > 0 ? (
        <div className="space-y-3">
          {chapitre.feuilles.map((feuille) => (
            <FeuilleCard 
              key={feuille.id} 
              feuille={feuille}
              progression={progressions.get(feuille.id) || null}
              onOpen={() => onOpenPdf(feuille.pdf_url)} 
              onUpdateProgression={onProgressionUpdate}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
          Aucune feuille d'entraînement pour ce chapitre
        </div>
      )}
    </div>
  );
}

/* ---------- Composant Sujet ---------- */
function SujetSection({ sujet, progressions, onOpenPdf, onProgressionUpdate }: { sujet: Sujet; progressions: Map<string, Progression>; onOpenPdf: (url: string) => void; onProgressionUpdate: () => void }) {
  return (
    <div className="mb-12">
      {/* En-tête du sujet */}
      <div className="inline-block mb-6 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white font-bold text-xl shadow-lg">
        {sujet.titre}
      </div>

      {/* Chapitres */}
      {sujet.chapitres.length > 0 ? (
        <div className="space-y-8">
          {sujet.chapitres.map((chapitre) => (
            <ChapitreSection key={chapitre.id} chapitre={chapitre} progressions={progressions} onOpenPdf={onOpenPdf} onProgressionUpdate={onProgressionUpdate} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
          Aucun chapitre pour ce sujet
        </div>
      )}
    </div>
  );
}

/* ---------- Page principale ---------- */
export default function LibraryPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [niveauSelectionne, setNiveauSelectionne] = useState<string | null>(null);
  const [parcours, setParcours] = useState<Niveau | null>(null);
  const [progressions, setProgressions] = useState<Map<string, Progression>>(new Map());

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

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
        
        // Charger les progressions de l'utilisateur
        if (result.data) {
          const { data: progressionsData } = await supabase
            .from('progression_feuille')
            .select(`
              *,
              sessions:session_travail(*)
            `)
            .eq('user_id', user.id);

          if (progressionsData) {
            const progMap = new Map<string, Progression>();
            progressionsData.forEach((prog: any) => {
              progMap.set(prog.feuille_id, {
                id: prog.id,
                feuille_id: prog.feuille_id,
                est_termine: prog.est_termine,
                score: prog.score,
                temps_total: prog.temps_total || 0,
                sessions: prog.sessions || [],
              });
            });
            setProgressions(progMap);
          }
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
    if (!niveauSelectionne) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return;
    
    const { data: progressionsData } = await supabase
      .from('progression_feuille')
      .select(`
        *,
        sessions:session_travail(*)
      `)
      .eq('user_id', session.user.id);

    if (progressionsData) {
      const progMap = new Map<string, Progression>();
      progressionsData.forEach((prog: any) => {
        progMap.set(prog.feuille_id, {
          id: prog.id,
          feuille_id: prog.feuille_id,
          est_termine: prog.est_termine,
          score: prog.score,
          temps_total: prog.temps_total || 0,
          sessions: prog.sessions || [],
        });
      });
      setProgressions(progMap);
    }
  };

  /* ---------- États de chargement / erreur ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-teal-500">
          <Loader />
          <span className="text-lg text-slate-800 dark:text-slate-100">Chargement du parcours…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600/40 rounded-xl p-6 max-w-md">
          <h2 className="text-red-600 dark:text-red-300 font-semibold mb-2">Erreur</h2>
          <p className="text-slate-800 dark:text-white">{error}</p>
          <button
            onClick={() => location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-white"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Rendu principal ---------- */
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              <span className="text-slate-800 dark:text-white">Parcours de </span>
              <span className="text-teal-600 dark:text-teal-400">Mathématiques</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Suis le chemin d'apprentissage étape par étape</p>
          </div>
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </header>

        {/* Sélecteur de niveau (si plusieurs niveaux disponibles) */}
        {niveaux.length > 1 && (
          <div className="mb-8">
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Niveau</label>
            <select
              value={niveauSelectionne || ''}
              onChange={(e) => setNiveauSelectionne(e.target.value)}
              className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
          <div className="text-center text-slate-500 dark:text-slate-400 py-20 bg-slate-100 dark:bg-slate-800/40 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
            <p className="text-lg mb-2">Aucun contenu disponible pour le moment</p>
            <p className="text-sm">Le parcours sera bientôt enrichi avec des exercices</p>
          </div>
        ) : (
          <div className="space-y-12">
            {parcours.sujets.map((sujet) => (
              <SujetSection key={sujet.id} sujet={sujet} progressions={progressions} onOpenPdf={handleOpenPdf} onProgressionUpdate={handleProgressionUpdate} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}