// src/app/api/pdfs/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const complexityId = url.searchParams.get('complexityId') || '';
    const subjectId    = url.searchParams.get('subjectId')    || '';
    const chapterId    = url.searchParams.get('chapterId')    || '';
    const exerciseId   = url.searchParams.get('exerciseId')   || '';

    const sb = await createClient();

    // SELECT publié + scope explicite
    let q = sb.from('publications')
      .select('id, ref, title, published_at, published_pdf_path, complexity_id, subject_id, chapter_id, exercise_id')
      .eq('status', 'published')
      .not('published_pdf_path', 'is', null)
      .order('published_at', { ascending: false });

    if (complexityId) q = q.eq('complexity_id', complexityId);
    if (subjectId)    q = q.eq('subject_id',    subjectId);
    if (chapterId)    q = q.eq('chapter_id',    chapterId);
    if (exerciseId)   q = q.eq('exercise_id',   exerciseId);

    const { data: pubs, error } = await q;
    if (error) throw error;

    const items = (pubs ?? []).map((p: any) => {
      const { data } = sb.storage.from('pdfs').getPublicUrl(p.published_pdf_path);
      return {
        id: p.id,
        title: p.title ?? p.ref,
        when: new Date(p.published_at).toLocaleString(),
        url: data.publicUrl,
        // tu peux aussi renvoyer les IDs pour surligner/afficher plus tard
        level: undefined, subject: undefined, chapter: undefined, exercise: undefined,
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
