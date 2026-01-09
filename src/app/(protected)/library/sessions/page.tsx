'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Types
type FeuilleProgression = {
  feuille_id: string;
  titre: string;
  type: 'mecanique' | 'chaotique';
  statut: string;
};

type Session = {
  id: string;
  numero_session: number;
  date_session: string;
  heure_session: string;
  feuille_mecanique_titre: string | null;
  feuille_mecanique_id: string | null;
  temps_mecanique: number | null;
  score_mecanique: number | null;
  feuille_chaotique_titre: string | null;
  feuille_chaotique_id: string | null;
  temps_chaotique: number | null;
  score_chaotique: number | null;
  objectifs: string | null;
  created_at: string;
};

type ScoreLocalHistorique = {
  id: string;
  session_id: string;
  exercice: string;
  question: string;
  comprehension: number;
  savoir: number;
  redaction: number;
  correction: number;
  questions_posees: string[];
  score_calcule: number;
  created_at: string;
  session_numero: number;
};

type ScoreLocalFormData = {
  exercice: string;
  question: string;
  comprehension: number;
  savoir: number;
  redaction: number;
  correction: number;
  questions_posees: string[];
};

// Icônes
const IconCheck = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconClock = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconDownload = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const Loader = () => (
  <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"/>
  </svg>
);

export default function SessionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Feuilles en progression
  const [feuilles, setFeuilles] = useState<FeuilleProgression[]>([]);
  const [feuilleMeca, setFeuilleMeca] = useState<FeuilleProgression | null>(null);
  const [feuilleChaos, setFeuilleChaos] = useState<FeuilleProgression | null>(null);
  
  // Formulaire global
  const [nextSessionNum, setNextSessionNum] = useState(1);
  const [typeEntrainement, setTypeEntrainement] = useState<'mecanique' | 'chaotique'>('mecanique');
  const [feuilleSelectionnee, setFeuilleSelectionnee] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    heure: new Date().toTimeString().slice(0, 5),
    temps: '',
    objectifs: '',
  });
  
  // Formulaire granulaire (score local) - visible uniquement pour chaotique
  const [showScoreLocalForm, setShowScoreLocalForm] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [scoreLocalData, setScoreLocalData] = useState<ScoreLocalFormData>({
    exercice: '',
    question: '',
    comprehension: 0,
    savoir: 0,
    redaction: 0,
    correction: 0,
    questions_posees: [''],
  });
  
  // Historique
  const [sessions, setSessions] = useState<Session[]>([]);
  const [scoresLocauxHistorique, setScoresLocauxHistorique] = useState<ScoreLocalHistorique[]>([]);
  
  // Modal Observer
  const [observerModalSessionId, setObserverModalSessionId] = useState<string | null>(null);
  const [observerModalScores, setObserverModalScores] = useState<ScoreLocalHistorique[]>([]);
  
  // Édition
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const { data: feuillesData, error: feuillesError } = await supabase
        .from('progression_feuille')
        .select(`
          feuille_id,
          statut,
          feuille_entrainement:feuille_entrainement(titre, type)
        `)
        .eq('user_id', user.id)
        .eq('statut', 'en_cours')
        .in('feuille_entrainement.type', ['mecanique', 'chaotique']);
      
      if (feuillesError) throw feuillesError;

      if (feuillesData) {
        const feuillesFormatted = feuillesData.map((item: any) => ({
          feuille_id: item.feuille_id,
          titre: item.feuille_entrainement?.titre || 'Titre inconnu',
          type: item.feuille_entrainement?.type || 'mecanique',
          statut: item.statut
        }));
        
        setFeuilles(feuillesFormatted);
        const meca = feuillesFormatted.find((f: FeuilleProgression) => f.type === 'mecanique');
        const chaos = feuillesFormatted.find((f: FeuilleProgression) => f.type === 'chaotique');
        setFeuilleMeca(meca || null);
        setFeuilleChaos(chaos || null);
      }

      const { data: nextNum, error: nextNumError } = await supabase.rpc('get_next_session_number');
      
      if (nextNumError) throw nextNumError;
      setNextSessionNum(nextNum || 1);

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('session_entrainement')
        .select(`
          id,
          numero_session,
          date_session,
          heure_session,
          feuille_mecanique_id,
          temps_mecanique,
          score_mecanique,
          feuille_chaotique_id,
          temps_chaotique,
          score_chaotique,
          objectifs,
          created_at,
          feuille_mecanique:feuille_mecanique_id(titre),
          feuille_chaotique:feuille_chaotique_id(titre)
        `)
        .eq('user_id', user.id)
        .order('date_session', { ascending: false })
        .order('numero_session', { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;
      
      const sessionsFormatted = (sessionsData || []).map((s: any) => ({
        id: s.id,
        numero_session: s.numero_session,
        date_session: s.date_session,
        heure_session: s.heure_session,
        feuille_mecanique_titre: s.feuille_mecanique?.titre || null,
        feuille_mecanique_id: s.feuille_mecanique_id,
        temps_mecanique: s.temps_mecanique,
        score_mecanique: s.score_mecanique,
        feuille_chaotique_titre: s.feuille_chaotique?.titre || null,
        feuille_chaotique_id: s.feuille_chaotique_id,
        temps_chaotique: s.temps_chaotique,
        score_chaotique: s.score_chaotique,
        objectifs: s.objectifs,
        created_at: s.created_at
      }));
      
      setSessions(sessionsFormatted);

      // Charger l'historique des scores locaux
      const { data: scoresLocauxData, error: scoresError } = await supabase
        .from('score_local')
        .select(`
          id,
          session_id,
          exercice,
          question,
          comprehension,
          savoir,
          redaction,
          correction,
          questions_posees,
          score_calcule,
          created_at,
          session_entrainement!inner(
            numero_session,
            user_id
          )
        `)
        .eq('session_entrainement.user_id', user.id)
        .order('created_at', { ascending: false });

      if (scoresError) {
        console.error('❌ Erreur scores locaux:', scoresError);
      } else {
        const scoresFormatted = (scoresLocauxData || []).map((s: any) => ({
          id: s.id,
          session_id: s.session_id,
          exercice: s.exercice,
          question: s.question,
          comprehension: s.comprehension,
          savoir: s.savoir,
          redaction: s.redaction,
          correction: s.correction,
          questions_posees: s.questions_posees || [],
          score_calcule: parseFloat(s.score_calcule) || 0,
          created_at: s.created_at,
          session_numero: s.session_entrainement?.numero_session || 0
        }));
        setScoresLocauxHistorique(scoresFormatted);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Erreur chargement:', err);
      alert('Erreur: ' + err.message);
      setLoading(false);
    }
  }

  function handleInputChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function handleScoreLocalChange(field: keyof ScoreLocalFormData, value: any) {
    setScoreLocalData(prev => ({ ...prev, [field]: value }));
  }

  function addQuestion() {
    setScoreLocalData(prev => ({
      ...prev,
      questions_posees: [...prev.questions_posees, '']
    }));
  }

  function updateQuestion(index: number, value: string) {
    setScoreLocalData(prev => ({
      ...prev,
      questions_posees: prev.questions_posees.map((q, i) => i === index ? value : q)
    }));
  }

  function removeQuestion(index: number) {
    setScoreLocalData(prev => ({
      ...prev,
      questions_posees: prev.questions_posees.filter((_, i) => i !== index)
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!feuilleSelectionnee) {
      alert('Veuillez sélectionner une feuille');
      return;
    }

    if (!formData.temps) {
      alert('Veuillez renseigner le temps');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const sessionData: any = {
        user_id: user.id,
        numero_session: nextSessionNum,
        date_session: formData.date,
        heure_session: formData.heure,
        objectifs: formData.objectifs || null,
      };

      if (typeEntrainement === 'mecanique') {
        sessionData.feuille_mecanique_id = feuilleSelectionnee;
        sessionData.temps_mecanique = parseInt(formData.temps);
      } else {
        sessionData.feuille_chaotique_id = feuilleSelectionnee;
        sessionData.temps_chaotique = parseInt(formData.temps);
      }

      const { data: newSession, error: sessionError } = await supabase
        .from('session_entrainement')
        .insert([sessionData])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Si c'est une feuille chaotique, afficher le formulaire granulaire
      if (typeEntrainement === 'chaotique') {
        setLastSessionId(newSession.id);
        setShowScoreLocalForm(true);
        setSaving(false);
      } else {
        // Si mécanique, recharger directement
        await loadData();
        resetForm();
        setSaving(false);
        alert('✅ Session enregistrée avec succès !');
      }

    } catch (err: any) {
      console.error('Erreur:', err);
      alert('Erreur: ' + err.message);
      setSaving(false);
    }
  }

  async function handleScoreLocalSubmit(e: React.FormEvent, addAnother: boolean = false) {
    e.preventDefault();

    if (!lastSessionId) {
      alert('Erreur: pas de session associée');
      return;
    }

    if (!scoreLocalData.exercice || !scoreLocalData.question) {
      alert('Veuillez renseigner l\'exercice et la question');
      return;
    }

    setSaving(true);

    try {
      // Filtrer les questions vides
      const questionsFiltered = scoreLocalData.questions_posees.filter(q => q.trim() !== '');

      const scoreLocalInsert = {
        session_id: lastSessionId,
        exercice: scoreLocalData.exercice,
        question: scoreLocalData.question,
        comprehension: scoreLocalData.comprehension,
        savoir: scoreLocalData.savoir,
        redaction: scoreLocalData.redaction,
        correction: scoreLocalData.correction,
        questions_posees: questionsFiltered,
      };

      const { error: scoreError } = await supabase
        .from('score_local')
        .insert([scoreLocalInsert]);

      if (scoreError) throw scoreError;

      setSaving(false);

      if (addAnother) {
        // Incrémenter le compteur
        setQuestionsCount(prev => prev + 1);
        // Réinitialiser uniquement les données du formulaire granulaire
        setScoreLocalData({
          exercice: '',
          question: '',
          comprehension: 0,
          savoir: 0,
          redaction: 0,
          correction: 0,
          questions_posees: [''],
        });
        alert('✅ Question enregistrée ! Vous pouvez en ajouter une autre.');
      } else {
        // Terminer : recharger et reset complet
        await loadData();
        resetForm();
        setShowScoreLocalForm(false);
        setLastSessionId(null);
        setQuestionsCount(0);
        alert('✅ Session et scores locaux enregistrés avec succès !');
      }

    } catch (err: any) {
      console.error('Erreur:', err);
      alert('Erreur: ' + err.message);
      setSaving(false);
    }
  }

  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toTimeString().slice(0, 5),
      temps: '',
      objectifs: '',
    });
    setFeuilleSelectionnee('');
    setQuestionsCount(0);
    setScoreLocalData({
      exercice: '',
      question: '',
      comprehension: 0,
      savoir: 0,
      redaction: 0,
      correction: 0,
      questions_posees: [''],
    });
  }

  function openObserverModal(sessionId: string) {
    setObserverModalSessionId(sessionId);
    const scores = scoresLocauxHistorique.filter(s => s.session_id === sessionId);
    setObserverModalScores(scores);
  }

  function closeObserverModal() {
    setObserverModalSessionId(null);
    setObserverModalScores([]);
  }

  function startEditingSession(session: Session) {
    const isMecanique = session.feuille_mecanique_titre !== null;
    setEditingSessionId(session.id);
    setEditFormData({
      date: session.date_session,
      heure: session.heure_session,
      temps: isMecanique ? session.temps_mecanique : session.temps_chaotique,
      objectifs: session.objectifs || ''
    });
  }

  function cancelEditingSession() {
    setEditingSessionId(null);
    setEditFormData(null);
  }

  async function saveEditedSession(sessionId: string) {
    if (!editFormData) return;

    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const isMecanique = session.feuille_mecanique_titre !== null;
      const updateData: any = {
        date_session: editFormData.date,
        heure_session: editFormData.heure,
        objectifs: editFormData.objectifs || null
      };

      if (isMecanique) {
        updateData.temps_mecanique = parseInt(editFormData.temps);
      } else {
        updateData.temps_chaotique = parseInt(editFormData.temps);
      }

      const { error } = await supabase
        .from('session_entrainement')
        .update(updateData)
        .eq('id', sessionId);

      if (error) throw error;

      await loadData();
      cancelEditingSession();
      alert('✅ Session modifiée avec succès !');
    } catch (err: any) {
      console.error('Erreur:', err);
      alert('Erreur: ' + err.message);
    }
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette session ? Cette action est irréversible.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('session_entrainement')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      await loadData();
      alert('✅ Session supprimée avec succès !');
    } catch (err: any) {
      console.error('Erreur:', err);
      alert('Erreur: ' + err.message);
    }
  }

  function startEditingScore(score: ScoreLocalHistorique) {
    setEditingScoreId(score.id);
    setEditFormData({
      exercice: score.exercice,
      question: score.question,
      comprehension: score.comprehension,
      savoir: score.savoir,
      redaction: score.redaction,
      correction: score.correction,
      questions_posees: score.questions_posees
    });
  }

  function cancelEditingScore() {
    setEditingScoreId(null);
    setEditFormData(null);
  }

  async function saveEditedScore(scoreId: string) {
    if (!editFormData) return;

    try {
      const { error } = await supabase
        .from('score_local')
        .update({
          exercice: editFormData.exercice,
          question: editFormData.question,
          comprehension: editFormData.comprehension,
          savoir: editFormData.savoir,
          redaction: editFormData.redaction,
          correction: editFormData.correction,
          questions_posees: editFormData.questions_posees.filter((q: string) => q.trim() !== '')
        })
        .eq('id', scoreId);

      if (error) throw error;

      await loadData();
      cancelEditingScore();
      alert('✅ Score local modifié avec succès !');
    } catch (err: any) {
      console.error('Erreur:', err);
      alert('Erreur: ' + err.message);
    }
  }

  async function deleteScoreLocal(scoreId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce score local ? Cette action est irréversible.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('score_local')
        .delete()
        .eq('id', scoreId);

      if (error) throw error;

      await loadData();
      alert('✅ Score local supprimé avec succès !');
    } catch (err: any) {
      console.error('Erreur:', err);
      alert('Erreur: ' + err.message);
    }
  }

  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toTimeString().slice(0, 5),
      temps: '',
      objectifs: '',
    });
    setFeuilleSelectionnee('');
    setQuestionsCount(0);
    setScoreLocalData({
      exercice: '',
      question: '',
      comprehension: 0,
      savoir: 0,
      redaction: 0,
      correction: 0,
      questions_posees: [''],
    });
  }

  function exportToCSV() {
    const headers = ['N°', 'Date', 'Heure', 'Type', 'Feuille', 'Temps (min)', 'Objectifs'];
    const rows = sessions.map(s => {
      const isMeca = s.feuille_mecanique_titre !== null;
      return [
        s.numero_session,
        new Date(s.date_session).toLocaleDateString('fr-FR'),
        s.heure_session,
        isMeca ? 'Mécanique' : 'Chaotique',
        isMeca ? s.feuille_mecanique_titre : s.feuille_chaotique_titre,
        isMeca ? s.temps_mecanique : s.temps_chaotique,
        s.objectifs || '-'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sessions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-teal-50">
        <Loader />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-teal-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-black text-gray-900 text-center mb-8">
          ⏱️ Gestion des Sessions
        </h1>

        {/* Formulaire Global */}
        {!showScoreLocalForm && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              📝 Nouvelle Session #{nextSessionNum}
            </h2>
            
            {feuilles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune feuille en cours. Rendez-vous dans l'onglet Progression pour en démarrer une.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Date & Heure */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📅 Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      required
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🕐 Heure
                    </label>
                    <input
                      type="time"
                      value={formData.heure}
                      onChange={(e) => handleInputChange('heure', e.target.value)}
                      required
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                </div>

                {/* Type d'entraînement */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Type d'entraînement
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${
                      typeEntrainement === 'mecanique' 
                        ? 'bg-blue-50/30 border-blue-300' 
                        : 'bg-gray-50/30 border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="type"
                        checked={typeEntrainement === 'mecanique'}
                        onChange={() => {
                          setTypeEntrainement('mecanique');
                          setFeuilleSelectionnee('');
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="font-medium text-gray-900">🔧 Feuille Mécanique</span>
                    </label>
                    <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${
                      typeEntrainement === 'chaotique' 
                        ? 'bg-purple-50/30 border-purple-300' 
                        : 'bg-gray-50/30 border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="type"
                        checked={typeEntrainement === 'chaotique'}
                        onChange={() => {
                          setTypeEntrainement('chaotique');
                          setFeuilleSelectionnee('');
                        }}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="font-medium text-gray-900">🎲 Feuille Chaotique</span>
                    </label>
                  </div>
                </div>

                {/* Sélection de feuille */}
                <div className={`p-4 border-2 rounded-xl ${
                  typeEntrainement === 'mecanique' 
                    ? 'bg-blue-50/20 border-blue-200' 
                    : 'bg-purple-50/20 border-purple-200'
                }`}>
                  <label className={`block text-sm font-medium mb-2 ${
                    typeEntrainement === 'mecanique' ? 'text-blue-700' : 'text-purple-700'
                  }`}>
                    {typeEntrainement === 'mecanique' ? '🔧' : '🎲'} Feuille sélectionnée
                  </label>
                  <select
                    value={feuilleSelectionnee}
                    onChange={(e) => setFeuilleSelectionnee(e.target.value)}
                    required
                    className={`w-full px-4 py-2 border-2 rounded-lg bg-white text-gray-900 ${
                      typeEntrainement === 'mecanique' 
                        ? 'border-blue-300' 
                        : 'border-purple-300'
                    }`}
                  >
                    <option value="">-- Sélectionner une feuille --</option>
                    {(typeEntrainement === 'mecanique' && feuilleMeca) && (
                      <option value={feuilleMeca.feuille_id}>
                        {feuilleMeca.titre}
                      </option>
                    )}
                    {(typeEntrainement === 'chaotique' && feuilleChaos) && (
                      <option value={feuilleChaos.feuille_id}>
                        {feuilleChaos.titre}
                      </option>
                    )}
                  </select>
                </div>

                {/* Temps */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ⏱️ Temps (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.temps}
                    onChange={(e) => handleInputChange('temps', e.target.value)}
                    placeholder="Ex: 45"
                    required
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>

                {/* Objectifs */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎯 Objectifs réalisés
                  </label>
                  <input
                    type="text"
                    value={formData.objectifs}
                    onChange={(e) => handleInputChange('objectifs', e.target.value)}
                    placeholder={
                      typeEntrainement === 'mecanique' 
                        ? "Ex: 3 (3 exercices mécaniques)" 
                        : "Ex: 1 (1 exercice chaotique)"
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {typeEntrainement === 'mecanique' 
                      ? "Nombre d'exercices mécaniques réalisés"
                      : "Nombre d'exercices chaotiques réalisés"
                    }
                  </p>
                </div>

                {/* Bouton Submit */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full px-6 py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      💾 Enregistrer la session
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Formulaire Score Local (visible après création session chaotique) */}
        {showScoreLocalForm && (
          <div className="bg-white rounded-2xl p-6 border-2 border-purple-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-purple-700">
                🎯 Score Local - Détails de la question
              </h2>
              {questionsCount > 0 && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-bold">
                  {questionsCount} question{questionsCount > 1 ? 's' : ''} enregistrée{questionsCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Session #{nextSessionNum} créée. Renseignez maintenant les détails de la question travaillée.
            </p>

            <form onSubmit={handleScoreLocalSubmit} className="space-y-6">
              {/* Exercice et Question */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📝 Exercice
                  </label>
                  <input
                    type="text"
                    value={scoreLocalData.exercice}
                    onChange={(e) => handleScoreLocalChange('exercice', e.target.value)}
                    placeholder="Ex: Exercice 3"
                    required
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ❓ Question
                  </label>
                  <input
                    type="text"
                    value={scoreLocalData.question}
                    onChange={(e) => handleScoreLocalChange('question', e.target.value)}
                    placeholder="Ex: Question 2.a"
                    required
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>
              </div>

              {/* Compréhension */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🧠 Compréhension (0-100)
                </label>
                <select
                  value={scoreLocalData.comprehension}
                  onChange={(e) => handleScoreLocalChange('comprehension', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value={0}>0 - Pas compris</option>
                  <option value={25}>25 - Compréhension minimale</option>
                  <option value={50}>50 - Compréhension partielle</option>
                  <option value={75}>75 - Bonne compréhension</option>
                  <option value={100}>100 - Compréhension totale</option>
                </select>
              </div>

              {/* Savoir-faire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🛠️ Savoir-faire (0 ou 100)
                </label>
                <select
                  value={scoreLocalData.savoir}
                  onChange={(e) => handleScoreLocalChange('savoir', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value={0}>0 - Non maîtrisé</option>
                  <option value={100}>100 - Maîtrisé</option>
                </select>
              </div>

              {/* Rédaction */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ✍️ Rédaction (0 ou 100)
                </label>
                <select
                  value={scoreLocalData.redaction}
                  onChange={(e) => handleScoreLocalChange('redaction', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value={0}>0 - Rédaction insuffisante</option>
                  <option value={100}>100 - Rédaction satisfaisante</option>
                </select>
              </div>

              {/* Correction */}
              <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={scoreLocalData.correction === 1}
                  onChange={(e) => handleScoreLocalChange('correction', e.target.checked ? 1 : 0)}
                  className="w-5 h-5 text-green-600 rounded"
                />
                <label className="text-sm font-medium text-gray-700">
                  ✅ Correction effectuée (+30% de bonus)
                </label>
              </div>

              {/* Questions posées */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    💬 Questions posées par l'étudiant
                  </label>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    + Ajouter une question
                  </button>
                </div>
                <div className="space-y-2">
                  {scoreLocalData.questions_posees.map((q, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => updateQuestion(idx, e.target.value)}
                        placeholder={`Question ${idx + 1}`}
                        className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                      />
                      {scoreLocalData.questions_posees.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(idx)}
                          className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={(e) => handleScoreLocalSubmit(e, true)}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      ➕ Enregistrer et ajouter une autre question
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleScoreLocalSubmit(e, false)}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      ✅ Enregistrer et terminer
                    </>
                  )}
                </button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Êtes-vous sûr de vouloir annuler ? Les données de la session globale sont déjà enregistrées.')) {
                      setShowScoreLocalForm(false);
                      setLastSessionId(null);
                      loadData();
                      resetForm();
                    }
                  }}
                  className="px-6 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Historique */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              📊 Historique des sessions ({sessions.length})
            </h2>
            {sessions.length > 0 && (
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-gray-900 font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <IconDownload />
                Exporter CSV
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucune session enregistrée pour le moment
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="px-3 py-3 text-left font-bold text-gray-700">N°</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-700">Date</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-700">Heure</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-700">Type & Feuille</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-700">Temps</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-700">Obj.</th>
                    <th className="px-3 py-3 text-center font-bold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const isMecanique = session.feuille_mecanique_titre !== null;
                    const titre = isMecanique ? session.feuille_mecanique_titre : session.feuille_chaotique_titre;
                    const temps = isMecanique ? session.temps_mecanique : session.temps_chaotique;
                    const isEditing = editingSessionId === session.id;
                    
                    return (
                      <tr key={session.id} className="border-b border-gray-300 hover:bg-gray-50/50">
                        <td className="px-3 py-3 font-bold text-teal-600">
                          #{session.numero_session}
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editFormData.date}
                              onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <span className="text-gray-900">
                              {new Date(session.date_session).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              type="time"
                              value={editFormData.heure}
                              onChange={(e) => setEditFormData({...editFormData, heure: e.target.value})}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <span className="text-gray-600">{session.heure_session}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {titre ? (
                            <div className="text-gray-900">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                  isMecanique 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {isMecanique ? '🔧 Mécanique' : '🎲 Chaotique'}
                                </span>
                              </div>
                              <div className="font-medium">{titre}</div>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              value={editFormData.temps}
                              onChange={(e) => setEditFormData({...editFormData, temps: e.target.value})}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            temps ? (
                              <span className="text-gray-900 font-medium">{temps} min</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editFormData.objectifs}
                              onChange={(e) => setEditFormData({...editFormData, objectifs: e.target.value})}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <span className="text-gray-900 font-medium">{session.objectifs || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => saveEditedSession(session.id)}
                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded transition"
                              >
                                ✓ Sauvegarder
                              </button>
                              <button
                                onClick={cancelEditingSession}
                                className="px-3 py-1.5 bg-gray-300 hover:bg-gray-400 text-gray-900 text-xs font-medium rounded transition"
                              >
                                ✕ Annuler
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openObserverModal(session.id)}
                                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium rounded transition"
                                title="Observer les scores locaux"
                              >
                                👁️ Observer
                              </button>
                              <button
                                onClick={() => startEditingSession(session)}
                                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded transition"
                                title="Modifier"
                              >
                                ✏️ Modifier
                              </button>
                              <button
                                onClick={() => deleteSession(session.id)}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition"
                                title="Supprimer"
                              >
                                🗑️ Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Observer - Scores locaux */}
        {observerModalSessionId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeObserverModal}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  👁️ Scores locaux - Session #{sessions.find(s => s.id === observerModalSessionId)?.numero_session}
                </h3>
                <button
                  onClick={closeObserverModal}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                {observerModalScores.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">📭</div>
                    <p>Aucun score local pour cette session</p>
                    <p className="text-sm mt-2">Les scores locaux sont enregistrés uniquement pour les sessions chaotiques</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {observerModalScores.map((score, index) => (
                      <div key={score.id} className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-purple-500 text-white text-sm font-bold rounded">
                                Question {index + 1}
                              </span>
                              <span className="text-lg font-bold text-purple-700">
                                {score.exercice} - {score.question}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {new Date(score.created_at).toLocaleString('fr-FR')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-purple-600">
                              {Math.round(score.score_calcule)}%
                            </div>
                            <div className="text-xs text-gray-500">Score final</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div className="bg-white rounded-lg p-3 border border-purple-200">
                            <div className="text-xs text-gray-600 mb-1">Compréhension</div>
                            <div className="text-lg font-bold text-purple-700">{score.comprehension}</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-purple-200">
                            <div className="text-xs text-gray-600 mb-1">Savoir-faire</div>
                            <div className="text-lg font-bold text-purple-700">{score.savoir}</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-purple-200">
                            <div className="text-xs text-gray-600 mb-1">Rédaction</div>
                            <div className="text-lg font-bold text-purple-700">{score.redaction}</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-purple-200">
                            <div className="text-xs text-gray-600 mb-1">Correction</div>
                            <div className="text-lg font-bold text-purple-700">
                              {score.correction === 1 ? '✓ Oui' : '✗ Non'}
                            </div>
                          </div>
                        </div>

                        {score.questions_posees && score.questions_posees.length > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-purple-200">
                            <div className="text-xs font-semibold text-gray-700 mb-2">💬 Questions posées :</div>
                            <ul className="space-y-1">
                              {score.questions_posees.map((q: string, idx: number) => (
                                <li key={idx} className="text-sm text-gray-700 pl-4">
                                  • {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 mt-3">
                          <button
                            onClick={() => {
                              closeObserverModal();
                              startEditingScore(score);
                            }}
                            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded transition"
                          >
                            ✏️ Modifier
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Supprimer ce score local ?')) {
                                deleteScoreLocal(score.id);
                                closeObserverModal();
                              }
                            }}
                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition"
                          >
                            🗑️ Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}