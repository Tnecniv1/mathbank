// src/app/pdfs/page.tsx
import { createClient } from '@supabase/supabase-js';
import { getSignedPdfUrl } from "@/lib/storage";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

export default async function PdfsPage() {
  const { data: rows, error } = await supabaseAdmin
    .from('pdf_artifacts')
    .select('id, storage_path, created_at, compilation_id')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return <div className="p-6 text-red-600">Erreur: {error.message}</div>;
  }

  const withUrls = await Promise.all(
    (rows ?? []).map(async r => ({
      ...r,
      url: await getSignedPdfUrl(r.storage_path, 3600),
    }))
  );

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">PDFs publiés</h1>
      <ul className="space-y-2">
        {withUrls.map(r => (
          <li key={r.id} className="flex items-center justify-between rounded border p-3">
            <div className="text-sm">
              <div className="font-medium">{r.storage_path}</div>
              <div className="text-gray-500">Créé le {new Date(r.created_at).toLocaleString()}</div>
            </div>
            <a href={r.url} target="_blank" className="px-3 py-1 rounded bg-black text-white">Ouvrir</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
