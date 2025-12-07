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

  console.log('🔍 Feuille:', feuille.titre, {
    statut: progression?.statut,
    est_bloquee: progression?.est_bloquee,
    estValidee,
    estBloquee
  });

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
            ? 'border-gray-700 bg-white/50 opacity-60 cursor-not-allowed'
            : isAuthorized && !estValidee
            ? 'border-green-400 bg-green-50/20 hover:border-green-500 hover:shadow-lg'
            : 'border-gray-300 bg-white border-2 border-blue-500/30 hover:border-blue-500 hover:shadow-md'
        }`}
      >
        {/* Badge de blocage */}
        {estBloquee && (
          <div className="absolute top-2 right-2 z-10">
            <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-full flex items-center gap-1">
              <IconLock />
              Bloquée
            </span>
          </div>
        )}

        {/* Badge feuille autorisée */}
        {isAuthorized && !estValidee && !estBloquee && (
          <div className="absolute top-2 right-2 z-10">
            <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 text-xs font-bold rounded-full flex items-center gap-1 shadow-md animate-pulse">
              ✓ À faire
            </span>
          </div>
        )}

        {/* Numéro d'ordre avec pastille */}
        <div className={`flex items-center justify-center w-10 h-10 rounded-full text-gray-900 font-bold text-lg shadow-md transition-transform ${
          estBloquee 
            ? 'bg-slate-400'
            : 'bg-[#ffd93d] group-hover:scale-110'
        }`}>
          {feuille.ordre_dans_niveau}
        </div>

        {/* Contenu */}
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-gray-900 truncate">{feuille.titre}</div>
          {feuille.description && (
            <div className="text-sm text-gray-600 mt-0.5 line-clamp-1">{feuille.description}</div>
          )}
          {progression && progression.temps_total > 0 && (
            <div className="text-xs text-blue-500 mt-1">
              {progression.temps_total} min • {progression.score !== null ? `Score: ${progression.score}` : 'Pas de score'}
            </div>
          )}
        </div>

        {/* Icône PDF */}
        <div className={`transition-colors ${
          estBloquee 
            ? 'text-gray-600'
            : 'text-gray-600 group-hover:text-[#4db7ff]'
        }`}>
          <IconFile />
        </div>

        {/* Pastille de progression - 3 COULEURS */}
        <div
          onClick={handlePastilleClick}
          className="absolute -top-2 -right-2 cursor-pointer hover:scale-110 transition-transform"
        >
          {estValidee ? (
            /* 🟣 VIOLET = Validée */
            <div className="text-[#ffd93d] drop-shadow-md">
              <IconCircleFilled />
            </div>
          ) : isAuthorized && !estBloquee ? (
            /* 🟠 ORANGE = Autorisée/Disponible */
            <div className="text-orange-500 drop-shadow-md">
              <IconCircleFilled />
            </div>
          ) : (
            /* ⚫ NOIR = Bloquée/Non autorisée */
            <div className="text-gray-900 hover:text-[#ffd93d] transition-colors">
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
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(''); // Score saisi par le membre
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const { data: { session: userSession } } = await supabase.auth.getSession();
      if (!userSession || !userSession.user) return;

      // Charger les sessions depuis session_entrainement
      const { data: sessionsData } = await supabase
        .from('session_entrainement')
        .select('*')
        .eq('user_id', userSession.user.id)
        .or(`feuille_mecanique_id.eq.${feuille.id},feuille_chaotique_id.eq.${feuille.id}`)
        .order('date_session', { ascending: false });

      if (sessionsData) {
        // Filtrer pour ne garder que les données de cette feuille spécifique
        const sessionsFiltered = sessionsData.map((s: any) => {
          const isMecanique = s.feuille_mecanique_id === feuille.id;
          return {
            id: s.id,
            numero: s.numero_session,
            date: s.date_session,
            heure: s.heure_session,
            temps: isMecanique ? s.temps_mecanique : s.temps_chaotique,
            type: isMecanique ? 'mecanique' : 'chaotique',
          };
        }).filter((s: any) => s.temps !== null && s.temps > 0);

        setSessions(sessionsFiltered);
      }

      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
      setLoading(false);
    }
  }

  const handleValider = async () => {
    try {
      setSaving(true);
      
      // Vérifier qu'on a des sessions
      if (sessions.length === 0) {
        alert('❌ Vous devez d\'abord enregistrer des sessions d\'entraînement sur cette feuille.\n\nRendez-vous sur "Mes Sessions" pour ajouter vos sessions quotidiennes.');
        setSaving(false);
        return;
      }

      // Vérifier que le score est saisi
      const scoreValue = parseInt(score);
      if (!score || isNaN(scoreValue) || scoreValue < 0 || scoreValue > 100) {
        alert('❌ Veuillez entrer un score valide entre 0 et 100');
        setSaving(false);
        return;
      }

      // Calculer le temps total
      const tempsTotal = sessions.reduce((acc, s) => acc + (s.temps || 0), 0);

      const { data: { session: userSession } } = await supabase.auth.getSession();
      if (!userSession || !userSession.user) {
        alert('Vous devez être connecté');
        setSaving(false);
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
        
        // Mettre à jour la progression avec le score et temps calculés
        const { error: updateError } = await supabase
          .from('progression_feuille')
          .update({
            score: scoreValue,
            temps_total: tempsTotal,
            est_termine: true,
          })
          .eq('id', progression!.id);

        if (updateError) throw updateError;

        // Appeler la fonction de soumission
        const { data, error } = await supabase.rpc('soumettre_feuille', {
          p_progression_id: progression!.id
        });

        if (error) throw error;

        if (!data.success) {
          alert(data.error);
          setSaving(false);
          return;
        }

        alert(`✅ Feuille soumise au chef pour validation !\n\n📊 Score : ${scoreValue}/100\n⏱️ Temps total : ${tempsTotal} min`);
      } else {
        // ========================================
        // CAS 2 : PAS DANS UNE ÉQUIPE
        // → Validation automatique
        // ========================================
        
        const { error } = await supabase
          .from('progression_feuille')
          .update({
            est_termine: true,
            en_cours: false,
            statut: 'validee',
            score: scoreValue,
            temps_total: tempsTotal,
            validee_at: new Date().toISOString()
          })
          .eq('id', progression!.id);

        if (error) throw error;

        alert(`✅ Feuille terminée !\n\n📊 Score : ${scoreValue}/100\n⏱️ Temps total : ${tempsTotal} min`);
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

  const tempsTotal = sessions.reduce((acc, s) => acc + (s.temps || 0), 0);
  const estValidee = progression?.statut === 'validee';
  const estEnAttente = progression?.statut === 'en_attente';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#4db7ff] to-[#4db7ff][#4db7ff] p-6 rounded-t-2xl">
          <h2 className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-gray-900">{feuille.titre}</h2>
          {feuille.description && (
            <p className="text-teal-100 mt-1">{feuille.description}</p>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Afficher le commentaire du chef si présent */}
          {progression?.commentaire_chef && (
            <div className="p-4 bg-blue-50/20 border-2 border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💬</div>
                <div className="flex-1">
                  <div className="font-semibold text-[#4db7ff] mb-1">
                    Commentaire du chef :
                  </div>
                  <p className="text-[#4db7ff]">
                    {progression.commentaire_chef}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Afficher si en attente */}
          {estEnAttente && (
            <div className="p-4 bg-orange-50/20 border-2 border-[#ffd93d]/30 rounded-xl text-center">
              <div className="text-3xl mb-2">⏳</div>
              <div className="font-semibold text-[#ffd93d]">
                Feuille en attente de validation
              </div>
              <p className="text-sm text-orange-700 mt-2">
                Votre chef d'équipe doit valider votre soumission avant que vous puissiez continuer.
              </p>
            </div>
          )}

          {/* Afficher si validée avec score */}
          {estValidee && progression?.score !== null && (
            <div className="p-4 bg-green-50/20 border-2 border-green-200 rounded-xl text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-semibold text-green-900">
                Feuille validée !
              </div>
              <div className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-green-700 mt-2">
                {progression.score}/100
              </div>
            </div>
          )}

          {/* Statistiques */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-xl text-center">
              <div className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-blue-500">
                {sessions.length}
              </div>
              <div className="text-sm text-gray-600">Session{sessions.length > 1 ? 's' : ''}</div>
            </div>
            <div className="p-4 bg-white rounded-xl text-center">
              <div className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-blue-500">
                {tempsTotal} min
              </div>
              <div className="text-sm text-gray-600">Temps total</div>
            </div>
          </div>

          {/* Liste des sessions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Historique des sessions</h3>
            </div>

            {sessions.length === 0 ? (
              <div className="p-6 bg-white rounded-xl text-center">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-gray-600 mb-3">
                  Aucune session enregistrée pour cette feuille
                </p>
                <p className="text-sm text-gray-600">
                  Rendez-vous sur <span className="font-semibold">"Mes Sessions"</span> pour enregistrer vos entraînements quotidiens
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 bg-white rounded-lg flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        Session #{session.numero} - {new Date(session.date).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-sm text-gray-600">
                        {session.heure} • {session.temps} min
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saisie du score (si pas encore validée/en attente) */}
          {!estValidee && !estEnAttente && sessions.length > 0 && (
            <div className="p-4 bg-teal-50/20 border-2 border-teal-200 rounded-xl">
              <label className="block font-semibold text-teal-900 mb-2">
                📊 Score de la feuille (sur 100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="Ex: 85"
                className="w-full px-4 py-3 text-lg font-bold rounded-lg border-2 border-blue-500/70 bg-white text-gray-900 text-center"
              />
              <p className="text-xs text-teal-700[#4db7ff]/70 mt-2">
                Entrez votre score global pour l'ensemble de la feuille
              </p>
            </div>
          )}

          {/* Message d'info si pas de sessions */}
          {sessions.length === 0 && (
            <div className="p-4 bg-yellow-50/20 border-2 border-yellow-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="text-2xl">ℹ️</div>
                <div className="flex-1 text-sm">
                  <p className="text-[#ffd93d] font-medium mb-1">
                    Comment ça marche ?
                  </p>
                  <ol className="text-[#ffd93d] space-y-1 list-decimal list-inside">
                    <li>Allez sur "Mes Sessions" depuis la page d'accueil</li>
                    <li>Enregistrez vos sessions d'entraînement quotidiennes</li>
                    <li>Revenez ici quand vous avez terminé la feuille</li>
                    <li>Entrez votre score et cliquez sur "Soumettre"</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-50 hover:bg-[#3d3b58] text-gray-900 font-medium rounded-lg transition-colors"
          >
            Fermer
          </button>
          {!estValidee && !estEnAttente && progression && (
            <button
              onClick={handleValider}
              disabled={saving || sessions.length === 0}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-gray-900 font-medium rounded-lg transition-colors"
            >
              {saving ? 'Envoi...' : 'Soumettre pour validation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


/* ---------- Composant Chapitre ---------- */
function ChapitreSection({ chapitre, progressions, onOpenPdf, onProgressionUpdate }: { chapitre: Chapitre; progressions: Map<string, Progression>; onOpenPdf: (url: string) => void; onProgressionUpdate: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="mb-4">
      {/* Header cliquable du chapitre */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
          <h3 className="text-lg font-bold text-gray-900">{chapitre.titre}</h3>
          <span className="text-sm text-gray-500">
            ({chapitre.feuilles.length} feuille{chapitre.feuilles.length > 1 ? 's' : ''})
          </span>
        </div>
        
        {/* Icône chevron */}
        <svg 
          className={`w-5 h-5 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
                  onOpen={() => onOpenPdf(feuille.pdf_url)} 
                  onUpdateProgression={onProgressionUpdate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              Aucune feuille d'entraînement pour ce chapitre
            </div>
          )}
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
      <div className="inline-block mb-6 px-6 py-3 rounded-full bg-gradient-to-r from-[#4db7ff] to-[#0084d4] text-gray-900 font-bold text-xl shadow-lg">
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
        <div className="text-center py-12 text-gray-600 border-2 border-dashed border-gray-300 rounded-lg">
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#4db7ff]">
          <Loader />
          <span className="text-lg text-gray-900">Chargement du parcours…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-red-100/30 border border-red-300/40 rounded-xl p-6 max-w-md">
          <h2 className="text-red-600 font-semibold mb-2">Erreur</h2>
          <p className="text-gray-900">{error}</p>
          <button
            onClick={() => location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-gray-900"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Rendu principal ---------- */
  return (
    <main className="min-h-screen bg-white text-gray-900 transition-colors">
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
              <span className="text-gray-900">Parcours de </span>
              <span className="text-blue-500">Mathématiques</span>
            </h1>
            <p className="text-gray-600 mt-2">Suis le chemin d'apprentissage étape par étape</p>
          </div>
        </header>

        {/* Sélecteur de niveau (si plusieurs niveaux disponibles) */}
        {niveaux.length > 1 && (
          <div className="mb-8">
            <label className="block text-sm font-medium mb-2 text-slate-700">Niveau</label>
            <select
              value={niveauSelectionne || ''}
              onChange={(e) => setNiveauSelectionne(e.target.value)}
              className="w-full max-w-xs px-4 py-2 rounded-lg border-2 border-blue-500/30 bg-white border-2 border-blue-500/30 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4db7ff]"
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
            <div className="mb-8 bg-gradient-to-r from-[#ffd93d]/10 to-[#4db7ff]/10 rounded-2xl p-6 border-2 border-[#ffd93d]/30">
              <h2 className="text-2xl font-[\'IBM_Plex_Mono\'] font-bold text-[#ffd93d] mb-4 flex items-center gap-2">
                🔥 En Progression
                <span className="text-sm font-normal text-[#ffd93d]/70">
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
          <div className="text-center text-gray-600 py-20 bg-white bg-white/50 rounded-xl border-2 border-dashed border-gray-300">
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