import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // attend un multipart/form-data avec:
    // - compilation_id (text)
    // - pdf (file)
    const form = await req.formData();
    const compilationId = form.get("compilation_id") as string | null;
    const pdf = form.get("pdf") as File | null;
    if (!compilationId || !pdf) {
      return NextResponse.json({ error: "compilation_id et pdf requis" }, { status: 400 });
    }

    // Lire compilation (pour scope + titre)
    const { data: comp, error: cErr } = await supabase
      .from("compilations")
      .select("id, title, complexity_id, subject_id, chapter_id, exercise_id")
      .eq("id", compilationId).single();
    if (cErr || !comp) throw cErr || new Error("Compilation introuvable");

    // Récupérer slugs pour construire un chemin storage hiérarchique
    async function slugById(table: string, id: string | null) {
      if (!id) return null;
      const { data, error } = await supabase.from(table).select("id, slug").eq("id", id).limit(1);
      if (error) throw error;
      return data?.[0]?.slug ?? null;
    }
    const cSlug = await slugById("complexities", comp.complexity_id);
    const sSlug = await slugById("subjects",     comp.subject_id);
    const chSlug= await slugById("chapters",     comp.chapter_id);

    const parts = [cSlug, sSlug, chSlug].filter(Boolean);
    const base  = parts.length ? parts.join("/") + "/" : "";
    const fileName = `${comp.title?.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9\-]/g,"") || comp.id}.pdf`;
    const storagePath = `${base}${fileName}`;

    // Upload PDF vers Storage (bucket 'pdfs', privé)
    const arrayBuf = await pdf.arrayBuffer();
    const { error: upErr } = await supabase.storage.from("pdfs").upload(storagePath, Buffer.from(arrayBuf), {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw upErr;

    // Journaliser l’usage des items + finaliser
    const { data: lines, error: lErr } = await supabase
      .from("compilation_items")
      .select("item_id")
      .eq("compilation_id", compilationId);
    if (lErr) throw lErr;
    if (lines?.length) {
      const usages = lines.map((r: any) => ({ item_id: r.item_id, compilation_id: compilationId, status: "used" }));
      await supabase.from("item_usages").insert(usages);
      try { await supabase.rpc("increment_times_used", { p_item_ids: lines.map((r:any)=>r.item_id) }); } catch {}
    }

    await supabase.from("compilations").update({ is_finalized: true }).eq("id", compilationId);

    // Enregistrer l'artefact PDF
    const { error: artErr } = await supabase.from("pdf_artifacts").insert({
      compilation_id: compilationId,
      storage_path: storagePath,
      is_published: true,
    });
    if (artErr) throw artErr;

    return NextResponse.json({ ok: true, storage_path: storagePath }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
