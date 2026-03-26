'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
} from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type Feuille = {
  id: string;
  titre: string;
  type: 'mecanique' | 'chaotique';
  pdf_url: string | null;
  prochain_exercice: number;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMime?: string;
  imagePreview?: string; // URL.createObjectURL pour l'affichage
  photo_url?: string;   // URL publique Storage (historique)
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
  messages: { role: 'user' | 'assistant'; content: string; timestamp?: string; photo_url?: string }[];
  created_at: string;
};

// ── Constantes ────────────────────────────────────────────────────────────────

const SESSION_DURATION = 30 * 60; // 30 minutes en secondes
const STORAGE_BASE =
  'https://rvonutomiuvsxjxeuipq.supabase.co/storage/v1/object/public/pdfs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function pdfUrl(pdf_url: string | null): string | null {
  if (!pdf_url) return null;
  return `${STORAGE_BASE}/${pdf_url}`;
}

// ── Composant Minuteur ────────────────────────────────────────────────────────

function Timer({ running }: { running: boolean }) {
  const [remaining, setRemaining] = useState(SESSION_DURATION);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const pct = ((SESSION_DURATION - remaining) / SESSION_DURATION) * 100;
  const urgent = remaining < 5 * 60;

  return (
    <div className="flex items-center gap-3">
      {/* Barre de progression */}
      <div className="w-24 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            urgent ? 'bg-red-400' : 'bg-[#185FA5]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-sm font-mono font-semibold tabular-nums ${
          urgent ? 'text-red-500' : 'text-[#555]'
        }`}
      >
        {formatTime(remaining)}
      </span>
    </div>
  );
}

// ── Rendu LaTeX + Markdown léger ──────────────────────────────────────────────

function renderContent(text: string): string {
  // 1. Échappe les caractères HTML de base avant injection
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 2. Remplace les blocs $$...$$ (display) et $...$ (inline) par du KaTeX
  //    On traite d'abord display ($$) pour éviter la collision avec inline ($)
  const renderLatex = (src: string): string => {
    // Display blocks : $$...$$
    src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return escapeHtml(`$$${math}$$`);
      }
    });
    // Inline : $...$  (pas de $ seul au milieu d'un nombre : \$\d évité)
    src = src.replace(/\$([^$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return escapeHtml(`$${math}$`);
      }
    });
    return src;
  };

  // 3. Markdown léger ligne par ligne (gras, tirets) + LaTeX
  const lines = text.split('\n');
  const html = lines.map((line) => {
    // Applique LaTeX sur la ligne brute
    let out = renderLatex(escapeHtml(line));
    // Gras : **...**
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Tiret de liste : "- " en début de ligne
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
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#185FA5] text-white rounded-br-sm'
            : 'bg-white border border-[#E8E8E8] text-[#1A1A1A] rounded-bl-sm'
        }`}
      >
        {(imagePreview || photoUrl) && (
          <img
            src={imagePreview ?? photoUrl}
            alt="photo"
            className="rounded-xl mb-2 max-w-[240px] border border-[#E8E8E8] object-contain"
          />
        )}
        <div
          className="katex-content"
          dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
        />
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function SessionPage() {
  // Contexte
  const [ctx, setCtx] = useState<SessionContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);

  // Sélection feuille
  const [feuilleId, setFeuilleId] = useState<string>('');

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

  // PDF overlay
  const [pdfOpen, setPdfOpen] = useState(false);

  // Photo
  const photoRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mime: string;
    preview: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Chargement du contexte ──────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/session/context')
      .then((r) => r.json())
      .then((data: SessionContext) => {
        setCtx(data);
        if (data.feuilles.length === 1) setFeuilleId(data.feuilles[0].id);
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

  const feuille = ctx?.feuilles.find((f) => f.id === feuilleId) ?? null;
  const prenom = ctx?.profil.full_name.split(' ')[0] ?? 'Élève';

  // ── Envoi d'un message + streaming ─────────────────────────────────────
  const sendMessage = useCallback(
    async (overrideContent?: string) => {
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
      if (pendingImage) {
        setLastPhotoSent({ base64: pendingImage.base64, mime: pendingImage.mime });
      }
      setPendingImage(null);
      setSending(true);
      setAiTyping(true);

      try {
        const res = await fetch('/api/session/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages.map(({ imagePreview: _, ...m }) => m), // strip preview URL
            feuille_id: feuille.id,
            prochain_exercice: currentExercice,
            prenom,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Erreur ${res.status}`);
        }

        // Placeholder pour la réponse en cours
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
        setAiTyping(false);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: accumulated },
          ]);
        }
      } catch (err: any) {
        setAiTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '⚠️ Une erreur est survenue. Réessaie dans un instant.',
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [feuille, input, messages, pendingImage, prenom, currentExercice]
  );

  // ── Démarrage de la session ─────────────────────────────────────────────
  const startSession = useCallback(async (exerciceOverride?: number) => {
    if (!feuille) return;
    const exo = exerciceOverride ?? feuille.prochain_exercice;
    setCurrentExercice(exo);
    setSessionStartTime(Date.now());
    setStarted(true);
    setMessages([{ role: 'user', content: 'Démarre la session.' }]);
    setLastPhotoSent(null);
    setEvaluation(null);
    setSending(true);
    setAiTyping(true);

    console.log('[startSession] feuille =', feuille);
    console.log('[startSession] exo =', exo);
    try {
      const res = await fetch('/api/session/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Démarre la session.' }],
          feuille_id: feuille.id,
          prochain_exercice: exo,
          prenom,
        }),
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
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: accumulated },
        ]);
      }
    } catch (err) {
      console.error('[startSession] erreur complète :', err);
      setAiTyping(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Impossible de démarrer la session.' },
      ]);
    } finally {
      setSending(false);
    }
  }, [feuille, prenom]);

  // ── Évaluation de l'exercice ────────────────────────────────────────────
  const handleEvaluate = useCallback(async () => {
    if (!feuille || !lastPhotoSent) return;
    setEvaluating(true);
    try {
      const res = await fetch('/api/session/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // strip image data from history — photo passée séparément
          messages: messages.map(({ imagePreview: _p, imageBase64: _b, imageMime: _m, ...m }) => m),
          feuille_id: feuille.id,
          exercice_numero: currentExercice,
          type: feuille.type,
          reference: `Exo${currentExercice}`,
          photo_base64: lastPhotoSent.base64,
          photo_mime: lastPhotoSent.mime,
          session_start_time: sessionStartTime ?? Date.now(),
        }),
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
  }, [feuille, lastPhotoSent, messages, currentExercice]);

  const handleNextExercice = useCallback(() => {
    startSession(currentExercice + 1);
  }, [startSession, currentExercice]);

  // ── Gestion photo ───────────────────────────────────────────────────────
  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl = "data:image/jpeg;base64,..."
      const [header, base64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      setPendingImage({ base64, mime, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset pour permettre de re-sélectionner le même fichier
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

  if (!ctx || ctx.feuilles.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-8 max-w-sm text-center space-y-3">
          <div className="text-3xl">📚</div>
          <p className="text-[#1A1A1A] font-semibold">Aucune feuille active</p>
          <p className="text-sm text-[#999]">
            Ton professeur ne t'a pas encore assigné de feuille d'entraînement.
          </p>
        </div>
      </div>
    );
  }

  // ── Interface principale ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F4EF] flex flex-col">
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8E8E8] px-4 py-3 flex items-center justify-between shrink-0">
        {/* Gauche : titre + feuille */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#185FA5] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">IA</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#1A1A1A] truncate">
              Coach Mathématiques
            </div>
            {feuille && (
              <div className="text-xs text-[#999] truncate">
                {feuille.titre}{' '}
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    feuille.type === 'mecanique'
                      ? 'bg-[#E6F1FB] text-[#185FA5]'
                      : 'bg-[#EEEDFE] text-[#534AB7]'
                  }`}
                >
                  {feuille.type === 'mecanique' ? 'M' : 'C'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Droite : minuteur + PDF */}
        <div className="flex items-center gap-3 shrink-0">
          <Timer running={started} />
          {feuille?.pdf_url && (
            <button
              onClick={() => setPdfOpen(true)}
              className="text-xs text-[#185FA5] underline hover:no-underline"
              title="Voir le PDF"
            >
              PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Sélecteur de feuille (si > 1) ─────────────────────────────── */}
      {!started && ctx.feuilles.length > 1 && (
        <div className="px-4 pt-4 max-w-lg mx-auto w-full">
          <label className="block text-xs font-semibold text-[#555] mb-1.5">
            Choisis ta feuille d'entraînement
          </label>
          <select
            value={feuilleId}
            onChange={(e) => setFeuilleId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#E0E0E0] rounded-lg bg-white text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30"
          >
            <option value="">— Sélectionner —</option>
            {ctx.feuilles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.titre} ({f.type === 'mecanique' ? 'Mécanique' : 'Chaotique'}) — Ex.{' '}
                {f.prochain_exercice}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Écran de démarrage + historique ────────────────────────────── */}
      {!started && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center px-4 py-6 gap-6 max-w-lg mx-auto">

            {/* Card de démarrage */}
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-8 w-full text-center space-y-5 shadow-sm">
              <div className="space-y-1">
                <p className="text-lg font-bold text-[#1A1A1A]">Bonjour, {prenom} 👋</p>
                {feuille ? (
                  <>
                    <p className="text-sm text-[#555]">
                      Tu vas travailler sur{' '}
                      <span className="font-semibold text-[#1A1A1A]">{feuille.titre}</span>
                    </p>
                    <p className="text-sm text-[#999]">
                      Exercice n°{feuille.prochain_exercice} · Session de 30 min
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[#999]">Sélectionne une feuille ci-dessus</p>
                )}
              </div>

              <button
                onClick={() => startSession()}
                disabled={!feuilleId || sending}
                className="w-full py-3 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                           hover:bg-[#1450A3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? 'Connexion…' : 'Démarrer la session'}
              </button>
            </div>

            {/* Historique des sessions */}
            {feuilleId && (
              <div className="w-full">
                <p className="text-xs font-semibold text-[#555] mb-3 uppercase tracking-wide">
                  Historique des sessions
                </p>
                {historyLoading && (
                  <p className="text-xs text-[#999]">Chargement…</p>
                )}
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
            )}

          </div>
        </div>
      )}

      {/* ── Modal conversation historique ──────────────────────────────── */}
      {historyEntry && (
        <div className="fixed inset-0 z-50 bg-[#F5F4EF] flex flex-col">
          {/* Header */}
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
          {/* Messages en lecture seule */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 max-w-2xl mx-auto w-full">
            {historyEntry.messages
              .filter((m) => !(m.role === 'user' && m.content === 'Démarre la session.'))
              .map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
          </div>
        </div>
      )}

      {/* ── Zone de chat ───────────────────────────────────────────────── */}
      {started && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 max-w-2xl mx-auto w-full">
            {messages
              .filter((m) => !(m.role === 'user' && m.content === 'Démarre la session.'))
              .map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}

            {/* Indicateur de frappe */}
            {aiTyping && (
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-[#E8E8E8] rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-[#AAAAAA] rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Loader évaluation ──────────────────────────────────────── */}
          {evaluating && (
            <div className="bg-white border-t border-[#E8E8E8] px-4 py-4 shrink-0 text-center">
              <span className="text-sm text-[#555]">L'agent évalue ton travail…</span>
            </div>
          )}

          {/* ── Résultat d'évaluation ───────────────────────────────────── */}
          {evaluation && (
            <div className="bg-white border-t border-[#E8E8E8] px-4 py-4 shrink-0">
              <div className="max-w-2xl mx-auto space-y-3">
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
                      <div
                        key={key}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${
                          val
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        <span>{val ? '✓' : '✗'}</span>
                        <span>{key}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Prochain exercice */}
                <button
                  onClick={handleNextExercice}
                  className="w-full py-2.5 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                             hover:bg-[#1450A3] transition-colors"
                >
                  Passer à l'exercice suivant →
                </button>
              </div>
            </div>
          )}

          {/* ── Barre d'input ──────────────────────────────────────────── */}
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
                  <img
                    src={pendingImage.preview}
                    alt="photo"
                    className="h-12 w-12 rounded-lg object-cover border border-[#E0E0E0]"
                  />
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
                  className="p-2 rounded-lg text-[#999] hover:bg-[#F5F5F5] transition-colors
                             disabled:opacity-40 shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoChange}
                />

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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
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

      {/* ── Overlay PDF ────────────────────────────────────────────────── */}
      {pdfOpen && feuille?.pdf_url && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
          {/* Header overlay */}
          <div className="bg-white flex items-center justify-between px-4 py-2 shrink-0">
            <span className="text-sm font-semibold text-[#1A1A1A] truncate">
              {feuille.titre}
            </span>
            <div className="flex items-center gap-3">
              <a
                href={pdfUrl(feuille.pdf_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#185FA5] underline hover:no-underline"
              >
                Ouvrir dans un onglet
              </a>
              <button
                onClick={() => setPdfOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F5F5F5] text-[#555]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {/* iframe PDF */}
          <iframe
            src={pdfUrl(feuille.pdf_url)!}
            className="flex-1 w-full bg-white"
            title="PDF de la feuille"
          />
        </div>
      )}
    </div>
  );
}
