'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  // ── Logique d'interaction ────────────────────────────────────────────────────
  const handleInteraction = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const [mx, my] = toSvg(clientX, clientY, rect);
    const dx = mx - CX, dy = my - CY;
    const r = Math.sqrt(dx * dx + dy * dy);

    if (exo.type !== 'mecanique') {
      // 1. Badge de validation extérieur (cercles à BADGE_R) — cycle 3 états
      const cycleVal = (cur: boolean | null | undefined): boolean | null | undefined =>
        (cur === undefined || cur === false) ? true : cur === true ? null : undefined;

      for (const w of WEDGES) {
        const mid = (w.a1 + w.a2) / 2;
        const [bx, by] = pt(mid, BADGE_R);
        if (dist2(mx, my, bx, by) <= BADGE_HIT) {
          onChange(exo.id, { validated: { ...validated, [w.id]: cycleVal(validated[w.id]) } });
          return;
        }
      }

      // 2. Centre B1 — même cycle 3 états
      if (r < R_IN) {
        onChange(exo.id, { validated: { ...validated, B1: cycleVal(validated['B1']) } });
        return;
      }
    } else if (r < R_IN) {
      return;
    }

    // 3. À l'intérieur d'un secteur
    if (r >= R_IN && r <= R_OUT) {
      // a. Clic sur une croix existante → supprimer
      for (const [wid, list] of Object.entries(crosses)) {
        for (let i = 0; i < list.length; i++) {
          if (dist2(mx, my, list[i].x, list[i].y) <= 15) {
            const next = [...list];
            next.splice(i, 1);
            onChange(exo.id, { crosses: { ...crosses, [wid]: next } });
            return;
          }
        }
      }
      // b. Ajouter une croix dans le secteur ciblé
      const norm = (x: number) => ((x % 360) + 360) % 360;
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const wedge = WEDGES.find((w) => {
        const na = norm(deg - w.a1), sp = norm(w.a2 - w.a1);
        return na >= 0 && na < sp;
      });
      if (wedge) {
        onChange(exo.id, {
          crosses: { ...crosses, [wedge.id]: [...(crosses[wedge.id] ?? []), { x: mx, y: my }] },
        });
      }
    }
  }, [exo.id, exo.type, validated, crosses, onChange]);

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
              fill={isMeca ? '#888888' : w.color}
              fillOpacity={i % 2 === 0 ? 0.09 : 0.04}
              stroke={isMeca ? '#AAAAAA' : w.color}
              strokeWidth="0.8"
              strokeOpacity="0.25"
            />
          ))}

          {/* ── Rayons de séparation ── */}
          {SECTORS.map((s) => {
            const [x, y] = pt(s.startAngle, R_OUT + 10);
            return (
              <line key={s.key} x1={CX} y1={CY} x2={x} y2={y}
                stroke={isMeca ? '#AAAAAA' : s.color} strokeWidth="2" strokeOpacity="0.45" />
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
                fill={isMeca ? '#AAAAAA' : w.color} fontWeight="700"
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
                fill={isMeca ? '#BBBBBB' : s.color} fontStyle="italic"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {s.label}
              </text>
            );
          })}

          {/* ── Croix libres dans les secteurs ── */}
          {WEDGES.flatMap((w) =>
            (crosses[w.id] ?? []).map((c, idx) => {
              const s = 7;
              const crossColor = isMeca ? '#777777' : w.color;
              return (
                <g key={`${w.id}-${idx}`} style={{ cursor: 'pointer' }}>
                  <circle cx={c.x} cy={c.y} r={s + 7} fill="transparent" />
                  <line x1={c.x - s} y1={c.y - s} x2={c.x + s} y2={c.y + s}
                    stroke={crossColor} strokeWidth="2.6" strokeLinecap="round" />
                  <line x1={c.x + s} y1={c.y - s} x2={c.x - s} y2={c.y + s}
                    stroke={crossColor} strokeWidth="2.6" strokeLinecap="round" />
                </g>
              );
            })
          )}

          {/* ── Badges de validation (chaotique uniquement) ── */}
          {!isMeca && WEDGES.map((w) => {
            const mid = (w.a1 + w.a2) / 2;
            const [bx, by] = pt(mid, BADGE_R);
            const val = validated[w.id];
            return (
              <g key={w.id + 'badge'} style={{ cursor: 'pointer' }}>
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
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {val === true ? '✓' : '—'}
                </text>
              </g>
            );
          })}

          {/* ── Centre ── */}
          {isMeca ? (
            <circle cx={CX} cy={CY} r={R_IN} fill="#F0EDE8" stroke="#C8BBA8" strokeWidth="1.5" />
          ) : (
            <>
              {(() => {
                const b1 = validated['B1'];
                return (
                  <>
                    <circle cx={CX} cy={CY} r={R_IN}
                      fill={b1 === true ? '#3DAF6B' : b1 === null ? '#E8E8E8' : '#FDFAF6'}
                      stroke={b1 === true ? '#3DAF6B' : '#C8BBA8'}
                      strokeWidth="1.5"
                      style={{ cursor: 'pointer' }}
                    />
                    <text x={CX} y={CY - 7}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="16" fontWeight="bold"
                      fill={b1 === true ? 'white' : b1 === null ? '#999' : '#8B7355'}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {b1 === true ? '✓' : b1 === null ? '—' : 'B1'}
                    </text>
                  </>
                );
              })()}
              <text x={CX} y={CY + 11}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fontFamily="Georgia, serif"
                fill={validated['B1'] ? 'rgba(255,255,255,0.75)' : '#B0A090'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                Bilan
              </text>
            </>
          )}
        </svg>
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

      {/* ── Résultat global ── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onChange(exo.id, { reussi: exo.reussi === true ? null : true })}
          className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
            exo.reussi === true
              ? 'bg-[#EAF3DE] text-[#639922] border-[#A3C76A]'
              : 'bg-white text-[#999] border-[#E8E8E8] hover:border-[#A3C76A]'
          }`}
        >
          ✓ Réussi
        </button>
        <button
          onClick={() => onChange(exo.id, { reussi: exo.reussi === false ? null : false })}
          className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
            exo.reussi === false
              ? 'bg-red-50 text-red-500 border-red-300'
              : 'bg-white text-[#999] border-[#E8E8E8] hover:border-red-300'
          }`}
        >
          ✗ Échoué
        </button>
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
  feuilleMeca,
  feuilleChaos,
  onAddRoue,
  onBoucler,
  sessions,
  onSessionsChange,
}: {
  exercices: Exercice[];
  onSelect: (id: string) => void;
  feuilleMeca: Feuille | null;
  feuilleChaos: Feuille | null;
  onAddRoue: (type: 'mecanique' | 'chaotique') => void;
  onBoucler: () => void;
  sessions: Session[];
  onSessionsChange: (s: Session[]) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const todayISO = new Date().toISOString().slice(0, 10);

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
            <button
              key={exo.id}
              onClick={() => onSelect(exo.id)}
              className="w-full bg-white rounded-xl border border-[#E8E8E8] px-4 py-3 text-left
                         hover:border-[#185FA5] hover:shadow-sm transition-all"
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
          ))}
        </div>
      )}

      {/* Sessions */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] px-3 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wide">Sessions</span>
          <button
            onClick={() => onSessionsChange([...sessions, { id: Date.now().toString(), date: todayISO, duree: '' }])}
            className="text-xs text-[#185FA5] font-semibold hover:underline"
          >
            + Ajouter une session
          </button>
        </div>
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <input
              type="date"
              value={s.date}
              onChange={(e) => onSessionsChange(sessions.map((x) => x.id === s.id ? { ...x, date: e.target.value } : x))}
              className="flex-1 px-2 py-1.5 bg-[#F9F9F9] border border-[#E8E8E8] rounded-lg text-xs
                         focus:outline-none focus:border-[#185FA5]"
            />
            <input
              type="text"
              value={s.duree}
              placeholder="30min"
              onChange={(e) => onSessionsChange(sessions.map((x) => x.id === s.id ? { ...x, duree: e.target.value } : x))}
              className="w-20 px-2 py-1.5 bg-[#F9F9F9] border border-[#E8E8E8] rounded-lg text-xs
                         focus:outline-none focus:border-[#185FA5]"
            />
            <button
              onClick={() => onSessionsChange(sessions.filter((x) => x.id !== s.id))}
              className="text-[#CCCCCC] hover:text-red-400 transition-colors text-lg leading-none px-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div>
        <button
          onClick={handleAddRoue}
          disabled={!feuilleMeca && !feuilleChaos}
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

      {exercices.length > 0 && (
        <button
          onClick={onBoucler}
          className="w-full py-3 rounded-xl bg-[#2C1810] text-[#FDFAF6] font-semibold text-sm
                     hover:bg-[#3D2418] transition-colors"
        >
          Boucler la feuille
        </button>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AutonomePage() {
  const router = useRouter();

  const [ctx, setCtx]               = useState<SessionContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError]     = useState<string | null>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [entrainementId, setEntrainementId] = useState<string | null>(null);
  const [exercices, setExercices]   = useState<Exercice[]>([]);
  const [activeExoId, setActiveExoId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | null>(null);
  const [sessions, setSessions]     = useState<Session[]>([]);

  const sessionId  = useRef<string>(Date.now().toString());
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const feuilleMeca  = ctx?.feuilles.find((f) => f.type === 'mecanique') ?? null;
  const feuilleChaos = ctx?.feuilles.find((f) => f.type === 'chaotique') ?? null;
  const activeExo    = exercices.find((e) => e.id === activeExoId) ?? null;

  const today    = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().slice(0, 10);

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
      } finally {
        setCtxLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('entrainement_id');
    if (id) setEntrainementId(id);
  }, [userId]);

  // ── Entrainement ──────────────────────────────────────────────────────────────
  const ensureEntrainement = useCallback(async (): Promise<string | null> => {
    if (entrainementId) return entrainementId;
    if (!userId) return null;
    const { data, error } = await supabase
      .from('entrainement')
      .insert({ user_id: userId, statut: 'en_cours', mode: 'autonome' })
      .select('id')
      .single();
    if (!error && data) { setEntrainementId(data.id); return data.id; }
    console.error('[autonome] create entrainement error:', error);
    return null;
  }, [entrainementId, userId]);

  // ── Sauvegarde ────────────────────────────────────────────────────────────────
  const saveGrille = useCallback((exos: Exercice[], eid: string | null, closed = false) => {
    if (!userId) return;
    const payload = {
      id:              sessionId.current,
      user_id:         userId,
      closed,
      inserted:        false,
      entrainement_id: eid ?? null,
      data: {
        id:   sessionId.current,
        meta: {
          user_id:  userId,
          feuille:  exos[0]?.feuille_titre ?? '',
          sessions,
          nom: '', prenom: '', note: '',
        },
        exercices:       exos,
        entrainement_id: eid ?? null,
        closed,
        inserted: false,
      },
    };
    supabase.from('grille_observation').upsert(payload).then(({ error }) => {
      if (error) console.error('[autonome] save error:', error);
      else {
        setSaveStatus('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveStatus(null), 2500);
      }
    });
  }, [userId, sessions]);

  const scheduleSave = useCallback((exos: Exercice[], eid: string | null) => {
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveGrille(exos, eid), 1000);
  }, [saveGrille]);

  // ── Exercices ─────────────────────────────────────────────────────────────────
  const addExercice = async (type: 'mecanique' | 'chaotique') => {
    const feuille = type === 'mecanique' ? feuilleMeca : feuilleChaos;
    if (!feuille) return;
    const eid = await ensureEntrainement();
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
    scheduleSave(next, eid);
  };

  const updateExercice = useCallback((id: string, patch: Partial<Exercice>) => {
    setExercices((prev) => {
      const next = prev.map((e) => e.id === id ? { ...e, ...patch } : e);
      scheduleSave(next, entrainementId);
      return next;
    });
  }, [scheduleSave, entrainementId]);

  // ── Boucler ───────────────────────────────────────────────────────────────────
  const boucler = async () => {
    const eid = entrainementId ?? await ensureEntrainement();
    saveGrille(exercices, eid, true);
    if (eid) {
      await supabase
        .from('entrainement')
        .update({ statut: 'boucle', updated_at: new Date().toISOString() })
        .eq('id', eid);
    }
    router.push('/session');
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
              onClick={activeExo ? () => setActiveExoId(null) : () => router.push('/session')}
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
            {saveStatus === 'saving' && <span className="text-[10px] text-[#AAAAAA] hidden sm:inline">Sauvegarde…</span>}
            {saveStatus === 'saved'  && <span className="text-[10px] text-green-500 hidden sm:inline">✓ Sauvegardé</span>}
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
              Plus tard
            </button>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto">
        {activeExo ? (
          <WheelForm exo={activeExo} onChange={updateExercice} onClose={() => setActiveExoId(null)} />
        ) : (
          <ExoList
            exercices={exercices}
            onSelect={setActiveExoId}
            feuilleMeca={feuilleMeca}
            feuilleChaos={feuilleChaos}
            onAddRoue={addExercice}
            onBoucler={boucler}
            sessions={sessions}
            onSessionsChange={setSessions}
          />
        )}
      </div>
    </div>
  );
}
