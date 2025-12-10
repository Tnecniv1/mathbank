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
  
  // Formulaire
  const [nextSessionNum, setNextSessionNum] = useState(1);
  const [typeEntrainement, setTypeEntrainement] = useState<'mecanique' | 'chaotique'>('mecanique');
  const [feuilleSelectionnee, setFeuilleSelectionnee] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    heure: new Date().toTimeString().slice(0, 5),
    temps: '',
    objectifs: '',
  });
  
  // Historique
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      console.log('🔍 Début chargement...');

      // TEST : Charger directement sans RPC
      console.log('📋 Test requête directe...');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('👤 User:', user?.id);

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
        .eq('statut', 'en_cours') // ← Seulement les feuilles en_cours (pas en_attente)
        .in('feuille_entrainement.type', ['mecanique', 'chaotique']);
      
      console.log('📋 Résultat feuilles (direct):', { feuillesData, feuillesError });
      
      if (feuillesError) {
        console.error('❌ Erreur feuilles:', feuillesError);
        throw feuillesError;
      }

      if (feuillesData) {
        // Adapter le format des données
        const feuillesFormatted = feuillesData.map((item: any) => ({
          feuille_id: item.feuille_id,
          titre: item.feuille_entrainement?.titre || 'Titre inconnu',
          type: item.feuille_entrainement?.type || 'mecanique',
          statut: item.statut
        }));
        
        console.log('📋 Feuilles formatées:', feuillesFormatted);
        
        setFeuilles(feuillesFormatted);
        const meca = feuillesFormatted.find((f: FeuilleProgression) => f.type === 'mecanique');
        const chaos = feuillesFormatted.find((f: FeuilleProgression) => f.type === 'chaotique');
        console.log('🔧 Feuille méca:', meca);
        console.log('🎲 Feuille chaos:', chaos);
        setFeuilleMeca(meca || null);
        setFeuilleChaos(chaos || null);
      }

      // Charger le prochain numéro de session
      console.log('🔢 Appel get_next_session_number...');
      const { data: nextNum, error: nextNumError } = await supabase.rpc('get_next_session_number');
      
      console.log('🔢 Résultat nextNum:', { nextNum, nextNumError });
      
      if (nextNumError) {
        console.error('❌ Erreur nextNum:', nextNumError);
        throw nextNumError;
      }
      setNextSessionNum(nextNum || 1);

      // Charger l'historique des sessions
      console.log('📊 Chargement sessions (direct)...');
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

      console.log('📊 Résultat sessions (direct):', { sessionsData, sessionsError });

      if (sessionsError) {
        console.error('❌ Erreur sessions:', sessionsError);
        throw sessionsError;
      }
      
      // Formater les sessions
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

      console.log('✅ Chargement terminé avec succès');
      setLoading(false);
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
      alert('Erreur lors du chargement : ' + JSON.stringify(error));
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!feuilleSelectionnee) {
      alert('Veuillez sélectionner une feuille');
      return;
    }

    if (!formData.temps) {
      alert('Veuillez saisir le temps');
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase.rpc('create_session_entrainement', {
        p_date_session: formData.date,
        p_heure_session: formData.heure,
        p_feuille_mecanique_id: typeEntrainement === 'mecanique' ? feuilleSelectionnee : null,
        p_temps_mecanique: typeEntrainement === 'mecanique' ? parseInt(formData.temps) : null,
        p_score_mecanique: null, // ✅ Score retiré
        p_feuille_chaotique_id: typeEntrainement === 'chaotique' ? feuilleSelectionnee : null,
        p_temps_chaotique: typeEntrainement === 'chaotique' ? parseInt(formData.temps) : null,
        p_score_chaotique: null, // ✅ Score retiré
        p_objectifs: formData.objectifs || null,
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Erreur lors de la création');
      }

      alert('✓ Session enregistrée avec succès !');
      
      // Réinitialiser le formulaire
      setFeuilleSelectionnee('');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        heure: new Date().toTimeString().slice(0, 5),
        temps: '',
        objectifs: '',
      });

      // Recharger les données
      loadData();
    } catch (error: any) {
      console.error('Erreur création session:', error);
      alert('Erreur : ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleInputChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function exportToCSV() {
    if (sessions.length === 0) {
      alert('Aucune session à exporter');
      return;
    }

    const headers = [
      'N° Session',
      'Date',
      'Heure',
      'Type',
      'Feuille',
      'Temps (min)',
      'Objectifs'
    ];

    const rows = sessions.map(s => {
      const isMecanique = s.feuille_mecanique_titre !== null;
      return [
        s.numero_session,
        s.date_session,
        s.heure_session,
        isMecanique ? 'Mécanique' : 'Chaotique',
        isMecanique ? s.feuille_mecanique_titre : s.feuille_chaotique_titre,
        isMecanique ? s.temps_mecanique : s.temps_chaotique,
        s.objectifs || '-'
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sessions_entrainement_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <Loader />
          <p className="text-gray-600 mt-4">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white p-4 md:p-8">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap');
        h1, h2, h3, h4, h5, h6, .font-mono { font-family: 'IBM Plex Mono', monospace; }
        body { font-family: 'Lora', serif; }
        p, span, div { font-family: 'Lora', serif; }
      `}</style>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
          <h1 className="text-3xl font-bold text-gray-900">
            📝 Mes Sessions d'Entraînement
          </h1>
          <p className="text-gray-600 mt-2">
            Enregistrez vos sessions quotidiennes et suivez votre progression
          </p>
        </div>

        {/* Message si aucune feuille en progression */}
        {feuilles.length === 0 && (
          <div className="bg-orange-50/20 border-2 border-orange-300 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="text-3xl">⚠️</div>
              <div>
                <h3 className="font-bold text-orange-900 text-lg mb-2">
                  Aucune feuille en progression
                </h3>
                <p className="text-orange-700">
                  Contactez votre chef d'équipe pour qu'il vous débloque des feuilles d'entraînement.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire */}
        {feuilles.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                📋 Enregistrer une session
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date, Heure, N° Session */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session n°
                  </label>
                  <input
                    type="text"
                    value={nextSessionNum}
                    disabled
                    className="w-full px-4 py-2 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-900 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                    required
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
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-gray-900"
                    required
                  />
                </div>
              </div>

              {/* Type d'entraînement */}
              <div className="p-4 bg-gray-50 border-2 border-gray-300 rounded-xl">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📚 Type d'entraînement
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="mecanique"
                      checked={typeEntrainement === 'mecanique'}
                      onChange={() => {
                        setTypeEntrainement('mecanique');
                        setFeuilleSelectionnee('');
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="font-medium text-gray-900">🔧 Feuille Mécanique</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="chaotique"
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
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    // Déterminer le type et les données
                    const isMecanique = session.feuille_mecanique_titre !== null;
                    const titre = isMecanique ? session.feuille_mecanique_titre : session.feuille_chaotique_titre;
                    const temps = isMecanique ? session.temps_mecanique : session.temps_chaotique;
                    
                    return (
                      <tr key={session.id} className="border-b border-gray-300 hover:bg-gray-50/50">
                        <td className="px-3 py-3 font-bold text-teal-600">
                          #{session.numero_session}
                        </td>
                        <td className="px-3 py-3 text-gray-900">
                          {new Date(session.date_session).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {session.heure_session}
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
                          {temps ? (
                            <span className="text-gray-900 font-medium">{temps} min</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-900 font-medium">
                          {session.objectifs || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}