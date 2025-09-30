// src/app/bibliotheque/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ---------------- Types ---------------- */
type Option = { id: string; label: string };
type Row = {
  id: string;
  title: string;
  when: string;
  url: string;
  level?: string | null;
  subject?: string | null;
  chapter?: string | null;
  exercise?: string | null;
};

/* ---------- Supabase client (client-side) ---------- */
function useSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return useMemo(() => createClient(url, key), [url, key]);
}

/* ----------- Menus de scope (Complexité → Sujet → Chapitre → Exercice) ----------- */
function useScopeMenus() {
  const supabase = useSupabase();

  const [complexities, setComplexities] = useState<Option[]>([]);
  const [subjects, setSubjects]         = useState<Option[]>([]);
  const [chapters, setChapters]         = useState<Option[]>([]);
  const [exercises, setExercises]       = useState<Option[]>([]);

  const [complexityId, setComplexityId] = useState('');
  const [subjectId, setSubjectId]       = useState('');
  const [chapterId, setChapterId]       = useState('');
  const [exerciseId, setExerciseId]     = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('complexities')
        .select('id, name, rank, is_active')
        .eq('is_active', true)
        .order('rank', { ascending: true })
        .order('name', { ascending: true });
      setComplexities((data ?? []).map((r: any) => ({ id: r.id, label: r.name })));
    })();
  }, [supabase]);

  useEffect(() => {
    setSubjects([]); setSubjectId('');
    setChapters([]); setChapterId('');
    setExercises([]); setExerciseId('');
    if (!complexityId) return;
    (async () => {
      const { data } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('complexity_id', complexityId)
        .order('name');
      setSubjects((data ?? []).map((r: any) => ({ id: r.id, label: r.name })));
    })();
  }, [complexityId, supabase]);

  useEffect(() => {
    setChapters([]); setChapterId('');
    setExercises([]); setExerciseId('');
    if (!subjectId) return;
    (async () => {
      const { data } = await supabase
        .from('chapters')
        .select('id, name, order_index')
        .eq('subject_id', subjectId)
        .order('order_index', { ascending: true, nullsFirst: true })
        .order('name');
      setChapters((data ?? []).map((r: any) => ({ id: r.id, label: r.name })));
    })();
  }, [subjectId, supabase]);

  useEffect(() => {
    setExercises([]); setExerciseId('');
    if (!chapterId) return;
    (async () => {
      const { data } = await supabase
        .from('exercises')
        .select('id, title')
        .eq('chapter_id', chapterId)
        .order('title');
      setExercises((data ?? []).map((r: any) => ({ id: r.id, label: r.title })));
    })();
  }, [chapterId, supabase]);

  return {
    complexities, subjects, chapters, exercises,
    complexityId, subjectId, chapterId, exerciseId,
    setComplexityId, setSubjectId, setChapterId, setExerciseId,
  };
}

/* ------------------------- Page ------------------------- */
export default function BibliothequePage() {
  const sb = useSupabase();
  const menus = useScopeMenus();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch direct depuis Supabase: publications publiées + libellés du scope
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        // LEFT JOIN sur les tables de scope pour récupérer les libellés
        let q = sb
          .from('publications')
          .select(`
            id, ref, title, published_at, published_pdf_path,
            complexities:complexity_id ( id, name ),
            subjects:subject_id ( id, name ),
            chapters:chapter_id ( id, name ),
            exercises:exercise_id ( id, title )
          `)
          .eq('status', 'published')
          .not('published_pdf_path', 'is', null)
          .order('published_at', { ascending: false });

        // Filtres par scope (sur publications.*_id)
        if (menus.complexityId) q = q.eq('complexity_id', menus.complexityId);
        if (menus.subjectId)    q = q.eq('subject_id', menus.subjectId);
        if (menus.chapterId)    q = q.eq('chapter_id', menus.chapterId);
        if (menus.exerciseId)   q = q.eq('exercise_id', menus.exerciseId);

        const { data, error } = await q;
        if (error) throw error;

        // Construire les URLs vers le bucket 'pdfs'
        const mapped: Row[] = (data ?? []).map((p: any) => {
          const { data: pu } = sb.storage.from('pdfs').getPublicUrl(p.published_pdf_path);
          return {
            id: p.id,
            title: p.title ?? p.ref,
            when: p.published_at ? new Date(p.published_at).toLocaleString() : '',
            url: pu.publicUrl,
            level:   p.complexities?.name ?? null,
            subject: p.subjects?.name ?? null,
            chapter: p.chapters?.name ?? null,
            exercise: p.exercises?.title ?? null,
          };
        });

        setRows(mapped);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message ?? 'Erreur de chargement');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [sb, menus.complexityId, menus.subjectId, menus.chapterId, menus.exerciseId]);

  return (
    <main className="min-h-screen w-full p-4 md:p-6 lg:p-8 bg-neutral-50">
      <div className="mx-auto max-w-[1100px] space-y-5">
        <h1 className="text-2xl font-semibold">Bibliothèque</h1>

        {/* Filtres */}
        <div className="rounded-lg border bg-white shadow-sm p-3 flex flex-wrap gap-2">
          <Select label="Complexité" value={menus.complexityId} onChange={menus.setComplexityId} options={menus.complexities} />
          <Select label="Sujet"       value={menus.subjectId}    onChange={menus.setSubjectId}    options={menus.subjects}   disabled={!menus.complexityId} />
          <Select label="Chapitre"    value={menus.chapterId}    onChange={menus.setChapterId}    options={menus.chapters}   disabled={!menus.subjectId} />
          <Select label="Exercice"    value={menus.exerciseId}   onChange={menus.setExerciseId}   options={menus.exercises}  disabled={!menus.chapterId} />
        </div>

        {/* Tableau */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-left">
                <Th>Niveau</Th>
                <Th>Sujet</Th>
                <Th>Chapitre</Th>
                <Th>Exercice</Th>
                <Th>Référence</Th>
                <Th className="text-right pr-4">PDF</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TrEmpty>Chargement…</TrEmpty>
              ) : errorMsg ? (
                <TrEmpty>{errorMsg}</TrEmpty>
              ) : rows.length === 0 ? (
                <TrEmpty>Aucun PDF publié pour ce scope.</TrEmpty>
              ) : (
                rows.map((it) => (
                  <tr key={it.id} className="border-t">
                    <Td>{it.level    ?? '—'}</Td>
                    <Td>{it.subject  ?? '—'}</Td>
                    <Td>{it.chapter  ?? '—'}</Td>
                    <Td>{it.exercise ?? '—'}</Td>
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-medium">{it.title}</span>
                        <span className="text-xs text-neutral-500">{it.when}</span>
                      </div>
                    </Td>
                    <Td className="text-right pr-4">
                      <a href={it.url} target="_blank" rel="noreferrer" className="underline">
                        Ouvrir
                      </a>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

/* ------------------- UI helpers ------------------- */
function Select({
  label, value, onChange, options, disabled,
}: { label: string; value: string; onChange: (v: string)=>void; options: Option[]; disabled?: boolean }) {
  return (
    <label className="text-sm flex items-center gap-2">
      <span className="text-neutral-600">{label}</span>
      <select
        className="px-2 py-1 border rounded text-sm"
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        disabled={!!disabled}
      >
        <option value="">Tous</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Th({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <th className={`py-2 px-3 text-xs font-semibold text-neutral-600 ${className ?? ''}`}>{children}</th>;
}
function Td({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <td className={`py-3 px-3 ${className ?? ''}`}>{children}</td>;
}
function TrEmpty({ children }: React.PropsWithChildren) {
  return (
    <tr>
      <td className="py-10 text-center text-neutral-500 text-sm" colSpan={6}>
        {children}
      </td>
    </tr>
  );
}

