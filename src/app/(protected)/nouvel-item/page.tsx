'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createItemWithMeta } from '@/app/actions/createItemWithMeta';

type Opt = { id: string; label: string; parentId?: string | null };

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
  const [saving, setSaving] = useState(false);

  /* ---------------- Soumission ---------------- */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exerciseId) { alert('Sélectionne un exercice (scope)'); return; }
    if (!ref.trim()) { alert('Référence requise'); return; }

    try {
      setSaving(true);

      const tags = tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const itemId = await createItemWithMeta({
        ref: ref.trim(),
        statement_md: statement || null,
        solution_md: solution || null,
        exercise_id: exerciseId,
        tag_names: tags,
      });

      alert(`Item créé ✅ (id: ${itemId})`);
      // Option : réinitialiser le formulaire
      // setRef(''); setStatement(''); setSolution(''); setTagsInput('');
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
          <a
            href="/atelier"
            className="text-sm rounded border px-3 py-2 hover:bg-neutral-50"
          >
            ← Retour Atelier
          </a>
        </div>

        {/* Scope */}
        <section className="rounded-lg border bg-white p-4 space-y-3">
          <div className="font-medium">Scope</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              label="Complexité"
              value={complexityId}
              onChange={(v) => setComplexityId(v)}
              options={complexities}
            />
            <Select
              label="Sujet"
              value={subjectId}
              onChange={(v) => setSubjectId(v)}
              options={subjects}
              disabled={!complexityId}
            />
            <Select
              label="Chapitre"
              value={chapterId}
              onChange={(v) => setChapterId(v)}
              options={chapters}
              disabled={!subjectId}
            />
            <Select
              label="Exercice"
              value={exerciseId}
              onChange={setExerciseId}
              options={exercises}
              disabled={!chapterId}
            />
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
              disabled={saving || !exerciseId || !ref.trim()}
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
