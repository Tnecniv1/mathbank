'use client';

import React, { useState, useEffect, useRef } from 'react';

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

export default function AgentChat() {
  const [open, setOpen]                       = useState(false);
  const [messages, setMessages]               = useState<Message[]>([]);
  const [input, setInput]                     = useState('');
  const [sending, setSending]                 = useState(false);
  const [feuillesActives, setFeuillesActives] = useState<Feuille[]>([]);
  const [feuillesLoaded, setFeuillesLoaded]   = useState(false);
  const [pendingImage, setPendingImage]       = useState<PendingImage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const photoRef       = useRef<HTMLInputElement>(null);

  // Chargement des feuilles actives au montage
  useEffect(() => {
    fetch('/api/agent/context')
      .then((r) => r.json())
      .then((data) => setFeuillesActives(data.feuilles ?? []))
      .catch(() => {})
      .finally(() => setFeuillesLoaded(true));
  }, []);

  // Premier message de Monstro — une seule fois au montage, jamais à la réouverture du panneau
  useEffect(() => {
    if (!feuillesLoaded) return;
    setMessages([{ role: 'assistant', content: 'Bonjour ! 👋 Sur quelle feuille travailles-tu ?' }]);
    // NOTE : open/close ne déclenche pas ce useEffect — feuillesLoaded ne change qu'une fois.
  }, [feuillesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetConversation = () => {
    setMessages([{ role: 'assistant', content: 'Bonjour ! 👋 Sur quelle feuille travailles-tu ?' }]);
    setInput('');
    setPendingImage(null);
  };

  // Scroll automatique
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Lecture fichier → base64
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

  const sendMessage = async (text: string) => {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:          next.map(({ imagePreview: _, ...m }) => m),
          feuilles_actives:  feuillesActives,
          image_base64:      imageToSend?.base64      ?? null,
          image_media_type:  imageToSend?.mime        ?? null,
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
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Une erreur est survenue. Réessaie dans un instant.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const showFeuilleButtons = messages.length === 1 && feuillesActives.length > 0;

  return (
    <>
      {/* ── Bulle flottante ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'assistant Monstro"
        className="fixed bottom-5 left-5 w-14 h-14 rounded-full bg-[#534AB7] shadow-lg
                   flex items-center justify-center z-40
                   hover:scale-105 active:scale-95 transition-transform"
      >
        <img src="/images/monster-avatar.png" alt="Monstro" className="w-10 h-10 object-contain" />
      </button>

      {/* ── Overlay ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
      )}

      {/* ── Panneau latéral ─────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 left-0 h-full w-[380px] bg-white shadow-xl z-50
                    flex flex-col transition-transform duration-300 ease-out
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center shrink-0">
              <img src="/images/monster-avatar.png" alt="" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-bold text-[#1A1A1A] text-sm">Monstro</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetConversation}
              title="Nouvelle conversation"
              className="text-[10px] text-[#AAAAAA] hover:text-[#534AB7] transition-colors
                         px-2 py-1 rounded-lg hover:bg-[#F0EEFF]"
            >
              Nouvelle conv.
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-[#AAAAAA] hover:text-[#555] transition-colors text-2xl leading-none p-1"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-[#534AB7] flex items-center justify-center shrink-0">
                  <img src="/images/monster-avatar.png" alt="" className="w-4 h-4 object-contain" />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#534AB7] text-white rounded-br-sm'
                    : 'bg-[#F3F3F3] text-[#1A1A1A] rounded-bl-sm'
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
                {msg.content ||
                  (sending && i === messages.length - 1 ? (
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

          {/* Boutons feuilles (premier message uniquement) */}
          {showFeuilleButtons && (
            <div className="flex flex-col gap-2 pl-8">
              {feuillesActives.map((f) => (
                <button
                  key={f.id}
                  onClick={() => sendMessage(f.titre)}
                  className="text-left px-3 py-2 rounded-xl border border-[#534AB7]/50
                             text-[#534AB7] text-xs font-medium
                             hover:bg-[#F0EEFF] hover:border-[#534AB7] transition-colors"
                >
                  {f.titre}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#E8E8E8] px-4 py-3 shrink-0">
          {/* Preview photo en attente */}
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
              className="p-2 rounded-lg text-[#999] hover:bg-[#F5F5F5] transition-colors
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
    </>
  );
}
