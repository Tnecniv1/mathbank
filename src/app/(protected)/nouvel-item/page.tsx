'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createItemWithMeta } from '@/app/actions/createItemWithMeta';

/* ---------------- Types ---------------- */
type Opt = { id: string; label: string; parentId?: string | null };

type QuestionElem =
  | string
  | {
      text: string;
      style?: 'blank' | 'ruled';
      heightCm?: number;
      points?: number;
    };

export default function NewItemPage() {
  /* ---------------- Supabase (client) ---------------- */
  const sb = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  /* ---------------- Scope (menus hiérarchiques) ---------------- */
  const [complexities, setComplexities] = useState<Opt[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [chapters, setChapters] = useState<Opt[]>([]);
  const [exercises, setExercises] = useState<Opt[]>([]);

  const [complexityId, setComplexityId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [exerciseId, setExerciseId] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from('complexities')
        .select('id, name, rank, is_active')
        .eq('is_active', true)
        .order('rank', { ascending: true })
        .order('name', { ascending: true });
      setComplexities((data ?? []).map((r: any) => ({ id: r.id, label: r.name })));
    })();
  }, [sb]);

  useEffect(() => {
    setSubjects([]); setSubjectId('');
    setChapters([]); setChapterId('');
    setExercises([]); setExerciseId('');
    if (!complexityId) return;
    (async () => {
      const { data } = await sb
        .from('subjects')
        .select('id, name')
        .eq('complexity_id', complexityId)
        .order('name');
      setSubjects((data ?? []).map((r: any) => ({ id: r.id, label: r.name, parentId: complexityId })));
    })();
  }, [sb, complexityId]);

  useEffect(() => {
    setChapters([]); setChapterId('');
    setExercises([]); setExerciseId('');
    if (!subjectId) return;
    (async () => {
      const { data } = await sb
        .from('chapters')
        .select('id, name, subject_id, order_index')
        .eq('subject_id', subjectId)
        .order('order_index', { ascending: true, nullsFirst: true })
        .order('name');
      setChapters((data ?? []).map((r: any) => ({ id: r.id, label: r.name, parentId: subjectId })));
    })();
  }, [sb, subjectId]);

  useEffect(() => {
    setExercises([]); setExerciseId('');
    if (!chapterId) return;
    (async () => {
      const { data } = await sb
        .from('exercises')
        .select('id, title, chapter_id')
        .eq('chapter_id', chapterId)
        .order('title');
      setExercises((data ?? []).map((r: any) => ({ id: r.id, label: r.title, parentId: chapterId })));
    })();
  }, [sb, chapterId]);

  /* ---------------- Champs Item ---------------- */
  const [ref, setRef] = useState('');
  const [statement, setStatement] = useState('');
  const [solution, setSolution] = useState('');
  const [tagsInput, setTagsInput] = useState(''); // ex: "Mécanique, Théorème"

  // QUESTIONS (JSONB)
  const [questionsMode, setQuestionsMode] = useState<'lines' | 'json'>('lines');
  const [questionsInput, setQuestionsInput] = useState('');
  const [questionsPreview, setQuestionsPreview] = useState<QuestionElem[]>([]);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  function parseQuestions(raw: string, mode: 'lines' | 'json'): QuestionElem[] {
    setQuestionsError(null);
    try {
      if (mode === 'json') {
        if (!raw.trim()) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Le JSON doit être un tableau.');
        for (const el of parsed) {
          const t = typeof el;
          if (t === 'string') continue;
          if (t === 'object' && el) {
            if (typeof el.text !== 'string' || el.text.trim() === '') {
              throw new Error("Chaque objet doit contenir une propriété 'text' (string).");
            }
            if (el.style && !['blank', 'ruled'].includes(el.style)) {
              throw new Error("'style' doit être 'blank' ou 'ruled'.");
            }
            if (el.heightCm && typeof el.heightCm !== 'number') {
              throw new Error("'heightCm' doit être un nombre.");
            }
            if (el.points && typeof el.points !== 'number') {
              throw new Error("'points' doit être un nombre.");
            }
            continue;
          }
          throw new Error('Éléments autorisés: string ou objet { text, style?, heightCm?, points? }');
        }
        return parsed as QuestionElem[];
      }
      // mode 'lines'
      const lines = raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      return lines as QuestionElem[];
    } catch (e: any) {
      setQuestionsError(e?.message ?? 'Format invalide');
      return [];
    }
  }

  useEffect(() => {
    setQuestionsPreview(parseQuestions(questionsInput, questionsMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionsInput, questionsMode]);

  const questionsCount = questionsPreview.length;

  const [saving, setSaving] = useState(false);

  /* ---------------- Soumission ---------------- */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exerciseId) { alert('Sélectionne un exercice (scope)'); return; }
    if (!ref.trim()) { alert('Référence requise'); return; }
    if (questionsError) { alert('Questions: ' + questionsError); return; }

    try {
      setSaving(true);

      const tags = tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const questions = parseQuestions(questionsInput, questionsMode);

      const itemId = await createItemWithMeta({
        ref: ref.trim(),
        statement_md: statement || null,
        solution_md: solution || null,
        exercise_id: exerciseId,
        tag_names: tags,
        // NEW: enregistrement JSONB
        questions,
      });

      alert(`Item créé ✅ (id: ${itemId})`);
      // Option : réinitialiser
      // setRef(''); setStatement(''); setSolution(''); setTagsInput(''); setQuestionsInput(''); setQuestionsMode('lines');
      // setComplexityId(''); setSubjectId(''); setChapterId(''); setExerciseId('');
    } catch (err: any) {
      console.error(err);
      alert('Erreur: ' + (err?.message ?? ''));
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Render ---------------- */
  return (
    <main className="min-h-screen w-full p-4 md:p-6 lg:p-8 bg-neutral-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Nouvel item</h1>
          <a href="/atelier" className="text-sm rounded border px-3 py-2 hover:bg-neutral-50">← Retour Atelier</a>
        </div>

        {/* Scope */}
        <section className="rounded-lg border bg-white p-4 space-y-3">
          <div className="font-medium">Scope</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select label="Complexité" value={complexityId} onChange={(v) => setComplexityId(v)} options={complexities} />
            <Select label="Sujet" value={subjectId} onChange={(v) => setSubjectId(v)} options={subjects} disabled={!complexityId} />
            <Select label="Chapitre" value={chapterId} onChange={(v) => setChapterId(v)} options={chapters} disabled={!subjectId} />
            <Select label="Exercice" value={exerciseId} onChange={setExerciseId} options={exercises} disabled={!chapterId} />
          </div>
        </section>

        {/* Formulaire Item */}
        <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-4 space-y-4">
          <label className="text-sm block">
            <div>Référence *</div>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="ex: add-2-chiffres-0001"
            />
          </label>

          <label className="text-sm block">
            <div>Énoncé (LaTeX/MD)</div>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm min-h-[120px]"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Contenu LaTeX/Markdown de l’énoncé…"
            />
          </label>

          {/* QUESTIONS (JSONB) */}
          <section className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Questions (JSONB)</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">Format:</span>
                <button
                  type="button"
                  onClick={() => setQuestionsMode('lines')}
                  className={`border rounded px-2 py-0.5 ${questionsMode === 'lines' ? 'bg-neutral-800 text-white' : 'bg-white'}`}
                >
                  Une ligne = une question
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionsMode('json')}
                  className={`border rounded px-2 py-0.5 ${questionsMode === 'json' ? 'bg-neutral-800 text-white' : 'bg-white'}`}
                >
                  JSON avancé
                </button>
              </div>
            </div>

            {questionsMode === 'lines' ? (
              <div className="space-y-1">
                <textarea
                  className="w-full border rounded px-2 py-1 text-sm min-h-[120px]"
                  value={questionsInput}
                  onChange={(e) => setQuestionsInput(e.target.value)}
                  placeholder={
                    'Q1 : 1 587 = ____ x 1 000 + ____ x 100 + ____ x 10 + ____ x 1\nQ2 : …\nQ3 : …'
                  }
                />
                <p className="text-xs text-neutral-500">
                  Astuce: écris chaque question sur sa propre ligne. Les séquences d’underscores
                  (<code>____</code>) seront rendues en <em>lignes à compléter</em> lors de la compilation LaTeX.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <textarea
                  className="w-full border rounded px-2 py-1 text-sm min-h-[160px] font-mono"
                  value={questionsInput}
                  onChange={(e) => setQuestionsInput(e.target.value)}
                  placeholder={'[\n  "Q1 : 1 587 = ____ x 1 000 + …",\n  { "text": "Q2 : …", "style": "ruled", "heightCm": 7.5 }\n]'}
                />
                <p className="text-xs text-neutral-500">
                  JSON accepté: tableau de <code>string</code> ou d’objets
                  <code>{'{ text, style?, heightCm?, points? }'}</code>.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="text-neutral-600">Prévisualisation: <strong>{questionsCount}</strong> question(s)</div>
              {questionsError ? (
                <div className="text-red-600">{questionsError}</div>
              ) : null}
            </div>

            {questionsPreview.length > 0 && (
              <ul className="text-xs text-neutral-700 list-disc pl-5 space-y-0.5">
                {questionsPreview.slice(0, 5).map((q, i) => (
                  <li key={i} className="break-words">
                    {typeof q === 'string' ? q : q.text}
                    {typeof q !== 'string' && q.style ? (
                      <span className="ml-1 text-neutral-500">(style: {q.style}{q.heightCm ? `, h=${q.heightCm}cm` : ''})</span>
                    ) : null}
                  </li>
                ))}
                {questionsPreview.length > 5 && (
                  <li className="text-neutral-400">… et {questionsPreview.length - 5} autres</li>
                )}
              </ul>
            )}
          </section>

          <label className="text-sm block">
            <div>Solution (LaTeX/MD)</div>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm min-h-[120px]"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="Contenu LaTeX/Markdown de la solution…"
            />
          </label>

          <label className="text-sm block">
            <div>Tags (séparés par des virgules)</div>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Mécanique, Théorème"
            />
            {/* Aperçu des tags */}
            <div className="mt-2 flex flex-wrap gap-1">
              {tagsInput
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((tag) => (
                  <span key={tag} className="text-[11px] border rounded px-2 py-0.5">
                    {tag}
                  </span>
                ))}
            </div>
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !exerciseId || !ref.trim() || !!questionsError}
              className="rounded bg-black text-white px-3 py-2 text-sm disabled:opacity-60"
              title={!exerciseId ? 'Choisis un exercice (scope)' : undefined}
            >
              {saving ? 'Enregistrement…' : 'Créer l’item'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ---------------- UI helpers ---------------- */
function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  disabled?: boolean;
}) {
  return (
    <label className="text-sm">
      <div>{label}</div>
      <select
        className="w-full border rounded px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!!disabled}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
