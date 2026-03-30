'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const GRILLE_BASE = 'https://mathbank.onrender.com/grille-roue.html';

type Feuille = {
  id: string;
  titre: string;
  type: 'mecanique' | 'chaotique';
  pdf_url: string | null;
  prochain_exercice: number;
};

type SessionContext = {
  feuilles: Feuille[];
  profil: { full_name: string };
};

export default function AutonomePage() {
  const router = useRouter();

  const [ctx, setCtx] = useState<SessionContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [entrainementId, setEntrainementId] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const feuilleMeca: Feuille | null = ctx?.feuilles.find((f) => f.type === 'mecanique') ?? null;
  const feuilleChaos: Feuille | null = ctx?.feuilles.find((f) => f.type === 'chaotique') ?? null;

  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Charger userId + contexte ───────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserId(session.user.id);

      try {
        const data: SessionContext = await fetch('/api/session/context').then((r) => r.json());
        setCtx(data);
      } catch (err: any) {
        setCtxError(err.message ?? 'Erreur de chargement');
      } finally {
        setCtxLoading(false);
      }
    };
    init();
  }, []);

  // ── Lire ?entrainement_id ou en créer un ────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const params = new URLSearchParams(window.location.search);
    const existing = params.get('entrainement_id');
    if (existing) {
      setEntrainementId(existing);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('entrainement')
        .insert({ user_id: userId, statut: 'en_cours', mode: 'autonome' })
        .select('id')
        .single();
      if (!error && data) setEntrainementId(data.id);
      else console.error('[autonome] create entrainement error:', error);
    })();
  }, [userId]);

  // ── Boucler ─────────────────────────────────────────────────────────────
  const boucler = async () => {
    if (entrainementId) {
      await supabase
        .from('entrainement')
        .update({ statut: 'boucle', updated_at: new Date().toISOString() })
        .eq('id', entrainementId);
    }
    router.push('/session');
  };

  // ── Ouvrir grille dans l'iframe ──────────────────────────────────────────
  const ouvrirGrille = (feuille: Feuille) => {
    if (!userId) return;
    const params = new URLSearchParams({
      user_id:       userId,
      feuille_id:    feuille.id,
      feuille_titre: feuille.titre,
      exercice:      `Exo${feuille.prochain_exercice}`,
      type:          feuille.type,
      ...(entrainementId ? { entrainement_id: entrainementId } : {}),
    });
    setIframeUrl(`${GRILLE_BASE}?${params.toString()}`);
  };

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (ctxLoading) {
    return (
      <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center">
        <span className="text-sm text-[#999]">Chargement…</span>
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8E8E8] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {iframeUrl ? (
              <button
                onClick={() => setIframeUrl(null)}
                className="text-sm text-[#185FA5] font-medium shrink-0 hover:underline"
              >
                ← Changer de grille
              </button>
            ) : (
              <button
                onClick={() => router.push('/session')}
                className="text-sm text-[#185FA5] font-medium shrink-0 hover:underline"
              >
                ← Retour
              </button>
            )}
            <div className="min-w-0">
              <div className="text-[11px] text-[#AAAAAA] leading-tight">{today} · Autonome</div>
              <div className="text-sm font-semibold text-[#1A1A1A]">Grille d'observation</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={boucler}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold
                         hover:bg-green-700 transition-colors"
            >
              Boucler
            </button>
            <button
              onClick={() => router.push('/session')}
              className="text-xs text-[#AAAAAA] hover:text-[#555] transition-colors"
            >
              Terminer plus tard
            </button>
          </div>
        </div>
      </div>

      {/* ── Vue iframe ──────────────────────────────────────────────────────── */}
      {iframeUrl ? (
        <iframe
          src={iframeUrl}
          className="flex-1 w-full border-0"
          style={{ minHeight: 'calc(100vh - 60px)' }}
          allow="camera"
        />
      ) : (

        /* ── Vue cartes ───────────────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-8 space-y-8">

            {/* Deux cartes grilles */}
            <div className="grid grid-cols-2 gap-3">

              {/* Mécanique */}
              <button
                onClick={() => feuilleMeca && ouvrirGrille(feuilleMeca)}
                disabled={!feuilleMeca}
                className={`flex flex-col items-start px-5 py-5 rounded-2xl border font-semibold
                            text-sm transition-all text-left ${
                  feuilleMeca
                    ? 'bg-white border-[#E8E8E8] text-[#1A1A1A] hover:border-[#185FA5] hover:shadow-sm'
                    : 'bg-white border-[#F0F0F0] text-[#CCCCCC] cursor-not-allowed'
                }`}
              >
                <span className="text-[#185FA5] text-xl mb-3">→</span>
                <div className="font-semibold text-sm">Grille mécanique</div>
                {feuilleMeca
                  ? <div className="text-xs font-normal text-[#AAAAAA] mt-1 leading-snug">{feuilleMeca.titre}<br />Exo {feuilleMeca.prochain_exercice}</div>
                  : <div className="text-xs font-normal text-[#CCCCCC] mt-1 leading-snug">Aucune feuille mécanique active</div>
                }
              </button>

              {/* Chaotique */}
              <button
                onClick={() => feuilleChaos && ouvrirGrille(feuilleChaos)}
                disabled={!feuilleChaos}
                className={`flex flex-col items-start px-5 py-5 rounded-2xl border font-semibold
                            text-sm transition-all text-left ${
                  feuilleChaos
                    ? 'bg-white border-[#E8E8E8] text-[#1A1A1A] hover:border-[#534AB7] hover:shadow-sm'
                    : 'bg-white border-[#F0F0F0] text-[#CCCCCC] cursor-not-allowed'
                }`}
              >
                <span className="text-[#534AB7] text-xl mb-3">→</span>
                <div className="font-semibold text-sm">Grille chaotique</div>
                {feuilleChaos
                  ? <div className="text-xs font-normal text-[#AAAAAA] mt-1 leading-snug">{feuilleChaos.titre}<br />Exo {feuilleChaos.prochain_exercice}</div>
                  : <div className="text-xs font-normal text-[#CCCCCC] mt-1 leading-snug">Aucune feuille chaotique active</div>
                }
              </button>
            </div>

            {/* Décision de session */}
            <div className="space-y-2">
              <button
                onClick={boucler}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm
                           hover:bg-green-700 transition-colors"
              >
                Boucler la session
              </button>
              <button
                onClick={() => router.push('/session')}
                className="w-full py-3 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                           font-semibold text-sm hover:bg-[#F5F5F5] transition-colors"
              >
                Terminer plus tard
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
