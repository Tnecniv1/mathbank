'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import JSZip from 'jszip';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/* dnd-kit */
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

/* Server Actions (publication) */
import { createPublication } from '@/app/actions/createPublication';
import { setPublicationItems } from '@/app/actions/setPublicationItems';
import { markUploaded } from '@/app/actions/markUploaded';
import { publish } from '@/app/actions/publish';

/* -------------------------------- Types -------------------------------- */
type Option = { id: string; label: string };

// Élément de question : chaîne simple ou objet enrichi
type QuestionElem =
  | string
  | {
      text: string;
      style?: 'blank' | 'ruled';
      heightCm?: number;
      points?: number;
    };

type Item = {
  id: string;
  ref: string;
  statement_md: string | null;
  solution_md: string | null;
  exercise_id: string;
  tags?: string[];
  // NEW: liste de questions JSONB (array de strings ou d'objets)
  questions?: QuestionElem[] | null;
  // (optionnel) overrides pour le rendu
  responseHeightCm?: number;
  responseStyle?: 'blank' | 'ruled';
};

type Exercise = { id: string; chapter_id: string };
type Chapter = { id: string; subject_id: string };
type Subject = { id: string; complexity_id: string };

type Scope = {
  complexity_id?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  exercise_id?: string | null;
};

/* --------------------------- Supabase client --------------------------- */
function useSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return useMemo(() => createClient(url, key), [url, key]);
}

/* ---------------- Helper: clé de stockage sûre ---------------- */
function storageSafeRef(ref: string) {
  const base = ref
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, ''); // accents
  return base
    .replace(/[^a-z0-9._-]+/g, '-') // tout sauf a-z0-9 . _ -
    .replace(/-+/g, '-') // compacter les '-'
    .replace(/^[-.]+|[-.]+$/g, ''); // pas de -/. au début/fin
}

/* --------------------------- Menus (filtres G) -------------------------- */
function useScopeMenus() {
  const supabase = useSupabase();

  const [complexities, setComplexities] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [chapters, setChapters] = useState<Option[]>([]);
  const [exercises, setExercises] = useState<Option[]>([]);

  const [complexityId, setComplexityId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [exerciseId, setExerciseId] = useState('');

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
    setSubjects([]);
    setSubjectId('');
    setChapters([]);
    setChapterId('');
    setExercises([]);
    setExerciseId('');
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
    setChapters([]);
    setChapterId('');
    setExercises([]);
    setExerciseId('');
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
    setExercises([]);
    setExerciseId('');
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
    complexities,
    subjects,
    chapters,
    exercises,
    complexityId,
    subjectId,
    chapterId,
    exerciseId,
    setComplexityId,
    setSubjectId,
    setChapterId,
    setExerciseId,
  };
}

/* --------------------- Menus (scope de la publication) --------------------- */
function usePublicationScopeMenus() {
  const supabase = useSupabase();

  const [complexities, setComplexities] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [chapters, setChapters] = useState<Option[]>([]);
  const [exercises, setExercises] = useState<Option[]>([]);

  const [complexityId, setComplexityId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [exerciseId, setExerciseId] = useState('');

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
    setSubjects([]);
    setSubjectId('');
    setChapters([]);
    setChapterId('');
    setExercises([]);
    setExerciseId('');
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
    setChapters([]);
    setChapterId('');
    setExercises([]);
    setExerciseId('');
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
    setExercises([]);
    setExerciseId('');
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
    complexities,
    subjects,
    chapters,
    exercises,
    complexityId,
    subjectId,
    chapterId,
    exerciseId,
    setComplexityId,
    setSubjectId,
    setChapterId,
    setExerciseId,
  };
}

/* ------------------------ Maps hiérarchiques (G) ------------------------ */
function useScopeMaps() {
  const supabase = useSupabase();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: ex }, { data: ch }, { data: su }] = await Promise.all([
        supabase.from('exercises').select('id, chapter_id'),
        supabase.from('chapters').select('id, subject_id'),
        supabase.from('subjects').select('id, complexity_id'),
      ]);
      setExercises((ex ?? []) as Exercise[]);
      setChapters((ch ?? []) as Chapter[]);
      setSubjects((su ?? []) as Subject[]);
      setLoading(false);
    })();
  }, [supabase]);

  const exToCh = useMemo(() => new Map(exercises.map((e) => [e.id, e.chapter_id])), [exercises]);
  const chToSu = useMemo(() => new Map(chapters.map((c) => [c.id, c.subject_id])), [chapters]);
  const suToCo = useMemo(() => new Map(subjects.map((s) => [s.id, s.complexity_id])), [subjects]);

  return { loading, exToCh, chToSu, suToCo };
}

/* --------------------------- Items (chargement) --------------------------- */
function useAllItems() {
  const supabase = useSupabase();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('items')
        .select(`
          id, ref, statement_md, solution_md, exercise_id, questions,
          item_tags!left( tags(name) )
        `)
        .order('ref');

      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        ref: row.ref,
        statement_md: row.statement_md,
        solution_md: row.solution_md,
        exercise_id: row.exercise_id,
        // questions: tableau JSONB (défaut [])
        questions: Array.isArray(row.questions) ? (row.questions as QuestionElem[]) : [],
        tags: Array.from(
          new Set(
            (row.item_tags ?? [])
              .map((it: any) => it?.tags?.name)
              .filter(Boolean)
          )
        ),
      })) as Item[];

      setItems(mapped);
      setLoading(false);
    })();
  }, [supabase]);

  return { items, loading };
}

/* -------------- Items déjà publiés (pour le filtre "usage") -------------- */
function usePublishedItemIds() {
  const supabase = useSupabase();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: pubs, error } = await supabase
        .from('publications')
        .select('id')
        .eq('status', 'published');

      if (error) {
        setIds(new Set());
        setLoading(false);
        return;
      }

      const pubIds = (pubs ?? []).map((p: any) => p.id);
      if (pubIds.length === 0) {
        setIds(new Set());
        setLoading(false);
        return;
      }

      const { data: links } = await supabase
        .from('publication_items')
        .select('item_id, publication_id')
        .in('publication_id', pubIds);

      setIds(new Set((links ?? []).map((r: any) => r.item_id)));
      setLoading(false);
    })();
  }, [supabase]);

  return { publishedIds: ids, loading };
}

/* ================================= PAGE ================================= */
export default function AtelierPage() {
  const supabase = useSupabase();

  /* Filtres & données */
  const menus = useScopeMenus();
  const { loading: mapsLoading, exToCh, chToSu, suToCo } = useScopeMaps();
  const { items: allItems, loading: itemsLoading } = useAllItems();
  const { publishedIds, loading: publishedLoading } = usePublishedItemIds();

  // Scope du PDF (menus dédiés)
  const pubMenus = usePublicationScopeMenus();

  type Usage = '' | 'published' | 'never';
  const [usageFilter, setUsageFilter] = useState<Usage>('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const loadingAny = itemsLoading || mapsLoading || publishedLoading;

  const filteredItems = useMemo(() => {
    if (loadingAny) return [] as Item[];
    return allItems.filter((it) => {
      const chapterId = exToCh.get(it.exercise_id);
      const subjectId = chapterId ? chToSu.get(chapterId) : undefined;
      const complexityId = subjectId ? suToCo.get(subjectId) : undefined;

      if (menus.complexityId && complexityId !== menus.complexityId) return false;
      if (menus.subjectId && subjectId !== menus.subjectId) return false;
      if (menus.chapterId && chapterId !== menus.chapterId) return false;
      if (menus.exerciseId && it.exercise_id !== menus.exerciseId) return false;

      if (usageFilter === 'published' && !publishedIds.has(it.id)) return false;
      if (usageFilter === 'never' && publishedIds.has(it.id)) return false;

      if (activeTags.length > 0) {
        const ts = it.tags ?? [];
        if (!ts.some((t) => activeTags.includes(t))) return false;
      }
      return true;
    });
  }, [
    loadingAny,
    allItems,
    menus.complexityId,
    menus.subjectId,
    menus.chapterId,
    menus.exerciseId,
    usageFilter,
    activeTags,
    exToCh,
    chToSu,
    suToCo,
    publishedIds,
  ]);

  /* ----------------------- Sélection (DnD) ----------------------- */
  const [selected, setSelected] = useState<Item[]>([]);
  const [activeDrag, setActiveDrag] = useState<Item | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(e: DragStartEvent) {
    const raw = String(e.active.id);
    const id = raw.startsWith('sel-') ? raw.slice(4) : raw;
    const src = filteredItems.find((i) => i.id === id) || selected.find((i) => i.id === id) || null;
    setActiveDrag(src);
  }

  function handleDragEnd(e: DragEndEvent) {
    const a = String(e.active.id);
    const o = e.over ? String(e.over.id) : null;

    // Réordonnage
    if (a.startsWith('sel-') && o && o.startsWith('sel-')) {
      const from = selected.findIndex((i) => 'sel-' + i.id === a);
      const to = selected.findIndex((i) => 'sel-' + i.id === o);
      if (from !== -1 && to !== -1 && from !== to) setSelected((prev) => arrayMove(prev, from, to));
      setActiveDrag(null);
      return;
    }

    // Ajout
    if (o === 'selection-drop') {
      const id = a.startsWith('sel-') ? a.slice(4) : a;
      const it = filteredItems.find((i) => i.id === id) || selected.find((i) => i.id === id);
      if (it && !selected.some((s) => s.id === it.id)) setSelected((prev) => [...prev, it]);
    }

    setActiveDrag(null);
  }

  const removeFromSelection = (id: string) => setSelected((prev) => prev.filter((i) => i.id !== id));

  /* ---------------------- Export / Publication ---------------------- */
  const [refTitle, setRefTitle] = useState('');
  const canExport = refTitle.trim().length > 0 && selected.length > 0;

  // (resté à dispo si utile côté UI titre)
  const latexSafe = (s: string) => s.replace(/([#%&~_^$])/g, '\\$1');

  // Helper: transforme ____ en ligne LaTeX imprimable
  const blanksafe = (s?: string) => (s ?? '').replace(/_{2,}/g, () => String.raw`\makebox[1.6cm]{\hrulefill}`);

  // Helper: extrait le texte d'un élément de question
  function qText(q: QuestionElem): string {
    return typeof q === 'string' ? q : q?.text ?? '';
  }

  // Helper: concatène les questions pour le bloc \begin{reponse} ...
  function renderQuestions(questions?: QuestionElem[] | null): string {
    if (!questions || questions.length === 0) return '';
    // Chaque question sur sa propre ligne (\\). On laisse le LaTeX "brut" et on sécurise seulement les blanks.
    return questions.map((q) => blanksafe(qText(q))).join(' \\\n');
  }

  const normalizeLatexText = (s: string) => (s ?? '').replace(/\\n\\/g, '\n\\');

  function makeMainTex(
    title: string,
    items: Array<{
      ref: string;
      statement_md: string;        // LaTeX
      solution_md?: string;        // LaTeX
      questions?: any[] | null;    // JSONB : éléments contenant du LaTeX
      responseHeightCm?: number;
      responseStyle?: 'blank' | 'ruled';
    }>,
    options?: {
      responseHeightCm?: number;   // défaut 8.0
      extraReserveCm?: number;     // défaut 3.0
      responseStyle?: 'blank' | 'ruled'; // défaut 'blank'
      addParskip?: boolean;        // défaut true
    }
  ) {
    // -------- utilitaires --------
    const latexSafeInner = (s: string) => (s ?? '').replace(/([#$%&_{}~^\\])/g, '\\$1');
    const refRight = (ref: string) => (ref.split('|').pop() ?? ref).trim();

    // Transforme le contenu JSONB « text » en vrai LaTeX
    const decodeJsonbLatex = (s?: string) => {
      if (!s) return '';
      let t = s.replace(/\r\n/g, '\n'); // normalise CRLF
      // ⚠️ NE PAS transformer \n -> newline (sinon on casse \n, \noindent, \node…)
      // Dé-échappe seulement les accolades littérales (venues de l’export JSON)
      t = t.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
      // Tabulations optionnelles
      t = t.replace(/\\t/g, '\t');
      return t;
    };

    const renderQuestionsBlock = (qs: any[] | null | undefined) => {
      const parts = (qs ?? [])
        .map(q => (typeof q === 'string' ? decodeJsonbLatex(q)
                : q && typeof q.text === 'string' ? decodeJsonbLatex(q.text)
                : ''))
        .filter(Boolean);
      return parts.join('\n');
    };

    // -------- options --------
    const responseHGlobal = options?.responseHeightCm ?? 8.0;
    const extraReserve   = options?.extraReserveCm ?? 3.0;
    const defaultStyle: 'blank' | 'ruled' = options?.responseStyle ?? 'blank';
    const addParskip     = options?.addParskip ?? true;

    // -------- LaTeX --------
    return `
  \\documentclass[12pt]{article}
  \\usepackage[utf8]{inputenc}
  \\usepackage[T1]{fontenc}
  \\usepackage[french]{babel}
  \\usepackage{amsmath, amssymb}
  \\usepackage{geometry}
  \\geometry{margin=2cm}
  \\usepackage{graphicx}
  \\usepackage{array}
  \\setlength{\\tabcolsep}{8pt}
  \\renewcommand{\\arraystretch}{1.6}
  ${addParskip ? '\\usepackage{parskip}' : ''}

  \\usepackage{microtype}
  \\usepackage[hidelinks]{hyperref}
  \\usepackage{enumitem}
  \\usepackage{tikz}

  \\title{${latexSafeInner(title)}}
  \\date{}

  % ==== Titres & mise en page ====
  \\usepackage{titlesec}
  \\titleformat{\\subsection}[block]{\\large\\bfseries}{}{0pt}{}
  \\titlespacing*{\\subsection}{0pt}{0.6ex}{0.5ex}

  % ==== Encadrés ====
  \\usepackage[most]{tcolorbox}
  \\tcbset{
    enhanced,
    boxsep=4pt,
    colback=white,
    colframe=black!20,
    arc=2mm,
    before skip=3pt, after skip=5pt
  }

  % Énoncé
  \\newtcolorbox{enonce}{
    breakable,
    colback=black!2, colframe=black!15, left=8pt, right=8pt, top=5pt, bottom=5pt
  }

  % Boîte "réponse" à hauteur fixe (pour zones à remplir)
  \\newtcolorbox{reponse}[1][${responseHGlobal}]{
    colback=white, colframe=black!20, height=#1cm, valign=top
  }

  % Boîte lignée à hauteur fixe
  \\newtcolorbox{reponseLignees}[1][${responseHGlobal}]{
    colback=white, colframe=black!20,
    enhanced, borderline={0.4pt}{0pt}{black!20},
    overlay={%
      \\begin{scope}
        \\clip (frame.south west) rectangle (frame.north east);
        \\pgfmathsetmacro\\H{#1}
        \\foreach \\yy in {0.8,1.6,...,100} {%
          \\ifdim \\yy cm<\\H cm
            \\draw[black!10] ([xshift=4pt]frame.south west) ++(0,\\yy cm) -- ([xshift=-4pt]frame.south east) ++(0,\\yy cm);
          \\fi
        }
      \\end{scope}
    },
    height=#1cm, valign=top
  }

  % ✅ Boîte AUTO-HAUTEUR (pour TikZ & contenu variable) — pas de height=, breakable
  \\newtcolorbox{reponseAuto}{
    breakable,
    enhanced,
    colback=white, colframe=black!20,
    left=4pt, right=4pt, top=4pt, bottom=4pt
  }

  % ==== Pagination "Flex" (max 2 exos/page) ====
  \\usepackage{needspace}
  \\newcounter{exopagecount}
  \\newcommand{\\ExoGate}[1]{%
    \\ifnum\\value{exopagecount}=2
      \\clearpage
      \\setcounter{exopagecount}{0}%
    \\fi
    \\stepcounter{exopagecount}%
    \\Needspace{#1cm}%
  }

  \\begin{document}
  \\raggedbottom
  \\maketitle
  \\thispagestyle{empty}
  \\clearpage

  % ===== ÉNONCÉS =====
  \\section*{Énoncés}
  \\setcounter{exopagecount}{0}

  ${
    items.map((it, i) => {
      const rh = (it.responseHeightCm ?? responseHGlobal).toFixed(2);
      const reserve = (parseFloat(rh) + extraReserve).toFixed(2);
      const qBlock = renderQuestionsBlock(it.questions);

      // Si le bloc contient du TikZ, on passe en boîte auto-hauteur
      const hasTikz = /\\\\begin\\{tikzpicture\\}/.test(qBlock) || /\\begin\\{tikzpicture\\}/.test(qBlock);
      const boxEnv = hasTikz
        ? 'reponseAuto'
        : ((it.responseStyle ?? defaultStyle) === 'ruled' ? 'reponseLignees' : 'reponse');

      const stmt = decodeJsonbLatex(it.statement_md);

      return `
  \\ExoGate{${reserve}}
  \\subsection*{Exercice ${i + 1} — ${latexSafeInner(refRight(it.ref))}}
  \\begin{enonce}
  ${stmt}
  \\end{enonce}
  \\begin{${boxEnv}}${hasTikz ? '' : `[${rh}]`}
  \\noindent
  ${qBlock}
  \\end{${boxEnv}}`.trim();
    }).join('\n\n')
  }

  \\clearpage

  % ===== SOLUTIONS =====
  \\section*{Solutions}
  \\setcounter{exopagecount}{0}

  ${
    items.map((it, i) => {
      const rh = (it.responseHeightCm ?? responseHGlobal).toFixed(2);
      const reserve = (parseFloat(rh) + extraReserve).toFixed(2);
      const sol = decodeJsonbLatex(it.solution_md ?? '');
      return `
  \\ExoGate{${reserve}}
  \\subsection*{Exercice ${i + 1} — ${latexSafeInner(refRight(it.ref))}}
  ${sol}
  \\vspace{0.5cm}`.trim();
    }).join('\n\n')
  }

  \\end{document}
  `.trim();
  }





  const [publicationId, setPublicationId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  function currentScope(): Scope {
    return {
      complexity_id: pubMenus.complexityId || null,
      subject_id: pubMenus.subjectId || null,
      chapter_id: pubMenus.chapterId || null,
      exercise_id: pubMenus.exerciseId || null,
    };
  }

  async function ensurePublication() {
    const ref = refTitle.trim();
    if (!ref) throw new Error('Référence requise');

    let id = publicationId;
    if (!id) {
      const pub = await createPublication(ref, ref, currentScope());
      id = pub.id;
      setPublicationId(id);
    } else {
      await createPublication(ref, ref, currentScope()); // mise à jour du scope
    }
    await setPublicationItems(id!, selected.map((i) => i.id));
    return id!;
  }

  async function handleExportZip() {
    if (!canExport) return;

    const safe = storageSafeRef(refTitle.trim());
    if (!safe) {
      alert('Référence invalide. Choisis un nom non vide.');
      return;
    }

    const zip = new JSZip();
    const main = makeMainTex(refTitle.trim(), selected as any);
    zip.file('main.tex', main);

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    try {
      await ensurePublication();
    } catch {
      alert('Erreur création de publication');
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!refTitle.trim()) {
      alert('Renseigne la Référence PDF');
      e.target.value = '';
      return;
    }

    const safe = storageSafeRef(refTitle.trim());
    if (!safe) {
      alert('Référence invalide. Choisis un nom non vide.');
      e.target.value = '';
      return;
    }

    try {
      setUploading(true);
      const id = await ensurePublication();
      const objectPath = `${safe}.pdf`;

      const { error } = await supabase.storage.from('pdfs').upload(objectPath, file, {
        contentType: 'application/pdf',
        upsert: true,
      });

      if (error) throw error;

      await markUploaded(id, objectPath);
      alert('PDF déposé ✅');
    } catch (err: any) {
      alert('Erreur upload: ' + (err?.message ?? ''));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handlePublish() {
    if (!publicationId) {
      alert('Aucune publication en cours. Dépose d’abord un PDF.');
      return;
    }
    try {
      setPublishing(true);
      await publish(publicationId);
      alert('Publié ✅');
    } catch (err: any) {
      alert('Erreur publication: ' + (err?.message ?? ''));
    } finally {
      setPublishing(false);
    }
  }

  /* -------------------------------- Rendu -------------------------------- */
  return (
    <main className="min-h-screen w-full p-4 md:p-6 lg:p-8 bg-neutral-50">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Atelier — Éditeur de PDF d’exercices</h1>
          {/* NOTE: la page "/nouvel-item" devra être mise à jour pour offrir le champ "Questions" (JSONB). */}
          <Link
            href="/nouvel-item"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <span className="text-base leading-none">＋</span>
            Nouvel item
          </Link>
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          collisionDetection={closestCenter}
        >
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* ---- Colonne gauche : Filtres + Liste scrollable ---- */}
            <div className="lg:col-span-2 rounded-lg border bg-white shadow-sm overflow-hidden">
              {/* Filtres */}
              <div className="border-b px-4 py-3 bg-neutral-50">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-lg font-medium">Ensemble des Items</h2>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={menus.complexityId} onChange={menus.setComplexityId} label="Complexité" options={menus.complexities} />
                    <Select value={menus.subjectId} onChange={menus.setSubjectId} label="Sujet" options={menus.subjects} disabled={!menus.complexityId} />
                    <Select value={menus.chapterId} onChange={menus.setChapterId} label="Chapitre" options={menus.chapters} disabled={!menus.subjectId} />
                    <Select value={menus.exerciseId} onChange={menus.setExerciseId} label="Exercice" options={menus.exercises} disabled={!menus.chapterId} />

                    <select
                      className="px-2 py-1 border rounded-md text-sm"
                      value={usageFilter}
                      onChange={(e) => setUsageFilter(e.target.value as any)}
                    >
                      <option value="">Usage</option>
                      <option value="published">Déjà publiés</option>
                      <option value="never">Jamais publiés</option>
                    </select>

                    <div className="flex items-center gap-3 ml-2">
                      {['Mécanique', 'Chaotique', 'Théorème'].map((tag) => (
                        <label key={tag} className="flex items-center gap-1 text-sm">
                          <input type="checkbox" checked={activeTags.includes(tag)} onChange={() => toggleTag(tag)} />
                          {tag}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Liste scrollable limitée en hauteur */}
              <div className="p-4">
                <div className="max-h-[70vh] overflow-y-auto">
                  {loadingAny ? (
                    <PlaceholderList />
                  ) : filteredItems.length === 0 ? (
                    <EmptyState text="Aucun item avec les filtres actuels" />
                  ) : (
                    <ul className="space-y-2">
                      {filteredItems.map((it) => (
                        <DraggableSource key={it.id} id={it.id}>
                          <ItemCard item={it} published={publishedIds.has(it.id)} />
                        </DraggableSource>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* ---- Colonne droite : 3 rangées DISTINCTES ---- */}
            <div className="lg:col-span-1 rounded-lg border bg-white shadow-sm overflow-visible grid grid-rows-[auto_auto_auto]">
              {/* Rangée 1 : Référence + Scope */}
              <div>
                <div className="border-b px-4 py-3 bg-neutral-50">
                  <h2 className="text-lg font-medium">Sélection des Items</h2>
                </div>
                <div className="p-4 space-y-4">
                  {/* Référence PDF */}
                  <div className="space-y-1">
                    <label htmlFor="pdf-ref" className="text-sm font-medium">
                      Référence PDF
                    </label>
                    <input
                      id="pdf-ref"
                      value={refTitle}
                      onChange={(e) => setRefTitle(e.target.value)}
                      type="text"
                      placeholder="ex. arithmetique-cm1-serie-01"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-neutral-500">
                      Nom du projet Overleaf et du PDF publié (.zip / .pdf).
                    </p>
                  </div>

                  {/* Scope du PDF */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Scope du PDF</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Select
                        value={pubMenus.complexityId}
                        onChange={(v) => {
                          pubMenus.setComplexityId(v);
                          pubMenus.setSubjectId('');
                          pubMenus.setChapterId('');
                          pubMenus.setExerciseId('');
                        }}
                        label="Complexité"
                        options={pubMenus.complexities}
                      />
                      <Select
                        value={pubMenus.subjectId}
                        onChange={(v) => {
                          pubMenus.setSubjectId(v);
                          pubMenus.setChapterId('');
                          pubMenus.setExerciseId('');
                        }}
                        label="Sujet"
                        options={pubMenus.subjects}
                        disabled={!pubMenus.complexityId}
                      />
                      <Select
                        value={pubMenus.chapterId}
                        onChange={(v) => {
                          pubMenus.setChapterId(v);
                          pubMenus.setExerciseId('');
                        }}
                        label="Chapitre"
                        options={pubMenus.chapters}
                        disabled={!pubMenus.subjectId}
                      />
                      <Select
                        value={pubMenus.exerciseId}
                        onChange={pubMenus.setExerciseId}
                        label="Exercice"
                        options={pubMenus.exercises}
                        disabled={!pubMenus.chapterId}
                      />
                    </div>
                    <p className="text-xs text-neutral-500">Ce scope est utilisé pour filtrer la Bibliothèque.</p>
                  </div>
                </div>
              </div>

              {/* Rangée 2 : Items sélectionnés — isolée */}
              <div className="p-4 relative isolate">
                <div className="text-sm font-medium mb-2">Items sélectionnés</div>

                {/* Boîte droppable strictement limitée à la liste */}
                <div className="rounded-md border-2 border-dashed p-3 overflow-hidden">
                  <SelectionDroppable>
                    <SortableContext items={selected.map((i) => 'sel-' + i.id)} strategy={verticalListSortingStrategy}>
                      {selected.length === 0 ? (
                        <EmptyState text="Glisse ici les items à compiler" />
                      ) : (
                        <ul className="space-y-2">
                          {selected.map((it) => (
                            <SortableSelected key={it.id} id={'sel-' + it.id}>
                              <ItemCard item={it} published={publishedIds.has(it.id)}>
                                <button
                                  onClick={() => removeFromSelection(it.id)}
                                  className="text-[11px] px-2 py-0.5 border rounded-md hover:bg-neutral-50"
                                >
                                  Retirer
                                </button>
                              </ItemCard>
                            </SortableSelected>
                          ))}
                        </ul>
                      )}
                    </SortableContext>
                  </SelectionDroppable>
                </div>
              </div>

              {/* Rangée 3 : Actions (totalement séparées) */}
              <div className="p-4 space-y-3 border-t">
                <button
                  type="button"
                  onClick={handleExportZip}
                  disabled={!canExport}
                  className={`w-full rounded-md px-3 py-2 text-sm border shadow-sm ${
                    canExport ? 'hover:bg-neutral-50' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  Exporter ZIP (Overleaf)
                </button>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Déposer PDF</div>
                  <div className="rounded-md border-2 border-dashed p-4 text-sm text-neutral-600">
                    <p className="mb-2">Dépose ici le PDF compilé depuis Overleaf</p>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="block w-full text-sm"
                      onChange={handlePdfUpload}
                      disabled={uploading}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!publicationId || publishing}
                  className="w-full rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  {publishing ? 'Publication…' : 'Publier'}
                </button>
              </div>
            </div>
          </section>

          <DragOverlay>
            {activeDrag ? (
              <ItemCard item={activeDrag} published={selected.some((s) => s.id === activeDrag.id)} ghost />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </main>
  );
}

/* ------------------------------- UI utils ------------------------------- */
function Select({
  value,
  onChange,
  label,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: Option[];
  disabled?: boolean;
}) {
  return (
    <select
      className="px-2.5 py-1.5 border rounded-md text-sm bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!!disabled}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ItemCard({ item, published, ghost, children }: { item: Item; published?: boolean; ghost?: boolean; children?: React.ReactNode }) {
  const qCount = Array.isArray(item.questions) ? item.questions.length : 0;
  return (
    <div className={`rounded-md border px-3 py-2 text-sm bg-white ${ghost ? 'opacity-70 shadow-lg' : 'hover:bg-neutral-50'} shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium truncate">{item.ref}</div>
        <div className="flex items-center gap-2 shrink-0">
          {published && (
            <span className="text-[10px] uppercase text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 font-semibold whitespace-nowrap">
              Publié
            </span>
          )}
          {children}
        </div>
      </div>
      <div className="text-xs text-neutral-600 mt-1 break-words">{item.statement_md ?? '—'}</div>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-neutral-600">
        <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 bg-neutral-50">
          <span>Questions</span>
          <strong>{qCount}</strong>
        </span>
      </div>
      {item.tags && item.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 border rounded-md bg-neutral-50">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* Draggable source (gauche) */
function DraggableSource({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  };
  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </li>
  );
}

/* Droppable (sélection) — uniquement la zone liste */
function SelectionDroppable({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'selection-drop' });
  return (
    <div ref={setNodeRef} className={`min-h-[140px] ${isOver ? 'bg-neutral-50' : ''}`} id="selection-drop-box">
      {children}
    </div>
  );
}

/* Sortable (élément sélectionné) */
function SortableSelected({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab',
  };
  return (
    <li id={id} ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </li>
  );
}

function PlaceholderList() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="h-10 rounded-md bg-neutral-100 animate-pulse" />
      ))}
    </ul>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center text-center">
      <p className="text-sm text-neutral-500">{text}</p>
    </div>
  );
}
