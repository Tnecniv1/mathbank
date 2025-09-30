'use server';
import { createClient } from '@/utils/supabase/server';

type Scope = {
  complexity_id?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  exercise_id?: string | null;
};

export async function createPublication(ref: string, title?: string, scope: Scope = {}) {
  const supabase = await createClient();

  // 1) éviter le doublon
  const { data: existing, error: exErr } = await supabase
    .from('publications')
    .select('id, ref')
    .eq('ref', ref)
    .maybeSingle();
  if (exErr) throw exErr;

  if (existing) {
    // 2) si déjà créé, on met juste à jour titre/scope
    const { error: updErr } = await supabase
      .from('publications')
      .update({ title, ...scope })
      .eq('id', existing.id);
    if (updErr) throw updErr;

    const { data: back } = await supabase
      .from('publications')
      .select('*')
      .eq('id', existing.id)
      .single();
    return back!;
  }

  // 3) sinon on insère
  const { data, error } = await supabase
    .from('publications')
    .insert({ ref, title, ...scope })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
