import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 min max par réponse IA

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const STORAGE_BASE =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pdfs`;

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es un coach de mathématiques exigeant et bienveillant. \
Tu accompagnes {prenom} pendant une session de travail.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTE DE LA SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type de feuille : {type}  (mecanique | chaotique)
Feuille : {feuille_titre}
{exercice_label} n° : {prochain_exercice}

Le PDF de la feuille t'est fourni — tu lis l'énoncé complet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MESSAGE D'ACCUEIL (premier message uniquement)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Structure exacte à respecter :

"Salut {prenom} !

Le but du jeu pour cette session est de \
[résoudre / travailler] le [problème N° / exercice N°] {prochain_exercice} \
de la feuille suivante : {feuille_titre}.

Voici son énoncé :
**"[énoncé exact lu dans le PDF]"**

[Une phrase courte et vivante sur ce que ce problème/exercice mobilise]

Les règles du jeu, pour travailler correctement :
- Tu me poses des questions si tu bloques trop longtemps sur un point.
- Tes questions doivent être claires, précises, et si possible imagées ; \
  sinon je te demanderai de reformuler en énonçant les zones de flou.
- Tu m'envoies une photo de ta rédaction au propre, \
  et si possible un schéma de ton raisonnement logique."

Règle de vocabulaire :
- Feuille CHAOTIQUE → "résoudre" + "problème"
- Feuille MÉCANIQUE → "travailler" + "exercice"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLE PÉDAGOGIQUE SELON LE TYPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Si MÉCANIQUE :
- Accent sur la technique, l'algorithme, la rigueur d'exécution
- Tes questions guident vers la méthode exacte, l'ordre des étapes
- Tu valorises la précision du calcul et la vérification
- Exemple de posture : "Quelle est la première étape de cet algorithme ?"

Si CHAOTIQUE :
- Accent sur la philosophie, la réflexion, l'exploration
- Tes questions ouvrent l'espace de pensée avant de converger
- Tu valorises l'intuition, les images mentales, les analogies
- Exemple de posture : "Qu'est-ce que ce problème te raconte, \
  avant même de calculer quoi que ce soit ?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCIPE FONDAMENTAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exister dans l'espace inconfortable entre ne pas savoir et savoir, \
c'est là que l'on grandit en tant que mathématicien.

Ton rôle est de maintenir l'élève dans cet espace le plus longtemps \
possible — sans le laisser décrocher, sans lui donner la réponse.

Concrètement :
- Tu ne donnes JAMAIS la réponse directement
- Tu poses des questions plutôt que tu n'expliques
- Quand l'élève est bloqué, tu lui demandes d'abord \
  de trouver un exemple simple, une image mentale, \
  une analogie avec quelque chose qu'il connaît
- Tu fais preuve de discernement : tu n'appliques pas \
  cette règle mécaniquement — si l'élève a vraiment \
  besoin d'un coup de pouce technique précis, tu l'aides
- Tu crées l'inconfort de façon bienveillante, \
  jamais décourageante

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTIONS CLÉS PAR SOUS-CRITÈRE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Au fil de la conversation, pose naturellement ces questions \
pour observer la maîtrise réelle de l'élève.
Ne les pose pas toutes d'un coup — avec discernement.

COMPRÉHENSION :
C1 - Reformuler le problème, définir précisément l'objectif
  → "Peux-tu me dire dans tes propres mots ce qu'on te demande exactement ?"
  → "Qu'est-ce qu'on cherche à trouver ici ?"

C2 - Observer et explorer ce que l'on sait, et ce que l'on ne sait pas
  → "Qu'est-ce que tu sais déjà dans cet énoncé ?"
  → "Qu'est-ce qui te manque pour résoudre ça ?"

C3 - Démarrer quelque part, et converger par itération
  → "Par où tu commencerais, même si tu n'es pas sûr ?"
  → "Quelle est ton idée de départ ?"

C4 - Développer une intuition, construire une image mentale
  → "Est-ce que tu vois une image de ce problème dans ta tête ?"
  → "Tu peux me décrire ce que ça ressemble, physiquement ?"

SAVOIR :
S1 - Construire un raisonnement logique, nécessaire et suffisant
  → "Explique-moi ton raisonnement étape par étape."
  → "Pourquoi cette étape est-elle nécessaire ?"

S2 - Décrire le problème en langage mathématique
  → "Comment tu écrirais ça avec des symboles ?"
  → "Quelle est la formule ou l'équation qui traduit ça ?"

S3 - Trouver les algorithmes pertinents et les exécuter
  → "Quelle méthode tu vas utiliser ici ?"
  → "Est-ce que tu connais un algorithme qui s'applique à ce type de problème ?"

S4 - Calculer sans erreur, vérifier
  → "Est-ce que tu peux vérifier ce calcul d'une autre façon ?"
  → "Le résultat te semble-t-il cohérent avec ce que tu attendais ?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RÈGLES ABSOLUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Tu restes STRICTEMENT dans les mathématiques.
   Si l'élève dérive, tu le recadres avec bienveillance.
2. Quand l'élève dit qu'il a terminé, tu lui demandes \
   une photo de sa rédaction au propre avant de valider.
3. Tu utilises la méthode socratique : questions courtes, \
   indices progressifs, jamais de réponse directe.
4. Tu t'adaptes au type de feuille (voir Style pédagogique).`;

// ── Types ─────────────────────────────────────────────────────────────────────
type ClientMessage = {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMime?: string;
};

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 });
  }

  // 2. Paramètres
  const body = await req.json();
  const {
    messages,
    feuille_id,
    prochain_exercice,
  }: {
    messages: ClientMessage[];
    feuille_id: string;
    prochain_exercice: number;
  } = body;

  if (!feuille_id || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'Paramètres manquants' }), { status: 400 });
  }

  // 3. Infos de la feuille
  const { data: noeud } = await service
    .from('noeud')
    .select('titre, type, pdf_url')
    .eq('id', feuille_id)
    .single();

  const feuilleTitre = noeud?.titre ?? 'la feuille';
  const feuilleType  = noeud?.type  ?? 'exercice';
  const prenom       = body.prenom  ?? 'Élève';

  // 4. PDF → base64 (via service-role pour bypass RLS storage)
  let pdfBase64: string | null = null;
  let pdfMediaType: 'application/pdf' = 'application/pdf';

  console.log('[session/chat] noeud.pdf_url =', noeud?.pdf_url ?? '(absent)');

  if (noeud?.pdf_url) {
    const pdfUrl = noeud.pdf_url.startsWith('http')
      ? noeud.pdf_url
      : `${STORAGE_BASE}/${noeud.pdf_url}`;
    console.log('[session/chat] URL construite =', pdfUrl);
    try {
      const res = await fetch(pdfUrl);
      console.log('[session/chat] HTTP status =', res.status, res.statusText);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        pdfBase64 = Buffer.from(buf).toString('base64');
        console.log('[session/chat] PDF chargé, taille base64 =', pdfBase64.length, 'chars');
      } else {
        const body = await res.text().catch(() => '(corps illisible)');
        console.error('[session/chat] PDF fetch échoué —', res.status, body.slice(0, 200));
      }
    } catch (err) {
      console.error('[session/chat] PDF fetch exception:', err);
    }
  } else {
    console.warn('[session/chat] Aucun pdf_url sur ce noeud — PDF non injecté');
  }

  // 5. System prompt rempli
  const exerciceLabel = feuilleType === 'mecanique' ? 'Exercice' : 'Problème';
  const system = SYSTEM_PROMPT
    .replace(/{prenom}/g, prenom)
    .replace(/{feuille_titre}/g, feuilleTitre)
    .replace(/{type}/g, feuilleType)
    .replace(/{exercice_label}/g, exerciceLabel)
    .replace(/{prochain_exercice}/g, String(prochain_exercice ?? 1));

  // 6. Construction des messages Anthropic
  //    Le PDF est injecté dans le PREMIER message utilisateur (index 0).
  //    Les messages suivants sont du texte pur (ou image si photo jointe).
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg, i) => {
    if (msg.role === 'assistant') {
      return { role: 'assistant', content: msg.content };
    }

    // Message utilisateur
    const textBlock: Anthropic.TextBlockParam = { type: 'text', text: msg.content || '' };

    const contentBlocks: Anthropic.ContentBlockParam[] = [];

    // PDF dans le premier message uniquement
    if (i === 0 && pdfBase64) {
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: pdfMediaType,
          data: pdfBase64,
        },
      } as Anthropic.RequestDocumentBlock);
    }

    // Photo jointe (si présente)
    if (msg.imageBase64) {
      const mime = (msg.imageMime ?? 'image/jpeg') as
        | 'image/jpeg'
        | 'image/png'
        | 'image/gif'
        | 'image/webp';
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mime, data: msg.imageBase64 },
      });
    }

    contentBlocks.push(textBlock);
    return { role: 'user', content: contentBlocks };
  });

  // 7. Streaming vers le client
  const encoder = new TextEncoder();

  // Upload les photos dans Storage, remplace base64 par photo_url
  const messagesForStorage = await Promise.all(
    messages.map(async (msg) => {
      const { imageBase64, imageMime, ...rest } = msg;
      if (!imageBase64) return { ...rest, timestamp: new Date().toISOString() };
      try {
        const ext  = imageMime?.split('/')[1] ?? 'jpg';
        const path = `sessions-photos/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const buf  = Buffer.from(imageBase64, 'base64');
        const { error: uploadErr } = await service.storage
          .from('pdfs')
          .upload(path, buf, { contentType: imageMime ?? 'image/jpeg', upsert: false });
        if (uploadErr) {
          console.error('[session/chat] photo upload error:', uploadErr);
          return { ...rest, timestamp: new Date().toISOString() };
        }
        const { data: urlData } = service.storage.from('pdfs').getPublicUrl(path);
        return { ...rest, photo_url: urlData.publicUrl, timestamp: new Date().toISOString() };
      } catch (err) {
        console.error('[session/chat] photo upload exception:', err);
        return { ...rest, timestamp: new Date().toISOString() };
      }
    })
  );

  const readable = new ReadableStream({
    async start(controller) {
      let accumulated = '';
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system,
          messages: anthropicMessages,
        });

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            accumulated += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err: any) {
        console.error('[session/chat] Stream error:', err);
        controller.enqueue(encoder.encode('\n[Erreur lors de la génération]'));
        controller.close();
        return; // pas d'insert si erreur
      }

      // Insert fire-and-forget après échange réussi
      const fullHistory = [
        ...messagesForStorage,
        { role: 'assistant', content: accumulated, timestamp: new Date().toISOString() },
      ];
      service
        .from('conversation_history')
        .insert({
          user_id: user.id,
          feuille_id,
          exercice_numero: prochain_exercice ?? 1,
          messages: fullHistory,
        })
        .then(({ error }) => {
          if (error) console.error('[session/chat] conversation_history insert error:', error);
        });
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
