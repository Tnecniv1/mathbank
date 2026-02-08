'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  equipeId: string;
  membreUserId: string;
  onClose: () => void;
  onCreated: () => void;
};

export default function ModalCreerObjectif({ equipeId, membreUserId, onClose, onCreated }: Props) {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [nbSessionsMin, setNbSessionsMin] = useState(1);
  const [nbExoMeca, setNbExoMeca] = useState(0);
  const [consignesMeca, setConsignesMeca] = useState('');
  const [nbExoChaos, setNbExoChaos] = useState(0);
  const [consignesChaos, setConsignesChaos] = useState('');
  const [description, setDescription] = useState('');
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
      setError('La date de debut est requise');
      return;
    }
    if (nbSessionsMin <= 0 && nbExoMeca <= 0 && nbExoChaos <= 0) {
      setError('Au moins un critere doit etre superieur a 0');
      return;
    }

    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('creer_objectif_hebdomadaire', {
        p_equipe_id: equipeId,
        p_membre_user_id: membreUserId,
        p_date_debut: dateDebut,
        p_nb_sessions_min: nbSessionsMin,
        p_nb_exercices_mecanique: nbExoMeca,
        p_consignes_mecanique: consignesMeca || null,
        p_nb_exercices_chaotique: nbExoChaos,
        p_consignes_chaotique: consignesChaos || null,
        p_description: description || null,
      });

      if (rpcError) throw rpcError;

      onCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erreur lors de la creation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cream-50 rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-ink">🎯 Nouvel objectif hebdomadaire</h2>
          <button
            onClick={onClose}
            className="text-ink hover:bg-cream-200 rounded-lg p-2 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Date debut */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Date de debut *</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => handleDateDebutChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
              required
            />
            {dateFin && (
              <p className="text-xs text-ink-light mt-1">
                Fin automatique : {new Date(dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Nb sessions */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Nombre de sessions minimum</label>
            <input
              type="number"
              min={0}
              value={nbSessionsMin}
              onChange={(e) => setNbSessionsMin(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            />
          </div>

          {/* Exercices mecaniques */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Exercices mecaniques</label>
            <input
              type="number"
              min={0}
              value={nbExoMeca}
              onChange={(e) => setNbExoMeca(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            />
            {nbExoMeca > 0 && (
              <div className="mt-2">
                <label className="block text-xs text-ink-light mb-1">Consignes (optionnel)</label>
                <input
                  type="text"
                  value={consignesMeca}
                  onChange={(e) => setConsignesMeca(e.target.value)}
                  placeholder="Ex: Feuille 3 du chapitre derivees..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>
            )}
          </div>

          {/* Exercices chaotiques */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Exercices chaotiques</label>
            <input
              type="number"
              min={0}
              value={nbExoChaos}
              onChange={(e) => setNbExoChaos(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
            />
            {nbExoChaos > 0 && (
              <div className="mt-2">
                <label className="block text-xs text-ink-light mb-1">Consignes (optionnel)</label>
                <input
                  type="text"
                  value={consignesChaos}
                  onChange={(e) => setConsignesChaos(e.target.value)}
                  placeholder="Ex: Exercices sur les probabilites..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Semaine de revision sur les fonctions..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-cream-50 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-none"
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-cream-200 hover:bg-cream-200/80 text-ink font-medium rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={(e) => {
              const form = (e.target as HTMLElement).closest('.flex.flex-col')?.querySelector('form');
              if (form) form.requestSubmit();
            }}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-accent hover:bg-accent/80 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Creation...' : 'Creer l\'objectif'}
          </button>
        </div>
      </div>
    </div>
  );
}
