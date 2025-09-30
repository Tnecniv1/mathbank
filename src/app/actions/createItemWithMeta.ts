'use server';
import { createClient } from '@/utils/supabase/server';

export async function createItemWithMeta(params: {
  ref: string;
  statement_md?: string;
  solution_md?: string;
  exercise_id: string;
  tag_names?: string[];
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('add_item_with_meta', {
    p_ref: params.ref,
    p_statement_md: params.statement_md ?? null,
    p_solution_md: params.solution_md ?? null,
    p_exercise_id: params.exercise_id,
    p_tag_names: params.tag_names ?? [],
  });

  if (error) throw error;
  return data as string; // item_id
}
