'use client';

import { useState, useCallback } from 'react';

export function useSecretKey() {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireKey = useCallback((action: () => void) => {
    setPendingAction(() => action);
    setShowKeyModal(true);
  }, []);

  async function submitKey(key: string): Promise<{ ok: boolean }> {
    const res = await fetch('/api/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      setShowKeyModal(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      return { ok: true };
    }
    return { ok: false };
  }

  function dismissKeyModal() {
    setShowKeyModal(false);
    setPendingAction(null);
  }

  return { requireKey, showKeyModal, submitKey, dismissKeyModal };
}
