'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
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
  path: string;
  ordre: number;
  created_at: string;
  url?: string | null;
};

type Cours = {
  id: string;
  titre: string;
  description: string | null;
  created_at: string;
  cours_fichier?: CoursFichier[];
};

/* ---------- Helpers ---------- */
function publicUrl(path: string): string | null {
  const { data } = supabase.storage.from('cours').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/* ---------- UI Components ---------- */
function FichierCard({ fichier }: { fichier: CoursFichier }) {
  const url = fichier.url || publicUrl(fichier.path);
  
  return (
    <div className="rounded-2xl border p-4 shadow-sm bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">
          {fichier.label || 'Fichier'}
          {fichier.ordre && (
            <span className="ml-2 text-sm text-zinc-500">#{fichier.ordre}</span>
          )}
        </h4>
      </div>

      <div className="mt-3">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Ouvrir le PDF
          </a>
        ) : (
          <span className="text-sm text-zinc-400">URL indisponible</span>
        )}
      </div>

      <div className="mt-2 text-xs text-zinc-500">
        {new Date(fichier.created_at).toLocaleDateString('fr-FR')}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function CoursScopePage() {
  const { type, id } = useParams<{ type: string; id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cours, setCours] = useState<Cours[]>([]);
  const [titreScope, setTitreScope] = useState<string>('');

  const columnName = useMemo(() => `${type}_id`, [type]);

  /* ---------- Load data ---------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Titre de scope
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
          .order('titre', { ascending: true });

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
    } else if (type === 'sujet') {
      const { data } = await supabase.from('sujet').select('titre').eq('id', id).single();
      setTitreScope(data?.titre || 'Sujet');
    } else if (type === 'chapitre') {
      const { data } = await supabase.from('chapitre').select('titre').eq('id', id).single();
      setTitreScope(data?.titre || 'Chapitre');
    } else if (type === 'lecon') {
      const { data } = await supabase.from('lecon').select('titre').eq('id', id).single();
      setTitreScope(data?.titre || 'Leçon');
    }
  }

  /* ---------- Render ---------- */
  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Cours</h1>
        <p className="text-sm text-zinc-500">
          Scope: <code className="font-mono">{type}</code> /{' '}
          <code className="font-mono">{id}</code>
        </p>
        {titreScope && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {titreScope}
          </p>
        )}
      </header>

      {loading && (
        <div className="text-sm text-zinc-500">Chargement des cours…</div>
      )}

      {!loading && error && (
        <div className="text-sm text-red-600">
          Erreur de chargement : {error}
        </div>
      )}

      {!loading && !error && cours.length === 0 && (
        <div className="text-sm text-zinc-500">
          Aucun cours trouvé pour ce périmètre.
        </div>
      )}

      {!loading &&
        !error &&
        cours.map((c) => (
          <section key={c.id} className="mb-10">
            <h2 className="text-xl font-medium mb-3">{c.titre}</h2>
            
            {c.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                {c.description}
              </p>
            )}

            {!c.cours_fichier || c.cours_fichier.length === 0 ? (
              <div className="text-sm text-zinc-500">
                Aucun fichier disponible.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {c.cours_fichier.map((fichier) => (
                  <FichierCard key={fichier.id} fichier={fichier} />
                ))}
              </div>
            )}
          </section>
        ))}
    </main>
  );
}
