'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

type Entrainement = {
  id: string;
  statut: 'en_cours' | 'boucle';
  mode: 'autonome' | 'assiste';
  created_at: string;
  nb_exercices: number;
};

type Cross = { x: number; y: number };

type ExoData = {
  id: string;
  type: 'mecanique' | 'chaotique';
  feuille_id: string;
  feuille_titre?: string;
  reference: string;
  reussi: boolean | null;
  crosses: Record<string, Cross[]>;
  validated: Record<string, boolean | null | undefined>;
};

// ── Géométrie roue ─────────────────────────────────────────────────────────────

const W = 640, H = 640, CX = 320, CY = 320;
const R_IN = 58, R_OUT = 230, R_LABEL = 256;
const BADGE_R = R_OUT + 20;

const SECTORS = [
  { key: 'C', label: 'Compréhension', color: '#3D7FD4', startAngle: -90 },
  { key: 'S', label: 'Savoir',        color: '#D4503D', startAngle: 30  },
  { key: 'R', label: 'Rédaction',     color: '#3DAF6B', startAngle: 150 },
] as const;

type SectorKey = typeof SECTORS[number]['key'];

const WEDGES: { id: string; sectorKey: SectorKey; color: string; a1: number; a2: number }[] = [];
SECTORS.forEach((s) => {
  for (let i = 0; i < 4; i++) {
    const a1 = s.startAngle + i * 30;
    WEDGES.push({ id: `${s.key}${i + 1}`, sectorKey: s.key, color: s.color, a1, a2: a1 + 30 });
  }
});

function rad(d: number) { return (d * Math.PI) / 180; }
function pt(a: number, r: number): [number, number] {
  return [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];
}
function wedgePath(a1: number, a2: number, r1: number, r2: number): string {
  const [x1, y1] = pt(a1, r1), [x2, y2] = pt(a1, r2);
  const [x3, y3] = pt(a2, r2), [x4, y4] = pt(a2, r1);
  return `M${x1},${y1}L${x2},${y2}A${r2},${r2} 0 0,1 ${x3},${y3}L${x4},${y4}A${r1},${r1} 0 0,0 ${x1},${y1}Z`;
}

// ── Roue lecture seule ─────────────────────────────────────────────────────────

function RoueReadOnly({ exo }: { exo: ExoData }) {
  const validated = exo.validated ?? {};
  const crosses   = exo.crosses   ?? {};
  const isMeca    = exo.type === 'mecanique';

  return (
    <div className="bg-white rounded-2xl border border-[#E8E0D4] overflow-hidden shadow-sm">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <rect width={W} height={H} fill="#FDFAF6" />

        {/* Fond des secteurs */}
        {WEDGES.map((w, i) => (
          <path
            key={w.id}
            d={wedgePath(w.a1, w.a2, R_IN, R_OUT)}
            fill={isMeca ? '#888888' : w.color}
            fillOpacity={i % 2 === 0 ? 0.09 : 0.04}
            stroke={isMeca ? '#AAAAAA' : w.color}
            strokeWidth="0.8"
            strokeOpacity="0.25"
          />
        ))}

        {/* Rayons de séparation */}
        {SECTORS.map((s) => {
          const [x, y] = pt(s.startAngle, R_OUT + 10);
          return (
            <line key={s.key} x1={CX} y1={CY} x2={x} y2={y}
              stroke={isMeca ? '#AAAAAA' : s.color} strokeWidth="2" strokeOpacity="0.45" />
          );
        })}

        {/* Cercles concentriques pointillés */}
        {([0.35, 0.67, 1] as const).map((f) => (
          <circle key={f} cx={CX} cy={CY}
            r={R_IN + (R_OUT - R_IN) * f}
            fill="none" stroke="#C8BBA8" strokeWidth="0.5" strokeDasharray="3,5" />
        ))}

        {/* Labels wedges C1–R4 */}
        {WEDGES.map((w) => {
          const [lx, ly] = pt((w.a1 + w.a2) / 2, R_LABEL + 30);
          return (
            <text key={w.id + 'l'} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="11.5" fontFamily="Georgia, serif"
              fill={isMeca ? '#AAAAAA' : w.color} fontWeight="700"
              style={{ userSelect: 'none' }}>
              {w.id}
            </text>
          );
        })}

        {/* Labels secteurs */}
        {SECTORS.map((s) => {
          const [lx, ly] = pt(s.startAngle + 60, R_LABEL + 52);
          return (
            <text key={s.key + 'sl'} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="9.5" fontFamily="Georgia, serif"
              fill={isMeca ? '#BBBBBB' : s.color} fontStyle="italic"
              style={{ userSelect: 'none' }}>
              {s.label}
            </text>
          );
        })}

        {/* Croix */}
        {WEDGES.flatMap((w) =>
          (crosses[w.id] ?? []).map((c, idx) => {
            const s = 7;
            const crossColor = isMeca ? '#777777' : w.color;
            return (
              <g key={`${w.id}-${idx}`}>
                <line x1={c.x - s} y1={c.y - s} x2={c.x + s} y2={c.y + s}
                  stroke={crossColor} strokeWidth="2.6" strokeLinecap="round" />
                <line x1={c.x + s} y1={c.y - s} x2={c.x - s} y2={c.y + s}
                  stroke={crossColor} strokeWidth="2.6" strokeLinecap="round" />
              </g>
            );
          })
        )}

        {/* Badges de validation (chaotique uniquement) */}
        {!isMeca && WEDGES.map((w) => {
          const mid = (w.a1 + w.a2) / 2;
          const [bx, by] = pt(mid, BADGE_R);
          const val = validated[w.id];
          return (
            <g key={w.id + 'badge'}>
              <circle cx={bx} cy={by} r={12}
                fill={val === true ? w.color : val === null ? '#E8E8E8' : '#FDFAF6'}
                stroke={w.color}
                strokeWidth="1.8"
                strokeOpacity={val === undefined ? 0.35 : 1}
              />
              <text x={bx} y={by + 0.5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={val === null ? '11' : '12'}
                fill={val === true ? 'white' : val === null ? '#999' : 'transparent'}
                fontWeight="bold"
                style={{ userSelect: 'none' }}>
                {val === true ? '✓' : '—'}
              </text>
            </g>
          );
        })}

        {/* Centre */}
        {isMeca ? (
          <circle cx={CX} cy={CY} r={R_IN} fill="#F0EDE8" stroke="#C8BBA8" strokeWidth="1.5" />
        ) : (() => {
          const b1 = validated['B1'];
          return (
            <>
              <circle cx={CX} cy={CY} r={R_IN}
                fill={b1 === true ? '#3DAF6B' : b1 === null ? '#E8E8E8' : '#FDFAF6'}
                stroke={b1 === true ? '#3DAF6B' : '#C8BBA8'}
                strokeWidth="1.5"
              />
              <text x={CX} y={CY - 7}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="16" fontWeight="bold"
                fill={b1 === true ? 'white' : b1 === null ? '#999' : '#8B7355'}
                style={{ userSelect: 'none' }}>
                {b1 === true ? '✓' : b1 === null ? '—' : 'B1'}
              </text>
              <text x={CX} y={CY + 11}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fontFamily="Georgia, serif"
                fill={b1 ? 'rgba(255,255,255,0.75)' : '#B0A090'}
                style={{ userSelect: 'none' }}>
                Bilan
              </text>
            </>
          );
        })()}
      </svg>
    </div>
  );
}

// ── Détail entraînement ────────────────────────────────────────────────────────

function EntrainementDetail({ exos }: { exos: ExoData[] }) {
  if (exos.length === 0) {
    return (
      <p className="text-xs text-[#AAAAAA] px-1 py-2">
        Aucune roue enregistrée pour cet entraînement.
      </p>
    );
  }
  return (
    <div className="space-y-5 pt-1">
      {exos.map((exo, i) => (
        <div key={exo.id ?? i} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold
                             flex items-center justify-center shrink-0 ${
              exo.type === 'mecanique' ? 'bg-[#185FA5]' : 'bg-[#534AB7]'
            }`}>
              {exo.type === 'mecanique' ? 'M' : 'C'}
            </span>
            <span className="text-sm font-medium text-[#1A1A1A]">{exo.reference}</span>
            {exo.feuille_titre && (
              <span className="text-xs text-[#AAAAAA] truncate">{exo.feuille_titre}</span>
            )}
            <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
              exo.reussi === true  ? 'bg-[#EAF3DE] text-[#639922]' :
              exo.reussi === false ? 'bg-red-50 text-red-500' :
                                     'bg-[#F3F3F3] text-[#999]'
            }`}>
              {exo.reussi === true ? '✓ Réussi' : exo.reussi === false ? '✗ Échoué' : 'En cours'}
            </span>
          </div>
          <div className="max-w-xs">
            <RoueReadOnly exo={exo} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function SessionPage() {
  const router = useRouter();
  const [entrainements, setEntrainements] = useState<Entrainement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [openId, setOpenId]               = useState<string | null>(null);
  const [grilles, setGrilles]             = useState<Map<string, ExoData[]>>(new Map());
  const [loadingGrille, setLoadingGrille] = useState<string | null>(null);

  useEffect(() => {
    loadEntrainements();
  }, []);

  async function loadEntrainements() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from('entrainement')
      .select('id, statut, mode, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) { setLoading(false); return; }

    const ids = data.map((e: any) => e.id);
    const { data: exos } = await supabase
      .from('exercice')
      .select('entrainement_id')
      .in('entrainement_id', ids);

    const counts: Record<string, number> = {};
    for (const exo of exos ?? []) {
      if (exo.entrainement_id) {
        counts[exo.entrainement_id] = (counts[exo.entrainement_id] ?? 0) + 1;
      }
    }

    setEntrainements(
      data.map((e: any) => ({ ...e, nb_exercices: counts[e.id] ?? 0 }))
    );
    setLoading(false);
  }

  async function loadGrilles(entrainementId: string) {
    if (grilles.has(entrainementId)) return;
    setLoadingGrille(entrainementId);
    const { data } = await supabase
      .from('grille_observation')
      .select('id, data, closed, created_at')
      .eq('entrainement_id', entrainementId)
      .order('created_at', { ascending: true });

    const exos: ExoData[] = (data ?? []).flatMap(
      (g: any) => (g.data?.exercices ?? []) as ExoData[]
    );
    setGrilles((prev) => new Map(prev).set(entrainementId, exos));
    setLoadingGrille(null);
  }

  function toggleOpen(id: string) {
    if (openId === id) {
      setOpenId(null);
    } else {
      setOpenId(id);
      loadGrilles(id);
    }
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#F5F4EF]">
      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="pt-2">
          <h1 className="text-xl font-bold text-[#1A1A1A]">Entraînement</h1>
          <p className="text-xs text-[#AAAAAA] mt-0.5 capitalize">{today}</p>
        </div>

        {/* ── Deux modes ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/session/autonome')}
            className="bg-white rounded-2xl border border-[#E8E8E8] p-5 text-left
                       hover:border-[#185FA5] hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E6F1FB] flex items-center justify-center mb-3
                            group-hover:bg-[#185FA5] transition-colors">
              <svg className="w-5 h-5 text-[#185FA5] group-hover:text-white transition-colors"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div className="font-semibold text-sm text-[#1A1A1A]">Autonome</div>
            <div className="text-xs text-[#AAAAAA] mt-0.5 leading-snug">
              Remplis ta grille toi-même
            </div>
          </button>

          <button
            onClick={() => router.push('/session/assiste')}
            className="bg-white rounded-2xl border border-[#E8E8E8] p-5 text-left
                       hover:border-[#185FA5] hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E6F1FB] flex items-center justify-center mb-3
                            group-hover:bg-[#185FA5] transition-colors">
              <svg className="w-5 h-5 text-[#185FA5] group-hover:text-white transition-colors"
                   fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="font-semibold text-sm text-[#1A1A1A]">Assisté</div>
            <div className="text-xs text-[#AAAAAA] mt-0.5 leading-snug">
              Travaille avec le coach IA
            </div>
          </button>
        </div>

        {/* ── Historique ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">Mes entraînements</h2>

          {loading ? (
            <div className="text-sm text-[#AAAAAA]">Chargement...</div>
          ) : entrainements.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center">
              <div className="text-[#CCC] text-sm">Aucun entraînement pour l'instant.</div>
              <div className="text-[#BBB] text-xs mt-1">Lance ton premier entraînement !</div>
            </div>
          ) : (
            <div className="space-y-2">
              {entrainements.map((e) => {
                const isEnCours = e.statut === 'en_cours';
                const isOpen    = openId === e.id;
                const date = new Date(e.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });

                if (isEnCours) {
                  return (
                    <button
                      key={e.id}
                      onClick={() => router.push(`/session/${e.mode}?entrainement_id=${e.id}`)}
                      className="w-full bg-white rounded-xl border border-amber-300
                                 hover:border-amber-400 p-4 text-left hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#1A1A1A]">{date}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                                            bg-amber-50 text-amber-600">
                              En cours
                            </span>
                          </div>
                          <div className="text-xs text-[#AAAAAA] mt-0.5 flex items-center gap-2">
                            <span className="capitalize">{e.mode}</span>
                            <span>·</span>
                            <span>{e.nb_exercices} exercice{e.nb_exercices > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-[#CCCCCC] shrink-0"
                             fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  );
                }

                return (
                  <div key={e.id}
                       className={`bg-white rounded-xl border transition-all ${
                         isOpen ? 'border-[#185FA5] shadow-sm' : 'border-[#E8E8E8]'
                       }`}>
                    {/* Card header */}
                    <button
                      onClick={() => toggleOpen(e.id)}
                      className="w-full p-4 text-left hover:bg-[#FAFAFA] transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#1A1A1A]">{date}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                                            bg-[#EAF3DE] text-[#639922]">
                              Bouclé
                            </span>
                          </div>
                          <div className="text-xs text-[#AAAAAA] mt-0.5 flex items-center gap-2">
                            <span className="capitalize">{e.mode}</span>
                            <span>·</span>
                            <span>{e.nb_exercices} exercice{e.nb_exercices > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <svg className={`w-4 h-4 text-[#CCCCCC] shrink-0 transition-transform ${
                               isOpen ? 'rotate-90' : ''
                             }`}
                             fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    {/* Panneau déplié */}
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-[#F0F0F0]">
                        {loadingGrille === e.id ? (
                          <p className="text-xs text-[#AAAAAA] py-3">Chargement des roues…</p>
                        ) : (
                          <EntrainementDetail exos={grilles.get(e.id) ?? []} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
