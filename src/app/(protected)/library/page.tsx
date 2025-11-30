'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/* ---------- Types ---------- */
type FeuilleEntrainement = {
  id: string;
  ordre: number;
  ordre_dans_niveau: number;
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
  statut: string;
  commentaire_chef: string | null;
  est_bloquee?: boolean; // NOUVEAU : Feuille bloquée par le chef
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
              id, ordre, ordre_dans_niveau, titre, description, pdf_url
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
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Vérifier si cette feuille est autorisée (nouveau système)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) return;

      // Récupérer l'ID du membre
      const { data: membre } = await supabase
        .from('membre_equipe')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (membre) {
        // Vérifier si cette feuille est dans les feuilles autorisées
        const { data: autorisee, count } = await supabase
          .from('feuilles_autorisees')
          .select('feuille_id', { count: 'exact', head: true })
          .eq('membre_id', membre.id)
          .eq('feuille_id', feuille.id);
        
        if (count && count > 0) {
          setIsAuthorized(true);
        }
      }
    })();
  }, [feuille.id]);

  // Déterminer le statut de la feuille
  const estValidee = progression?.statut === 'validee';
  const estBloquee = progression?.est_bloquee;

  const handlePastilleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Si bloquée, afficher message
    if (estBloquee) {
      alert('🔒 Cette feuille est bloquée. Votre chef doit d\'abord valider votre travail en cours.');
      return;
    }
    
    setShowModal(true);
  };

  const handleCardClick = () => {
    // Si bloquée, empêcher l'ouverture
    if (estBloquee) {
      alert('🔒 Cette feuille est bloquée. Seule la feuille autorisée par votre chef est accessible.');
      return;
    }
    
    onOpen();
  };

  return (
    <>
      <button
        onClick={handleCardClick}
        disabled={estBloquee}
        className={`group relative flex items-center gap-4 w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
          estBloquee
            ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-60 cursor-not-allowed'
            : isAuthorized && !estValidee
            ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:border-green-500 dark:hover:border-green-500 hover:shadow-lg'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-md'
        }`}
      >
        {/* Badge de blocage */}
        {estBloquee && (
          <div className="absolute top-2 right-2 z-10">
            <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-full flex items-center gap-1">
              <IconLock />
              Bloquée
            </span>
          </div>
        )}

        {/* Badge feuille autorisée */}
        {isAuthorized && !estValidee && !estBloquee && (
          <div className="absolute top-2 right-2 z-10">
            <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-md animate-pulse">
              ✓ À faire
            </span>
          </div>
        )}

        {/* Numéro d'ordre avec pastille */}
        <div className={`flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-lg shadow-md transition-transform ${
          estBloquee 
            ? 'bg-slate-400 dark:bg-slate-600'
            : 'bg-gradient-to-br from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 group-hover:scale-110'
        }`}>
          {feuille.ordre_dans_niveau}
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
        <div className={`transition-colors ${
          estBloquee 
            ? 'text-slate-400'
            : 'text-slate-400 group-hover:text-teal-500'
        }`}>
          <IconFile />
        </div>

        {/* Pastille de progression - 3 COULEURS */}
        <div
          onClick={handlePastilleClick}
          className="absolute -top-2 -right-2 cursor-pointer hover:scale-110 transition-transform"
        >
          {estValidee ? (
            // 🟣 VIOLET = Validée
            <div className="text-purple-600 dark:text-purple-400 drop-shadow-md">
              <IconCircleFilled />
            </div>
          ) : isAuthorized && !estBloquee ? (
            // 🟠 ORANGE = Autorisée/Disponible
            <div className="text-orange-500 dark:text-orange-400 drop-shadow-md">
              <IconCircleFilled />
            </div>
          ) : (
            // ⚫ NOIR = Bloquée/Non autorisée
            <div className="text-slate-800 dark:text-slate-400 hover:text-purple-400 dark:hover:text-purple-500 transition-colors">
              <IconCircleEmpty />
            </div>
          )}
        </div>
      </button>

      {/* Modal de progression */}
      {showModal && !estBloquee && (
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
  const [sessions, setSessions] = useState<SessionTravail[]>(progression?.sessions || []);
  const [showAddSession, setShowAddSession] = useState(false);
  const [score, setScore] = useState(progression?.score?.toString() || '');
  const [saving, setSaving] = useState(false);

  // Formulaire de nouvelle session
  const [newSession, setNewSession] = useState({
    date: new Date().toISOString().split('T')[0],
    heure: '00:00',
    duree: '',
    commentaire: '',
  });

  const handleAddSession = async () => {
    if (!newSession.duree || parseInt(newSession.duree) <= 0) {
      alert('Veuillez entrer une durée valide');
      return;
    }

    try {
      const { data: { session: userSession } } = await supabase.auth.getSession();
      if (!userSession || !userSession.user) {
        alert('Vous devez être connecté');
        return;
      }

      // NOUVEAU : Vérifier qu'il n'y a pas déjà une feuille en cours
      if (!progression) {
        const { data: autreEnCours } = await supabase
          .from('progression_feuille')
          .select('id')
          .eq('user_id', userSession.user.id)
          .is('statut', null) // Feuilles pas encore soumises
          .neq('feuille_id', feuille.id);

        if (autreEnCours && autreEnCours.length > 0) {
          alert('⚠️ Vous avez déjà une autre feuille en cours. Terminez-la avant d\'en commencer une nouvelle.');
          return;
        }
      }

      // Créer ou récupérer la progression
      let progressionId = progression?.id;

      if (!progressionId) {
        // IMPORTANT : Ne pas créer la progression avec statut 'en_cours'
        // Elle restera NULL jusqu'à la soumission
        const { data: newProg, error: progError } = await supabase
          .from('progression_feuille')
          .insert({
            user_id: userSession.user.id,
            feuille_id: feuille.id,
            est_termine: false,
            en_cours: false, // Pas "en cours" tant que non soumise
            statut: null, // Pas de statut tant que non soumise
          })
          .select()
          .single();

        if (progError) throw progError;
        progressionId = newProg.id;
      }

      // Ajouter la session
      const { data: sessionData, error: sessionError } = await supabase
        .from('session_travail')
        .insert({
          progression_id: progressionId,
          date: newSession.date,
          heure: newSession.heure,
          duree: parseInt(newSession.duree),
          commentaire: newSession.commentaire || null,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Ajouter à la liste locale
      setSessions([...sessions, sessionData]);

      // Réinitialiser le formulaire
      setNewSession({
        date: new Date().toISOString().split('T')[0],
        heure: '00:00',
        duree: '',
        commentaire: '',
      });
      setShowAddSession(false);

      alert('✅ Session ajoutée !');
      onSave();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de l\'ajout de la session');
    }
  };

  const handleValider = async () => {
    try {
      setSaving(true);
      
      // Vérifier qu'on a des sessions ET un score
      if (sessions.length === 0) {
        alert('Ajoutez au moins une session de travail');
        return;
      }

      if (!score || parseInt(score) < 0 || parseInt(score) > 20) {
        alert('Veuillez entrer un score valide entre 0 et 20');
        return;
      }

      const { data: { session: userSession } } = await supabase.auth.getSession();
      if (!userSession || !userSession.user) {
        alert('Vous devez être connecté');
        return;
      }

      // Vérifier si l'utilisateur est dans une équipe
      const { data: membreData } = await supabase
        .from('membre_equipe')
        .select('equipe_id')
        .eq('user_id', userSession.user.id)
        .single();

      if (membreData) {
        // ========================================
        // CAS 1 : MEMBRE D'UNE ÉQUIPE
        // → Soumettre pour validation par le chef
        // ========================================
        
        // Créer ou récupérer la progression
        let progressionId = progression?.id;

        if (!progressionId) {
          const { data: newProg, error: progError } = await supabase
            .from('progression_feuille')
            .insert({
              user_id: userSession.user.id,
              feuille_id: feuille.id,
              est_termine: false,
              en_cours: true, // Maintenant oui, car on soumet
              statut: 'en_cours',
              score: parseInt(score),
            })
            .select()
            .single();

          if (progError) throw progError;
          progressionId = newProg.id;
        } else {
          // Mettre à jour le score et le statut
          const { error: updateError } = await supabase
            .from('progression_feuille')
            .update({
              score: parseInt(score),
              en_cours: true,
              statut: 'en_cours',
            })
            .eq('id', progressionId);

          if (updateError) throw updateError;
        }

        // Appeler la fonction de soumission
        const { data, error } = await supabase.rpc('soumettre_feuille', {
          p_progression_id: progressionId
        });

        if (error) throw error;

        if (!data.success) {
          alert(data.error);
          return;
        }

        alert('✅ Feuille soumise au chef pour validation !');
      } else {
        // ========================================
        // CAS 2 : PAS DANS UNE ÉQUIPE
        // → Validation automatique (comme avant)
        // ========================================
        
        let progressionId = progression?.id;

        if (!progressionId) {
          const { data: newProg, error: progError } = await supabase
            .from('progression_feuille')
            .insert({
              user_id: userSession.user.id,
              feuille_id: feuille.id,
              est_termine: true,
              en_cours: false,
              statut: 'validee',
              score: parseInt(score),
              validee_at: new Date().toISOString()
            })
            .select()
            .single();

          if (progError) throw progError;
        } else {
          const { error } = await supabase
            .from('progression_feuille')
            .update({
              est_termine: true,
              en_cours: false,
              statut: 'validee',
              score: parseInt(score),
              validee_at: new Date().toISOString()
            })
            .eq('id', progressionId);

          if (error) throw error;
        }

        alert('✅ Feuille terminée !');
      }

      onClose();
      onSave();
    } catch (error: any) {
      console.error('Erreur validation:', error);
      alert('Erreur lors de la validation');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Supprimer cette session ?')) return;

    try {
      const { error } = await supabase
        .from('session_travail')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(sessions.filter((s) => s.id !== sessionId));
      alert('Session supprimée');
      onSave();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de la suppression');
    }
  };

  const tempsTotal = sessions.reduce((acc, s) => acc + s.duree, 0);
  const estValidee = progression?.statut === 'validee';
  const estEnProgression = progression && !estValidee;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">{feuille.titre}</h2>
          {feuille.description && (
            <p className="text-teal-100 mt-1">{feuille.description}</p>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Afficher le commentaire du chef si présent */}
          {progression?.commentaire_chef && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💬</div>
                <div className="flex-1">
                  <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Commentaire du chef :
                  </div>
                  <p className="text-blue-800 dark:text-blue-200">
                    {progression.commentaire_chef}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Afficher si validée avec score */}
          {estValidee && progression?.score !== null && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-semibold text-green-900 dark:text-green-100">
                Feuille validée !
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300 mt-2">
                {progression.score}/20
              </div>
            </div>
          )}

          {/* Statistiques */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center">
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                {sessions.length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Session{sessions.length > 1 ? 's' : ''}</div>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center">
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                {tempsTotal} min
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Temps total</div>
            </div>
          </div>

          {/* Liste des sessions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Sessions de travail</h3>
              {!estValidee && (
                <button
                  onClick={() => setShowAddSession(!showAddSession)}
                  className="px-3 py-1 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {showAddSession ? 'Annuler' : '+ Ajouter'}
                </button>
              )}
            </div>

            {/* Formulaire d'ajout */}
            {showAddSession && (
              <div className="mb-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input
                      type="date"
                      value={newSession.date}
                      onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Heure</label>
                    <input
                      type="time"
                      value={newSession.heure}
                      onChange={(e) => setNewSession({ ...newSession, heure: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Durée (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={newSession.duree}
                    onChange={(e) => setNewSession({ ...newSession, duree: e.target.value })}
                    placeholder="60"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Commentaire (optionnel)</label>
                  <textarea
                    value={newSession.commentaire}
                    onChange={(e) => setNewSession({ ...newSession, commentaire: e.target.value })}
                    placeholder="Notes sur cette session..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <button
                  onClick={handleAddSession}
                  className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <IconCheck />
                  Enregistrer la session
                </button>
              </div>
            )}

            {/* Liste */}
            {sessions.length > 0 ? (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {new Date(session.date).toLocaleDateString('fr-FR')} à {session.heure}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {session.duree} min {session.commentaire && `• ${session.commentaire}`}
                      </div>
                    </div>
                    {!estValidee && (
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="px-3 py-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                Aucune session enregistrée
              </div>
            )}
          </div>

          {/* IMPORTANT : Score TOUJOURS visible (sauf si validée) */}
          {!estValidee && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Score final (sur 20) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="18"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Requis pour soumettre la feuille
              </p>
            </div>
          )}

          {/* Affichage du score si validée */}
          {estValidee && progression?.score !== null && (
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Score final</div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {progression.score}/20
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl transition-colors"
            >
              Fermer
            </button>
            
            {/* Bouton de soumission visible seulement si sessions + score */}
            {!estValidee && (
              <button
                onClick={handleValider}
                disabled={saving || sessions.length === 0 || !score}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  sessions.length === 0 
                    ? "Ajoutez au moins une session"
                    : !score 
                    ? "Entrez un score"
                    : ""
                }
              >
                {saving ? 'Soumission...' : 'Valider et soumettre'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} // En cours, en attente, ou rejetée

/* ---------- Composant Chapitre ---------- */
function ChapitreSection({ chapitre, progressions, onOpenPdf, onProgressionUpdate }: { chapitre: Chapitre; progressions: Map<string, Progression>; onOpenPdf: (url: string) => void; onProgressionUpdate: () => void }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-8 bg-gradient-to-b from-teal-500 to-teal-600 rounded-full"></div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{chapitre.titre}</h3>
      </div>

      {chapitre.feuilles.length > 0 ? (
        <div className="space-y-3 ml-6">
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [niveauSelectionne, setNiveauSelectionne] = useState<string | null>(null);
  const [parcours, setParcours] = useState<Niveau | null>(null);
  const [progressions, setProgressions] = useState<Map<string, Progression>>(new Map());

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
        
        // ========================================
        // NOUVEAU : Charger progressions + feuilles autorisées
        // ========================================
        if (result.data) {
          // Vérifier si membre d'une équipe et charger TOUTES les feuilles autorisées
          const { data: membre } = await supabase
            .from('membre_equipe')
            .select('id')
            .eq('user_id', user.id)
            .single();

          // Charger les feuilles autorisées (plusieurs feuilles possibles)
          let feuillesAutoriseesIds = new Set<string>();
          if (membre) {
            const { data: autorisees } = await supabase
              .from('feuilles_autorisees')
              .select('feuille_id')
              .eq('membre_id', membre.id);
            
            if (autorisees) {
              feuillesAutoriseesIds = new Set(autorisees.map(a => a.feuille_id));
            }
          }

          // Charger progressions
          const { data: progressionsData } = await supabase
            .from('progression_feuille')
            .select(`
              *,
              sessions:session_travail(*)
            `)
            .eq('user_id', user.id);

          const progMap = new Map<string, Progression>();

          // Remplir avec les progressions existantes
          if (progressionsData) {
            progressionsData.forEach((prog: any) => {
              // Calculer si la feuille est bloquée
              // Bloquée = membre d'équipe ET (pas autorisée ET pas validée)
              const estBloquee = membre && 
                                 !feuillesAutoriseesIds.has(prog.feuille_id) && 
                                 prog.statut !== 'validee';

              progMap.set(prog.feuille_id, {
                id: prog.id,
                feuille_id: prog.feuille_id,
                est_termine: prog.est_termine,
                score: prog.score,
                temps_total: prog.temps_total || 0,
                sessions: prog.sessions || [],
                statut: prog.statut,
                commentaire_chef: prog.commentaire_chef,
                est_bloquee: estBloquee,
              });
            });
          }

          // Si membre d'équipe, bloquer TOUTES les feuilles non autorisées
          if (membre) {
            // Parcourir toutes les feuilles du parcours
            result.data.sujets.forEach((sujet: any) => {
              sujet.chapitres.forEach((chapitre: any) => {
                chapitre.feuilles.forEach((feuille: any) => {
                  // Si cette feuille n'a pas de progression
                  if (!progMap.has(feuille.id)) {
                    // Est-elle autorisée ?
                    const estAutorisee = feuillesAutoriseesIds.has(feuille.id);
                    
                    // Créer une entrée (bloquée si pas autorisée)
                    progMap.set(feuille.id, {
                      id: '',
                      feuille_id: feuille.id,
                      est_termine: false,
                      score: null,
                      temps_total: 0,
                      sessions: [],
                      statut: null,
                      commentaire_chef: null,
                      est_bloquee: !estAutorisee, // BLOQUÉE si pas autorisée
                    });
                  }
                });
              });
            });
          }

          setProgressions(progMap);
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
        score: prog.score,
        temps_total: prog.temps_total || 0,
        sessions: prog.sessions || [],
        statut: prog.statut || 'en_cours',
        commentaire_chef: prog.commentaire_chef,
        est_bloquee: newProgMap.get(prog.feuille_id)?.est_bloquee || false,
      });
    });

    setProgressions(newProgMap);
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
        <header className="mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              <span className="text-slate-800 dark:text-white">Parcours de </span>
              <span className="text-teal-600 dark:text-teal-400">Mathématiques</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Suis le chemin d'apprentissage étape par étape</p>
          </div>
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

        {/* Section En Progression */}
        {parcours && (() => {
          const feuillesEnCours: Array<{feuille: FeuilleEntrainement, progression: Progression, chapitre: string}> = [];
          parcours.sujets?.forEach(sujet => {
            sujet.chapitres?.forEach(chapitre => {
              chapitre.feuilles?.forEach(feuille => {
                const prog = progressions.get(feuille.id);
                if (prog && !prog.est_bloquee && prog.statut !== 'validee') {
                  feuillesEnCours.push({ feuille, progression: prog, chapitre: chapitre.titre });
                }
              });
            });
          });

          if (feuillesEnCours.length === 0) return null;

          return (
            <div className="mb-8 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-2xl p-6 border-2 border-orange-200 dark:border-orange-800">
              <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-4 flex items-center gap-2">
                🔥 En Progression
                <span className="text-sm font-normal text-orange-600 dark:text-orange-400">
                  ({feuillesEnCours.length})
                </span>
              </h2>
              <div className="space-y-2">
                {feuillesEnCours.map(({ feuille, progression }) => (
                  <FeuilleCard
                    key={feuille.id}
                    feuille={feuille}
                    progression={progression}
                    onOpen={() => {}}
                    onUpdateProgression={handleProgressionUpdate}
                  />
                ))}
              </div>
            </div>
          );
        })()}

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