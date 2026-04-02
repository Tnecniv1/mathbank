'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type EntreeClassement = {
  userId: string;
  nom: string;
  scoreBrut: number;
  avatarUrl: string | null;
};


function calcInitiales(nom: string): string {
  return nom.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

export default function ClassementPage() {
  const router = useRouter();
  const [classement, setClassement] = useState<EntreeClassement[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClassement();
  }, []);

  async function loadClassement() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setCurrentUserId(session.user.id);

      const { data, error: rpcError } = await supabase.rpc('get_classement');

      if (rpcError) throw rpcError;

      const entrees: EntreeClassement[] = (data ?? []).map((row: any) => ({
        userId:    row.user_id,
        nom:       row.pseudo ?? row.full_name ?? 'Inconnu',
        scoreBrut: Math.round(row.score_brut),
        avatarUrl: row.avatar_url ?? null,
      }));

      setClassement(entrees);
    } catch (err: any) {
      console.error('Erreur chargement classement:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center">
        <span className="text-sm text-[#999]">Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm w-full">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F4EF]">
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-[#185FA5] font-medium hover:underline shrink-0"
          >
            ← Retour
          </button>
        </div>

        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Classement</h1>
          <p className="text-xs text-[#AAAAAA] mt-0.5">Score brut total</p>
        </div>

        {/* Liste */}
        {classement.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-10 text-center">
            <div className="text-[#CCC] text-sm">Aucune donnée disponible</div>
          </div>
        ) : (
          <div className="space-y-2 pb-8">
            {classement.map((entree, index) => {
              const rang = index + 1;
              const isMe = entree.userId === currentUserId;
              const initiales = calcInitiales(entree.nom);
              const medal =
                rang === 1 ? '🥇' :
                rang === 2 ? '🥈' :
                rang === 3 ? '🥉' : null;

              return (
                <div
                  key={entree.userId}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    isMe
                      ? 'bg-[#E6F1FB] border-[#185FA5]'
                      : 'bg-white border-[#E8E8E8]'
                  }`}
                >
                  {/* Rang */}
                  <div className="w-8 text-center shrink-0">
                    {medal ? (
                      <span className="text-lg leading-none">{medal}</span>
                    ) : (
                      <span className="text-sm font-semibold text-[#AAAAAA] tabular-nums">{rang}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  {entree.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entree.avatarUrl} alt={initiales}
                         className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#185FA5] flex items-center justify-center
                                    text-white font-bold text-xs shrink-0 select-none">
                      {initiales}
                    </div>
                  )}

                  {/* Nom */}
                  <span className={`flex-1 text-sm font-medium min-w-0 truncate ${
                    isMe ? 'text-[#185FA5]' : 'text-[#1A1A1A]'
                  }`}>
                    {entree.nom}
                    {isMe && (
                      <span className="ml-1.5 text-[10px] font-normal text-[#185FA5]">(moi)</span>
                    )}
                  </span>

                  {/* Score */}
                  <span className={`text-sm font-bold tabular-nums shrink-0 ${
                    isMe ? 'text-[#185FA5]' : 'text-[#1A1A1A]'
                  }`}>
                    {entree.scoreBrut.toLocaleString('fr-FR')} pts
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
