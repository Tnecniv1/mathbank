'use client';

import React, { useState, useRef, useEffect } from 'react';

type Props = {
  onSubmit: (key: string) => Promise<{ ok: boolean }>;
  onDismiss: () => void;
};

export function SecretKeyModal({ onSubmit, onDismiss }: Props) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(key.trim());
    if (!result.ok) {
      setError('Clé incorrecte. Réessaie.');
      setKey('');
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
        <div>
          <h2 className="text-base font-bold text-[#1A1A1A]">Clé requise</h2>
          <p className="text-xs text-[#888] mt-1">
            Cette action est protégée. Entre la clé secrète pour continuer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Clé secrète"
            autoComplete="off"
            className="w-full px-3 py-2.5 bg-[#F9F9F9] border border-[#E8E8E8] rounded-xl
                       text-sm focus:outline-none focus:border-[#185FA5] transition-colors"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 py-2.5 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                         font-semibold text-sm hover:bg-[#F5F5F5] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !key.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#185FA5] text-white font-semibold text-sm
                         hover:bg-[#1450A0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '…' : 'Valider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
