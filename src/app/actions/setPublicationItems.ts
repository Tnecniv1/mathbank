// app/actions/setPublicationItems.ts
'use server';
import { createClient } from '@/utils/supabase/server';

export async function setPublicationItems(publicationId: string, itemIds: string[]) {
  const supabase = await createClient(); // ← ICI

  await supabase.from('publication_items').delete().eq('publication_id', publicationId);
  const rows = itemIds.map((item_id, idx) => ({ publication_id: publicationId, item_id, position: idx + 1 }));
  const { error } = await supabase.from('publication_items').insert(rows);
  if (error) throw error;
}
