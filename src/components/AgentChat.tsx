'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ── KaTeX via CDN ─────────────────────────────────────────────────────────────

function useKatex() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).katex) { setReady(true); return; }

    // CSS
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
    document.head.appendChild(link);

    // katex.min.js → then auto-render
    const script1 = document.createElement('script');
    script1.src   = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
    script1.async = true;
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.src   = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js';
      script2.async = true;
      script2.onload = () => setReady(true);
      document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
  }, []);

  return ready;
}

// ── Composant MathMessage ─────────────────────────────────────────────────────

function MathMessage({ content }: { content: string }) {
  const ref      = useRef<HTMLDivElement>(null);
  const katexReady = (typeof window !== 'undefined') && !!(window as any).renderMathInElement;

  useEffect(() => {
    if (!ref.current) return;
    const render = (window as any).renderMathInElement;
    if (typeof render !== 'function') return;
    render(ref.current, {
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '$',  right: '$',  display: false },
      ],
      throwOnError: false,
    });
  });

  return (
    <div
      ref={ref}
      className="katex-content"
      // On met le texte brut ; useEffect le remplace par le rendu KaTeX dès que disponible
    >
      {content}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
};

type PendingImage = {
  base64: string;
  mime: string;
  preview: string;
};

type Feuille = {
  id: string;
  titre: string;
  type: string;
};

type ConvItem = {
  // clé composite : feuille_id + exercice_numero
  historyId: string;          // id de la ligne conversation_history la plus récente
  feuille_id: string;
  feuille_titre: string;
  exercice_numero: number;
  messages: Message[];
  created_at: string;
};

// ── Composant ─────────────────────────────────────────────────────────────────

export default function AgentChat() {
  useKatex(); // charge KaTeX via CDN une seule fois

  const [isOpen, setIsOpen]               = useState(false);
  const [userId, setUserId]               = useState<string | null>(null);

  // Feuilles actives (pour l'écran d'accueil)
  const [feuillesActives, setFeuillesActives] = useState<Feuille[]>([]);

  // Historique des conversations (une par exercice)
  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [activeConvKey, setActiveConvKey] = useState<string | null>(null); // "feuille_id::exo_num"

  // Chat courant
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const photoRef       = useRef<HTMLInputElement>(null);

  // ── Utilitaires ─────────────────────────────────────────────────────────────

  const convKey = (feuille_id: string, exercice_numero: number) =>
    `${feuille_id}::${exercice_numero}`;

  const activeConv = conversations.find(
    (c) => convKey(c.feuille_id, c.exercice_numero) === activeConvKey,
  ) ?? null;

  // ── Init au montage ──────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Feuilles actives
      const ctxRes = await fetch('/api/agent/context');
      const ctxData = await ctxRes.json().catch(() => ({ feuilles: [] }));
      setFeuillesActives(ctxData.feuilles ?? []);

      // Historique conversation_history
      const { data: histRows } = await supabase
        .from('conversation_history')
        .select('id, feuille_id, exercice_numero, messages, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!histRows || histRows.length === 0) return;

      // Résoudre les titres de feuilles
      const feuilleIds = [...new Set(histRows.map((r: any) => r.feuille_id as string))];
      const { data: noeuds } = await supabase
        .from('noeud')
        .select('id, titre')
        .in('id', feuilleIds);
      const titreMap: Record<string, string> = {};
      (noeuds ?? []).forEach((n: any) => { titreMap[n.id] = n.titre; });

      // Grouper par feuille_id + exercice_numero (garder le plus récent = premier dans DESC)
      const seen = new Set<string>();
      const items: ConvItem[] = [];
      for (const row of histRows as any[]) {
        const key = convKey(row.feuille_id, row.exercice_numero);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          historyId:       row.id,
          feuille_id:      row.feuille_id,
          feuille_titre:   titreMap[row.feuille_id] ?? row.feuille_id,
          exercice_numero: row.exercice_numero,
          messages:        (row.messages as any[] ?? []).map((m: any) => ({
            role:    m.role as 'user' | 'assistant',
            content: m.content ?? '',
          })),
          created_at: row.created_at,
        });
      }
      setConversations(items);
    };
    init();
  }, []);

  // Scroll automatique
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Sélection d'une conversation ─────────────────────────────────────────────

  const selectConv = (conv: ConvItem) => {
    setActiveConvKey(convKey(conv.feuille_id, conv.exercice_numero));
    setMessages(conv.messages);
    setPendingImage(null);
    setInput('');
  };

  // ── Nouvelle conversation ────────────────────────────────────────────────────

  const newConversation = () => {
    setActiveConvKey(null);
    setMessages([]);
    setInput('');
    setPendingImage(null);
  };

  // ── Envoi photo ──────────────────────────────────────────────────────────────

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // ── Envoi message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || sending) return;

    const userMsg: Message = {
      role:         'user',
      content:      trimmed,
      imagePreview: pendingImage?.preview,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    const imageToSend = pendingImage;
    setPendingImage(null);
    setSending(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:         next.map(({ imagePreview: _, ...m }) => m),
          feuilles_actives: feuillesActives,
          image_base64:     imageToSend?.base64     ?? null,
          image_media_type: imageToSend?.mime       ?? null,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      const reader  = res.body.getReader();
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

      // Mise à jour de la conversation dans l'état local
      const finalMessages = [...next, { role: 'assistant' as const, content: accumulated }];
      if (activeConvKey) {
        setConversations((prev) => prev.map((c) =>
          convKey(c.feuille_id, c.exercice_numero) === activeConvKey
            ? { ...c, messages: finalMessages }
            : c,
        ));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Une erreur est survenue. Réessaie dans un instant.' },
      ]);
    } finally {
      setSending(false);
    }
  }, [messages, pendingImage, sending, feuillesActives, activeConvKey]);

  // ── Formatage date ───────────────────────────────────────────────────────────

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Bulle flottante ─────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Fermer Monstro' : "Ouvrir l'assistant Monstro"}
        className="fixed bottom-5 left-5 w-14 h-14 rounded-full bg-[#534AB7] shadow-lg
                   flex items-center justify-center z-50
                   hover:scale-105 active:scale-95 transition-transform"
      >
        {isOpen ? (
          <span className="text-white text-2xl leading-none font-light">×</span>
        ) : (
          <img src="/images/monster-avatar.png" alt="Monstro" className="w-10 h-10 object-contain" />
        )}
      </button>

      {/* ── Overlay ─────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Modal centré ────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed z-40 bg-white rounded-2xl shadow-2xl flex overflow-hidden"
          style={{
            top:       '50%',
            left:      '50%',
            transform: 'translate(-50%, -50%)',
            width:     '90vw',
            maxWidth:  '800px',
            height:    '90vh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Colonne gauche — Historique ───────────────────────────── */}
          <div className="w-[250px] shrink-0 bg-gray-50 border-r border-[#E8E8E8] flex flex-col">
            {/* Header gauche */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-[#E8E8E8]">
              <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide">
                Conversations
              </span>
              <button
                onClick={newConversation}
                className="text-[10px] font-semibold text-[#534AB7] hover:bg-[#F0EEFF]
                           px-2 py-1 rounded-lg transition-colors"
              >
                + Nouvelle
              </button>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto py-2">
              {conversations.length === 0 ? (
                <p className="text-[11px] text-[#AAAAAA] px-3 py-4 text-center">
                  Aucune conversation
                </p>
              ) : (
                conversations.map((conv) => {
                  const key = convKey(conv.feuille_id, conv.exercice_numero);
                  const isActive = key === activeConvKey;
                  return (
                    <button
                      key={key}
                      onClick={() => selectConv(conv)}
                      className={`w-full text-left px-3 py-2.5 transition-colors
                                  ${isActive
                                    ? 'bg-[#F0EEFF] border-l-2 border-[#534AB7]'
                                    : 'hover:bg-gray-100 border-l-2 border-transparent'}`}
                    >
                      <div className="text-xs font-semibold text-[#1A1A1A] truncate">
                        {conv.feuille_titre}
                      </div>
                      <div className="text-[10px] text-[#AAAAAA] mt-0.5">
                        Exo {conv.exercice_numero} · {fmtDate(conv.created_at)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Colonne droite — Chat ────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header droite */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#534AB7] flex items-center justify-center shrink-0">
                  <img src="/images/monster-avatar.png" alt="" className="w-4 h-4 object-contain" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-[#1A1A1A] text-sm">Monstro</span>
                  {activeConv && (
                    <span className="text-[11px] text-[#AAAAAA] ml-2 truncate">
                      {activeConv.feuille_titre} · Exo {activeConv.exercice_numero}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#AAAAAA] hover:text-[#555] transition-colors text-2xl leading-none p-1 shrink-0"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {/* Corps — accueil ou messages */}
            {messages.length === 0 ? (
              /* ── Écran d'accueil ── */
              <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center
                              px-6 py-8 gap-5">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#534AB7] flex items-center justify-center">
                    <img src="/images/monster-avatar.png" alt="Monstro" className="w-11 h-11 object-contain" />
                  </div>
                  <p className="text-base font-bold text-[#1A1A1A]">Bonjour ! 👋</p>
                  <p className="text-sm text-[#555]">Sur quelle feuille travailles-tu ?</p>
                </div>
                {feuillesActives.length > 0 && (
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    {feuillesActives.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => sendMessage(f.titre)}
                        className="text-left px-4 py-2.5 rounded-xl border border-[#534AB7]/40
                                   text-[#534AB7] text-sm font-medium
                                   hover:bg-[#F0EEFF] hover:border-[#534AB7] transition-colors"
                      >
                        {f.titre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Messages ── */
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-[#534AB7] flex items-center justify-center shrink-0">
                        <img src="/images/monster-avatar.png" alt="" className="w-3.5 h-3.5 object-contain" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#534AB7] text-white rounded-br-sm'
                          : 'bg-gray-100 text-[#1A1A1A] rounded-bl-sm'
                      }`}
                    >
                      {msg.imagePreview && (
                        <img
                          src={msg.imagePreview}
                          alt="photo jointe"
                          className="rounded-lg mb-1.5 object-contain"
                          style={{ maxWidth: '200px' }}
                        />
                      )}
                      {msg.content
                        ? <MathMessage content={msg.content} />
                        : (sending && i === messages.length - 1 ? (
                          <span className="flex gap-1 items-center h-4 px-1">
                            {[0, 1, 2].map((j) => (
                              <span
                                key={j}
                                className="w-1.5 h-1.5 bg-[#AAAAAA] rounded-full animate-bounce"
                                style={{ animationDelay: `${j * 150}ms` }}
                              />
                            ))}
                          </span>
                        ) : '')}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <div className="border-t border-[#E8E8E8] px-4 py-3 shrink-0">
              {pendingImage && (
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={pendingImage.preview}
                    alt="aperçu"
                    className="w-10 h-10 rounded-lg object-cover border border-[#E0E0E0] shrink-0"
                  />
                  <span className="text-xs text-[#999] flex-1">Photo jointe</span>
                  <button
                    onClick={() => setPendingImage(null)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                {/* Bouton photo */}
                <button
                  onClick={() => photoRef.current?.click()}
                  disabled={sending}
                  title="Joindre une photo"
                  className="p-2 rounded-lg text-[#999] hover:bg-gray-100 transition-colors
                             disabled:opacity-40 shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Écris ta question…"
                  rows={1}
                  disabled={sending}
                  className="flex-1 resize-none rounded-xl border border-[#E0E0E0] px-3 py-2.5
                             text-sm text-[#1A1A1A] placeholder-[#AAAAAA] bg-[#FAFAFA]
                             focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30
                             disabled:opacity-50 max-h-24 overflow-y-auto"
                  style={{ lineHeight: '1.5' }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={sending || (!input.trim() && !pendingImage)}
                  className="p-2.5 rounded-xl bg-[#534AB7] text-white shrink-0
                             hover:bg-[#4A43A0] transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-[10px] text-[#CCCCCC] mt-1.5 text-center">
                Shift+Entrée pour nouvelle ligne
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
