'use client';

import React from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */
interface Etape {
  id?: string;
  numero: number;
  titre_snapshot: string;
  statut: string; // 'validee' | 'en_cours' | 'en_attente'
  validee_at?: string | null;
  autorisee_at?: string | null;
  chapitre_snapshot?: string | null;
  clot_noeud?: boolean;
  feuille_id?: string;
  type?: string | null;
}

interface Props {
  etapes: Etape[];
}

type Groupe = {
  chapitre_snapshot: string | null;
  etapes: Etape[];
};

/* ─── Palette ────────────────────────────────────────────────────── */
const C = {
  fond:                 '#FFFFFF',
  encre:                '#2C1810',
  ligne:                '#D0C5B5',
  muted:                '#8B7355',
  noeud_valide:         '#1D9E75',
  noeud_encours:        '#7F77DD',
  noeud_border_valide:  '#0F6E56',
  noeud_border_encours: '#534AB7',
  connector_fe:         '#AFA9EC',
  depart_fond:          '#F5C4B3',
  depart_border:        '#D85A30',
} as const;

/* ─── Layout (coordonnées fixes pour le SVG) ─────────────────────── */
const NOEUD_W     = 200;
const NOEUD_H     = 56;
const NOEUD_HALF  = NOEUD_W / 2;    // 100
const FE_ROW_H    = 68;
const FE_W        = 200;
const GROUP_MB    = 60;
const BRACKET_GAP = 28;
const BRANCH_LEN  = 32;
const CONTAINER_W = 780;
const CENTER      = CONTAINER_W / 2; // 390

// Nœud bornes
const NOEUD_LEFT  = CENTER - NOEUD_HALF; // 290
const NOEUD_RIGHT = CENTER + NOEUD_HALF; // 490

// Positions côté droit (groupes pairs 0, 2, 4…)
const R_SPINE = NOEUD_RIGHT + BRACKET_GAP; // 518
const R_FE_L  = R_SPINE + BRANCH_LEN;      // 550

// Positions côté gauche (groupes impairs 1, 3, 5…)
const L_SPINE = NOEUD_LEFT - BRACKET_GAP;  // 262
const L_FE_R  = L_SPINE - BRANCH_LEN;      // 230
const L_FE_L  = L_FE_R - FE_W;             // 30

/* ─── Helpers ────────────────────────────────────────────────────── */
function iconeStatut(s: string): string {
  if (s === 'validee')    return '✅';
  if (s === 'en_cours')   return '🔄';
  if (s === 'en_attente') return '⏳';
  return '🔒';
}

function couleurNoeud(g: Groupe): string {
  return g.etapes.every(e => e.statut === 'validee') ? C.noeud_valide : C.noeud_encours;
}

function borderNoeud(g: Groupe): string {
  return g.etapes.every(e => e.statut === 'validee') ? C.noeud_border_valide : C.noeud_border_encours;
}

function feStyle(type?: string | null): { bg: string; border: string; color: string } {
  if (type === 'mecanique') return { bg: '#EEEDFE', border: '#AFA9EC', color: '#3C3489' };
  if (type === 'chaotique') return { bg: '#FAEEDA', border: '#EF9F27', color: '#633806' };
  return { bg: '#F0EDE8', border: '#C8BBA8', color: '#2C1810' };
}

function grouperEtapes(etapes: Etape[]): Groupe[] {
  const gs: Groupe[] = [];
  for (const e of etapes) {
    const cle  = e.chapitre_snapshot ?? null;
    const last = gs[gs.length - 1];
    if (last && last.chapitre_snapshot === cle) last.etapes.push(e);
    else gs.push({ chapitre_snapshot: cle, etapes: [e] });
  }
  return gs;
}

/* ─── Bulle FE ───────────────────────────────────────────────────── */
function BulleFE({ etape }: { etape: Etape }) {
  const s = feStyle(etape.type);
  return (
    <div style={{
      background: s.bg,
      border: `1.5px solid ${s.border}`,
      borderRadius: '10px',
      padding: '10px 14px',
      width: FE_W,
      color: s.color,
      fontFamily: 'Georgia, serif',
      boxShadow: `0 2px 8px ${s.border}33`,
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
        <span style={{ fontSize: '13px', flexShrink: 0 }}>{iconeStatut(etape.statut)}</span>
        <span style={{
          fontWeight: 700,
          fontSize: '13px',
          lineHeight: 1.3,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {etape.titre_snapshot}
        </span>
      </div>
    </div>
  );
}

/* ─── Nœud rectangle arrondi ─────────────────────────────────────── */
function RectNoeud({ groupe }: { groupe: Groupe }) {
  const color  = couleurNoeud(groupe);
  const border = borderNoeud(groupe);
  const label  = groupe.chapitre_snapshot ?? '—';
  return (
    <div
      style={{
        background: color,
        border: `2px solid ${border}`,
        borderRadius: NOEUD_H / 2,
        width: NOEUD_W,
        height: NOEUD_H,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: '12px',
        fontFamily: 'Georgia, serif',
        padding: '4px 16px',
        textAlign: 'center',
        boxShadow: `0 3px 14px ${color}55`,
        overflow: 'hidden',
        zIndex: 3,
      } as React.CSSProperties}
      title={label}
    >
      {label}
    </div>
  );
}

/* ─── Composant principal ────────────────────────────────────────── */
export default function ParcoursTimeline({ etapes }: Props) {
  if (etapes.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: C.muted, padding: '32px', fontFamily: 'Georgia, serif' }}>
        Aucune étape pour le moment.
      </div>
    );
  }

  const groupes = grouperEtapes(etapes);

  return (
    <div style={{
      position: 'relative',
      width: CONTAINER_W,
      maxWidth: '100%',
      margin: '0 auto',
      paddingTop: 32,
      paddingBottom: 32,
      fontFamily: 'Georgia, serif',
      overflowX: 'auto',
      background: C.fond,
    }}>

      {/* Ligne d'axe — fond gris pointillé (visible avant le 1er groupe) */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: CENTER - 1,
        borderLeft: `2px dashed ${C.ligne}`,
        zIndex: 0,
      }} />

      {/* Cercle de départ */}
      <div style={{ position: 'relative', height: 28, marginBottom: 16, zIndex: 4 }}>
        <div style={{
          position: 'absolute',
          left: CENTER,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: C.depart_fond,
          border: `3px solid ${C.depart_border}`,
        }} />
      </div>

      {/* Groupes */}
      {groupes.map((groupe, gi) => {
        const isRight  = gi % 2 === 0;
        const n        = groupe.etapes.length;
        const groupH   = n * FE_ROW_H;
        const noeudCY  = groupH / 2;
        const color    = couleurNoeud(groupe);

        // Coordonnées SVG selon le côté
        const spineX   = isRight ? R_SPINE : L_SPINE;
        const hLineX1  = isRight ? NOEUD_RIGHT : NOEUD_LEFT;
        const hLineX2  = isRight ? R_SPINE     : L_SPINE;
        const branchX2 = isRight ? R_FE_L      : L_FE_R;
        const feLeft   = isRight ? R_FE_L      : L_FE_L;

        const spineY1  = FE_ROW_H / 2;
        const spineY2  = (n - 1) * FE_ROW_H + FE_ROW_H / 2;
        const markerId = `ar-${gi}`;

        return (
          <div
            key={gi}
            style={{
              position: 'relative',
              height: groupH,
              marginBottom: GROUP_MB,
              animation: 'parcours-fade-in 0.45s ease both',
              animationDelay: `${gi * 150}ms`,
            }}
          >
            {/* Segment d'axe coloré (couleur de CE nœud, s'étend dans le gap ci-dessous) */}
            <div style={{
              position: 'absolute',
              left: CENTER - 1,
              top: 0,
              bottom: gi < groupes.length - 1 ? -GROUP_MB : 0,
              borderLeft: `2px solid ${color}`,
              zIndex: 1,
            }} />

            {/* SVG — connecteurs avec flèches */}
            <svg
              width={CONTAINER_W}
              height={groupH}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                overflow: 'visible',
                zIndex: 2,
              }}
            >
              <defs>
                <marker
                  id={markerId}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" fill={C.connector_fe} />
                </marker>
              </defs>

              {/* Ligne H : nœud → spine */}
              <line
                x1={hLineX1} y1={noeudCY}
                x2={hLineX2} y2={noeudCY}
                stroke={C.connector_fe}
                strokeWidth="1.5"
                markerEnd={`url(#${markerId})`}
              />

              {/* Spine verticale */}
              {n > 1 && (
                <line
                  x1={spineX} y1={spineY1}
                  x2={spineX} y2={spineY2}
                  stroke={C.connector_fe}
                  strokeWidth="1.5"
                />
              )}

              {/* Branches : spine → FE */}
              {groupe.etapes.map((_, ei) => {
                const feCY = ei * FE_ROW_H + FE_ROW_H / 2;
                return (
                  <line
                    key={ei}
                    x1={spineX}    y1={feCY}
                    x2={branchX2}  y2={feCY}
                    stroke={C.connector_fe}
                    strokeWidth="1.5"
                    markerEnd={`url(#${markerId})`}
                  />
                );
              })}
            </svg>

            {/* Nœud */}
            <div style={{
              position: 'absolute',
              left: NOEUD_LEFT,
              top: noeudCY - NOEUD_H / 2,
              zIndex: 3,
            }}>
              <RectNoeud groupe={groupe} />
            </div>

            {/* Bulles FE */}
            {groupe.etapes.map((etape, ei) => {
              const feCY = ei * FE_ROW_H + FE_ROW_H / 2;
              return (
                <div
                  key={etape.id ?? `${gi}-${ei}`}
                  style={{
                    position: 'absolute',
                    left: feLeft,
                    top: feCY,
                    transform: 'translateY(-50%)',
                    zIndex: 3,
                  }}
                >
                  <BulleFE etape={etape} />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Cercle d'arrivée */}
      <div style={{ position: 'relative', height: 20, zIndex: 4 }}>
        <div style={{
          position: 'absolute',
          left: CENTER,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: C.noeud_valide,
          boxShadow: `0 0 0 3px ${C.fond}, 0 0 0 5px ${C.noeud_valide}55`,
        }} />
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 28 }}>
        {[
          { label: 'Mécanique', bg: '#EEEDFE', border: '#AFA9EC' },
          { label: 'Chaotique', bg: '#FAEEDA', border: '#EF9F27' },
        ].map(({ label, bg, border }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 16, height: 16,
              border: `2px solid ${border}`,
              borderRadius: 4,
              background: bg,
            }} />
            <span style={{ fontSize: 11, color: C.muted, fontFamily: 'Georgia, serif' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes parcours-fade-in {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}
