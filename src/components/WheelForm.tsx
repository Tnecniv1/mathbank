'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type Cross = { x: number; y: number };
export type MecaObservation = { id: string; reference: string; reussi: boolean | null };

export type Exercice = {
  id: string;
  type: 'mecanique' | 'chaotique';
  feuille_id: string;
  feuille_titre: string;
  reference: string;
  reussi: boolean | null;
  mecaList: MecaObservation[];
  validated: Record<string, boolean | null | undefined>;
  crosses: Record<string, Cross[]>;
};

// ── Géométrie roue ─────────────────────────────────────────────────────────────

export const W = 640, H = 640, CX = 320, CY = 320;
export const R_IN = 58, R_OUT = 230, R_LABEL = 256;
export const BADGE_R = R_OUT + 20;
export const BADGE_HIT = 16;

export const SECTORS = [
  { key: 'C', label: 'Compréhension', color: '#3D7FD4', startAngle: -90 },
  { key: 'S', label: 'Savoir',        color: '#D4503D', startAngle: 30  },
  { key: 'R', label: 'Rédaction',     color: '#3DAF6B', startAngle: 150 },
] as const;

export type SectorKey = typeof SECTORS[number]['key'];

export const WEDGES: {
  id: string; sectorKey: SectorKey; color: string; a1: number; a2: number;
}[] = [];
SECTORS.forEach((s) => {
  for (let i = 0; i < 4; i++) {
    const a1 = s.startAngle + i * 30;
    WEDGES.push({ id: `${s.key}${i + 1}`, sectorKey: s.key, color: s.color, a1, a2: a1 + 30 });
  }
});

export const EMPTY_CROSSES: Record<string, Cross[]> = {
  C1: [], C2: [], C3: [], C4: [],
  S1: [], S2: [], S3: [], S4: [],
  R1: [], R2: [], R3: [], R4: [],
  B1: [],
};

export function rad(d: number) { return (d * Math.PI) / 180; }
export function pt(a: number, r: number): [number, number] {
  return [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];
}
export function wedgePath(a1: number, a2: number, r1: number, r2: number): string {
  const [x1, y1] = pt(a1, r1), [x2, y2] = pt(a1, r2);
  const [x3, y3] = pt(a2, r2), [x4, y4] = pt(a2, r1);
  return `M${x1},${y1}L${x2},${y2}A${r2},${r2} 0 0,1 ${x3},${y3}L${x4},${y4}A${r1},${r1} 0 0,0 ${x1},${y1}Z`;
}
export function dist2(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}
export function toSvg(clientX: number, clientY: number, rect: DOMRect): [number, number] {
  return [
    (clientX - rect.left) * (W / rect.width),
    (clientY - rect.top)  * (H / rect.height),
  ];
}

// ── Roue SVG ───────────────────────────────────────────────────────────────────

export function WheelForm({
  exo,
  onChange,
  onClose,
  readonly = false,
}: {
  exo: Exercice;
  onChange: (id: string, patch: Partial<Exercice>) => void;
  onClose?: () => void;
  readonly?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [reference, setReference] = useState(exo.reference);
  useEffect(() => { setReference(exo.reference); }, [exo.id]);

  const validated = exo.validated ?? {};
  const crosses   = exo.crosses   ?? {};
  const isMeca    = exo.type === 'mecanique';

  const [undoStack, setUndoStack] = useState<string[]>([]);
  useEffect(() => { setUndoStack([]); }, [exo.id]);

  const hasCrosses = undoStack.length > 0 || WEDGES.some((w) => (crosses[w.id] ?? []).length > 0);

  const handleUndoLastCross = useCallback(() => {
    if (undoStack.length > 0) {
      const wid = undoStack[undoStack.length - 1];
      setUndoStack((s) => s.slice(0, -1));
      const arr = [...(crosses[wid] ?? [])];
      arr.splice(arr.length - 1, 1);
      onChange(exo.id, { crosses: { ...crosses, [wid]: arr } });
    } else {
      let lastWid: string | null = null;
      for (const w of WEDGES) { if ((crosses[w.id] ?? []).length > 0) lastWid = w.id; }
      if (!lastWid) return;
      const list = crosses[lastWid];
      onChange(exo.id, { crosses: { ...crosses, [lastWid]: list.slice(0, -1) } });
    }
  }, [undoStack, exo.id, crosses, onChange]);

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
        readOnly={readonly}
        onChange={readonly ? undefined : (e) => setReference(e.target.value)}
        onBlur={readonly ? undefined : () => { if (reference !== exo.reference) onChange(exo.id, { reference }); }}
        placeholder="Référence (ex: Exo 3)"
        className={`w-full px-3 py-2.5 bg-white border border-[#E8E8E8] rounded-xl text-sm
                   focus:outline-none focus:border-[#185FA5] transition-colors ${
          readonly ? 'cursor-default text-[#888]' : ''
        }`}
      />

      {/* Titre feuille */}
      {exo.feuille_titre && (
        <p className="text-xs text-[#AAAAAA] px-1">{exo.feuille_titre}</p>
      )}

      {/* SVG Roue */}
      <div className="bg-white rounded-2xl border border-[#E8E0D4] overflow-hidden shadow-sm">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          onClick={readonly ? undefined : handleClick}
          onTouchEnd={readonly ? undefined : handleTouch}
          style={{ display: 'block', cursor: readonly ? 'default' : 'crosshair', touchAction: 'none' }}
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
                <g key={`${w.id}-${idx}`} style={{ cursor: readonly ? 'default' : 'pointer' }}
                  onClick={readonly ? undefined : (e) => removeCross(e)}
                  onTouchEnd={readonly ? undefined : (e) => { e.preventDefault(); removeCross(e); }}
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
              <g key={w.id + 'badge'} style={{ cursor: readonly ? 'default' : 'pointer' }}
                onClick={readonly ? undefined : (e) => cycleBadge(e)}
                onTouchEnd={readonly ? undefined : (e) => { e.preventDefault(); cycleBadge(e); }}
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
              <g style={{ cursor: readonly ? 'default' : 'pointer' }}
                onClick={readonly ? undefined : (e) => cycleB1(e)}
                onTouchEnd={readonly ? undefined : (e) => { e.preventDefault(); cycleB1(e); }}
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
      {!readonly && (
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
      )}

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
      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white border border-[#E8E8E8] text-[#555]
                     font-semibold text-sm hover:bg-[#F5F5F5] transition-colors"
        >
          ← Retour à la liste
        </button>
      )}
    </div>
  );
}
