import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import YAML from "yaml";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const compilationId = searchParams.get("compilation_id");
    if (!compilationId) return NextResponse.json({ error: "compilation_id requis" }, { status: 400 });

    // 1) Lire compilation + items ordonnés
    const { data: comp, error: cErr } = await supabase
      .from("compilations")
      .select("id, title, description, complexity_id, subject_id, chapter_id, exercise_id")
      .eq("id", compilationId).single();
    if (cErr || !comp) throw cErr || new Error("Compilation introuvable");

    const { data: lines, error: lErr } = await supabase
      .from("compilation_items")
      .select("item_id, order_index, include_solution, items: item_id ( statement_md, solution_md )")
      .eq("compilation_id", compilationId)
      .order("order_index", { ascending: true });
    if (lErr) throw lErr;

    // 2) Construire TeX
    const mainTex = `
\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=22mm]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[french]{babel}
\\usepackage{lmodern}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{hyperref}
\\input{macros.tex}
\\setlength{\\parskip}{0.5em}
\\setlength{\\parindent}{0pt}
\\begin{document}
\\section*{${comp.title?.replace(/&/g,"\\&") ?? "Feuille"}}
\\input{items.tex}
\\newpage
\\section*{Solutions}
\\input{solutions.tex}
\\end{document}
`.trim();

    const macrosTex = `
% Place tes macros LaTeX ici
% \\newcommand{\\R}{\\mathbb{R}}
`.trim();

    const itemsTex = (lines ?? [])
      .map((ln: any, i: number) => `\\paragraph{Exercice ${i+1}.}\n${ln.items?.statement_md ?? ""}\n`)
      .join("\n\n");

    const solutionsTex = (lines ?? [])
      .filter((ln: any) => ln.include_solution !== false)
      .map((ln: any, i: number) => `\\paragraph{Solution ${i+1}.}\n${ln.items?.solution_md ?? ""}\n`)
      .join("\n\n");

    // 3) metadata.yml
    const meta = {
      id: comp.id,
      title: comp.title,
      description: comp.description ?? null,
      anchor_ids: {
        complexity_id: comp.complexity_id,
        subject_id: comp.subject_id,
        chapter_id: comp.chapter_id,
        exercise_id: comp.exercise_id,
      },
      items: (lines ?? []).map((ln: any) => ({
        id: ln.item_id, order: ln.order_index, include_solution: ln.include_solution !== false
      })),
    };
    const metadataYml = YAML.stringify(meta);

    // 4) ZIP
    const zip = new JSZip();
    zip.file("main.tex", mainTex);
    zip.file("macros.tex", macrosTex);
    zip.file("items.tex", itemsTex || "% vide");
    zip.file("solutions.tex", solutionsTex || "% vide");
    zip.file("metadata.yml", metadataYml);
    const buf = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${comp.id}.zip"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
