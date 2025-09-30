import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service-role bypass RLS
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      anchor_slugs,     // { complexity?, subject?, chapter?, exercise? } (slugs)
      items             // [{ id: uuid, order: number, include_solution?: boolean }]
    } = body || {};

    if (!title || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "title et items requis" }, { status: 400 });
    }

    // Résoudre slugs -> ids (si fournis)
    async function idBySlug(table: string, slug?: string) {
      if (!slug) return null;
      const { data, error } = await supabase.from(table).select("id, slug").eq("slug", slug).limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    }

    let anchor = { complexity_id: null as string|null, subject_id: null as string|null, chapter_id: null as string|null, exercise_id: null as string|null };
    if (anchor_slugs) {
      anchor.complexity_id = await idBySlug("complexities", anchor_slugs.complexity);
      anchor.subject_id    = await idBySlug("subjects",     anchor_slugs.subject);
      anchor.chapter_id    = await idBySlug("chapters",     anchor_slugs.chapter);
      anchor.exercise_id   = await idBySlug("exercises",    anchor_slugs.exercise);
    }

    // Créer la compilation (brouillon)
    const { data: compIns, error: compErr } = await supabase
      .from("compilations")
      .insert({
        title,
        description: description ?? null,
        is_finalized: false,
        ...anchor
      })
      .select("id")
      .single();
    if (compErr) throw compErr;

    const compilationId = compIns.id as string;

    // Insérer les lignes compilation_items
    const rows = items.map((it: any, idx: number) => ({
      compilation_id: compilationId,
      item_id: it.id,
      order_index: it.order ?? (idx + 1),
      include_solution: it.include_solution ?? true,
    }));

    const { error: ciErr } = await supabase.from("compilation_items").insert(rows);
    if (ciErr) throw ciErr;

    return NextResponse.json({ compilation_id: compilationId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
