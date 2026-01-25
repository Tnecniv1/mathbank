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
  score_calcule: number;
  created_at: string;
  session_numero: number;
};

type Question = {
  tempId: string;
  exercice: string;
  question: string;
  comprehension: number;
  savoir: number;
  redaction: number;
  correction: number;
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
  
  // Formulaire unifié
  const [nextSessionNum, setNextSessionNum] = useState(1);
  const [typeEntrainement, setTypeEntrainement] = useState<'mecanique' | 'chaotique'>('mecanique');
  const [feuilleSelectionnee, setFeuilleSelectionnee] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    heure: new Date().toTimeString().slice(0, 5),
    temps: '',
  });
  
  // Questions ajoutées
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Formulaire d'ajout de question (inline)
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionFormData, setQuestionFormData] = useState({
    exercice: '',
    question: '',
    comprehension: 0,
    savoir: 0,
    redaction: 0,
    correction: 0,
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
          en_cours,
          feuille_entrainement:feuille_entrainement(titre, type)
        `)
        .eq('user_id', user.id)
        .eq('en_cours', true)
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
      
      const { data: nextNum, error: nextNumError } = await supabase.rpc('get_next_session_number', {
        p_user_id: user.id
      });

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
        .order('heure_session', { ascending: false })
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

  function handleQuestionFormChange(field: string, value: any) {
    setQuestionFormData((prev: any) => ({ ...prev, [field]: value }));
  }

  function addQuestion() {
    // Validation
    if (!questionFormData.question.trim()) {
      alert('Veuillez renseigner la question');
      return;
    }

    if (typeEntrainement === 'chaotique' && !questionFormData.exercice.trim()) {
      alert('Veuillez renseigner l\'exercice');
      return;
    }

    if (editingQuestionId) {
      // Édition
      setQuestions(prev =>
        prev.map(q => q.tempId === editingQuestionId
          ? { ...questionFormData, tempId: editingQuestionId }
          : q
        )
      );
    } else {
      // Ajout
      const newQuestion = {
        ...questionFormData,
        tempId: Date.now().toString(),
      };
      
      setQuestions(prev => [...prev, newQuestion]);
    }

    resetQuestionForm();
  }

  function resetQuestionForm() {
    setQuestionFormData({
      exercice: '',
      question: '',
      comprehension: 0,
      savoir: 0,
      redaction: 0,
      correction: 0,
    });
    setEditingQuestionId(null);
    setShowAddQuestion(false);
  }

  function editQuestion(tempId: string) {
    const question = questions.find(q => q.tempId === tempId);
    
    if (question) {
      setQuestionFormData({
        exercice: question.exercice,
        question: question.question,
        comprehension: question.comprehension,
        savoir: question.savoir,
        redaction: question.redaction,
        correction: question.correction,
      });
      setEditingQuestionId(tempId);
      setShowAddQuestion(true);
    }
  }

  function deleteQuestion(tempId: string) {
    setQuestions(prev => prev.filter(q => q.tempId !== tempId));
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

    
    
    if (questions.length === 0) {
      alert('Veuillez ajouter au moins une question');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Créer la session
      const sessionData: any = {
        user_id: user.id,
        numero_session: nextSessionNum,
        date_session: formData.date,
        heure_session: formData.heure,
        objectifs: null,
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


      // Créer les scores locaux
      const scoresLocaux = questions.map((q: any) => ({
        session_id: newSession.id,
        exercice: q.exercice || '',
        question: q.question,
        comprehension: q.comprehension,
        savoir: q.savoir,
        redaction: q.redaction,
        correction: q.correction,
      }));

      const { error: scoresError } = await supabase
        .from('score_local')
        .insert(scoresLocaux);

      if (scoresError) throw scoresError;

      // Incrémenter le numéro localement (évite la race condition)
      setNextSessionNum(prev => prev + 1);

      // Reset et notification
      resetForm();
      setSaving(false);
      alert('✅ Session enregistrée avec succès !');

      // Recharger en arrière-plan (sans bloquer)
      loadData();

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
    });
    setFeuilleSelectionnee('');
    setQuestions([]);
    resetQuestionForm();
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

  const questionsActuelles = questions;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-teal-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-black text-gray-900 text-center mb-8">
          ⏱️ Gestion des Sessions
        </h1>

        {/* Formulaire Unifié */}
        {feuilles.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-300 text-center text-gray-500">
            Aucune feuille en cours. Rendez-vous dans l'onglet Progression pour en démarrer une.
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              📝 Nouvelle Session #{nextSessionNum}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1 : Informations de la session */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <h3 className="font-bold text-gray-900">📋 Informations de la session</h3>
                
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

                {/* Nature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    🎲 Nature
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
                          setQuestionsMecaniques([]);
                          setQuestionsChaotiques([]);
                          resetQuestionForm();
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="font-medium text-gray-900">🔧 Mécanique</span>
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
                          setQuestionsMecaniques([]);
                          setQuestionsChaotiques([]);
                          resetQuestionForm();
                        }}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="font-medium text-gray-900">🎲 Chaotique</span>
                    </label>
                  </div>
                </div>

                {/* Feuille */}
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
              </div>

              {/* Section 2 : Questions */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">
                    ❓ Questions ({questionsActuelles.length})
                  </h3>
                  {!showAddQuestion && (
                    <button
                      type="button"
                      onClick={() => setShowAddQuestion(true)}
                      className={`px-4 py-2 font-medium rounded-lg transition ${
                        typeEntrainement === 'mecanique'
                          ? 'bg-blue-500 hover:bg-blue-600 text-white'
                          : 'bg-purple-500 hover:bg-purple-600 text-white'
                      }`}
                    >
                      ➕ Insérer une question
                    </button>
                  )}
                </div>

                {/* Formulaire d'ajout de question */}
                {showAddQuestion && (
                  <div className={`border-2 rounded-xl p-4 ${
                    typeEntrainement === 'mecanique'
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-purple-50 border-purple-300'
                  }`}>
                    <h4 className="font-bold text-gray-900 mb-4">
                      {editingQuestionId ? '✏️ Modifier la question' : '➕ Nouvelle question'}
                    </h4>
                    
                    <div className="space-y-4">
                      <div className={`grid ${typeEntrainement === 'chaotique' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                        {typeEntrainement === 'chaotique' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Ref Exercice
                            </label>
                            <input
                              type="text"
                              value={questionFormData.exercice}
                              onChange={(e) => handleQuestionFormChange('exercice', e.target.value)}
                              placeholder="Ex: Exercice 3"
                              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ref Question
                          </label>
                          <input
                            type="text"
                            value={questionFormData.question}
                            onChange={(e) => handleQuestionFormChange('question', e.target.value)}
                            placeholder="Ex: Question 2.a"
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          🧠 Compréhension
                        </label>
                        <select
                          value={questionFormData.comprehension}
                          onChange={(e) => handleQuestionFormChange('comprehension', parseInt(e.target.value))}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                        >
                          <option value={0}>0 - Pas compris</option>
                          <option value={25}>25 - Compréhension minimale</option>
                          <option value={50}>50 - Compréhension partielle</option>
                          <option value={75}>75 - Bonne compréhension</option>
                          <option value={100}>100 - Compréhension totale</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          🛠️ Savoir-faire
                        </label>
                        <select
                          value={questionFormData.savoir}
                          onChange={(e) => handleQuestionFormChange('savoir', parseInt(e.target.value))}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                        >
                          <option value={0}>0 - Non maîtrisé</option>
                          <option value={50}>50 - Partiellement maîtrisé</option>
                          <option value={100}>100 - Maîtrisé</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ✍️ Rédaction
                        </label>
                        <select
                          value={questionFormData.redaction}
                          onChange={(e) => handleQuestionFormChange('redaction', parseInt(e.target.value))}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                        >
                          <option value={0}>0 - Rédaction insuffisante</option>
                          <option value={50}>50 - Rédaction partielle</option>
                          <option value={100}>100 - Rédaction satisfaisante</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                        <input
                          type="checkbox"
                          checked={questionFormData.correction === 1}
                          onChange={(e) => handleQuestionFormChange('correction', e.target.checked ? 1 : 0)}
                          className="w-5 h-5 text-green-600 rounded"
                        />
                        <label className="text-sm font-medium text-gray-700">
                          ✅ Correction effectuée (+30% de bonus)
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition"
                      >
                        {editingQuestionId ? '✓ Mettre à jour' : '➕ Ajouter'}
                      </button>
                      <button
                        type="button"
                        onClick={resetQuestionForm}
                        className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium rounded-lg transition"
                      >
                        ✕ Annuler
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste des questions ajoutées */}
                {questions.length > 0 && (
                  <div className="space-y-2">
                    {questions.map((q, index) => (
                      <div key={q.tempId} className={`bg-white border-2 rounded-lg p-3 flex items-center justify-between ${
                        typeEntrainement === 'mecanique' ? 'border-blue-200' : 'border-purple-200'
                      }`}>
                        <div>
                          <span className={`font-bold ${typeEntrainement === 'mecanique' ? 'text-blue-600' : 'text-purple-600'}`}>
                            Question {index + 1}:
                          </span>
                          <span className="ml-2 text-gray-900">
                            {typeEntrainement === 'chaotique' && q.exercice && `${q.exercice} - `}
                            {q.question}
                          </span>
                          <div className="text-xs text-gray-600 mt-1">
                            C: {q.comprehension} | S: {q.savoir} | R: {q.redaction} | Corr: {q.correction ? '✓' : '✗'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editQuestion(q.tempId)}
                            className={`px-3 py-1 text-xs font-medium rounded transition ${
                              typeEntrainement === 'mecanique'
                                ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                            }`}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteQuestion(q.tempId)}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bouton Submit */}
              <button
                type="submit"
                disabled={saving || questionsActuelles.length === 0}
                className="w-full px-6 py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    💾 Enregistrer la session complète
                  </>
                )}
              </button>
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
                                {score.exercice && `${score.exercice} - `}{score.question}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {new Date(score.created_at).toLocaleString('fr-FR')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-purple-600">
                              {Math.round(score.score_calcule * 100)}%
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