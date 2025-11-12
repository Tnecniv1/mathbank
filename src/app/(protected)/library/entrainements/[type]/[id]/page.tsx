'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';

// TODO: si tu as déjà un helper Supabase (ex: "@/utils/supabase/client"),
// remplace ce bloc par ton import existant.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// Types de params Next.js App Router : /library/entrainements/[type]/[id]
type PageProps = {
  params: { type: 'niveau' | 'sujet' | 'chapitre' | 'lecon'; id: string };
};

// Types de données
type TagRow = { id: string; titre: string };
type TagPublicationRow = { tags: TagRow | null };

type VarianteRow = {
  id: string;
  publication: string;
  variante_no: number;
  complexite: number | null;
  tags_publication: TagPublicationRow[] | null;
};

type EntrainementRow = {
  id: string;
  titre: string;
  entrainement_variante: VarianteRow[] | null;
};

// Données pour l'UI après mappage (avec URL public résolue)
type VarianteUI = {
  id: string;
  url: string;
  variante_no: number;
  complexite: number | null;
  tags: string[]; // titres
};

// Util: résout l’URL publique si "publication" n’est pas déjà une URL http(s)
function resolvePublicationUrl(supabase: SupabaseClient, publication: string): string {
  if (/^https?:\/\//i.test(publication)) return publication;
  // TODO: adapte le nom du bucket si nécessaire (par défaut "pdfs")
  const { data } = supabase.storage.from('pdfs').getPublicUrl(publication);
  return data.publicUrl;
}

// Petit badge
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
      {children}
    </span>
  );
}

// Carte variante
function VarianteCard({ v }: { v: VarianteUI }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Variante {v.variante_no}</h4>
        {typeof v.complexite === 'number' && (
          <div className="inline-flex items-center text-sm rounded-full px-2 py-0.5 bg-gray-100">
            <span className="mr-1" aria-hidden>
              ★
            </span>
            {v.complexite}/5
          </div>
        )}
      </div>

      <div className="mt-3">
        <a
          href={v.url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Ouvrir le PDF
        </a>
      </div>

      {v.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {v.tags.map((titre) => (
            <Pill key={titre}>&#35; {titre}</Pill>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page({ params }: PageProps) {
  const { type, id } = params;
  const supabase = useMemo(getSupabaseClient, []);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<EntrainementRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      // Sélectionne les entraînements ancrés par type/id, avec variantes + complexité + tags
      const { data, error } = await supabase
        .from('entrainement')
        .select(
          `
          id,
          titre,
          entrainement_variante (
            id,
            publication,
            variante_no,
            complexite,
            tags_publication (
              tags:tags_id ( id, titre )
            )
          )
        `
        )
        .eq(`${type}_id`, id)
        .order('titre', { ascending: true });

      if (error) {
        if (!cancelled) {
          setErrorMsg(error.message);
          setRows([]);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setRows(data as EntrainementRow[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  // Mise en forme UI : chaque entrainement → liste de variantes
  const entrainementsUI = useMemo(() => {
    return (rows ?? []).map((e) => {
      const variantes: VarianteUI[] = (e.entrainement_variante ?? []).map((v) => {
        const url = resolvePublicationUrl(supabase, v.publication);
        const tags =
          (v.tags_publication ?? [])
            .map((tp) => tp?.tags?.titre)
            .filter((x): x is string => !!x) ?? [];
        return {
          id: v.id,
          url,
          variante_no: v.variante_no,
          complexite: typeof v.complexite === 'number' ? v.complexite : null,
          tags,
        };
      });

      // Tri par numéro de variante ascendant
      variantes.sort((a, b) => a.variante_no - b.variante_no);

      return { id: e.id, titre: e.titre, variantes };
    });
  }, [rows, supabase]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Entraînements</h1>
        <p className="text-sm text-zinc-500">
          Scope: <code className="font-mono">{type}</code> /{' '}
          <code className="font-mono">{id}</code>
        </p>
      </header>

      {loading && (
        <div className="text-sm text-zinc-500">Chargement des variantes…</div>
      )}

      {!loading && errorMsg && (
        <div className="text-sm text-red-600">
          Erreur de chargement : {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && entrainementsUI.length === 0 && (
        <div className="text-sm text-zinc-500">
          Aucun entraînement trouvé pour ce périmètre.
        </div>
      )}

      {!loading &&
        !errorMsg &&
        entrainementsUI.map((e) => (
          <section key={e.id} className="mb-10">
            <h2 className="text-xl font-medium mb-3">{e.titre}</h2>

            {e.variantes.length === 0 ? (
              <div className="text-sm text-zinc-500">
                Aucune variante disponible.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {e.variantes.map((v) => (
                  <VarianteCard key={v.id} v={v} />
                ))}
              </div>
            )}
          </section>
        ))}
    </main>
  );
}
