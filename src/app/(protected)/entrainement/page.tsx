'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ---------- Supabase ---------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

// Type pour une brique d'apprentissage (depuis la vue v_parcours_complet)
type BriqueFromDB = {
  parcours_id: string;
  user_id: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: 'non_commence' | 'en_cours' | 'termine' | 'a_revoir';
  score: number | null;
  temps: number | null;
  created_at: string;
  variante_id: string;
  variante_no: number;
  variante_publication: string;
  entrainement_titre: string;
  niveau_titre: string | null;
  sujet_titre: string | null;
  chapitre_titre: string | null;
  lecon_titre: string | null;
};

// Type pour une brique formatée pour l'UI
type Brique = {
  id: string;
  scope: {
    niveau: string;
    sujet: string;
    chapitre: string;
    lecon: string;
  };
  entrainement: string;
  variante: {
    numero: number;
    pdfUrl: string;
  };
  metadata: {
    statut: string;
    score: number | null;
    temps: number | null;
  };
};

// Type pour un bloc hiérarchique
type BlocHierarchique = {
  id: string;
  ancetreCommun: string;
  briques: Brique[];
  couleur: string;
};

// Types pour l'arborescence
type NiveauRow = { id: string; titre: string; ordre: number };
type SujetRow = { id: string; titre: string; niveau_id: string; ordre: number };
type ChapitreRow = { id: string; titre: string; sujet_id: string; ordre: number };
type LeconRow = { id: string; titre: string; chapitre_id: string; ordre: number };
type EntrainementRow = { id: string; titre: string };
type VarianteRow = { id: string; variante_no: number; complexite: number | null };

// Types pour les sessions
type Session = {
  id: string;
  date_heure: string;
  duree: number;
};

type NoeudSelectionne = {
  type: 'niveau' | 'sujet' | 'chapitre' | 'lecon';
  id: string;
  titre: string;
  path: string;
};

// Couleurs pour différencier les blocs
const COULEURS_BLOCS = [
  'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50',
  'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50',
  'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50',
  'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50',
  'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900/50',
];

// Transformer les données DB en format UI
function transformBriqueFromDB(briqueDB: BriqueFromDB): Brique {
  const { data } = supabase.storage.from('pdfs').getPublicUrl(briqueDB.variante_publication);
  
  return {
    id: briqueDB.parcours_id,
    scope: {
      niveau: briqueDB.niveau_titre || '-',
      sujet: briqueDB.sujet_titre || '-',
      chapitre: briqueDB.chapitre_titre || '-',
      lecon: briqueDB.lecon_titre || '-',
    },
    entrainement: briqueDB.entrainement_titre,
    variante: {
      numero: briqueDB.variante_no,
      pdfUrl: data.publicUrl,
    },
    metadata: {
      statut: briqueDB.statut,
      score: briqueDB.score,
      temps: briqueDB.temps,
    },
  };
}

// Calculer la profondeur d'un scope
function getProfondeur(scope: Brique['scope']): number {
  let prof = 0;
  if (scope.niveau !== '-') prof++;
  if (scope.sujet !== '-') prof++;
  if (scope.chapitre !== '-') prof++;
  if (scope.lecon !== '-') prof++;
  return prof;
}

// Regrouper les briques en blocs hiérarchiques par Niveau + Sujet
function regrouperEnBlocs(briques: Brique[]): BlocHierarchique[] {
  if (briques.length === 0) return [];
  
  const blocs: BlocHierarchique[] = [];
  let blocActuel: Brique[] = [];
  let ancetreActuel = '';
  
  for (const brique of briques) {
    const ancetre = brique.scope.sujet !== '-' 
      ? `${brique.scope.niveau} | ${brique.scope.sujet}`
      : brique.scope.niveau;
    
    if (ancetreActuel && ancetre !== ancetreActuel) {
      blocActuel.sort((a, b) => getProfondeur(a.scope) - getProfondeur(b.scope));
      
      blocs.push({
        id: `bloc-${blocs.length}`,
        ancetreCommun: ancetreActuel,
        briques: blocActuel,
        couleur: COULEURS_BLOCS[blocs.length % COULEURS_BLOCS.length],
      });
      
      blocActuel = [];
    }
    
    ancetreActuel = ancetre;
    blocActuel.push(brique);
  }
  
  if (blocActuel.length > 0) {
    blocActuel.sort((a, b) => getProfondeur(a.scope) - getProfondeur(b.scope));
    blocs.push({
      id: `bloc-${blocs.length}`,
      ancetreCommun: ancetreActuel,
      briques: blocActuel,
      couleur: COULEURS_BLOCS[blocs.length % COULEURS_BLOCS.length],
    });
  }
  
  return blocs;
}

// Obtenir le texte du scope avec chemin depuis le parent
function getScopeText(brique: Brique, isFirst: boolean): string {
  if (isFirst) {
    return `${brique.scope.niveau} | ${brique.scope.sujet} | ${brique.scope.chapitre} | ${brique.scope.lecon}`;
  }
  
  const parts: string[] = [];
  if (brique.scope.sujet !== '-') parts.push(brique.scope.sujet);
  if (brique.scope.chapitre !== '-') parts.push(brique.scope.chapitre);
  if (brique.scope.lecon !== '-') parts.push(brique.scope.lecon);
  
  return parts.join(' | ');
}

// Composant pour afficher une ligne de brique avec indentation
function BriqueRow({ brique, isFirst, profondeur, isLastAdded, numero }: { 
  brique: Brique; 
  isFirst: boolean; 
  profondeur: number;
  isLastAdded: boolean;
  numero: number;
}) {
  const scopeText = getScopeText(brique, isFirst);
  const indentation = isFirst ? 0 : (profondeur - 1) * 24;

  return (
    <div className="relative border-b border-zinc-200 dark:border-zinc-800 hover:bg-white/50 dark:hover:bg-zinc-900/30 transition-colors">
      {isLastAdded && (
        <div className="absolute top-2 left-2 w-3 h-3 bg-purple-500 rounded-full" title="Brique en cours"></div>
      )}
      
      <div className="flex">
        {/* Colonne numéro */}
        <div className="w-16 flex-shrink-0 flex items-center justify-center border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">#{numero}</span>
        </div>
        
        {/* Contenu de la brique */}
        <div className="flex-1">
          <div className="p-3" style={{ paddingLeft: `${16 + indentation}px` }}>
            <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
              {scopeText}
            </p>
          </div>
          
          <div className="px-3 pb-3 flex items-center justify-between" style={{ paddingLeft: `${16 + indentation + 24}px` }}>
            <div className="flex items-center gap-4 flex-1">
              <span className="text-zinc-400">└─</span>
              <div className="flex-1">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {brique.entrainement}
                </span>
                {brique.metadata.statut !== 'non_commence' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                    brique.metadata.statut === 'termine' ? 'bg-green-100 text-green-700' :
                    brique.metadata.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {brique.metadata.statut === 'termine' ? '✓ Terminé' :
                     brique.metadata.statut === 'en_cours' ? '⏳ En cours' :
                     '🔄 À revoir'}
                  </span>
                )}
              </div>
              
              <span className="text-zinc-400">|</span>
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Variante {brique.variante.numero}
                </span>
                {typeof brique.metadata.score === 'number' && (
                  <span className="text-xs text-zinc-500">
                    Score: {brique.metadata.score > 0 ? '+' : ''}{brique.metadata.score}
                  </span>
                )}
                <a
                  href={brique.variante.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  [PDF]
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant pour afficher un bloc hiérarchique
function BlocHierarchique({ bloc, lastBriqueId, startIndex }: { 
  bloc: BlocHierarchique; 
  lastBriqueId: string | null;
  startIndex: number;
}) {
  return (
    <div className={`rounded-xl border overflow-hidden ${bloc.couleur} mb-6`}>
      <div className="px-4 py-2 border-b border-zinc-300 dark:border-zinc-700">
        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          📚 {bloc.ancetreCommun}
        </p>
      </div>
      
      <div className="bg-white dark:bg-zinc-950">
        {bloc.briques.map((brique, index) => (
          <BriqueRow
            key={brique.id}
            brique={brique}
            isFirst={index === 0}
            profondeur={getProfondeur(brique.scope)}
            isLastAdded={brique.id === lastBriqueId}
            numero={startIndex + index}
          />
        ))}
      </div>
    </div>
  );
}

// Composant Arborescence - Leçon
function LeconItem({ lecon, onSelect }: { lecon: LeconRow; onSelect: (noeud: NoeudSelectionne) => void }) {
  return (
    <button
      onClick={() => onSelect({ type: 'lecon', id: lecon.id, titre: lecon.titre, path: lecon.titre })}
      className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors text-sm flex items-center gap-2"
    >
      <span className="text-zinc-400">📄</span>
      {lecon.titre}
    </button>
  );
}

// Composant Arborescence - Chapitre
function ChapitreItem({ chapitre, onSelect }: { chapitre: ChapitreRow; onSelect: (noeud: NoeudSelectionne) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [lecons, setLecons] = useState<LeconRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function toggle() {
    if (!loaded) {
      const { data } = await supabase
        .from('lecon')
        .select('*')
        .eq('chapitre_id', chapitre.id)
        .order('ordre');
      if (data) setLecons(data);
      setLoaded(true);
    }
    setExpanded(!expanded);
  }

  return (
    <div>
      <div className="flex items-center">
        <button onClick={toggle} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
          {expanded ? '▼' : '▶️'}
        </button>
        <button
          onClick={() => onSelect({ type: 'chapitre', id: chapitre.id, titre: chapitre.titre, path: chapitre.titre })}
          className="flex-1 text-left px-2 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors text-sm flex items-center gap-2"
        >
          <span className="text-zinc-400">📂</span>
          {chapitre.titre}
        </button>
      </div>
      {expanded && (
        <div className="ml-6 border-l border-zinc-200 dark:border-zinc-700">
          {lecons.map(lecon => (
            <LeconItem key={lecon.id} lecon={lecon} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// Composant Arborescence - Sujet
function SujetItem({ sujet, onSelect }: { sujet: SujetRow; onSelect: (noeud: NoeudSelectionne) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [chapitres, setChapitres] = useState<ChapitreRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function toggle() {
    if (!loaded) {
      const { data } = await supabase
        .from('chapitre')
        .select('*')
        .eq('sujet_id', sujet.id)
        .order('ordre');
      if (data) setChapitres(data);
      setLoaded(true);
    }
    setExpanded(!expanded);
  }

  return (
    <div>
      <div className="flex items-center">
        <button onClick={toggle} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
          {expanded ? '▼' : '▶️'}
        </button>
        <button
          onClick={() => onSelect({ type: 'sujet', id: sujet.id, titre: sujet.titre, path: sujet.titre })}
          className="flex-1 text-left px-2 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors text-sm flex items-center gap-2"
        >
          <span className="text-zinc-400">📁</span>
          {sujet.titre}
        </button>
      </div>
      {expanded && (
        <div className="ml-6 border-l border-zinc-200 dark:border-zinc-700">
          {chapitres.map(chapitre => (
            <ChapitreItem key={chapitre.id} chapitre={chapitre} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// Composant Arborescence - Niveau
function NiveauItem({ niveau, onSelect }: { niveau: NiveauRow; onSelect: (noeud: NoeudSelectionne) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [sujets, setSujets] = useState<SujetRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function toggle() {
    if (!loaded) {
      const { data } = await supabase
        .from('sujet')
        .select('*')
        .eq('niveau_id', niveau.id)
        .order('ordre');
      if (data) setSujets(data);
      setLoaded(true);
    }
    setExpanded(!expanded);
  }

  return (
    <div>
      <div className="flex items-center">
        <button onClick={toggle} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
          {expanded ? '▼' : '▶️'}
        </button>
        <button
          onClick={() => onSelect({ type: 'niveau', id: niveau.id, titre: niveau.titre, path: niveau.titre })}
          className="flex-1 text-left px-2 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-medium flex items-center gap-2"
        >
          <span className="text-zinc-400">🏫</span>
          {niveau.titre}
        </button>
      </div>
      {expanded && (
        <div className="ml-6 border-l-2 border-zinc-300 dark:border-zinc-600">
          {sujets.map(sujet => (
            <SujetItem key={sujet.id} sujet={sujet} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// Composant Formulaire de suivi
function FormulaireSuivi({ 
  briqueEnCours,
  numeroBrique,
  onComplete 
}: { 
  briqueEnCours: Brique | null;
  numeroBrique: number | null;
  onComplete: () => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [score, setScore] = useState<string>('');
  const [nouvelleDuree, setNouvelleDuree] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (briqueEnCours) {
      loadSessions();
    } else {
      setSessions([]);
      setScore('');
    }
  }, [briqueEnCours]);

  async function loadSessions() {
    if (!briqueEnCours) return;
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('parcours_id', briqueEnCours.id)
      .order('date_heure', { ascending: true });
    
    if (!error && data) {
      setSessions(data);
    }

    const { data: parcoursData } = await supabase
      .from('parcours')
      .select('score')
      .eq('id', briqueEnCours.id)
      .single();
    
    if (parcoursData?.score !== null && parcoursData?.score !== undefined) {
      setScore(parcoursData.score.toString());
    }
  }

  // Sauvegarder le score automatiquement
  async function sauvegarderScore(newScore: string) {
    if (!briqueEnCours) return;
    
    const scoreNum = parseInt(newScore);
    if (isNaN(scoreNum)) return;

    await supabase
      .from('parcours')
      .update({ score: scoreNum })
      .eq('id', briqueEnCours.id);
  }

  function handleScoreChange(newScore: string) {
    setScore(newScore);
    // Sauvegarder après un petit délai (debounce)
    const timeout = setTimeout(() => {
      sauvegarderScore(newScore);
    }, 500);
    return () => clearTimeout(timeout);
  }

  async function ajouterSession() {
    if (!briqueEnCours || !nouvelleDuree) return;
    
    setLoading(true);
    setError(null);

    try {
      const dureeNum = parseInt(nouvelleDuree);
      if (isNaN(dureeNum) || dureeNum <= 0) {
        throw new Error('Durée invalide');
      }

      const dateFin = new Date();
      
      const { error: insertError } = await supabase
        .from('sessions')
        .insert({
          parcours_id: briqueEnCours.id,
          date_heure: dateFin.toISOString(),
          duree: dureeNum,
        });

      if (insertError) throw insertError;

      await loadSessions();
      setNouvelleDuree('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function terminerEtValider() {
    if (!briqueEnCours) return;
    
    setLoading(true);
    setError(null);

    try {
      const scoreNum = parseInt(score);
      if (isNaN(scoreNum)) {
        throw new Error('Score invalide');
      }

      if (sessions.length === 0) {
        throw new Error('Ajoutez au moins une session');
      }

      const tempsTotal = sessions.reduce((acc, s) => acc + s.duree, 0);

      const { error: updateError } = await supabase
        .from('parcours')
        .update({
          score: scoreNum,
          temps: tempsTotal,
          statut: 'termine',
          date_fin: new Date().toISOString(),
        })
        .eq('id', briqueEnCours.id);

      if (updateError) throw updateError;

      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!briqueEnCours) {
    return (
      <div className="mb-6 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-center text-zinc-500">
        Aucune feuille en cours. Ajoutez une brique pour commencer !
      </div>
    );
  }

  return (
    <div className="mb-6 p-6 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
        <h2 className="text-lg font-semibold">Feuille en cours</h2>
      </div>

      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        <p className="text-lg font-medium">Brique {numeroBrique}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Score total</label>
        <input
          type="number"
          value={score}
          onChange={(e) => handleScoreChange(e.target.value)}
          placeholder="Ex: +5, -2, 0"
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        />
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">Sessions de travail</h3>
        <div className="space-y-2 mb-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune session enregistrée</p>
          ) : (
            sessions.map((session, index) => {
              const date = new Date(session.date_heure);
              const dateStr = date.toLocaleDateString('fr-FR');
              const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-sm">
                    <span className="font-medium">Session {index + 1}</span> : {dateStr} - {timeStr}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {session.duree} min
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            value={nouvelleDuree}
            onChange={(e) => setNouvelleDuree(e.target.value)}
            placeholder="Durée (minutes)"
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            disabled={loading}
          />
          <button
            onClick={ajouterSession}
            disabled={loading || !nouvelleDuree}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm">
          <span className="font-medium">Temps total :</span> {sessions.reduce((acc, s) => acc + s.duree, 0)} minutes
        </div>
      )}

      <button
        onClick={terminerEtValider}
        disabled={loading || !score || sessions.length === 0}
        className="w-full px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {loading ? 'Validation...' : 'Terminer et valider'}
      </button>
    </div>
  );
}

// Modale avec arborescence
function AjouterBriqueModal({ isOpen, onClose, onBriqueAdded }: {
  isOpen: boolean;
  onClose: () => void;
  onBriqueAdded: () => void;
}) {
  const [step, setStep] = useState<'arbre' | 'entrainement' | 'variante'>('arbre');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [niveaux, setNiveaux] = useState<NiveauRow[]>([]);
  const [noeudSelectionne, setNoeudSelectionne] = useState<NoeudSelectionne | null>(null);
  const [entrainements, setEntrainements] = useState<EntrainementRow[]>([]);
  const [variantes, setVariantes] = useState<VarianteRow[]>([]);

  useEffect(() => {
    if (isOpen && step === 'arbre') {
      loadNiveaux();
    }
  }, [isOpen, step]);

  async function loadNiveaux() {
    const { data } = await supabase.from('niveau').select('*').order('ordre');
    if (data) setNiveaux(data);
  }

  async function handleNoeudSelect(noeud: NoeudSelectionne) {
    setNoeudSelectionne(noeud);
    setStep('entrainement');
    setLoading(true);

    let query = supabase.from('entrainement').select('id, titre');
    
    if (noeud.type === 'lecon') {
      query = query.eq('lecon_id', noeud.id);
    } else if (noeud.type === 'chapitre') {
      query = query.eq('chapitre_id', noeud.id).is('lecon_id', null);
    } else if (noeud.type === 'sujet') {
      query = query.eq('sujet_id', noeud.id).is('chapitre_id', null).is('lecon_id', null);
    } else if (noeud.type === 'niveau') {
      query = query.eq('niveau_id', noeud.id).is('sujet_id', null).is('chapitre_id', null).is('lecon_id', null);
    }

    const { data } = await query.order('titre');
    if (data) setEntrainements(data);
    setLoading(false);
  }

  async function handleEntrainementSelect(entrainement: EntrainementRow) {
    setStep('variante');
    setLoading(true);
    const { data } = await supabase
      .from('entrainement_variante')
      .select('*')
      .eq('entrainement_id', entrainement.id)
      .order('variante_no');
    if (data) setVariantes(data);
    setLoading(false);
  }

  async function ajouterBrique(varianteId: string) {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { error: insertError } = await supabase
        .from('parcours')
        .insert({ user_id: user.id, variante_id: varianteId, statut: 'non_commence' });

      if (insertError) throw insertError;

      onBriqueAdded();
      resetModal();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetModal() {
    setStep('arbre');
    setNoeudSelectionne(null);
    setEntrainements([]);
    setVariantes([]);
    setError(null);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Ajouter une brique</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700">✕</button>
          </div>
          {noeudSelectionne && (
            <p className="text-sm text-zinc-500 mt-2">{noeudSelectionne.path}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading && <div className="text-center py-8">Chargement...</div>}

          {!loading && step === 'arbre' && (
            <div className="space-y-1">
              {niveaux.map(niveau => (
                <NiveauItem key={niveau.id} niveau={niveau} onSelect={handleNoeudSelect} />
              ))}
            </div>
          )}

          {!loading && step === 'entrainement' && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold mb-3">Sélectionner un entraînement</h3>
              {entrainements.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucun entraînement disponible.</p>
              ) : (
                entrainements.map(e => (
                  <button
                    key={e.id}
                    onClick={() => handleEntrainementSelect(e)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {e.titre}
                  </button>
                ))
              )}
            </div>
          )}

          {!loading && step === 'variante' && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold mb-3">Sélectionner une variante</h3>
              {variantes.map(v => (
                <button
                  key={v.id}
                  onClick={() => ajouterBrique(v.id)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-zinc-50 dark:hover:bg-zinc-800 flex justify-between"
                >
                  <span>Variante {v.variante_no}</span>
                  {v.complexite && <span className="text-xs">★ {v.complexite}/5</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-between">
          <button
            onClick={() => step === 'arbre' ? onClose() : setStep(step === 'variante' ? 'entrainement' : 'arbre')}
            className="px-4 py-2 rounded-lg border hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            {step === 'arbre' ? 'Annuler' : '← Retour'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EntrainementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briques, setBriques] = useState<Brique[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function loadParcours() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Vous devez être connecté pour voir votre parcours.');
        return;
      }

      const { data, error: dbError } = await supabase
        .from('v_parcours_complet')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (dbError) throw dbError;

      const briquesFormatted = (data || []).map(transformBriqueFromDB);
      setBriques(briquesFormatted);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erreur lors du chargement du parcours.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParcours();
  }, []);

  const blocs = useMemo(() => regrouperEnBlocs(briques), [briques]);
  
  const lastBriqueId = useMemo(() => {
    if (briques.length === 0) return null;
    return briques[briques.length - 1].id;
  }, [briques]);

  const briqueEnCours = useMemo(() => {
    if (briques.length === 0) return null;
    const derniere = briques[briques.length - 1];
    return derniere.metadata.statut !== 'termine' ? derniere : null;
  }, [briques]);

  const numeroBriqueEnCours = useMemo(() => {
    if (!briqueEnCours) return null;
    return briques.length;
  }, [briqueEnCours, briques]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entraînement</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={briqueEnCours !== null}
          className="px-4 py-2 rounded-xl bg-black text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <span className="text-lg">+</span>
          Ajouter une brique
        </button>
      </div>

      <AjouterBriqueModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onBriqueAdded={() => loadParcours()}
      />

      <FormulaireSuivi 
        briqueEnCours={briqueEnCours}
        numeroBrique={numeroBriqueEnCours}
        onComplete={() => loadParcours()}
      />

      {loading && (
        <div className="text-center py-12 text-zinc-500">
          Chargement de votre parcours...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 rounded-xl p-6 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {blocs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              Aucune brique dans votre parcours. Cliquez sur "Ajouter une brique" pour commencer.
            </div>
          ) : (
            <div>
              {blocs.map((bloc, blocIndex) => {
                // Calculer l'index de départ pour ce bloc
                const startIndex = blocs.slice(0, blocIndex).reduce((acc, b) => acc + b.briques.length, 0) + 1;
                return (
                  <BlocHierarchique 
                    key={bloc.id} 
                    bloc={bloc} 
                    lastBriqueId={lastBriqueId}
                    startIndex={startIndex}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}