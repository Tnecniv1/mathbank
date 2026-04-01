'use client';

import React, { use, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

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

type Cross = { x: number; y: number };
type Session = { id: string; date: string; duree: string };

type RoueRow = {
  id: string;
  closed: boolean;
  updated_at: string;
  data: { exercices?: Exercice[]; meta?: { sessions?: Session[] } };
};

type MecaObservation = { id: string; reference: string; reussi: boolean | null };

type Exercice = {
  id: string;
  type: 'mecanique' | 'chaotique';
  feuille_id: string;
  feuille_titre: string;
  reference: string;
  reussi:   boolean | null;
  mecaList: MecaObservation[];
  validated: Record<string, boolean | null | undefined>;
  crosses:   Record<string, Cross[]>;
};

// ── Géométrie roue (identique à grille-roue.html) ─────────────────────────────

const W = 640, H = 640, CX = 320, CY = 320;
const R_IN = 58, R_OUT = 230, R_LABEL = 256;
const BADGE_R = R_OUT + 20;   // 250 — cercles de validation
const BADGE_HIT = 16;         // rayon de détection clic badge

const SECTORS = [
  { key: 'C', label: 'Compréhension', color: '#3D7FD4', startAngle: -90 },
  { key: 'S', label: 'Savoir',        color: '#D4503D', startAngle: 30  },
  { key: 'R', label: 'Rédaction',     color: '#3DAF6B', startAngle: 150 },
] as const;

type SectorKey = typeof SECTORS[number]['key'];

const WEDGES: {
  id: string; sectorKey: SectorKey; color: string; a1: number; a2: number;
}[] = [];
SECTORS.forEach((s) => {
  for (let i = 0; i < 4; i++) {
    const a1 = s.startAngle + i * 30;
    WEDGES.push({ id: `${s.key}${i + 1}`, sectorKey: s.key, color: s.color, a1, a2: a1 + 30 });
  }
});

const EMPTY_CROSSES: Record<string, Cross[]> = {
  C1: [], C2: [], C3: [], C4: [],
  S1: [], S2: [], S3: [], S4: [],
  R1: [], R2: [], R3: [], R4: [],
  B1: [],
};

function rad(d: number) { return (d * Math.PI) / 180; }
function pt(a: number, r: number): [number, number] {
  return [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];
}
function wedgePath(a1: number, a2: number, r1: number, r2: number): string {
  const [x1, y1] = pt(a1, r1), [x2, y2] = pt(a1, r2);
  const [x3, y3] = pt(a2, r2), [x4, y4] = pt(a2, r1);
  return `M${x1},${y1}L${x2},${y2}A${r2},${r2} 0 0,1 ${x3},${y3}L${x4},${y4}A${r1},${r1} 0 0,0 ${x1},${y1}Z`;
}
function dist2(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}
function toSvg(clientX: number, clientY: number, rect: DOMRect): [number, number] {
  return [
    (clientX - rect.left) * (W / rect.width),
    (clientY - rect.top)  * (H / rect.height),
  ];
}

// ── Roue SVG ───────────────────────────────────────────────────────────────────

function WheelForm({
  exo,
  onChange,
  onClose,
}: {
  exo: Exercice;
  onChange: (id: string, patch: Partial<Exercice>) => void;
  onClose: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [reference, setReference] = useState(exo.reference);
  useEffect(() => { setReference(exo.reference); }, [exo.id]);

  const validated = exo.validated ?? {};
  const crosses   = exo.crosses   ?? {};
  const isMeca    = exo.type === 'mecanique';

  // undoStack : trace le wedge de chaque croix posée (dans cette session)
  const [undoStack, setUndoStack] = useState<string[]>([]);
  useEffect(() => { setUndoStack([]); }, [exo.id]);

  const hasCrosses = undoStack.length > 0 || WEDGES.some((w) => (crosses[w.id] ?? []).length > 0);

  const handleUndoLastCross = useCallback(() => {
    if (undoStack.length > 0) {
      // Annuler la dernière croix posée dans cette session
      const wid = undoStack[undoStack.length - 1];
      setUndoStack((s) => s.slice(0, -1));
      const arr = [...(crosses[wid] ?? [])];
      arr.splice(arr.length - 1, 1);
      onChange(exo.id, { crosses: { ...crosses, [wid]: arr } });
    } else {
      // Fallback : retirer la dernière croix du dernier wedge non-vide
      let lastWid: string | null = null;
      for (const w of WEDGES) { if ((crosses[w.id] ?? []).length > 0) lastWid = w.id; }
      if (!lastWid) return;
      const list = crosses[lastWid];
      onChange(exo.id, { crosses: { ...crosses, [lastWid]: list.slice(0, -1) } });
    }
  }, [undoStack, exo.id, crosses, onChange]);

  // ── Logique d'interaction ────────────────────────────────────────────────────
  // Même logique que grille-roue.html handleClick : pose uniquement des croix.
  // Badges et B1 ont leurs propres onClick directs (stopPropagation).
  // Suppression des croix via onClick direct sur chaque <g> croix.
  const handleInteraction = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const [mx, my] = toSvg(clientX, clientY, rect);
    const dx = mx - CX, dy = my - CY;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < R_IN || r > R_OUT) return;
    const norm = (x: number) => ((x % 360) + 360) % 360;
    const deg  = (Math.atan2(dy, dx) * 180) / Math.PI;
    const wedge = WEDGES.find((w) => {
      const na = norm(deg - w.a1), sp = norm(w.a2 - w.a1);
      return na >= 0 && na < sp;
    });
    if (wedge) {
      onChange(exo.id, {
        crosses: { ...crosses, [wedge.id]: [...(crosses[wedge.id] ?? []), { x: mx, y: my }] },
      });
      setUndoStack((s) => [...s, wedge.id]);
    }
  }, [exo.id, crosses, onChange]);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    handleInteraction(e.clientX, e.clientY);
  }, [handleInteraction]);

  const handleTouch = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (t) handleInteraction(t.clientX, t.clientY);
  }, [handleInteraction]);

  const counts = SECTORS.map((s) => ({
    ...s,
    total: WEDGES.filter((w) => w.sectorKey === s.key && validated[w.id] === true).length,
  }));

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

      {/* Référence */}
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        onBlur={() => { if (reference !== exo.reference) onChange(exo.id, { reference }); }}
        placeholder="Référence (ex: Exo 3)"
        className="w-full px-3 py-2.5 bg-white border border-[#E8E8E8] rounded-xl text-sm
                   focus:outline-none focus:border-[#185FA5] transition-colors"
      />

      {/* SVG Roue */}
      <div className="bg-white rounded-2xl border border-[#E8E0D4] overflow-hidden shadow-sm">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          onClick={handleClick}
          onTouchEnd={handleTouch}
          style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        >
          <rect width={W} height={H} fill="#FDFAF6" />

          {/* ── Fond des secteurs ── */}
          {WEDGES.map((w, i) => (
            <path
              key={w.id}
              d={wedgePath(w.a1, w.a2, R_IN, R_OUT)}
              fill={w.color}
              fillOpacity={i % 2 === 0 ? 0.09 : 0.04}
              stroke={w.color}
              strokeWidth="0.8"
              strokeOpacity="0.25"
            />
          ))}

          {/* ── Rayons de séparation ── */}
          {SECTORS.map((s) => {
            const [x, y] = pt(s.startAngle, R_OUT + 10);
            return (
              <line key={s.key} x1={CX} y1={CY} x2={x} y2={y}
                stroke={s.color} strokeWidth="2" strokeOpacity="0.45" />
            );
          })}

          {/* ── Cercles concentriques pointillés ── */}
          {([0.35, 0.67, 1] as const).map((f) => (
            <circle key={f} cx={CX} cy={CY}
              r={R_IN + (R_OUT - R_IN) * f}
              fill="none" stroke="#C8BBA8" strokeWidth="0.5" strokeDasharray="3,5" />
          ))}

          {/* ── Labels wedges C1–R4 ── */}
          {WEDGES.map((w) => {
            const [lx, ly] = pt((w.a1 + w.a2) / 2, R_LABEL + 30);
            return (
              <text key={w.id + 'l'} x={lx} y={ly}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="11.5" fontFamily="Georgia, serif"
                fill={w.color} fontWeight="700"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {w.id}
              </text>
            );
          })}

          {/* ── Labels secteurs ── */}
          {SECTORS.map((s) => {
            const [lx, ly] = pt(s.startAngle + 60, R_LABEL + 52);
            return (
              <text key={s.key + 'sl'} x={lx} y={ly}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="9.5" fontFamily="Georgia, serif"
                fill={s.color} fontStyle="italic"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {s.label}
              </text>
            );
          })}

          {/* ── Croix libres dans les secteurs ── */}
          {WEDGES.flatMap((w) =>
            (crosses[w.id] ?? []).map((c, idx) => {
              const s = 7;
              const crossColor = w.color;
              const removeCross = (e: React.MouseEvent | React.TouchEvent) => {
                e.stopPropagation();
                const arr = [...(crosses[w.id] ?? [])];
                arr.splice(idx, 1);
                onChange(exo.id, { crosses: { ...crosses, [w.id]: arr } });
              };
              return (
                <g key={`${w.id}-${idx}`} style={{ cursor: 'pointer' }}
                  onClick={(e) => removeCross(e)}
                  onTouchEnd={(e) => { e.preventDefault(); removeCross(e); }}
                >
                  <circle cx={c.x} cy={c.y} r={s + 7} fill="transparent" />
                  <line x1={c.x - s} y1={c.y - s} x2={c.x + s} y2={c.y + s}
                    stroke={crossColor} strokeWidth="2.6" strokeLinecap="round" />
                  <line x1={c.x + s} y1={c.y - s} x2={c.x - s} y2={c.y + s}
                    stroke={crossColor} strokeWidth="2.6" strokeLinecap="round" />
                </g>
              );
            })
          )}

          {/* ── Badges de validation ── */}
          {WEDGES.map((w) => {
            const mid = (w.a1 + w.a2) / 2;
            const [bx, by] = pt(mid, BADGE_R);
            const val = validated[w.id];
            const cycleBadge = (e: React.MouseEvent | React.TouchEvent) => {
              e.stopPropagation();
              const cur = validated[w.id];
              const next = cur === undefined ? true : cur === true ? null : undefined;
              onChange(exo.id, { validated: { ...validated, [w.id]: next } });
            };
            return (
              <g key={w.id + 'badge'} style={{ cursor: 'pointer' }}
                onClick={(e) => cycleBadge(e)}
                onTouchEnd={(e) => { e.preventDefault(); cycleBadge(e); }}
              >
                <circle cx={bx} cy={by} r={20} fill="transparent" />
                <circle cx={bx} cy={by} r={12}
                  fill={val === true ? w.color : val === null ? '#B0A090' : '#FDFAF6'}
                  stroke={val === null ? '#B0A090' : w.color}
                  strokeWidth="1.8"
                />
                {val === true
                  ? <text x={bx} y={by + 0.5} textAnchor="middle" dominantBaseline="middle"
                      fontSize="12" fill="white" fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>✓</text>
                  : val === null
                    ? <text x={bx} y={by + 0.5} textAnchor="middle" dominantBaseline="middle"
                        fontSize="14" fill="white" fontWeight="bold"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>—</text>
                    : <circle cx={bx} cy={by} r={4}
                        fill="none" stroke={w.color} strokeWidth="1.2" opacity="0.35"
                        style={{ pointerEvents: 'none' }} />
                }
              </g>
            );
          })}

          {/* ── Centre ── */}
          {(() => {
            const b1 = validated['B1'];
            const cycleB1 = (e: React.MouseEvent | React.TouchEvent) => {
              e.stopPropagation();
              const cur = validated['B1'];
              const next = cur === undefined ? true : cur === true ? null : undefined;
              onChange(exo.id, { validated: { ...validated, B1: next } });
            };
            return (
              <g style={{ cursor: 'pointer' }}
                onClick={(e) => cycleB1(e)}
                onTouchEnd={(e) => { e.preventDefault(); cycleB1(e); }}
              >
                <circle cx={CX} cy={CY} r={R_IN}
                  fill={b1 === true ? '#3DAF6B' : b1 === null ? '#E8E8E8' : '#FDFAF6'}
                  stroke={b1 === true ? '#3DAF6B' : '#C8BBA8'}
                  strokeWidth="1.5"
                />
                <text x={CX} y={CY - 7}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="16" fontWeight="bold"
                  fill={b1 === true ? 'white' : b1 === null ? '#999' : '#8B7355'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {b1 === true ? '✓' : b1 === null ? '—' : 'B1'}
                </text>
                <text x={CX} y={CY + 11}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="8" fontFamily="Georgia, serif"
                  fill={b1 === true ? 'rgba(255,255,255,0.75)' : '#B0A090'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  Bilan
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* ── Annuler dernière croix ── */}
      <div className="flex justify-end">
        <button
          onClick={handleUndoLastCross}
          disabled={!hasCrosses}
          className="px-3 py-1.5 text-xs font-medium text-[#555] bg-white border border-[#E8E8E8]
                     rounded-lg hover:border-[#999] transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Annuler
        </button>
      </div>

      {/* ── Compteurs C / S / R (chaotique uniquement) ── */}
      {!isMeca && (
        <div className="grid grid-cols-3 gap-2">
          {counts.map((s) => (
            <div key={s.key} className="bg-white rounded-xl py-3 text-center border"
              style={{ borderColor: s.color + '44' }}>
              <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'Georgia, serif' }}>
                {s.total}
              </div>
              <div className="text-[10px] text-[#8B7355] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Légende ── */}
      <div className="text-center text-[10px] text-[#AAAAAA] leading-relaxed">
        Clic dans un secteur = ajouter une croix · Clic sur une croix = supprimer
        {!isMeca && <><br />Clic sur le cercle extérieur = valider le critère · Clic au centre = B1</>}
      </div>


      {/* ── Retour ── */}
      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                   font-semibold text-sm hover:bg-[#F5F5F5] transition-colors"
      >
        ← Retour à la liste
      </button>
    </div>
  );
}

// ── Liste des exercices ────────────────────────────────────────────────────────

function ExoList({
  exercices,
  onSelect,
  onRemove,
  feuilleMeca,
  feuilleChaos,
  onAddRoue,
  onBoucler,
  sessions,
  onSessionsChange,
}: {
  exercices: Exercice[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  feuilleMeca: Feuille | null;
  feuilleChaos: Feuille | null;
  onAddRoue: (type: 'mecanique' | 'chaotique') => void;
  onBoucler: () => void;
  sessions: Session[];
  onSessionsChange: (s: Session[]) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const hasExoEnCours = exercices.some(
    (e) => e.reussi !== true && e.reussi !== false && e.validated?.B1 === undefined,
  );

  const handleAddRoue = () => {
    if (feuilleMeca && feuilleChaos) {
      setShowPicker((v) => !v);
    } else if (feuilleMeca) {
      onAddRoue('mecanique');
    } else if (feuilleChaos) {
      onAddRoue('chaotique');
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {exercices.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E8E8] px-5 py-10 text-center">
          <p className="text-sm text-[#CCCCCC]">Aucun exercice pour l'instant.</p>
          <p className="text-xs text-[#DDDDDD] mt-1">Ajoute une roue ci-dessous.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exercices.map((exo) => (
            <div
              key={exo.id}
              className="w-full bg-white rounded-xl border border-[#E8E8E8] flex items-center
                         hover:border-[#185FA5] hover:shadow-sm transition-all"
            >
              <button
                onClick={() => onSelect(exo.id)}
                className="flex-1 px-4 py-3 text-left min-w-0"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-white text-[10px] font-bold
                                    flex items-center justify-center shrink-0 ${
                    exo.type === 'mecanique' ? 'bg-[#185FA5]' : 'bg-[#534AB7]'
                  }`}>
                    {exo.type === 'mecanique' ? 'M' : 'C'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1A1A1A]">{exo.reference}</div>
                    <div className="text-xs text-[#AAAAAA] truncate">{exo.feuille_titre}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                    exo.reussi === true  ? 'bg-[#EAF3DE] text-[#639922]' :
                    exo.reussi === false ? 'bg-red-50 text-red-500' :
                                           'bg-[#F3F3F3] text-[#999]'
                  }`}>
                    {exo.reussi === true ? '✓ Réussi' : exo.reussi === false ? '✗ Échoué' : 'En cours'}
                  </span>
                </div>
              </button>
              <button
                onClick={() => onRemove(exo.id)}
                className="shrink-0 px-3 py-3 text-[#CCCCCC] hover:text-red-400 transition-colors
                           text-lg leading-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}


      <div>
        <button
          onClick={handleAddRoue}
          disabled={hasExoEnCours || (!feuilleMeca && !feuilleChaos)}
          title={hasExoEnCours ? 'Un exercice est déjà en cours' : undefined}
          className="w-full py-2.5 rounded-xl border-2 border-[#185FA5] text-[#185FA5] font-semibold
                     text-sm hover:bg-[#E6F1FB] transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Roue
        </button>

        {showPicker && (
          <div className="mt-2 bg-white rounded-xl border border-[#E8E8E8] shadow-sm overflow-hidden">
            {feuilleMeca && (
              <button
                onClick={() => { setShowPicker(false); onAddRoue('mecanique'); }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#F5F5F5] transition-colors
                           flex items-center gap-3 border-b border-[#F0F0F0]"
              >
                <span className="w-5 h-5 rounded-full bg-[#185FA5] text-white text-[9px] font-bold
                                 flex items-center justify-center shrink-0">M</span>
                <span className="font-medium text-[#1A1A1A]">{feuilleMeca.titre}</span>
                <span className="text-[#AAAAAA] text-xs ml-auto">Mécanique</span>
              </button>
            )}
            {feuilleChaos && (
              <button
                onClick={() => { setShowPicker(false); onAddRoue('chaotique'); }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#F5F5F5] transition-colors
                           flex items-center gap-3"
              >
                <span className="w-5 h-5 rounded-full bg-[#534AB7] text-white text-[9px] font-bold
                                 flex items-center justify-center shrink-0">C</span>
                <span className="font-medium text-[#1A1A1A]">{feuilleChaos.titre}</span>
                <span className="text-[#AAAAAA] text-xs ml-auto">Chaotique</span>
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Hub des roues ─────────────────────────────────────────────────────────────

function RoueHub({
  allRoues,
  feuilleMeca,
  feuilleChaos,
  onReprendre,
  onNouvelle,
}: {
  allRoues:     RoueRow[];
  feuilleMeca:  Feuille | null;
  feuilleChaos: Feuille | null;
  onReprendre:  (row: RoueRow) => void;
  onNouvelle:   (type: 'mecanique' | 'chaotique') => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const openRoue    = allRoues.find((r) => !r.closed) ?? null;
  const closedRoues = allRoues.filter((r) => r.closed);
  const hasOpen     = !!openRoue;

  const handleNouvelle = () => {
    if (hasOpen) return;
    if (feuilleMeca && feuilleChaos) { setShowPicker((v) => !v); }
    else if (feuilleMeca)            { onNouvelle('mecanique'); }
    else if (feuilleChaos)           { onNouvelle('chaotique'); }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const nbExos = (r: RoueRow) => (r.data.exercices ?? []).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Roue en cours */}
      {openRoue && (
        <div className="bg-white rounded-xl border border-[#185FA5] px-4 py-4
                        flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold text-[#185FA5] uppercase tracking-wide mb-1">
              En cours
            </div>
            <div className="text-sm font-medium text-[#1A1A1A]">
              {nbExos(openRoue)} exercice{nbExos(openRoue) !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-[#AAAAAA]">{fmt(openRoue.updated_at)}</div>
          </div>
          <button
            onClick={() => onReprendre(openRoue)}
            className="px-4 py-2 rounded-lg bg-[#185FA5] text-white text-sm font-semibold
                       hover:bg-[#0E4A8A] transition-colors shrink-0"
          >
            Reprendre →
          </button>
        </div>
      )}

      {/* Roues bouclées */}
      {closedRoues.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wide px-1">
            Bouclées
          </div>
          {closedRoues.map((r) => (
            <div key={r.id}
              className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3
                         flex items-center justify-between">
              <div>
                <div className="text-sm text-[#1A1A1A]">
                  {nbExos(r)} exercice{nbExos(r) !== 1 ? 's' : ''}
                </div>
                <div className="text-xs text-[#AAAAAA]">{fmt(r.updated_at)}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                               bg-[#EAF3DE] text-[#639922]">
                Bouclée
              </span>
            </div>
          ))}
        </div>
      )}

      {/* État vide */}
      {!openRoue && closedRoues.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E8E8E8] px-5 py-10 text-center">
          <p className="text-sm text-[#CCCCCC]">Aucune session pour l'instant.</p>
          <p className="text-xs text-[#DDDDDD] mt-1">Démarre une nouvelle roue ci-dessous.</p>
        </div>
      )}

      {/* Nouvelle roue */}
      <div>
        <button
          onClick={handleNouvelle}
          disabled={hasOpen || (!feuilleMeca && !feuilleChaos)}
          title={hasOpen ? 'Une roue est déjà en cours' : undefined}
          className="w-full py-2.5 rounded-xl border-2 border-[#185FA5] text-[#185FA5] font-semibold
                     text-sm hover:bg-[#E6F1FB] transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Nouvelle roue
        </button>
        {showPicker && !hasOpen && (
          <div className="mt-2 bg-white rounded-xl border border-[#E8E8E8] shadow-sm overflow-hidden">
            {feuilleMeca && (
              <button
                onClick={() => { setShowPicker(false); onNouvelle('mecanique'); }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#F5F5F5] transition-colors
                           flex items-center gap-3 border-b border-[#F0F0F0]"
              >
                <span className="w-5 h-5 rounded-full bg-[#185FA5] text-white text-[9px] font-bold
                                 flex items-center justify-center shrink-0">M</span>
                <span className="font-medium text-[#1A1A1A]">{feuilleMeca.titre}</span>
                <span className="text-[#AAAAAA] text-xs ml-auto">Mécanique</span>
              </button>
            )}
            {feuilleChaos && (
              <button
                onClick={() => { setShowPicker(false); onNouvelle('chaotique'); }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-[#F5F5F5] transition-colors
                           flex items-center gap-3"
              >
                <span className="w-5 h-5 rounded-full bg-[#534AB7] text-white text-[9px] font-bold
                                 flex items-center justify-center shrink-0">C</span>
                <span className="font-medium text-[#1A1A1A]">{feuilleChaos.titre}</span>
                <span className="text-[#AAAAAA] text-xs ml-auto">Chaotique</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AutonomePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const entrainementId = use(params).id;

  const [ctx, setCtx]               = useState<SessionContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError]     = useState<string | null>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [exercices, setExercices]   = useState<Exercice[]>([]);
  const [activeExoId, setActiveExoId] = useState<string | null>(null);
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [bouclageLoading, setBouclageLoading] = useState(false);
  const [bouclageError, setBouclageError]     = useState<string | null>(null);
  const [allRoues, setAllRoues]               = useState<RoueRow[]>([]);
  const [roueeActive, setRoueeActive]         = useState(false);

  // ── Persistance ───────────────────────────────────────────────────────────────
  const roueeId      = useRef<string | null>(null);   // ID de la ligne grille_observation
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionsRef  = useRef<Session[]>([]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  const feuilleMeca  = ctx?.feuilles.find((f) => f.type === 'mecanique') ?? null;
  const feuilleChaos = ctx?.feuilles.find((f) => f.type === 'chaotique') ?? null;
  const activeExo    = exercices.find((e) => e.id === activeExoId) ?? null;

  const today    = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().slice(0, 10);

  // ── Upsert grille_observation ─────────────────────────────────────────────────
  const saveToSupabase = useCallback(async (
    exos: Exercice[],
    sess: Session[],
    closed: boolean,
  ): Promise<void> => {
    if (!userId) return;
    if (!roueeId.current) roueeId.current = Date.now().toString();
    const id     = roueeId.current;
    const feuille = feuilleMeca?.titre ?? feuilleChaos?.titre ?? '';
    const { error } = await supabase.from('grille_observation').upsert({
      id,
      user_id:         userId,
      data:            { id, meta: { feuille, sessions: sess }, exercices: exos, closed },
      closed,
      inserted:        false,
      entrainement_id: entrainementId,
      updated_at:      new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }, [userId, entrainementId, feuilleMeca, feuilleChaos]);

  // Debounce 2 s — identique à grille-roue.html scheduleSave
  const scheduleAutoSave = useCallback((exos: Exercice[], sess: Session[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToSupabase(exos, sess, false).catch(console.error);
    }, 2000);
  }, [saveToSupabase]);

  // ── Init ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserId(session.user.id);

      try {
        const data: SessionContext = await fetch('/api/session/context').then((r) => r.json());
        setCtx(data);
      } catch (err: any) {
        setCtxError(err.message ?? 'Erreur de chargement');
      }

      // ── Charger toutes les roues pour cet entrainement ─────────────────────
      try {
        const { data: rows } = await supabase
          .from('grille_observation')
          .select('id, closed, updated_at, data')
          .eq('entrainement_id', entrainementId)
          .or('inserted.eq.false,inserted.is.null')
          .order('updated_at', { ascending: false });

        if (rows) setAllRoues(rows as RoueRow[]);
      } catch {
        // Pas de roues — démarrage vide normal
      }

      setCtxLoading(false);
    };
    init();
  }, [entrainementId]);

  // ── Lire session_id depuis l'URL ──────────────────────────────────────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session_id');
    if (id) setSessionId(id);
  }, []);

  // ── Exercices ─────────────────────────────────────────────────────────────────
  const addExercice = useCallback(async (type: 'mecanique' | 'chaotique') => {
    const feuille = type === 'mecanique' ? feuilleMeca : feuilleChaos;
    if (!feuille) return;
    const sameType = exercices.filter((e) => e.type === type).length;
    const newExo: Exercice = {
      id:            Date.now().toString(),
      type,
      feuille_id:    feuille.id,
      feuille_titre: feuille.titre,
      reference:     `Exo${feuille.prochain_exercice + sameType}`,
      reussi:        null,
      mecaList:      [],
      validated:     {},
      crosses:       Object.fromEntries(Object.keys(EMPTY_CROSSES).map((k) => [k, []])),
    };
    const next = [...exercices, newExo];
    setExercices(next);
    setActiveExoId(newExo.id);
    setRoueeActive(true);
    scheduleAutoSave(next, sessionsRef.current);
  }, [exercices, feuilleMeca, feuilleChaos, scheduleAutoSave]);

  const updateExercice = useCallback((id: string, patch: Partial<Exercice>) => {
    const next = exercices.map((e) => e.id === id ? { ...e, ...patch } : e);
    setExercices(next);
    scheduleAutoSave(next, sessionsRef.current);
  }, [exercices, scheduleAutoSave]);

  // ── CORRECTION 3 : suppression d'exercice ────────────────────────────────────
  const removeExercice = useCallback((id: string) => {
    setExercices((prev) => {
      const next = prev.filter((e) => e.id !== id);
      scheduleAutoSave(next, sessionsRef.current);
      return next;
    });
    setActiveExoId((cur) => cur === id ? null : cur);
  }, [scheduleAutoSave]);

  // ── Charger une roue existante ───────────────────────────────────────────────
  const loadRoue = useCallback((row: RoueRow) => {
    roueeId.current = row.id;
    const exos = (row.data.exercices ?? []) as Exercice[];
    const sess = (row.data.meta?.sessions ?? []) as Session[];
    setExercices(exos);
    setSessions(sess);
    sessionsRef.current = sess;
    setRoueeActive(true);
    if (exos.length > 0) setActiveExoId(exos[0].id);
  }, []);

  // ── Sessions avec sauvegarde ──────────────────────────────────────────────────
  const handleSessionsChange = useCallback((s: Session[]) => {
    setSessions(s);
    sessionsRef.current = s;
    setExercices((prev) => { scheduleAutoSave(prev, s); return prev; });
  }, [scheduleAutoSave]);

  // ── Actions contextuelles — exercice individuel ───────────────────────────────
  const bouclerExo = useCallback(() => {
    if (!activeExo) return;
    const b1 = activeExo.validated?.B1;
    const reussi = b1 === true ? true : b1 === null ? false : null;
    updateExercice(activeExo.id, { reussi });
    setActiveExoId(null);
  }, [activeExo, updateExercice]);

  const reporterExo = useCallback(() => {
    setActiveExoId(null);
  }, []);

  const abandonnerExo = useCallback(() => {
    if (!activeExo) return;
    removeExercice(activeExo.id);
  }, [activeExo, removeExercice]);

  // ── Boucler ───────────────────────────────────────────────────────────────────
  const boucler = async () => {
    // Annuler le debounce en cours et sauvegarder immédiatement avec closed=true
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setBouclageLoading(true);
    setBouclageError(null);
    try {
      await saveToSupabase(exercices, sessionsRef.current, true);
    } catch (err: any) {
      setBouclageError(err.message ?? 'Erreur de sauvegarde');
      setBouclageLoading(false);
      return;
    }
    if (sessionId) {
      await supabase.from('session').update({ closed: true }).eq('id', sessionId);
    }
    router.push(`/entrainement/${entrainementId}`);
  };

  // ── Loading / Error ───────────────────────────────────────────────────────────
  if (ctxLoading) return (
    <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center">
      <span className="text-sm text-[#999]">Chargement…</span>
    </div>
  );

  if (ctxError) return (
    <div className="min-h-screen bg-[#F5F4EF] flex items-center justify-center p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm text-center">
        <p className="text-red-700 text-sm">{ctxError}</p>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F4EF] flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-[#E8E8E8] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={activeExo ? () => setActiveExoId(null) : () => router.push(`/entrainement/${entrainementId}`)}
              className="text-sm text-[#185FA5] font-medium shrink-0 hover:underline"
            >
              {activeExo ? '← Liste' : '← Retour'}
            </button>
            <div className="min-w-0">
              <div className="text-[11px] text-[#AAAAAA] leading-tight">{today} · Autonome</div>
              <div className="text-sm font-semibold text-[#1A1A1A] truncate">
                {activeExo
                  ? `${activeExo.type === 'mecanique' ? 'Mécanique' : 'Chaotique'} · ${activeExo.reference}`
                  : 'Grille d\'observation'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bouclageError && (
              <span className="text-[10px] text-red-500 max-w-[120px] leading-tight">
                {bouclageError}
              </span>
            )}
            {activeExo ? (
              <>
                <button
                  onClick={bouclerExo}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold
                             hover:bg-green-700 transition-colors"
                >
                  Boucler
                </button>
                <button
                  onClick={reporterExo}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#E8E8E8] text-[#555]
                             text-xs font-semibold hover:border-[#999] transition-colors"
                >
                  Reporter
                </button>
                <button
                  onClick={abandonnerExo}
                  className="px-3 py-1.5 rounded-lg text-red-400 text-xs font-semibold
                             hover:text-red-600 transition-colors"
                >
                  Abandonner
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={boucler}
                  disabled={bouclageLoading}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold
                             hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bouclageLoading ? '…' : 'Terminer'}
                </button>
                <button
                  onClick={() => router.push(`/entrainement/${entrainementId}`)}
                  className="text-xs text-[#AAAAAA] hover:text-[#555] transition-colors"
                >
                  Reporter
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto">
        {activeExo ? (
          <WheelForm exo={activeExo} onChange={updateExercice} onClose={() => setActiveExoId(null)} />
        ) : roueeActive ? (
          <ExoList
            exercices={exercices}
            onSelect={setActiveExoId}
            onRemove={removeExercice}
            feuilleMeca={feuilleMeca}
            feuilleChaos={feuilleChaos}
            onAddRoue={addExercice}
            onBoucler={boucler}
            sessions={sessions}
            onSessionsChange={handleSessionsChange}
          />
        ) : (
          <RoueHub
            allRoues={allRoues}
            feuilleMeca={feuilleMeca}
            feuilleChaos={feuilleChaos}
            onReprendre={loadRoue}
            onNouvelle={addExercice}
          />
        )}
      </div>
    </div>
  );
}
