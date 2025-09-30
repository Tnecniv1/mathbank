// app/actions/markUploaded.ts
'use server';
import { createClient } from '@/utils/supabase/server';

export async function markUploaded(publicationId: string, objectPath: string) {
  const supabase = await createClient(); // ← ICI
  const { error } = await supabase
    .from('publications')
    .update({ status: 'uploaded', uploaded_pdf_path: objectPath })
    .eq('id', publicationId);
  if (error) throw error;
}
