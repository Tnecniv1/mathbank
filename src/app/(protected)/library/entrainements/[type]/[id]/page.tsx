'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams, useRouter } from 'next/navigation';

/* ---------- Supabase client ---------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

/* ---------- Types ---------- */
type Variante = {
  id: string;
  publication: string;
  variante_no: number;
  url: string | null;
};

type Entrainement = {
  id: string;
  titre: string;
  description: string | null;
  created_at: string;
  variantes: Variante[];
};

type BreadcrumbInfo = {
  titre: string;
  breadcrumb: string[];
};

/* ---------- Icônes ---------- */
const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.4a1 1 0 00-.3-.7L13.3 3.3A1 1 0 0012.6 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const ExternalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const Loader = () => (
  <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"></path>
  </svg>
);

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

/* ---------- Page ---------- */
export default function EntrainementsPage() {
  const params = useParams();
  const router = useRouter();

  const type = params.type as string; // 'niveau' | 'sujet' | 'chapitre' | 'lecon'
  const id = params.id as string;

  const [entrainements, setEntrainements] = useState<Entrainement[]>([]);
  const [info, setInfo] = useState<BreadcrumbInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

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
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    if (type && id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      let breadcrumb: string[] = [];
      let titre = '';

      // ---- Fil d'Ariane & titre selon type ----
      if (type === 'lecon') {
        const { data, error } = await supabase
          .from('lecon')
          .select(`
            titre,
            chapitre:chapitre (
              titre,
              sujet:sujet (
                titre,
                niveau:niveau (titre)
              )
            )
          `)
          .eq('id', id)
          .single();
        if (error) throw error;

        titre = data.titre;
        breadcrumb = [
          data.chapitre?.sujet?.niveau?.titre || '',
          data.chapitre?.sujet?.titre || '',
          data.chapitre?.titre || '',
          titre
        ];
      } else if (type === 'chapitre') {
        const { data, error } = await supabase
          .from('chapitre')
          .select(`
            titre,
            sujet:sujet (
              titre,
              niveau:niveau (titre)
            )
          `)
          .eq('id', id)
          .single();
        if (error) throw error;

        titre = data.titre;
        breadcrumb = [
          data.sujet?.niveau?.titre || '',
          data.sujet?.titre || '',
          titre
        ];
      } else if (type === 'sujet') {
        const { data, error } = await supabase
          .from('sujet')
          .select(`
            titre,
            niveau:niveau (titre)
          `)
          .eq('id', id)
          .single();
        if (error) throw error;

        titre = data.titre;
        breadcrumb = [data.niveau?.titre || '', titre];
      } else if (type === 'niveau') {
        const { data, error } = await supabase
          .from('niveau')
          .select('titre')
          .eq('id', id)
          .single();
        if (error) throw error;

        titre = data.titre;
        breadcrumb = [titre];
      }

      setInfo({ titre, breadcrumb });

      // ---- Entraînements ----
      const column = `${type}_id`;
      const { data: entrainementsData, error: entrainementsError } = await supabase
        .from('entrainement')
        .select(`
          id,
          titre,
          description,
          created_at,
          variantes:entrainement_variante (
            id,
            publication,
            variante_no
          )
        `)
        .eq(column, id)
        .order('created_at', { ascending: false });

      if (entrainementsError) throw entrainementsError;

      const entrainementsWithUrls = (entrainementsData || []).map((e) => ({
        ...e,
        variantes: (e.variantes || [])
          .map((v: any) => {
            let url: string | null = null;
            if (v.publication) {
              if (/^https?:\/\//i.test(v.publication)) {
                url = v.publication;
              } else {
                const { data: publicUrl } = supabase.storage.from('pdfs').getPublicUrl(v.publication);
                url = publicUrl?.publicUrl || null;
              }
            }
            return { ...v, url };
          })
          .sort((a: any, b: any) => a.variante_no - b.variante_no),
      }));

      setEntrainements(entrainementsWithUrls);
    } catch (err: any) {
      console.error('Erreur:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- UI States ---------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white">
        <div className="flex items-center gap-3 text-teal-500">
          <Loader />
          <span className="text-lg">Chargement…</span>
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
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Page ---------- */
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
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>

        {/* Fil d'Ariane + Titre */}
        {info && (
          <div className="mb-8">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              {info.breadcrumb.filter(Boolean).join(' → ')}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              <span className="text-slate-800 dark:text-white">Entraînements</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">{info.titre}</p>
          </div>
        )}

        {/* Grille d'entraînements */}
        {entrainements.length === 0 ? (
          <div className="bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-slate-300 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-500 dark:text-slate-300 text-lg">Aucun entraînement disponible.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {entrainements.map((e) => {
              // Nombre de variantes pour le style "cartes empilées"
              const n = Math.min(e.variantes.length, 3);
              return (
                <div key={e.id} className="relative" style={{ paddingTop: `${Math.min(e.variantes.length * 8, 32)}px` }}>
                  {/* Piles d'arrière-plan (subtiles) */}
                  {n > 1 &&
                    Array.from({ length: n }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute inset-0 rounded-xl border bg-slate-200/60 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                        style={{
                          top: `${i * 8}px`,
                          left: `${i * 4}px`,
                          right: `${-i * 4}px`,
                          zIndex: i,
                          opacity: 0.5 - i * 0.1,
                        }}
                      />
                    ))}

                  {/* Carte principale */}
                  <div
                    className="relative rounded-xl bg-white/80 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
                    style={{ zIndex: 10 }}
                  >
                    <div className="mb-4 flex-1">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{e.titre}</h2>
                      {e.description && (
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">{e.description}</p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {new Date(e.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>

                    {/* Variantes */}
                    {e.variantes.length > 0 && (
                      <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
                        {e.variantes.map((v) => {
                          const enabled = !!v.url;
                          return (
                            <a
                              key={v.id}
                              href={enabled ? v.url! : undefined}
                              target={enabled ? '_blank' : undefined}
                              rel={enabled ? 'noopener noreferrer' : undefined}
                              className={[
                                'flex items-center justify-between p-3 rounded-lg border transition-colors',
                                enabled
                                  ? 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-700 ' +
                                    'dark:bg-teal-500/10 dark:hover:bg-teal-500/20 dark:border-teal-500/30 dark:text-teal-200 cursor-pointer'
                                  : 'bg-slate-100 border-slate-300 text-slate-400 ' +
                                    'dark:bg-slate-700/40 dark:border-slate-600 dark:text-slate-400 cursor-not-allowed'
                              ].join(' ')}
                              onClick={(e2) => {
                                if (!enabled) e2.preventDefault();
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className={enabled ? 'text-teal-600 dark:text-teal-300' : 'text-slate-400'}>
                                  <FileIcon />
                                </span>
                                <span className="font-medium text-sm">
                                  Variante {v.variante_no}
                                </span>
                              </div>
                              {enabled && (
                                <span className="text-teal-600 dark:text-teal-300">
                                  <ExternalIcon />
                                </span>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    )}
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
