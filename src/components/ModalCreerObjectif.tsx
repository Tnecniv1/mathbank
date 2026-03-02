'use client';

import React, { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  equipeId: string;
  membreUserId: string;
  onClose: () => void;
  onCreated: () => void;
};

const DUREES_SUGGESTIONS = [5, 7, 10, 15, 20, 30, 45, 60];

export default function ModalCreerObjectif({
  equipeId,
  membreUserId,
  onClose,
  onCreated,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [nbJoursMin, setNbJoursMin] = useState(3);
  const [dureeMinSession, setDureeMinSession] = useState(30);
  const [nbExoMeca, setNbExoMeca] = useState(0);
  const [consignesMeca, setConsignesMeca] = useState('');
  const [nbExoChaos, setNbExoChaos] = useState(0);
  const [consignesChaos, setConsignesChaos] = useState('');
  const [description, setDescription] = useState('');
  const [validationMode, setValidationMode] = useState<'auto' | 'manuel'>(
    'auto'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleDateDebutChange(value: string) {
    setDateDebut(value);
    if (value) {
      const d = new Date(value);
      d.setDate(d.getDate() + 6);
      setDateFin(d.toISOString().split('T')[0]);
    } else {
      setDateFin('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!dateDebut) {
      setError('La date de début est requise');
      return;
    }
    if (nbJoursMin <= 0) {
      setError('Le nombre de jours minimum doit être ≥ 1');
      return;
    }
    if (dureeMinSession <= 0) {
      setError('La durée minimale par session doit être > 0');
      return;
    }

    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc(
        'creer_objectif_hebdomadaire',
        {
          p_equipe_id: equipeId,
          p_membre_user_id: membreUserId,
          p_date_debut: dateDebut,
          p_nb_jours_min: nbJoursMin,
          p_nb_exercices_mecanique: nbExoMeca,
          p_consignes_mecanique: consignesMeca || null,
          p_nb_exercices_chaotique: nbExoChaos,
          p_consignes_chaotique: consignesChaos || null,
          p_description: description || null,
          p_duree_min_session: dureeMinSession,
          p_validation_mode: validationMode,
        }
      );

      if (rpcError) throw rpcError;

      onCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cream-50 rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-ink">
            🎯 Nouvel objectif hebdomadaire
          </h2>
          <button
            onClick={onClose}
            className="text-ink hover:bg-cream-200 rounded-lg p-2 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Formulaire */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* Date de début */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Date de début *
            </label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => handleDateDebutChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
              required
            />
            {dateFin && (
              <p className="text-xs text-ink-light mt-1">
                Fin automatique :{' '}
                {new Date(dateFin).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>

          {/* Jours valides minimum */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Jours valides minimum
            </label>
            <input
              type="number"
              min={1}
              value={nbJoursMin}
              onChange={(e) =>
                setNbJoursMin(parseInt(e.target.value) || 1)
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            />
            <p className="text-xs text-ink-light mt-1">
              Un jour est valide s'il contient au moins 1 session mécanique ET 1 session chaotique satisfaisant les critères.
            </p>
          </div>

          {/* Durée minimale par session */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Durée minimale par session (minutes) *
            </label>
            <input
              type="number"
              min={1}
              value={dureeMinSession}
              onChange={(e) =>
                setDureeMinSession(parseInt(e.target.value) || 1)
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            />
            {/* Suggestions rapides */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DUREES_SUGGESTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDureeMinSession(d)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    dureeMinSession === d
                      ? 'bg-accent text-white border-accent'
                      : 'border-border text-ink-light hover:border-accent hover:text-ink'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-light mt-1.5">
              Durée minimale requise pour chaque session mécanique et
              chaque session chaotique.
            </p>
          </div>

          {/* Exercices mécaniques par jour */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Exercices mécaniques minimum par jour
            </label>
            <input
              type="number"
              min={0}
              value={nbExoMeca}
              onChange={(e) =>
                setNbExoMeca(parseInt(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            />
            <p className="text-xs text-ink-light mt-1">
              0 = pas de contrainte sur les mécaniques.
            </p>
            {nbExoMeca > 0 && (
              <div className="mt-2">
                <label className="block text-xs text-ink-light mb-1">
                  Consignes (optionnel)
                </label>
                <input
                  type="text"
                  value={consignesMeca}
                  onChange={(e) => setConsignesMeca(e.target.value)}
                  placeholder="Ex : Feuille 3 du chapitre dérivées…"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>
            )}
          </div>

          {/* Exercices chaotiques par jour */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Exercices chaotiques minimum par jour
            </label>
            <input
              type="number"
              min={0}
              value={nbExoChaos}
              onChange={(e) =>
                setNbExoChaos(parseInt(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            />
            <p className="text-xs text-ink-light mt-1">
              0 = pas de contrainte sur les chaotiques.
            </p>
            {nbExoChaos > 0 && (
              <div className="mt-2">
                <label className="block text-xs text-ink-light mb-1">
                  Consignes (optionnel)
                </label>
                <input
                  type="text"
                  value={consignesChaos}
                  onChange={(e) => setConsignesChaos(e.target.value)}
                  placeholder="Ex : Exercices sur les probabilités…"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : Semaine de révision sur les fonctions…"
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-none"
              rows={2}
            />
          </div>

          {/* Mode de validation */}
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Mode de validation
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setValidationMode('auto')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors text-left ${
                  validationMode === 'auto'
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-border text-ink-light hover:border-ink-light'
                }`}
              >
                <div className="font-semibold mb-0.5">🤖 Automatique</div>
                <div className="text-xs font-normal opacity-70">
                  Le statut est calculé automatiquement selon les sessions
                  réalisées.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setValidationMode('manuel')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors text-left ${
                  validationMode === 'manuel'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-border text-ink-light hover:border-ink-light'
                }`}
              >
                <div className="font-semibold mb-0.5">✏️ Manuelle</div>
                <div className="text-xs font-normal opacity-70">
                  Vous décidez vous-même du succès ou de l'échec à tout
                  moment.
                </div>
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-cream-200 hover:bg-cream-200/80 text-ink font-medium rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-accent hover:bg-accent/80 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Création…' : "Créer l'objectif"}
          </button>
        </div>
      </div>
    </div>
  );
}
