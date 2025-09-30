// app/actions/publish.ts
'use server';
import { createClient } from '@/utils/supabase/server';

export async function publish(publicationId: string) {
  const supabase = await createClient(); // ← ICI

  const { data: pub, error: getErr } = await supabase
    .from('publications')
    .select('id, uploaded_pdf_path')
    .eq('id', publicationId)
    .single();
  if (getErr) throw getErr;
  if (!pub?.uploaded_pdf_path) throw new Error('Aucun PDF déposé.');

  const { error: updErr } = await supabase
    .from('publications')
    .update({
      status: 'published',
      published_pdf_path: pub.uploaded_pdf_path,
      published_at: new Date().toISOString(),
    })
    .eq('id', publicationId);
  if (updErr) throw updErr;

  return { objectPath: pub.uploaded_pdf_path };
}
