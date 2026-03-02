'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type QuestionRow = {
  tempId: string;
  numero: number;
  exercice: string;
  question: string;
  comprehension: number | null;
  savoir: number | null; // chaotique : 0-100 | mécanique : 0 (FAUX) ou 100 (VRAI)
  redaction: number | null;
  correction: number;
  valide: boolean;
};

type TableauNotationProps = {
  sessionId: string;
  type: 'mecanique' | 'chaotique';
  onScoreInserted: () => void;
};

const COMPREHENSION_OPTIONS = [
  { value: 0, label: '0' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
  { value: 100, label: '100' },
];

const SAVOIR_OPTIONS = [
  { value: 0, label: '0' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
  { value: 100, label: '100' },
];

const REDACTION_OPTIONS = [
  { value: 0, label: '0' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
  { value: 100, label: '100' },
];

function makeEmptyRow(numero: number): QuestionRow {
  return {
    tempId: `q-${Date.now()}-${numero}`,
    numero,
    exercice: '',
    question: `Q${numero}`,
    comprehension: null,
    savoir: null,
    redaction: null,
    correction: 0,
    valide: false,
  };
}

export function TableauNotation({ sessionId, type, onScoreInserted }: TableauNotationProps) {
  const [rows, setRows] = useState<QuestionRow[]>(() => [makeEmptyRow(1)]);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleChange = (tempId: string, champ: keyof QuestionRow, valeur: any) => {
    setRows(prev => prev.map(q =>
      q.tempId === tempId ? { ...q, [champ]: valeur } : q
    ));
  };

  const handleSelectChange = (tempId: string, champ: string, value: string) => {
    handleChange(tempId, champ as keyof QuestionRow, value === '' ? null : parseInt(value));
  };

  // Navigation clavier pour le mode chaotique uniquement
  const handleKeyDown = (e: React.KeyboardEvent, tempId: string, champ: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const ordre = ['comprehension', 'savoir', 'redaction'];
      const indexActuel = ordre.indexOf(champ);
      if (indexActuel < 2) {
        const prochainChamp = ordre[indexActuel + 1];
        const input = document.querySelector(
          `select[data-question="${tempId}"][data-champ="${prochainChamp}"]`
        ) as HTMLSelectElement | null;
        input?.focus();
      } else {
        validerQuestionChaotique(tempId);
      }
    }
  };

  // Validation chaotique (via bouton ✓ ou Enter sur le dernier select)
  const validerQuestionChaotique = async (tempId: string) => {
    const q = rows.find(x => x.tempId === tempId);
    if (!q) return;
    if (q.comprehension === null && q.savoir === null && q.redaction === null) return;

    const { error } = await supabase.from('score_local').insert({
      session_id: sessionId,
      exercice: q.exercice || '',
      question: q.question,
      comprehension: q.comprehension,
      savoir: q.savoir,
      redaction: q.redaction,
      correction: q.correction,
    });

    if (error) {
      console.error('Erreur insertion score:', error.message, error.code);
      return;
    }

    setRows(prev => prev.map(x =>
      x.tempId === tempId ? { ...x, valide: true } : x
    ));
    onScoreInserted();
    ajouterNouvelleRangee();
  };

  // Validation mécanique : clic sur VRAI ou FAUX → insertion immédiate
  const handleVraiFaux = async (tempId: string, value: 0 | 100) => {
    const q = rows.find(x => x.tempId === tempId);
    if (!q || q.valide) return;

    // Mettre à jour visuellement avant l'insert
    setRows(prev => prev.map(x =>
      x.tempId === tempId ? { ...x, savoir: value } : x
    ));

    const { error } = await supabase.from('score_local').insert({
      session_id: sessionId,
      exercice: '',
      question: q.question,
      comprehension: null,
      savoir: value,
      redaction: null,
      correction: 0,
    });

    if (error) {
      console.error('Erreur insertion score:', error.message, error.code);
      // Remettre savoir à null si échec
      setRows(prev => prev.map(x =>
        x.tempId === tempId ? { ...x, savoir: null } : x
      ));
      return;
    }

    setRows(prev => prev.map(x =>
      x.tempId === tempId ? { ...x, savoir: value, valide: true } : x
    ));
    onScoreInserted();
    ajouterNouvelleRangee();
  };

  const ajouterNouvelleRangee = () => {
    const nouveauNumero = rows.length + 1;
    const newRow = makeEmptyRow(nouveauNumero);
    setRows(prev => [...prev, newRow]);

    setTimeout(() => {
      let selector: string;
      if (type === 'mecanique') {
        selector = `button[data-question="${newRow.tempId}"][data-champ="vrai"]`;
      } else {
        selector = `select[data-question="${newRow.tempId}"][data-champ="comprehension"]`;
      }
      const el = document.querySelector(selector) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
    }, 100);
  };

  const ajouterQuestion = () => {
    const nouveauNumero = rows.length + 1;
    const newRow = makeEmptyRow(nouveauNumero);
    setRows(prev => [...prev, newRow]);

    setTimeout(() => {
      let selector: string;
      if (type === 'mecanique') {
        selector = `button[data-question="${newRow.tempId}"][data-champ="vrai"]`;
      } else {
        selector = `select[data-question="${newRow.tempId}"][data-champ="comprehension"]`;
      }
      const el = document.querySelector(selector) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
    }, 100);
  };

  return (
    <div ref={tableRef} className="h-full overflow-y-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 z-10">
          {type === 'mecanique' ? (
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="p-2 text-center w-10">Q</th>
              <th className="p-2 text-center w-32">Référence</th>
              <th className="p-2 text-center">Résultat</th>
              <th className="p-2 text-center w-16">OK</th>
            </tr>
          ) : (
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="p-2 text-center w-10">Q</th>
              <th className="p-2 text-center w-24">Exercice</th>
              <th className="p-2 text-center w-20">Question</th>
              <th className="p-2 text-center w-28">Compréhension</th>
              <th className="p-2 text-center w-24">Savoir</th>
              <th className="p-2 text-center w-24">Rédaction</th>
              <th className="p-2 text-center w-16">Corr.</th>
              <th className="p-2 text-center w-20">Score</th>
              <th className="p-2 text-center w-16">OK</th>
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((q) => {
            if (type === 'mecanique') {
              return (
                <tr
                  key={q.tempId}
                  className={`border-b transition-colors ${
                    q.valide
                      ? 'bg-green-50/50 text-gray-400'
                      : 'hover:bg-blue-50/30'
                  }`}
                >
                  {/* Numéro */}
                  <td className="p-2 text-center font-mono text-sm font-bold text-blue-600">
                    {q.numero}
                  </td>

                  {/* Question */}
                  <td className="p-1">
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => handleChange(q.tempId, 'question', e.target.value)}
                      placeholder="Q1"
                      className="w-full text-center text-sm border border-gray-200 rounded px-1 py-1 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                      disabled={q.valide}
                    />
                  </td>

                  {/* VRAI / FAUX */}
                  <td className="p-2">
                    <div className="flex gap-2 justify-center">
                      <button
                        data-question={q.tempId}
                        data-champ="vrai"
                        onClick={() => handleVraiFaux(q.tempId, 100)}
                        disabled={q.valide}
                        className={`px-4 py-1.5 rounded font-bold text-sm transition ${
                          q.savoir === 100
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-700'
                        } disabled:cursor-default disabled:opacity-60`}
                      >
                        ✓ Réussi
                      </button>
                      <button
                        data-question={q.tempId}
                        data-champ="faux"
                        onClick={() => handleVraiFaux(q.tempId, 0)}
                        disabled={q.valide}
                        className={`px-4 py-1.5 rounded font-bold text-sm transition ${
                          q.valide && q.savoir === 0
                            ? 'bg-red-500 text-white'
                            : !q.valide && q.savoir === 0
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-700'
                        } disabled:cursor-default disabled:opacity-60`}
                      >
                        ✗ Échoué
                      </button>
                    </div>
                  </td>

                  {/* Statut */}
                  <td className="p-2 text-center">
                    {q.valide ? (
                      <span className="text-lg">{q.savoir === 100 ? '✅' : '❌'}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            }

            // ── Mode chaotique ─────────────────────────────────────────────
            const scoreDisplay = (() => {
              if (!q.valide) return '-';
              let sum = 0, poids = 0;
              if (q.comprehension !== null) { sum += 50 * q.comprehension; poids += 50; }
              if (q.savoir !== null) { sum += 25 * q.savoir; poids += 25; }
              if (q.redaction !== null) { sum += 25 * q.redaction; poids += 25; }
              if (poids === 0) return '-';
              return Math.round((sum / poids) * (1 + 0.3 * q.correction));
            })();

            return (
              <tr
                key={q.tempId}
                className={`border-b transition-colors ${
                  q.valide
                    ? 'bg-green-50/50 text-gray-400'
                    : 'hover:bg-purple-50/30'
                }`}
              >
                {/* Numéro */}
                <td className="p-2 text-center font-mono text-sm font-bold text-purple-600">
                  {q.numero}
                </td>

                {/* Exercice */}
                <td className="p-1">
                  <input
                    type="text"
                    value={q.exercice}
                    onChange={(e) => handleChange(q.tempId, 'exercice', e.target.value)}
                    placeholder="Ex3"
                    className="w-full text-center text-sm border border-gray-200 rounded px-1 py-1 focus:ring-2 focus:ring-purple-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    disabled={q.valide}
                  />
                </td>

                {/* Question */}
                <td className="p-1">
                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => handleChange(q.tempId, 'question', e.target.value)}
                    placeholder="Q1"
                    className="w-full text-center text-sm border border-gray-200 rounded px-1 py-1 focus:ring-2 focus:ring-purple-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    disabled={q.valide}
                  />
                </td>

                {/* Compréhension */}
                <td className="p-1">
                  <select
                    value={q.comprehension ?? ''}
                    onChange={(e) => handleSelectChange(q.tempId, 'comprehension', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, q.tempId, 'comprehension')}
                    data-question={q.tempId}
                    data-champ="comprehension"
                    className="w-full text-center text-sm border border-gray-200 rounded px-1 py-1.5 focus:ring-2 focus:ring-purple-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    disabled={q.valide}
                  >
                    <option value="">-</option>
                    {COMPREHENSION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>

                {/* Savoir */}
                <td className="p-1">
                  <select
                    value={q.savoir ?? ''}
                    onChange={(e) => handleSelectChange(q.tempId, 'savoir', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, q.tempId, 'savoir')}
                    data-question={q.tempId}
                    data-champ="savoir"
                    className="w-full text-center text-sm border border-gray-200 rounded px-1 py-1.5 focus:ring-2 focus:ring-purple-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    disabled={q.valide}
                  >
                    <option value="">-</option>
                    {SAVOIR_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>

                {/* Rédaction */}
                <td className="p-1">
                  <select
                    value={q.redaction ?? ''}
                    onChange={(e) => handleSelectChange(q.tempId, 'redaction', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, q.tempId, 'redaction')}
                    data-question={q.tempId}
                    data-champ="redaction"
                    className="w-full text-center text-sm border border-gray-200 rounded px-1 py-1.5 focus:ring-2 focus:ring-purple-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    disabled={q.valide}
                  >
                    <option value="">-</option>
                    {REDACTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>

                {/* Correction */}
                <td className="p-1 text-center">
                  <input
                    type="checkbox"
                    checked={q.correction === 1}
                    onChange={(e) => handleChange(q.tempId, 'correction', e.target.checked ? 1 : 0)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-400"
                    disabled={q.valide}
                  />
                </td>

                {/* Score */}
                <td className="p-2 text-center font-bold text-purple-600 text-sm">
                  {scoreDisplay}{q.valide ? '%' : ''}
                </td>

                {/* Validation */}
                <td className="p-2 text-center">
                  {q.valide ? (
                    <span className="text-green-500 text-lg">✅</span>
                  ) : (
                    <button
                      onClick={() => validerQuestionChaotique(q.tempId)}
                      disabled={q.comprehension === null && q.savoir === null && q.redaction === null}
                      className="px-2 py-1 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded transition"
                    >
                      ✓
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        onClick={ajouterQuestion}
        className="w-full py-2 text-sm text-gray-500 hover:text-purple-600 hover:bg-purple-50 flex items-center justify-center gap-2 transition-colors border-t"
      >
        <span className="text-lg">+</span> Ajouter une question
      </button>
    </div>
  );
}
