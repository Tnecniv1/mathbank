import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const STORAGE_BASE =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pdfs`;

const EVAL_SYSTEM = `Tu es un évaluateur expert en mathématiques.
Tu viens de coacher un élève sur l'exercice {reference} de la feuille "{feuille_titre}".

Tu as accès à :
- Le PDF de la feuille (l'énoncé complet)
- La photo du travail de l'élève
- L'historique complet de la conversation de coaching

Évalue l'exercice et retourne UNIQUEMENT un JSON valide (aucun texte autour) :

Pour un exercice CHAOTIQUE :
{
  "reussi": true,
  "validated": {
    "C1": true, "C2": true, "C3": true, "C4": true,
    "S1": true, "S2": true, "S3": true, "S4": true,
    "R1": true, "R2": true, "R3": true, "R4": true,
    "B1": true
  },
  "note": "remarque courte sur le travail de l'élève"
}

Pour un exercice MÉCANIQUE :
{
  "reussi": true,
  "note": "remarque courte"
}

Critères d'évaluation :
Compréhension :
C1 - Reformuler le problème, définir précisément l'objectif
C2 - Observer et explorer ce que l'on sait, et ce que l'on ne sait pas
C3 - Démarrer quelque part, et converger par itération
C4 - Développer une intuition du problème, et construire une image mentale
Savoir :
S1 - Construire un raisonnement logique, nécessaire et suffisant
S2 - Décrire le problème en langage mathématique, et mettre en équation
S3 - Trouver les algorithmes de travail pertinents, et les exécuter correctement
S4 - Calculer sans erreur, vérifier son brouillon, et le mettre à l'épreuve
Rédaction :
R1 - Respecter la structure, la langue et les conventions de publication
R2 - Décrire l'ensemble du raisonnement, et le prouver par les calculs
R3 - Décrire clairement les gestes, faisant danser élégamment calcul avec la narration
R4 - Faire des dessins pour expliquer les points compliqués
Bilan :
B1 - Est-ce que le problème a été résolu ?

Sois exigeant mais juste. Base-toi sur la photo ET sur la qualité
des échanges pendant le coaching.`;

type ConvMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  // 2. Body
  const body = await req.json();
  const {
    messages,
    feuille_id,
    exercice_numero,
    type,
    reference,
    photo_base64,
    photo_mime,
  }: {
    messages: ConvMessage[];
    feuille_id: string;
    exercice_numero: number;
    type: 'mecanique' | 'chaotique';
    reference: string;
    photo_base64: string;
    photo_mime: string;
    session_start_time: number;
  } = body;

  if (!feuille_id || !photo_base64) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  // 3. Feuille + profil (en parallèle)
  const [{ data: noeud }, { data: profile }] = await Promise.all([
    service.from('noeud').select('titre, type, pdf_url').eq('id', feuille_id).single(),
    service.from('profiles').select('full_name').eq('user_id', user.id).single(),
  ]);

  const feuilleTitre = noeud?.titre ?? 'la feuille';
  const feuilleType  = (type ?? noeud?.type ?? 'mecanique') as 'mecanique' | 'chaotique';
  const fullName     = profile?.full_name ?? '';
  const nameParts    = fullName.trim().split(' ');
  const prenom       = nameParts[0] ?? '';
  const nom          = nameParts.slice(1).join(' ');

  // 4. PDF → base64
  let pdfBase64: string | null = null;
  if (noeud?.pdf_url) {
    const pdfUrl = noeud.pdf_url.startsWith('http')
      ? noeud.pdf_url
      : `${STORAGE_BASE}/${noeud.pdf_url}`;
    try {
      const res = await fetch(pdfUrl);
      if (res.ok) {
        pdfBase64 = Buffer.from(await res.arrayBuffer()).toString('base64');
      }
    } catch (err) {
      console.error('[evaluate] PDF fetch error:', err);
    }
  }

  // 5. System prompt
  const system = EVAL_SYSTEM
    .replace(/{reference}/g, reference)
    .replace(/{feuille_titre}/g, feuilleTitre);

  // 6. Build Anthropic messages
  //    Conversation history (text-only, images stripped by client) → PDF injected in first user msg
  //    Final user message → photo + eval prompt
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      anthropicMessages.push({ role: 'assistant', content: msg.content });
    } else {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (i === 0 && pdfBase64) {
        blocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
        } as Anthropic.RequestDocumentBlock);
      }
      blocks.push({ type: 'text', text: msg.content || '…' });
      anthropicMessages.push({ role: 'user', content: blocks });
    }
  }

  // Ensure last message is from assistant before adding our eval prompt
  // (normal flow: user sent photo, AI responded → last is assistant)
  // If conversation is empty or ends with user, add a dummy assistant ack
  if (anthropicMessages.length === 0 || anthropicMessages[anthropicMessages.length - 1].role === 'user') {
    anthropicMessages.push({ role: 'assistant', content: 'Je vois ton travail.' });
  }

  // Final eval user message: photo + prompt
  const mime = (photo_mime ?? 'image/jpeg') as
    | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  anthropicMessages.push({
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mime, data: photo_base64 } },
      {
        type: 'text',
        text: `Voici la photo du travail de l'élève sur ${reference}. Évalue son travail et retourne uniquement le JSON demandé.`,
      },
    ],
  });

  // 7. Call Claude (non-streaming — on a besoin du JSON complet)
  let claudeText = '';
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system,
      messages: anthropicMessages,
    });
    claudeText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (err) {
    console.error('[evaluate] Claude error:', err);
    return NextResponse.json({ error: 'Erreur IA' }, { status: 500 });
  }

  // 8. Parse JSON (robuste : extrait le premier objet JSON du texte)
  let evalResult: {
    reussi: boolean;
    note: string;
    validated?: Record<string, boolean>;
  };
  try {
    const match = claudeText.match(/\{[\s\S]*\}/);
    evalResult = JSON.parse(match ? match[0] : claudeText);
  } catch (err) {
    console.error('[evaluate] JSON parse error:', err, '— raw:', claudeText);
    return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });
  }

  // 9. Construire le data JSONB complet
  const now = new Date();
  const id  = String(now.getTime());

  const exerciceEntry: Record<string, unknown> = {
    id: `${id}_exo`,
    type: feuilleType,
    reference,
    feuille_id,
    reussi: evalResult.reussi ?? false,
  };

  if (feuilleType === 'chaotique') {
    exerciceEntry.crosses = {
      C1: [], C2: [], C3: [], C4: [],
      S1: [], S2: [], S3: [], S4: [],
      R1: [], R2: [], R3: [], R4: [],
      B1: [],
    };
    exerciceEntry.validated = evalResult.validated ?? {
      C1: false, C2: false, C3: false, C4: false,
      S1: false, S2: false, S3: false, S4: false,
      R1: false, R2: false, R3: false, R4: false,
      B1: false,
    };
  }

  const data = {
    id,
    meta: {
      user_id: user.id,
      nom,
      prenom,
      feuille: feuilleTitre,
      sessions: [{ date: now.toISOString().slice(0, 10), duree: `${Math.round((now.getTime() - (session_start_time ?? now.getTime())) / 60000)}min` }],
      note: evalResult.note ?? '',
    },
    exercices: [exerciceEntry],
    closed: true,
    closedAt: now.toISOString(),
    inserted: false,
  };

  // 10. INSERT dans grille_observation (service-role, bypass RLS)
  const { error: insertError } = await service
    .from('grille_observation')
    .insert({
      id,
      user_id: user.id,
      data,
      closed: true,
      inserted: false,
    });

  if (insertError) {
    console.error('[evaluate] grille_observation insert error:', insertError);
    return NextResponse.json({ error: 'Erreur BDD' }, { status: 500 });
  }

  // Marquer la session conversation comme terminée (fire-and-forget)
  service
    .from('conversation_history')
    .update({ terminee: true })
    .eq('user_id', user.id)
    .eq('feuille_id', feuille_id)
    .eq('exercice_numero', exercice_numero)
    .eq('terminee', false)
    .then(({ error }) => {
      if (error) console.error('[evaluate] conversation_history terminee update error:', error);
    });

  return NextResponse.json({
    success: true,
    grille_id: id,
    reussi: evalResult.reussi,
    note: evalResult.note,
    validated: evalResult.validated ?? null,
    type: feuilleType,
  });
}
