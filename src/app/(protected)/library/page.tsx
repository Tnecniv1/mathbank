'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

/* ---------- Supabase client ---------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

/* ---------- Types ---------- */
type Lecon = { id: string; ordre: number; titre: string; description: string | null };
type Chapitre = { id: string; ordre: number; titre: string; description: string | null; lecons?: Lecon[] };
type Sujet = { id: string; ordre: number; titre: string; description: string | null; chapitres?: Chapitre[] };
type Niveau = { id: string; ordre: number; titre: string; description: string | null; sujets?: Sujet[] };

type EntrainementIndexRow = {
  id: string;
  niveau_id: string | null;
  sujet_id: string | null;
  chapitre_id: string | null;
  lecon_id: string | null;
};
type CoursIndexRow = EntrainementIndexRow;

/* ---------- Icônes ---------- */
const IconChevron = ({ open }: { open: boolean }) => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d={open ? 'M6 15l6-6 6 6' : 'M9 6l6 6-6 6'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconBook = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M4 19a2 2 0 002 2h12" stroke="currentColor" strokeWidth="2" />
    <path d="M6 3h9a3 3 0 013 3v13" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const IconLayers = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="2" />
    <path d="M3 12l9 5 9-5" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const IconFile = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12V7l-4-4z" stroke="currentColor" strokeWidth="2" />
    <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const Loader = () => (
  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
  </svg>
);

/* ---------- Collapse (CSS) ---------- */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number | string>(open ? '9999px' : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      const h = el.scrollHeight;
      setMaxH(h);
      const id = setTimeout(() => setMaxH('9999px'), 200);
      return () => clearTimeout(id);
    } else {
      const h = el.scrollHeight;
      setMaxH(h);
      requestAnimationFrame(() => setMaxH(0));
    }
  }, [open, children]);

  return (
    <div
      ref={ref}
      className="overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out"
      style={{ maxHeight: typeof maxH === 'number' ? `${maxH}px` : maxH, opacity: open ? 1 : 0 }}
    >
      {children}
    </div>
  );
}

/* ---------- Theme Toggle ---------- */
function ThemeToggle({ theme, toggle }: { theme: 'light' | 'dark'; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/40 transition-colors"
      title="Changer de thème"
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h1M22 12h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7M12 8a4 4 0 000 8 4 4 0 000-8z" stroke="currentColor" strokeWidth="2" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-slate-800" viewBox="0 0 24 24" fill="none">
          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
    </button>
  );
}

/* ---------- Data fetch ---------- */
async function getBibliothequeComplete() {
  try {
    const { data: niveaux, error } = await supabase
      .from('niveau')
      .select(`
        id, ordre, titre, description,
        sujets:sujet (
          id, ordre, titre, description,
          chapitres:chapitre (
            id, ordre, titre, description,
            lecons:lecon ( id, ordre, titre, description )
          )
        )
      `)
      .order('ordre', { ascending: true });

    if (error) throw error;

    niveaux?.forEach((n: any) => {
      n.sujets?.sort((a: any, b: any) => a.ordre - b.ordre);
      n.sujets?.forEach((s: any) => {
        s.chapitres?.sort((a: any, b: any) => a.ordre - b.ordre);
        s.chapitres?.forEach((c: any) => c.lecons?.sort((a: any, b: any) => a.ordre - b.ordre));
      });
    });

    return { data: niveaux as Niveau[], error: null };
  } catch (e: any) {
    console.error(e);
    return { data: null, error: e };
  }
}

async function getEntrainementIndex() {
  const { data, error } = await supabase
    .from('entrainement')
    .select('id, niveau_id, sujet_id, chapitre_id, lecon_id');
  if (error) return { data: null, error };
  return { data: data as EntrainementIndexRow[], error: null };
}

async function getCoursIndex() {
  const { data, error } = await supabase
    .from('cours')
    .select('id, niveau_id, sujet_id, chapitre_id, lecon_id');
  if (error) return { data: null, error };
  return { data: data as CoursIndexRow[], error: null };
}

/* ---------- UI primitives ---------- */
type RowProps = {
  title: string;
  description?: string | null;
  depth: 0 | 1 | 2 | 3;
  open: boolean;
  onToggle: () => void;
  leftIcon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};
const depthStyles: Record<RowProps['depth'], { accent: string; pad: string; border: string; title: string }> = {
  0: { accent: 'text-teal-500', pad: 'pl-0', border: 'border-teal-500/40', title: 'text-xl font-bold' },
  1: { accent: 'text-sky-500', pad: 'pl-5', border: 'border-sky-500/30', title: 'text-lg font-semibold' },
  2: { accent: 'text-indigo-500', pad: 'pl-10', border: 'border-indigo-500/30', title: 'text-base font-medium' },
  3: { accent: 'text-slate-700 dark:text-slate-300', pad: 'pl-14', border: 'border-slate-400/50 dark:border-slate-600/50', title: 'text-base' },
};
const Row = ({ title, description, depth, open, onToggle, leftIcon, actions, children }: RowProps) => {
  const s = depthStyles[depth];
  return (
    <div className={`${s.pad}`}>
      <div
        className={[
          'group rounded-xl px-3 py-2 border transition-all duration-200 cursor-pointer select-none',
          'bg-slate-100/80 dark:bg-slate-800/60 hover:dark:bg-slate-700/60 hover:bg-slate-200/80',
          depth > 0 ? 'border-l-4' : 'border-l-8',
          s.border
        ].join(' ')}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white transition-colors">
            <IconChevron open={open} />
          </span>
          <span className={`${s.accent}`}>{leftIcon}</span>
          <div className="flex-1 min-w-0">
            <div className={`truncate ${s.title}`}>{title}</div>
            {description && <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{description}</div>}
          </div>
          {actions}
        </div>
      </div>
      <Collapse open={open}>
        <div className="pl-6 border-l border-slate-300/60 dark:border-slate-700/60 ml-4 pt-3 pb-2">{children}</div>
      </Collapse>
    </div>
  );
};

function ScopeActions({ onEntrainements, onCours }: { onEntrainements: () => void; onCours: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); onEntrainements(); }}
        className="text-xs md:text-sm px-2 py-1 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/30 hover:bg-teal-500/20"
      >
        Entraînements
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onCours(); }}
        className="text-xs md:text-sm px-2 py-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/30 hover:bg-sky-500/20"
      >
        Cours
      </button>
    </div>
  );
}

/* ---------- Page ---------- */
export default function BibliothequePage() {
  const router = useRouter();

  // data
  const [bibliotheque, setBibliotheque] = useState<Niveau[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // thème
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (stored === 'light' || stored === 'dark') setTheme(stored);
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // expansions
  const [expandedNiveaux, setExpandedNiveaux] = useState<string[]>([]);
  const [expandedSujets, setExpandedSujets] = useState<string[]>([]);
  const [expandedChapitres, setExpandedChapitres] = useState<string[]>([]);

  // sets d’IDs ayant au moins 1 entraînement
  const [hasNiveau, setHasNiveau] = useState<Set<string>>(new Set());
  const [hasSujet, setHasSujet] = useState<Set<string>>(new Set());
  const [hasChapitre, setHasChapitre] = useState<Set<string>>(new Set());
  const [hasLecon, setHasLecon] = useState<Set<string>>(new Set());

  // sets d’IDs ayant au moins 1 cours
  const [hasNiveauCours, setHasNiveauCours] = useState<Set<string>>(new Set());
  const [hasSujetCours, setHasSujetCours] = useState<Set<string>>(new Set());
  const [hasChapitreCours, setHasChapitreCours] = useState<Set<string>>(new Set());
  const [hasLeconCours, setHasLeconCours] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [biblio, idxEntraine, idxCours] = await Promise.all([
        getBibliothequeComplete(),
        getEntrainementIndex(),
        getCoursIndex(),
      ]);

      if (biblio.error) {
        setError(biblio.error.message);
        setLoading(false);
        return;
      }
      setBibliotheque(biblio.data || []);

      // entrainements
      if (!idxEntraine.error && idxEntraine.data) {
        const n = new Set<string>(), s = new Set<string>(), c = new Set<string>(), l = new Set<string>();
        idxEntraine.data.forEach((row) => {
          if (row.niveau_id) n.add(row.niveau_id);
          if (row.sujet_id) s.add(row.sujet_id);
          if (row.chapitre_id) c.add(row.chapitre_id);
          if (row.lecon_id) l.add(row.lecon_id);
        });
        setHasNiveau(n); setHasSujet(s); setHasChapitre(c); setHasLecon(l);
      }

      // cours
      if (!idxCours.error && idxCours.data) {
        const n = new Set<string>(), s = new Set<string>(), c = new Set<string>(), l = new Set<string>();
        idxCours.data.forEach((row) => {
          if (row.niveau_id) n.add(row.niveau_id);
          if (row.sujet_id) s.add(row.sujet_id);
          if (row.chapitre_id) c.add(row.chapitre_id);
          if (row.lecon_id) l.add(row.lecon_id);
        });
        setHasNiveauCours(n); setHasSujetCours(s); setHasChapitreCours(c); setHasLeconCours(l);
      }

      setLoading(false);
      if (biblio.data && biblio.data.length > 0) setExpandedNiveaux([biblio.data[0].id]);
    })();
  }, []);

  // helpers
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const go = (path: string) => router.push(path);
  const goEntrainements = (type: 'niveau' | 'sujet' | 'chapitre' | 'lecon', id: string) =>
    go(`/library/entrainements/${type}/${id}`);
  const goCours = (type: 'niveau' | 'sujet' | 'chapitre' | 'lecon', id: string) =>
    go(`/library/cours/${type}/${id}`);

  /* ---------- UI states ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-teal-500">
          <Loader />
          <span className="text-lg">Chargement de la bibliothèque…</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-white flex items-center justify-center">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600/40 rounded-xl p-6 max-w-md text-slate-800 dark:text-white">
          <h2 className="text-red-600 dark:text-red-300 font-semibold mb-2">Erreur</h2>
          <p>{error}</p>
          <button onClick={() => location.reload()} className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-white">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Render ---------- */
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              <span className="text-slate-800 dark:text-white">Bibliothèque de </span>
              <span className="text-teal-600 dark:text-teal-400">Mathématiques</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Choisis un niveau, puis explore les sujets, chapitres et leçons.</p>
          </div>
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </header>

        {bibliotheque.length === 0 ? (
          <div className="text-center text-slate-500 dark:text-slate-300 py-16 bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-slate-300 dark:border-slate-700/40">
            Aucun contenu disponible pour le moment.
          </div>
        ) : (
          <div className="space-y-4">
            {bibliotheque.map((niveau) => {
              const openN = expandedNiveaux.includes(niveau.id);
              const showN = hasNiveau.has(niveau.id) || hasNiveauCours.has(niveau.id);
              return (
                <Row
                  key={niveau.id}
                  title={niveau.titre}
                  description={niveau.description}
                  depth={0}
                  open={openN}
                  onToggle={() => toggle(setExpandedNiveaux)(niveau.id)}
                  leftIcon={<IconBook />}
                  actions={
                    openN && showN ? (
                      <ScopeActions
                        onEntrainements={() => goEntrainements('niveau', niveau.id)}
                        onCours={() => goCours('niveau', niveau.id)}
                      />
                    ) : null
                  }
                >
                  <div className="space-y-3">
                    {niveau.sujets?.map((sujet) => {
                      const openS = expandedSujets.includes(sujet.id);
                      const showS = hasSujet.has(sujet.id) || hasSujetCours.has(sujet.id);
                      return (
                        <Row
                          key={sujet.id}
                          title={sujet.titre}
                          description={sujet.description}
                          depth={1}
                          open={openS}
                          onToggle={() => toggle(setExpandedSujets)(sujet.id)}
                          leftIcon={<IconLayers />}
                          actions={
                            openS && showS ? (
                              <ScopeActions
                                onEntrainements={() => goEntrainements('sujet', sujet.id)}
                                onCours={() => goCours('sujet', sujet.id)}
                              />
                            ) : null
                          }
                        >
                          <div className="space-y-3">
                            {sujet.chapitres?.map((chapitre) => {
                              const openC = expandedChapitres.includes(chapitre.id);
                              const showC = hasChapitre.has(chapitre.id) || hasChapitreCours.has(chapitre.id);
                              return (
                                <Row
                                  key={chapitre.id}
                                  title={chapitre.titre}
                                  description={chapitre.description}
                                  depth={2}
                                  open={openC}
                                  onToggle={() => toggle(setExpandedChapitres)(chapitre.id)}
                                  leftIcon={<IconFile />}
                                  actions={
                                    openC && showC ? (
                                      <ScopeActions
                                        onEntrainements={() => goEntrainements('chapitre', chapitre.id)}
                                        onCours={() => goCours('chapitre', chapitre.id)}
                                      />
                                    ) : null
                                  }
                                >
                                  <div className="space-y-2 pl-2">
                                    {chapitre.lecons?.map((lecon) => {
                                      const showL = hasLecon.has(lecon.id) || hasLeconCours.has(lecon.id);
                                      return (
                                        <div
                                          key={lecon.id}
                                          className="flex items-start justify-between rounded-lg px-3 py-2 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"
                                        >
                                          <div className="min-w-0 pr-3">
                                            <div className="text-slate-800 dark:text-slate-100">{lecon.titre}</div>
                                            {lecon.description && (
                                              <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                                {lecon.description}
                                              </div>
                                            )}
                                          </div>
                                          {showL && (
                                            <ScopeActions
                                              onEntrainements={() => goEntrainements('lecon', lecon.id)}
                                              onCours={() => goCours('lecon', lecon.id)}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </Row>
                              );
                            })}
                          </div>
                        </Row>
                      );
                    })}
                  </div>
                </Row>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
