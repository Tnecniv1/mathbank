'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Session = {
  id: string;
  date: string;
  heure: string;
  duree: number;
  commentaire: string | null;
};

type Progression = {
  progression_id: string;
  feuille_id: string;
  feuille_titre: string;
  feuille_ordre: number;
  statut: 'en_cours' | 'soumise';
  score: number | null;
  temps_total: number;
  sessions: Session[];
};

type Membre = {
  membre_id: string;
  membre_nom: string;
  progressions: Progression[];
};

const IconCheck = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export default function ModalObserverFeuilles({ 
  equipeId, 
  onClose 
}: { 
  equipeId: string; 
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [selectedProg, setSelectedProg] = useState<Progression | null>(null);

  useEffect(() => {
    loadProgressions();
  }, [equipeId]);

  async function loadProgressions() {
    try {
      const { data, error } = await supabase.rpc('get_feuilles_equipe_progression', {
        p_equipe_id: equipeId
      });

      if (error) throw error;
      
      setMembres(data || []);
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
        </div>
      </div>
    );
  }

  if (selectedProg) {
    return <DetailFeuilleModal progression={selectedProg} onClose={() => setSelectedProg(null)} onRefresh={loadProgressions} />;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">🔍 Observer les feuilles</h2>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">✕</button>
          </div>
        </div>

        <div className="p-6">
          {membres.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Aucune feuille en progression</div>
          ) : (
            <div className="space-y-6">
              {membres.map((membre) => (
                <div key={membre.membre_id}>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    👤 {membre.membre_nom}
                  </h3>

                  {!membre.progressions || membre.progressions.length === 0 ? (
                    <p className="text-sm text-slate-500 ml-6">Aucune feuille</p>
                  ) : (
                    <div className="space-y-3 ml-6">
                      {membre.progressions.map((prog) => (
                        <div
                          key={prog.progression_id}
                          onClick={() => setSelectedProg(prog)}
                          className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-600 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                [{prog.feuille_ordre}] {prog.feuille_titre}
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {prog.sessions?.length || 0} session{(prog.sessions?.length || 0) > 1 ? 's' : ''} • 
                                {prog.score ? ` Score: ${prog.score}/20 • ` : ' '}
                                {Math.round((prog.sessions?.reduce((sum, s) => sum + s.duree, 0) || 0))} min
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                              prog.statut === 'soumise'
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                              {prog.statut === 'soumise' ? '⚠️ Soumise' : '🔄 En cours'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailFeuilleModal({
  progression,
  onClose,
  onRefresh
}: {
  progression: Progression;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [sessions, setSessions] = useState<Session[]>(progression.sessions || []);
  const [score, setScore] = useState(progression.score?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSession, setNewSession] = useState({
    date: new Date().toISOString().split('T')[0],
    heure: '00:00',
    duree: '',
    commentaire: '',
  });

  const tempsTotal = sessions.reduce((acc, s) => acc + s.duree, 0);
  const estSoumise = progression.statut === 'soumise';

  async function handleAddSession() {
    if (!newSession.duree || parseInt(newSession.duree) <= 0) {
      alert('Veuillez entrer une durée valide');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('chef_ajouter_session', {
        p_progression_id: progression.progression_id,
        p_date: newSession.date,
        p_heure: newSession.heure,
        p_duree: parseInt(newSession.duree),
        p_commentaire: newSession.commentaire || null
      });

      if (error) throw error;

      // Recharger juste les sessions
      const { data: newSessionData } = await supabase
        .from('session_travail')
        .select('*')
        .eq('progression_id', progression.progression_id)
        .order('date', { ascending: false });

      if (newSessionData) {
        setSessions(newSessionData);
      }

      setNewSession({
        date: new Date().toISOString().split('T')[0],
        heure: '00:00',
        duree: '',
        commentaire: '',
      });
      setShowAddSession(false);
      alert('✅ Session ajoutée !');
    } catch (error: any) {
      alert('Erreur : ' + error.message);
    }
  }

  async function handleValider() {
    if (!confirm('Valider cette soumission ?')) return;

    try {
      setSaving(true);
      const { error } = await supabase.rpc('chef_valider_soumission', {
        p_progression_id: progression.progression_id,
        p_score: score ? parseInt(score) : null
      });

      if (error) throw error;

      alert('✅ Soumission validée !');
      onRefresh();
      onClose();
    } catch (error: any) {
      alert('Erreur : ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRefuser() {
    const raison = prompt('Raison du refus (optionnel) :');
    if (raison === null) return;

    try {
      setSaving(true);
      const { error } = await supabase.rpc('chef_refuser_soumission', {
        p_progression_id: progression.progression_id,
        p_raison: raison || null
      });

      if (error) throw error;

      alert('Soumission refusée');
      onRefresh();
      onClose();
    } catch (error: any) {
      alert('Erreur : ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-teal-600 p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">{progression.feuille_titre}</h2>
          <p className="text-teal-100 mt-1">Ordre: {progression.feuille_ordre}</p>
        </div>

        <div className="p-6 space-y-6">
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
              <button
                onClick={() => setShowAddSession(!showAddSession)}
                className="px-3 py-1 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg"
              >
                {showAddSession ? 'Annuler' : '+ Ajouter'}
              </button>
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
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Heure</label>
                    <input
                      type="time"
                      value={newSession.heure}
                      onChange={(e) => setNewSession({ ...newSession, heure: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Commentaire (optionnel)</label>
                  <textarea
                    value={newSession.commentaire}
                    onChange={(e) => setNewSession({ ...newSession, commentaire: e.target.value })}
                    placeholder="Notes..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <button
                  onClick={handleAddSession}
                  className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                >
                  <IconCheck />
                  Enregistrer la session
                </button>
              </div>
            )}

            {sessions.length > 0 ? (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {new Date(session.date).toLocaleDateString('fr-FR')} à {session.heure}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {session.duree} min {session.commentaire && `• ${session.commentaire}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                Aucune session
              </div>
            )}
          </div>

          {/* Score */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Score final (sur 20) {estSoumise && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder={progression.score?.toString() || '18'}
              className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-lg font-semibold"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-900 dark:text-slate-100 font-semibold rounded-xl"
            >
              Retour
            </button>
            
            {estSoumise && (
              <>
                <button
                  onClick={handleRefuser}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  ❌ Refuser
                </button>
                <button
                  onClick={handleValider}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  ✅ Valider
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}