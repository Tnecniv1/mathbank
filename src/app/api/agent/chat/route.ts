import { createClient } from '@/utils/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type ClientMessage = { role: 'user' | 'assistant'; content: string };
type FeuilleActive = { id: string; titre: string; type: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 });
  }

  const body = await req.json();
  const {
    messages,
    feuilles_actives,
    image_base64,
    image_media_type,
  }: {
    messages:          ClientMessage[];
    feuilles_actives:  FeuilleActive[];
    image_base64?:     string | null;
    image_media_type?: string | null;
  } = body;

  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'messages requis' }), { status: 400 });
  }

  const feuillesList = feuilles_actives?.length > 0
    ? feuilles_actives
        .map((f) => `- ${f.titre} (${f.type === 'mecanique' ? 'Mécanique' : 'Chaotique'})`)
        .join('\n')
    : '(aucune feuille active)';

  const system =
`Tu es Monstro 🟣, un éminent professeur de mathématique capable de pédagogie pour tout niveaux.

L'élève travaille sur les feuilles suivantes :
${feuillesList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROUE D'OBSERVATION — 12 CRITÈRES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
La roue d'observation comporte 12 critères répartis en 3 secteurs :

COMPRÉHENSION :
- C1 : Reformuler le problème, définir précisément l'objectif
- C2 : Explorer ce que l'on sait, et ce que l'on ne sait pas
- C3 : Trouver une idée, démarrer quelque part, et converger par itération
- C4 : Développer une intuition du problème, et construire une image mentale

SAVOIR :
- S1 : Décrire le problème en langage mathématique, et le mettre en équation
- S2 : Construire un raisonnement logique, nécessaire et suffisant
- S3 : Trouver les algorithmes de travail pertinents, et les exécuter correctement
- S4 : Calculer sans faire d'erreur, vérifier son brouillon, et le mettre à l'épreuve

RÉDACTION :
- R1 : Respecter la structure, la langue et les conventions de publication
- R2 : Décrire l'ensemble du raisonnement, et le prouver par les calculs
- R3 : Décrire clairement les gestes, faisant danser élégamment la narration et le calcul
- R4 : Faire des dessins pour expliquer les points compliqués

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TON RÔLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tu accompagnes l'élève dans la correction et la compréhension de ses exercices de mathématiques, tout en l'aidant à remplir sa roue d'observation en temps réel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORKFLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Demande à l'élève sur quelle feuille et quel exercice porte sa question (ex: Exo3). Propose les feuilles actives comme choix.
2. Demande ce qu'il veut : corriger son travail OU obtenir de l'aide pour avancer.
3. L'élève envoie sa photo ou décrit son travail. Engage un ping-pong de correction.
4. À CHAQUE erreur identifiée, indique IMMÉDIATEMENT quel critère est concerné avec ce format exact :
   📍 Croix en [CODE] — [explication courte de l'erreur en lien avec le critère]
   Exemple : 📍 Croix en S4 — tu as fait une erreur de calcul en développant les parenthèses
5. À CHAQUE compétence bien maîtrisée, tu peux le signaler :
   ✅ [CODE] bien maîtrisé — [explication courte]
6. Ne donne jamais la réponse directement en mode aide — guide par questions.
7. En mode correction, sois précis et bienveillant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- La conversation persiste même si l'élève ouvre/ferme le panneau pour remplir sa roue.
- Reste concis — l'élève est en train de travailler en parallèle sur sa roue.
- Utilise des emojis avec modération.`;

  // Construire les messages Anthropic.
  // Le dernier message utilisateur reçoit l'image si présente.
  const hasImage = !!(image_base64 && image_media_type);

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m, i) => {
    if (m.role === 'assistant') {
      return { role: 'assistant', content: m.content };
    }

    // Dernier message utilisateur + image fournie → contenu multimodal
    if (i === messages.length - 1 && hasImage) {
      const mime = image_media_type as
        | 'image/jpeg'
        | 'image/png'
        | 'image/gif'
        | 'image/webp';
      return {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mime, data: image_base64! },
          } as Anthropic.ImageBlockParam,
          { type: 'text', text: m.content || '' } as Anthropic.TextBlockParam,
        ],
      };
    }

    return { role: 'user', content: m.content };
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model:     'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system,
          messages:  anthropicMessages,
        });

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        console.error('[agent/chat]', err);
        controller.enqueue(encoder.encode('\n[Erreur lors de la génération]'));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
