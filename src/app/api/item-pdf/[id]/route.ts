// src/app/api/item-pdf/[id]/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import MarkdownIt from "markdown-it";

export const runtime = "nodejs";

// Normalisation minimale : CRLF -> LF, \\ (SQL) -> \ (KaTeX)
function preprocess(md: string | null | undefined) {
  if (!md) return "";
  return md.replace(/\r\n?/g, "\n").replace(/\\\\/g, "\\").trim();
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // Next 15: params est une Promise
) {
  const { id } = await ctx.params;

  // 1) Récupérer l'item + contexte
  const { data, error } = await supabase
    .from("items")
    .select(`
      id, statement_md, solution_md,
      exercises:exercise_id (
        title,
        chapters:chapter_id (
          name,
          subjects:subject_id (
            name,
            complexities:complexity_id (name)
          )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return new NextResponse("Item introuvable", { status: 404 });
  }

  const ex = data.exercises;
  const ch = ex?.chapters;
  const s  = ch?.subjects;
  const c  = s?.complexities;

  const title = [c?.name, s?.name, ch?.name, ex?.title].filter(Boolean).join(" • ") || "Exercice";

  // 2) Markdown -> HTML (on NE rend PAS KaTeX ici)
  const md = new MarkdownIt({ html: false, breaks: true, typographer: false });
  const statementHTML = md.render(preprocess(data.statement_md));
  const solutionHTML  = data.solution_md ? md.render(preprocess(data.solution_md)) : "";

  // 3) HTML final : KaTeX (CSS + JS + auto-render) sera exécuté par Puppeteer
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
        integrity="sha384-N3y2CHmG0yqg2eQq5ZkD9s9d8qY2z3J7sQXGQEHmq8dXkF0Y4pSTd6QIo7gGUpjv"
        crossorigin="anonymous" />
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    h2 { font-size: 14px; margin: 16px 0 8px; }
    .section { margin-bottom: 12px; }
    .content { font-size: 12px; line-height: 1.45; }
    .katex-display { margin: 10px 0; }
    .katex-display, .katex { page-break-inside: avoid; }
    /* Masquer la sortie accessibilité (MathML) pour éviter tout doublon à l'impression */
    .katex .katex-mathml { display: none !important; }
    .katex .katex-html   { display: inline-block !important; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="section">
    <h2>Énoncé :</h2>
    <div class="content" id="statement">${statementHTML}</div>
  </div>
  ${solutionHTML ? `<div class="section">
    <h2>Solution :</h2>
    <div class="content" id="solution">${solutionHTML}</div>
  </div>` : ``}
</body>
</html>`;

  // 4) Ouvre la page et exécute KaTeX auto-render avant d'imprimer
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // Injecte KaTeX (JS) + auto-render
    await page.addScriptTag({
      url: "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js",
    });
    await page.addScriptTag({
      url: "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js",
    });

    // Rend toutes les maths $...$ et $$...$$
    await page.evaluate(() => {
      // @ts-ignore
      renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$",  right: "$",  display: false },
        ],
        throwOnError: false,
      });
    });

    // Petit délai pour le layout
    await page.waitForTimeout(50);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="exercice-${id}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}


