'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

/* ---------- Supabase ---------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

/* ---------- Types ---------- */
type CoursFichier = {
  id: string;
  label: string | null;
  path: string;      // chemin dans le bucket 'cours'
  ordre: number;
  created_at: string;
  url?: string | null; // URL publique résolue depuis Storage
};

type Cours = {
  id: string;
  titre: string;
  description: string | null;
  created_at: string;
  cours_fichier?: CoursFichier[];
};

/* ---------- UI Bits ---------- */
const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const FileIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.4a1 1 0 00-.3-.7L13.3 3.3A1 1 0 0012.6 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);
const ExternalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);
const Loader = () => (
  <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
  </svg>
);
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

/* ---------- Helpers ---------- */
function publicUrl(path: string): string | null {
  const { data } = supabase.storage.from('cours').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/* ---------- Page ---------- */
export default function CoursScopePage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const router = useRouter();

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cours, setCours] = useState<Cours[]>([]);
  const [titreScope, setTitreScope] = useState<string>('');
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);

  /* ---------- Theme init ---------- */
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (stored === 'light' || stored === 'dark') setTheme(stored);
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const columnName = useMemo(() => `${type}_id`, [type]); // niveau_id | sujet_id | chapitre_id | lecon_id

  /* ---------- Load data ---------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Titre de scope + breadcrumb
        await fetchScopeInfos();

        // 2) Cours + fichiers pour ce scope
        const { data, error } = await supabase
          .from('cours')
          .select(`
            id,
            titre,
            description,
            created_at,
            cours_fichier:cours_fichier ( id, label, path, ordre, created_at )
          `)
          .eq(columnName as any, id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // 3) Attacher l'URL publique à chaque fichier
        const list: Cours[] = (data || []).map((c: any) => {
          const fichiers: CoursFichier[] = (c.cours_fichier || [])
            .sort((a: CoursFichier, b: CoursFichier) => a.ordre - b.ordre)
            .map((f: CoursFichier) => ({ ...f, url: publicUrl(f.path) }));
          return { ...c, cours_fichier: fichiers };
        });

        setCours(list);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Erreur lors du chargement des cours.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  async function fetchScopeInfos() {
    if (type === 'niveau') {
      const { data } = await supabase.from('niveau').select('titre').eq('id', id).single();
      setTitreScope(data?.titre || 'Niveau');
      setBreadcrumb([data?.titre || 'Niveau']);
    } else if (type === 'sujet') {
      const { data } = await supabase.from('sujet').select('titre, niveau:niveau (titre)').eq('id', id).single();
      setTitreScope(data?.titre || 'Sujet');
      setBreadcrumb([data?.niveau?.titre || '', data?.titre || '']);
    } else if (type === 'chapitre') {
      const { data } = await supabase.from('chapitre').select('titre, sujet:sujet (titre, niveau:niveau (titre))').eq('id', id).single();
      setTitreScope(data?.titre || 'Chapitre');
      setBreadcrumb([data?.sujet?.niveau?.titre || '', data?.sujet?.titre || '', data?.titre || '']);
    } else if (type === 'lecon') {
      const { data } = await supabase
        .from('lecon')
        .select('titre, chapitre:chapitre (titre, sujet:sujet (titre, niveau:niveau (titre)))')
        .eq('id', id)
        .single();
      setTitreScope(data?.titre || 'Leçon');
      setBreadcrumb([
        data?.chapitre?.sujet?.niveau?.titre || '',
        data?.chapitre?.sujet?.titre || '',
        data?.chapitre?.titre || '',
        data?.titre || '',
      ]);
    }
  }

  /* ---------- UI states ---------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white">
        <div className="flex items-center gap-3 text-teal-500">
          <Loader />
          <span className="text-lg">Chargement des cours…</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600/40 rounded-xl p-6 max-w-md text-slate-800 dark:text-white">
          <h2 className="text-red-600 dark:text-red-300 font-semibold mb-2">Erreur</h2>
          <p>{error}</p>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg">
            Retour
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Render ---------- */
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-600 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300 transition-colors"
          >
            <BackIcon />
            <span>Retour à la bibliothèque</span>
          </button>
          <ThemeToggle theme={theme} toggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        </div>

        {/* Breadcrumb + Title */}
        <div className="mb-8">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
            {breadcrumb.filter(Boolean).join(' → ')}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            <span className="text-slate-800 dark:text-white">Cours</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">{titreScope}</p>
        </div>

        {/* Grid of cours */}
        {cours.length === 0 ? (
          <div className="bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-slate-300 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-500 dark:text-slate-300 text-lg">Aucun cours pour ce scope.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cours.map((c) => {
              const n = Math.min(c.cours_fichier?.length || 0, 3);
              return (
                <div key={c.id} className="relative" style={{ paddingTop: `${Math.min(n * 8, 32)}px` }}>
                  {/* Pile subtile */}
                  {n > 1 &&
                    Array.from({ length: n }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute inset-0 rounded-xl border bg-slate-200/60 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                        style={{ top: `${i * 8}px`, left: `${i * 4}px`, right: `${-i * 4}px`, zIndex: i, opacity: 0.5 - i * 0.1 }}
                      />
                    ))}

                  {/* Carte */}
                  <div className="relative rounded-xl bg-white/80 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col" style={{ zIndex: 10 }}>
                    <div className="mb-4 flex-1">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{c.titre}</h2>
                      {c.description && <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">{c.description}</p>}
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {new Date(c.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>

                    {/* Fichiers */}
                    <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
                      {c.cours_fichier && c.cours_fichier.length > 0 ? (
                        c.cours_fichier.map((f) => {
                          const url = f.url || publicUrl(f.path); // garde une dernière chance si pas résolu
                          return (
                            <a
                              key={f.id}
                              href={url || '#'}
                              target={url ? '_blank' : undefined}
                              rel={url ? 'noopener noreferrer' : undefined}
                              className={[
                                'w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left',
                                url
                                  ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700 ' +
                                    'dark:bg-sky-500/10 dark:hover:bg-sky-500/20 dark:border-sky-500/30 dark:text-sky-200'
                                  : 'bg-slate-100 border-slate-300 text-slate-400 ' +
                                    'dark:bg-slate-700/40 dark:border-slate-600 dark:text-slate-400 cursor-not-allowed'
                              ].join(' ')}
                              onClick={(e) => { if (!url) e.preventDefault(); }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sky-600 dark:text-sky-300">
                                  <FileIcon />
                                </span>
                                <span className="font-medium text-sm">
                                  {f.label || 'Fichier'}{f.ordre ? ` · #${f.ordre}` : ''}
                                </span>
                              </div>
                              {url && (
                                <span className="text-sky-600 dark:text-sky-300">
                                  <ExternalIcon />
                                </span>
                              )}
                            </a>
                          );
                        })
                      ) : (
                        <div className="p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/40 text-slate-500 dark:text-slate-300 text-sm">
                          Aucun fichier pour ce cours.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
