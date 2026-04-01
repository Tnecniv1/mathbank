'use client';

import React, {
  use,
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { supabase } from '@/lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type RoueEnCours = {
  roue_id: string;
  reference: string;
  validated: Record<string, boolean | null> | null;
  type: 'mecanique' | 'chaotique';
};

type Feuille = {
  id: string;
  titre: string;
  type: 'mecanique' | 'chaotique';
  pdf_url: string | null;
  prochain_exercice: number;
  roue_en_cours?: RoueEnCours;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMime?: string;
  imagePreview?: string;
  photo_url?: string;
};

type SessionContext = {
  feuilles: Feuille[];
  profil: { full_name: string };
};

type EvalResult = {
  reussi: boolean;
  note: string;
  validated: Record<string, boolean> | null;
  type: 'mecanique' | 'chaotique';
};

type HistoryEntry = {
  id: string;
  exercice_numero: number;
  terminee: boolean;
  messages: { role: 'user' | 'assistant'; content: string; timestamp?: string; photo_url?: string }[];
  created_at: string;
};

// ── Constantes ────────────────────────────────────────────────────────────────

const STORAGE_BASE =
  'https://rvonutomiuvsxjxeuipq.supabase.co/storage/v1/object/public/pdfs';

function pdfUrl(pdf_url: string | null): string | null {
  if (!pdf_url) return null;
  return `${STORAGE_BASE}/${pdf_url}`;
}

// ── Rendu LaTeX + Markdown léger ──────────────────────────────────────────────

function renderContent(text: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const renderLatex = (src: string): string => {
    src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
      catch { return escapeHtml(`$$${math}$$`); }
    });
    src = src.replace(/\$([^$\n]+?)\$/g, (_, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
      catch { return escapeHtml(`$${math}$`); }
    });
    return src;
  };

  const lines = text.split('\n');
  const html = lines.map((line) => {
    let out = renderLatex(escapeHtml(line));
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^-\s/.test(line)) {
      out = `<span class="block pl-3 before:content-['–'] before:mr-2">${out.replace(/^-\s/, '')}</span>`;
    }
    return out;
  });
  return html.join('<br />');
}

// ── Composant Bulle ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message | { role: 'user' | 'assistant'; content: string; photo_url?: string } }) {
  const isUser = msg.role === 'user';
  const imagePreview = 'imagePreview' in msg ? msg.imagePreview : undefined;
  const photoUrl = msg.photo_url;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-[#185FA5] text-white rounded-br-sm'
          : 'bg-white border border-[#E8E8E8] text-[#1A1A1A] rounded-bl-sm'
      }`}>
        {(imagePreview || photoUrl) && (
          <img src={imagePreview ?? photoUrl} alt="photo"
               className="rounded-xl mb-2 max-w-[240px] border border-[#E8E8E8] object-contain" />
        )}
        <div className="katex-content"
             dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AssistePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const entrainementId = use(params).id;

  // Contexte
  const [ctx, setCtx] = useState<SessionContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);

  // Type actif (détermine quelle feuille est active)
  const [type, setType] = useState<'mecanique' | 'chaotique'>('mecanique');

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);

  // Évaluation
  const [currentExercice, setCurrentExercice] = useState<number>(1);
  const [lastPhotoSent, setLastPhotoSent] = useState<{ base64: string; mime: string } | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvalResult | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Historique
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<HistoryEntry | null>(null);

  // Roue en cours
  const [roueEnCoursActif, setRoueEnCoursActif] = useState<RoueEnCours | null>(null);

  // PDF
  const [pdfOpen, setPdfOpen] = useState(false);

  // Photo
  const photoRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<{
    base64: string; mime: string; preview: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);

  // ── Lire session_id depuis l'URL ────────────────────────────────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session_id');
    if (id) setSessionId(id);
  }, []);

  // ── Chargement du contexte ──────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/session/context')
      .then((r) => r.json())
      .then((data: SessionContext) => {
        setCtx(data);
        // Par défaut : si pas de feuille méca, basculer sur chaotique
        const hasMeca = data.feuilles.some((f) => f.type === 'mecanique');
        if (!hasMeca) setType('chaotique');
        setCtxLoading(false);
      })
      .catch((err) => {
        setCtxError(err.message ?? 'Erreur de chargement');
        setCtxLoading(false);
      });
  }, []);

  // Scroll automatique
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiTyping]);

  // Feuille active dérivée du type
  const feuille: Feuille | null = ctx?.feuilles.find((f) => f.type === type) ?? null;
  const feuilleId = feuille?.id ?? '';

  // Chargement historique quand feuilleId change
  useEffect(() => {
    if (!feuilleId) { setHistory([]); return; }
    setHistoryLoading(true);
    fetch(`/api/session/history?feuille_id=${feuilleId}`)
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [feuilleId]);

  const prenom = ctx?.profil.full_name.split(' ')[0] ?? 'Élève';

  const sessionEnCours: HistoryEntry | null =
    feuille && !started
      ? (history.find(
          (e) => !e.terminee && e.exercice_numero === feuille.prochain_exercice
        ) ?? null)
      : null;

  const hasFeuilleMeca = ctx?.feuilles.some((f) => f.type === 'mecanique') ?? false;
  const hasFeuilleChaos = ctx?.feuilles.some((f) => f.type === 'chaotique') ?? false;

  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Entraînement fourni par params ──────────────────────────────────────
  const ensureEntrainement = useCallback(async (): Promise<string | null> => {
    return entrainementId;
  }, [entrainementId]);

  // ── Boucler l'entraînement ─────────────────────────────────────────────
  const bouclerEntrainement = useCallback(async () => {
    await supabase
      .from('entrainement')
      .update({ statut: 'boucle', updated_at: new Date().toISOString() })
      .eq('id', entrainementId);
  }, [entrainementId]);

  // ── Envoi d'un message + streaming ─────────────────────────────────────
  const sendMessage = useCallback(async (overrideContent?: string) => {
    if (!feuille) return;
    const text = overrideContent ?? input.trim();
    if (!text && !pendingImage) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      imageBase64: pendingImage?.base64,
      imageMime: pendingImage?.mime,
      imagePreview: pendingImage?.preview,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    if (pendingImage) setLastPhotoSent({ base64: pendingImage.base64, mime: pendingImage.mime });
    setPendingImage(null);
    setSending(true);
    setAiTyping(true);

    try {
      const chatBody: Record<string, unknown> = {
        messages: nextMessages.map(({ imagePreview: _, ...m }) => m),
        feuille_id: feuille.id,
        prochain_exercice: currentExercice,
        prenom,
      };
      if (roueEnCoursActif) chatBody.roue_en_cours = roueEnCoursActif;
      if (entrainementId) chatBody.entrainement_id = entrainementId;

      const res = await fetch('/api/session/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody),
      });

      if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      setAiTyping(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: accumulated }]);
      }
    } catch (err) {
      setAiTyping(false);
      setMessages((prev) => [...prev, {
        role: 'assistant', content: '⚠️ Une erreur est survenue. Réessaie dans un instant.',
      }]);
    } finally {
      setSending(false);
    }
  }, [feuille, input, messages, pendingImage, prenom, currentExercice, roueEnCoursActif, entrainementId]);

  // ── Démarrage de la session ─────────────────────────────────────────────
  const startSession = useCallback(async (
    exerciceOverride?: number,
    roueEnCours?: RoueEnCours,
    targetType?: 'mecanique' | 'chaotique',
  ) => {
    // Résoudre le type effectif et la feuille correspondante
    const effectiveType = targetType ?? type;
    if (targetType && targetType !== type) setType(targetType);

    const targetFeuille = ctx?.feuilles.find((f) => f.type === effectiveType) ?? null;
    if (!targetFeuille) return;

    const entId = await ensureEntrainement();

    const exo = exerciceOverride ?? targetFeuille.prochain_exercice;
    setCurrentExercice(exo);
    setSessionStartTime(Date.now());
    setRoueEnCoursActif(roueEnCours ?? null);
    setStarted(true);
    setMessages([{ role: 'user', content: 'Démarre la session.' }]);
    setLastPhotoSent(null);
    setEvaluation(null);
    setSending(true);
    setAiTyping(true);

    try {
      const startBody: Record<string, unknown> = {
        messages: [{ role: 'user', content: 'Démarre la session.' }],
        feuille_id: targetFeuille.id,
        prochain_exercice: exo,
        prenom,
      };
      if (roueEnCours) startBody.roue_en_cours = roueEnCours;
      if (entId) startBody.entrainement_id = entId;

      const res = await fetch('/api/session/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(startBody),
      });

      if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      setAiTyping(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: accumulated }]);
      }
    } catch (err) {
      setAiTyping(false);
      setMessages((prev) => [...prev, {
        role: 'assistant', content: '⚠️ Impossible de démarrer la session.',
      }]);
    } finally {
      setSending(false);
    }
  }, [ctx, type, prenom, ensureEntrainement]);

  // ── Évaluation de l'exercice ────────────────────────────────────────────
  const handleEvaluate = useCallback(async () => {
    if (!feuille || !lastPhotoSent) return;
    setEvaluating(true);
    try {
      const evalBody: Record<string, unknown> = {
        messages: messages.map(({ imagePreview: _p, imageBase64: _b, imageMime: _m, ...m }) => m),
        feuille_id: feuille.id,
        exercice_numero: currentExercice,
        type: feuille.type,
        reference: roueEnCoursActif?.reference ?? `Exo${currentExercice}`,
        photo_base64: lastPhotoSent.base64,
        photo_mime: lastPhotoSent.mime,
        session_start_time: sessionStartTime ?? Date.now(),
      };
      if (roueEnCoursActif) evalBody.roue_id = roueEnCoursActif.roue_id;
      if (entrainementId) evalBody.entrainement_id = entrainementId;

      const res = await fetch('/api/session/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evalBody),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setEvaluation({
        reussi: data.reussi,
        note: data.note,
        validated: data.validated ?? null,
        type: data.type ?? feuille.type,
      });
    } catch (err) {
      console.error('[evaluate]', err);
    } finally {
      setEvaluating(false);
    }
  }, [feuille, lastPhotoSent, messages, currentExercice, roueEnCoursActif, sessionStartTime, entrainementId]);

  // ── Reprise d'une session interrompue ───────────────────────────────────
  const handleReprendre = useCallback(async (entry: HistoryEntry) => {
    if (!feuille) return;
    const exo = entry.exercice_numero;
    setCurrentExercice(exo);
    setSessionStartTime(Date.now());

    const restoredMessages: Message[] = entry.messages.map((m) => ({
      role: m.role, content: m.content, photo_url: m.photo_url,
    }));
    setMessages(restoredMessages);
    setStarted(true);
    setLastPhotoSent(null);
    setEvaluation(null);
    setSending(true);
    setAiTyping(true);

    const entId = await ensureEntrainement();

    const resumeMessages = [
      ...restoredMessages.map(({ imagePreview: _, ...m }) => m),
      { role: 'user' as const, content: 'Je reprends la session.' },
    ];
    try {
      const body: Record<string, unknown> = {
        messages: resumeMessages,
        feuille_id: feuille.id,
        prochain_exercice: exo,
        prenom,
        reprise: true,
      };
      if (entId) body.entrainement_id = entId;

      const res = await fetch('/api/session/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      setAiTyping(false);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: accumulated }]);
      }
    } catch {
      setAiTyping(false);
      setMessages((prev) => [...prev, {
        role: 'assistant', content: '⚠️ Impossible de reprendre la session.',
      }]);
    } finally {
      setSending(false);
    }
  }, [feuille, prenom, ensureEntrainement]);

  // ── Gestion photo ───────────────────────────────────────────────────────
  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      setPendingImage({ base64, mime, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Rendu ───────────────────────────────────────────────────────────────

  if (ctxLoading) {
    return (
      <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center">
        <span className="text-sm text-[#999]">Chargement de la session…</span>
      </div>
    );
  }

  if (ctxError) {
    return (
      <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm text-center">
          <p className="text-red-700 text-sm">{ctxError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F4EF] flex flex-col">

      {/* ── Bloc de contrôle ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8E8E8] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* Gauche : retour + contexte */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(`/entrainement/${entrainementId}`)}
              className="text-sm text-[#185FA5] font-medium shrink-0 hover:underline"
            >
              ← Retour
            </button>
            <div className="min-w-0">
              <div className="text-[11px] text-[#AAAAAA] leading-tight">
                {today} ·{' '}
                <span className={type === 'mecanique' ? 'text-[#185FA5]' : 'text-[#534AB7]'}>
                  {type === 'mecanique' ? 'Mécanique' : 'Chaotique'}
                </span>
              </div>
              {feuille ? (
                <div className="text-sm font-semibold text-[#1A1A1A] truncate">
                  {feuille.titre}
                  <span className="font-normal text-[#AAAAAA] ml-1.5">
                    — Exo {started ? currentExercice : feuille.prochain_exercice}
                  </span>
                </div>
              ) : (
                <div className="text-sm text-[#AAAAAA]">Aucune feuille active</div>
              )}
            </div>
          </div>

          {/* Droite : PDF + Terminer plus tard */}
          <div className="flex items-center gap-3 shrink-0">
            {feuille?.pdf_url && (
              <button
                onClick={() => setPdfOpen(true)}
                className="text-xs text-[#185FA5] underline hover:no-underline"
              >
                PDF
              </button>
            )}
            <button
              onClick={() => router.push(`/entrainement/${entrainementId}`)}
              className="text-xs text-[#AAAAAA] hover:text-[#555] transition-colors"
            >
              Terminer plus tard
            </button>
          </div>
        </div>

        {/* Toggle type — visible seulement avant démarrage */}
        {!started && (
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={() => setType('mecanique')}
              disabled={!hasFeuilleMeca}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${type === 'mecanique'
                  ? 'bg-[#185FA5] text-white'
                  : 'bg-[#F3F3F3] text-[#555] hover:bg-[#E8E8E8]'}
                ${!hasFeuilleMeca ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              Mécanique
            </button>
            <button
              onClick={() => setType('chaotique')}
              disabled={!hasFeuilleChaos}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${type === 'chaotique'
                  ? 'bg-[#534AB7] text-white'
                  : 'bg-[#F3F3F3] text-[#555] hover:bg-[#E8E8E8]'}
                ${!hasFeuilleChaos ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              Chaotique
            </button>
          </div>
        )}
      </div>

      {/* ── Pas de feuille pour ce type ───────────────────────────────────── */}
      {!feuille && !started && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-8 max-w-sm text-center space-y-2">
            <p className="text-sm font-medium text-[#1A1A1A]">
              Tu n'as pas de feuille {type === 'mecanique' ? 'mécanique' : 'chaotique'} active.
            </p>
            <p className="text-xs text-[#999]">
              Va dans la bibliothèque pour en ajouter une.
            </p>
          </div>
        </div>
      )}

      {/* ── Écran de démarrage ────────────────────────────────────────────── */}
      {feuille && !started && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center px-4 py-6 gap-6 max-w-lg mx-auto">

            {/* Card session en cours (reprise) */}
            {sessionEnCours && (
              <div className="bg-[#FFF8E7] border border-[#F5D48B] rounded-2xl p-6 w-full space-y-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#8B6800]">⚡ Session en cours</p>
                  <p className="text-sm text-[#555]">
                    Tu as une session interrompue sur l'exercice n°{sessionEnCours.exercice_numero} —{' '}
                    {new Date(sessionEnCours.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-[#999]">{sessionEnCours.messages.length} messages échangés</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReprendre(sessionEnCours)}
                    disabled={sending}
                    className="flex-1 py-2.5 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                               hover:bg-[#1450A3] transition-colors disabled:opacity-40"
                  >
                    {sending ? 'Connexion…' : 'Reprendre →'}
                  </button>
                  <button
                    onClick={() => startSession()}
                    disabled={sending}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                               font-semibold text-sm hover:bg-[#F5F5F5] transition-colors disabled:opacity-40"
                  >
                    Nouvelle session
                  </button>
                </div>
              </div>
            )}

            {/* Card roue en cours (observée en classe) */}
            {!sessionEnCours && feuille.roue_en_cours && (
              <div className="bg-[#F0F4FF] border border-[#B0C4DE] rounded-2xl p-6 w-full space-y-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#2D3A8C]">
                    Exercice en cours — {feuille.roue_en_cours.reference}
                  </p>
                  <p className="text-sm text-[#555]">Commencé en classe — critères partiellement observés</p>
                </div>
                {feuille.roue_en_cours.validated && (
                  <div className="grid grid-cols-4 gap-1">
                    {Object.entries(feuille.roue_en_cours.validated).map(([key, val]) => (
                      <div key={key} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${
                        val ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-[#AAAAAA]'
                      }`}>
                        <span>{val ? '✓' : '○'}</span>
                        <span>{key}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    const ref = feuille.roue_en_cours!.reference;
                    const exoNum = parseInt(ref.replace(/\D/g, ''), 10) || feuille.prochain_exercice;
                    startSession(exoNum, feuille.roue_en_cours!);
                  }}
                  disabled={sending}
                  className="w-full py-2.5 rounded-xl bg-[#2D3A8C] text-white font-semibold text-sm
                             hover:bg-[#3D4A9C] transition-colors disabled:opacity-40"
                >
                  {sending ? 'Connexion…' : 'Continuer cet exercice →'}
                </button>
              </div>
            )}

            {/* Card de démarrage */}
            {!sessionEnCours && (
              <div className="bg-white border border-[#E8E8E8] rounded-2xl p-8 w-full text-center space-y-5 shadow-sm">
                <div className="space-y-1">
                  <p className="text-lg font-bold text-[#1A1A1A]">Bonjour, {prenom} 👋</p>
                  <p className="text-sm text-[#555]">
                    Tu vas travailler sur{' '}
                    <span className="font-semibold text-[#1A1A1A]">{feuille.titre}</span>
                  </p>
                  <p className="text-sm text-[#999]">Exercice n°{feuille.prochain_exercice}</p>
                </div>
                <button
                  onClick={() => startSession()}
                  disabled={sending}
                  className="w-full py-3 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                             hover:bg-[#1450A3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending ? 'Connexion…' : 'Démarrer la session'}
                </button>
              </div>
            )}

            {/* Historique des sessions */}
            <div className="w-full">
              <p className="text-xs font-semibold text-[#555] mb-3 uppercase tracking-wide">
                Historique
              </p>
              {historyLoading && <p className="text-xs text-[#999]">Chargement…</p>}
              {!historyLoading && history.length === 0 && (
                <p className="text-xs text-[#999] italic">Aucune session précédente.</p>
              )}
              <div className="space-y-2">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setHistoryEntry(entry)}
                    className="w-full text-left px-4 py-3 bg-white border border-[#E8E8E8]
                               rounded-xl hover:border-[#185FA5]/40 transition-colors"
                  >
                    <div className="text-sm font-medium text-[#1A1A1A]">
                      Session du{' '}
                      {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-[#999] mt-0.5">
                      Exo {entry.exercice_numero} · {entry.messages.length} messages
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Modal conversation historique ─────────────────────────────────── */}
      {historyEntry && (
        <div className="fixed inset-0 z-50 bg-[#F5F4EF] flex flex-col">
          <div className="bg-white border-b border-[#E8E8E8] px-4 py-3 flex items-center gap-3 shrink-0">
            <button
              onClick={() => setHistoryEntry(null)}
              className="text-sm text-[#185FA5] font-medium"
            >
              ← Retour
            </button>
            <span className="text-sm font-semibold text-[#1A1A1A]">
              Session du{' '}
              {new Date(historyEntry.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}{' '}
              — Exo {historyEntry.exercice_numero}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 max-w-2xl mx-auto w-full">
            {historyEntry.messages
              .filter((m) => !(m.role === 'user' && m.content === 'Démarre la session.'))
              .map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          </div>
        </div>
      )}

      {/* ── Zone de chat ──────────────────────────────────────────────────── */}
      {started && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 max-w-2xl mx-auto w-full">
            {messages
              .filter((m) => !(m.role === 'user' && m.content === 'Démarre la session.'))
              .map((msg, i) => <MessageBubble key={i} msg={msg} />)}

            {/* Indicateur de frappe */}
            {aiTyping && (
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-[#E8E8E8] rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <span key={i}
                        className="w-1.5 h-1.5 bg-[#AAAAAA] rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Loader évaluation ────────────────────────────────────────── */}
          {evaluating && (
            <div className="bg-white border-t border-[#E8E8E8] px-4 py-4 shrink-0 text-center">
              <span className="text-sm text-[#555]">L'agent évalue ton travail…</span>
            </div>
          )}

          {/* ── Résultat + décision post-évaluation ──────────────────────── */}
          {evaluation && (
            <div className="bg-white border-t border-[#E8E8E8] px-4 py-4 shrink-0">
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Verdict */}
                <div className={`flex items-center gap-2 font-semibold text-sm ${
                  evaluation.reussi ? 'text-green-600' : 'text-red-500'
                }`}>
                  <span className="text-base">{evaluation.reussi ? '✓' : '✗'}</span>
                  <span>{evaluation.reussi ? 'Exercice réussi !' : 'Exercice à retravailler'}</span>
                </div>

                {/* Note de l'agent */}
                {evaluation.note && (
                  <p className="text-xs text-[#555] italic">"{evaluation.note}"</p>
                )}

                {/* Grille critères (chaotique seulement) */}
                {evaluation.validated && (
                  <div className="grid grid-cols-4 gap-1">
                    {Object.entries(evaluation.validated).map(([key, val]) => (
                      <div key={key} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${
                        val ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}>
                        <span>{val ? '✓' : '✗'}</span>
                        <span>{key}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Bloc de décision ──────────────────────────────────── */}
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold text-[#555] uppercase tracking-wide">
                    Que veux-tu faire maintenant ?
                  </p>
                  <button
                    onClick={async () => {
                      await bouclerEntrainement();
                      router.push(`/entrainement/${entrainementId}`);
                    }}
                    className="w-full py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm
                               hover:bg-green-700 transition-colors"
                  >
                    Boucler la session
                  </button>
                  {hasFeuilleMeca && (
                    <button
                      onClick={() => startSession(undefined, undefined, 'mecanique')}
                      className="w-full py-2.5 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                                 hover:bg-[#1450A3] transition-colors"
                    >
                      Exercice mécanique
                    </button>
                  )}
                  {hasFeuilleChaos && (
                    <button
                      onClick={() => startSession(undefined, undefined, 'chaotique')}
                      className="w-full py-2.5 rounded-xl bg-[#534AB7] text-white font-semibold text-sm
                                 hover:bg-[#4A43A0] transition-colors"
                    >
                      Exercice chaotique
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/entrainement/${entrainementId}`)}
                    className="w-full py-2.5 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                               font-semibold text-sm hover:bg-[#F5F5F5] transition-colors"
                  >
                    Terminer plus tard
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Barre d'input ─────────────────────────────────────────────── */}
          {!evaluation && (
            <div className="bg-white border-t border-[#E8E8E8] px-4 py-3 shrink-0">
              <div className="max-w-2xl mx-auto">
                {/* Bouton valider (après envoi d'une photo) */}
                {lastPhotoSent && !evaluating && (
                  <div className="mb-2">
                    <button
                      onClick={handleEvaluate}
                      className="w-full py-2 rounded-xl bg-green-600 text-white font-semibold text-sm
                                 hover:bg-green-700 transition-colors"
                    >
                      Valider et terminer l'exercice
                    </button>
                  </div>
                )}

                {/* Aperçu photo en attente */}
                {pendingImage && (
                  <div className="mb-2 flex items-center gap-2">
                    <img src={pendingImage.preview} alt="photo"
                         className="h-12 w-12 rounded-lg object-cover border border-[#E0E0E0]" />
                    <span className="text-xs text-[#999]">Photo jointe</span>
                    <button
                      onClick={() => setPendingImage(null)}
                      className="ml-auto text-xs text-red-400 hover:text-red-600"
                    >
                      Supprimer
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* Bouton photo */}
                  <button
                    onClick={() => photoRef.current?.click()}
                    disabled={sending}
                    title="Joindre une photo de ton travail"
                    className="p-2 rounded-lg text-[#999] hover:bg-[#F5F5F5] transition-colors disabled:opacity-40 shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <input ref={photoRef} type="file" accept="image/*" capture="environment"
                         className="hidden" onChange={handlePhotoChange} />

                  {/* Zone de texte */}
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Écris ta réponse… (Entrée pour envoyer)"
                    rows={1}
                    disabled={sending}
                    className="flex-1 resize-none rounded-xl border border-[#E0E0E0] px-3 py-2.5
                               text-sm text-[#1A1A1A] placeholder-[#AAAAAA] bg-[#FAFAFA]
                               focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30
                               disabled:opacity-50 max-h-32 overflow-y-auto"
                    style={{ lineHeight: '1.5' }}
                  />

                  {/* Bouton envoyer */}
                  <button
                    onClick={() => sendMessage()}
                    disabled={sending || (!input.trim() && !pendingImage)}
                    className="p-2.5 rounded-xl bg-[#185FA5] text-white shrink-0
                               hover:bg-[#1450A3] transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>

                <p className="text-[10px] text-[#CCCCCC] mt-1.5 text-center">
                  Shift+Entrée pour nouvelle ligne · 📸 pour envoyer une photo de ton travail
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Overlay PDF ───────────────────────────────────────────────────── */}
      {pdfOpen && feuille?.pdf_url && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
          <div className="bg-white flex items-center justify-between px-4 py-2 shrink-0">
            <span className="text-sm font-semibold text-[#1A1A1A] truncate">{feuille.titre}</span>
            <div className="flex items-center gap-3">
              <a href={pdfUrl(feuille.pdf_url)!} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-[#185FA5] underline hover:no-underline">
                Ouvrir dans un onglet
              </a>
              <button onClick={() => setPdfOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-[#F5F5F5] text-[#555]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <iframe src={pdfUrl(feuille.pdf_url)!} className="flex-1 w-full bg-white" title="PDF de la feuille" />
        </div>
      )}

    </div>
  );
}
