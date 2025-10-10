'use server';
import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

/* --------------------------------------------------------------------------
 * Server Action: createItemWithMeta
 *  - crée un item (items) avec questions (JSONB)
 *  - upsert des tags et lie dans item_tags
 *  - retourne l'id de l'item créé
 * -------------------------------------------------------------------------- */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // conseillé côté serveur

const supabase = createClient(
  SUPABASE_URL,
  // On privilégie la clé service (RLS bypass pour actions serveur), sinon anon
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  { db: { schema: 'public' } }
);

/* --------------------------------- Schema -------------------------------- */
const QuestionElemSchema = z.union([
  z.string(),
  z.object({
    text: z.string().min(1, "'text' est requis"),
    style: z.enum(['blank', 'ruled']).optional(),
    heightCm: z.number().optional(),
    points: z.number().optional(),
  }),
]);

const PayloadSchema = z.object({
  ref: z.string().min(1),
  statement_md: z.string().nullable().optional(),
  solution_md: z.string().nullable().optional(),
  exercise_id: z.string().min(1), // UUID attendu dans ton schéma
  tag_names: z.array(z.string()).optional().default([]),
  questions: z.array(QuestionElemSchema).optional().default([]),
});

export type CreateItemPayload = z.infer<typeof PayloadSchema>;

/* --------------------------------- Action -------------------------------- */
export async function createItemWithMeta(payload: CreateItemPayload): Promise<string> {
  // Validation forte du payload
  const data = PayloadSchema.parse(payload);

  // Normalisation minimale des tags (trim + unique)
  const tagNames = Array.from(new Set((data.tag_names ?? []).map((t) => t.trim()).filter(Boolean)));

  // 1) Insert item
  const { data: itemRow, error: insertErr } = await supabase
    .from('items')
    .insert({
      ref: data.ref,
      statement_md: data.statement_md ?? null,
      solution_md: data.solution_md ?? null,
      exercise_id: data.exercise_id,
      // Passage natif d'un tableau -> jsonb (supabase-js sérialise en JSONB)
      questions: data.questions ?? [],
    })
    .select('id')
    .single();

  if (insertErr) {
    throw new Error(`Insertion item échouée: ${insertErr.message}`);
  }

  const itemId = itemRow!.id as string;

  // 2) Tags (facultatif)
  if (tagNames.length > 0) {
    // 2a) Upsert des tags par nom
    const { data: upserted, error: upsertErr } = await supabase
      .from('tags')
      .upsert(tagNames.map((name) => ({ name })), { onConflict: 'name' })
      .select('id, name');

    if (upsertErr) {
      // On ne casse pas la création de l'item si les tags posent problème
      console.warn('[createItemWithMeta] Upsert tags error:', upsertErr.message);
    }

    // 2b) Récupération des IDs (les tags existants peuvent ne pas tous revenir via upsert)
    const tagIdByName = new Map<string, string>();
    (upserted ?? []).forEach((t) => tagIdByName.set(t.name, t.id));

    const missing = tagNames.filter((n) => !tagIdByName.has(n));
    if (missing.length > 0) {
      const { data: existing, error: fetchErr } = await supabase
        .from('tags')
        .select('id, name')
        .in('name', missing);
      if (fetchErr) {
        console.warn('[createItemWithMeta] Fetch existing tags error:', fetchErr.message);
      } else {
        (existing ?? []).forEach((t) => tagIdByName.set(t.name, t.id));
      }
    }

    // 2c) Liens item_tags (éviter les doublons)
    const links = tagNames
      .map((n) => tagIdByName.get(n))
      .filter((id): id is string => typeof id === 'string')
      .map((tag_id) => ({ item_id: itemId, tag_id }));

    if (links.length > 0) {
      const { error: linkErr } = await supabase
        .from('item_tags')
        .upsert(links, { onConflict: 'item_id,tag_id' });
      if (linkErr) {
        console.warn('[createItemWithMeta] Link item_tags error:', linkErr.message);
      }
    }
  }

  return itemId;
}
