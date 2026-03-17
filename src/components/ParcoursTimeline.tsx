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
  fond:      '#FDFAF6',
  encre:     '#2C1810',
  ligne:     '#D0C5B5',
  muted:     '#8B7355',
  validee:   '#BA69C8',
  en_cours:  '#83C5BE',
  en_attente:'#C8BBA8',
  mecanique: '#BA69C8',
  chaotique: '#F4A261',
} as const;

/* ─── Constantes layout ──────────────────────────────────────────── */
const NOEUD_W     = 200;
const NOEUD_H     = 56;
const NOEUD_HALF  = NOEUD_W / 2;   // 100
const AXIS_OFFSET = 40;             // nœud décalé de 40px à gauche du centre
const BRACKET_GAP = 28;             // espace nœud-droite → spine
const BRANCH_LEN  = 32;             // branche horizontale spine → FE
const FE_ROW_H    = 68;
const GROUP_MB    = 60;

// Positions CSS responsive (calc)
// nœud right  = 50% + (NOEUD_HALF - AXIS_OFFSET) = 50% + 50px
// spine       = nœud right + BRACKET_GAP          = 50% + 70px
// FE left     = spine + BRANCH_LEN                = 50% + 90px
const noeudRightPx  = NOEUD_HALF - AXIS_OFFSET;               // +50
const spinePx       = noeudRightPx + BRACKET_GAP;             // +70
const feLeftPx      = spinePx + BRANCH_LEN;                   // +90
const S = {
  axis:      `calc(50% - ${AXIS_OFFSET}px)`,
  noeudLeft: `calc(50% - ${AXIS_OFFSET + NOEUD_HALF}px)`,     // calc(50% - 130px)
  hLineLeft: `calc(50% + ${noeudRightPx}px)`,                 // calc(50% + 50px)
  spine:     `calc(50% + ${spinePx}px)`,                      // calc(50% + 70px)
  feLeft:    `calc(50% + ${feLeftPx}px)`,                     // calc(50% + 90px)
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function iconeStatut(statut: string): string {
  if (statut === 'validee')    return '✅';
  if (statut === 'en_cours')   return '🔄';
  if (statut === 'en_attente') return '⏳';
  return '🔒';
}

function dateEtape(etape: Etape): string | null {
  if (etape.statut === 'validee' && etape.validee_at)
    return new Date(etape.validee_at).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  if (etape.autorisee_at)
    return `Auth. le ${new Date(etape.autorisee_at).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short',
    })}`;
  return null;
}

function couleurBordureFE(etape: Etape): string {
  if (etape.type === 'mecanique') return C.mecanique;
  if (etape.type === 'chaotique') return C.chaotique;
  return C.en_attente;
}

function couleurNoeud(groupe: Groupe): string {
  const statuts = groupe.etapes.map(e => e.statut);
  if (statuts.every(s => s === 'validee')) return C.validee;
  if (statuts.some(s => s === 'en_cours')) return C.en_cours;
  return C.en_attente;
}

function grouperEtapes(etapes: Etape[]): Groupe[] {
  const groupes: Groupe[] = [];
  for (const etape of etapes) {
    const cle     = etape.chapitre_snapshot ?? null;
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.chapitre_snapshot === cle) {
      dernier.etapes.push(etape);
    } else {
      groupes.push({ chapitre_snapshot: cle, etapes: [etape] });
    }
  }
  return groupes;
}

/* ─── Bulle FE ───────────────────────────────────────────────────── */
function BulleFE({ etape }: { etape: Etape }) {
  const border = couleurBordureFE(etape);
  const date   = dateEtape(etape);
  const icone  = iconeStatut(etape.statut);

  return (
    <div style={{
      background: C.fond,
      border: `1.5px solid ${border}`,
      borderRadius: '10px',
      padding: '10px 14px',
      width: '220px',
      color: C.encre,
      fontFamily: 'Georgia, serif',
      boxShadow: `0 2px 8px ${border}22`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ fontSize: '13px', flexShrink: 0 }}>{icone}</span>
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
      {date && (
        <div style={{ fontSize: '10px', color: C.muted, marginTop: '3px' }}>
          {date}
        </div>
      )}
    </div>
  );
}

/* ─── Rectangle nœud ─────────────────────────────────────────────── */
function RectNoeud({ groupe }: { groupe: Groupe }) {
  const color    = couleurNoeud(groupe);
  const label    = groupe.chapitre_snapshot ?? '—';
  const derniere = groupe.etapes[groupe.etapes.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{
        background: color,
        borderRadius: `${NOEUD_H / 2}px`,
        width: `${NOEUD_W}px`,
        height: `${NOEUD_H}px`,
        display: 'flex',
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
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        zIndex: 2,
      } as React.CSSProperties}
        title={label}
      >
        {label}
      </div>
      {derniere.clot_noeud && (
        <span style={{
          fontSize: '10px',
          color: '#5a8a5a',
          fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
        }}>
          ✓ nœud validé
        </span>
      )}
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
      width: '100%',
      maxWidth: '680px',
      margin: '0 auto',
      paddingTop: '32px',
      paddingBottom: '32px',
      fontFamily: 'Georgia, serif',
    }}>

      {/* Ligne verticale de l'axe */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: S.axis,
        transform: 'translateX(-1px)',
        borderLeft: `2px dashed ${C.ligne}`,
        zIndex: 0,
      }} />

      {/* Cercle de départ */}
      <div style={{ position: 'relative', height: '28px', marginBottom: '16px', zIndex: 1 }}>
        <div style={{
          position: 'absolute',
          left: S.axis,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: C.validee,
          boxShadow: `0 0 0 3px ${C.fond}, 0 0 0 5px ${C.validee}55`,
          zIndex: 1,
        }} />
      </div>

      {/* Groupes */}
      {groupes.map((groupe, gi) => {
        const n       = groupe.etapes.length;
        const groupH  = n * FE_ROW_H;
        const noeudCY = groupH / 2;             // nœud center Y within group
        const noeudT  = noeudCY - NOEUD_H / 2; // nœud top within group

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
            {/* Nœud */}
            <div style={{
              position: 'absolute',
              left: S.noeudLeft,
              top: noeudT,
              zIndex: 2,
            }}>
              <RectNoeud groupe={groupe} />
            </div>

            {/* Ligne horizontale nœud → spine (au niveau du centre du nœud) */}
            <div style={{
              position: 'absolute',
              left: S.hLineLeft,
              top: noeudCY,
              width: BRACKET_GAP,
              transform: 'translateY(-1px)',
              borderTop: `1.5px dashed ${C.ligne}`,
            }} />

            {/* Spine verticale (de la première FE à la dernière) */}
            {n > 1 && (
              <div style={{
                position: 'absolute',
                left: S.spine,
                top: FE_ROW_H / 2,
                height: (n - 1) * FE_ROW_H,
                transform: 'translateX(-1px)',
                borderLeft: `1.5px dashed ${C.ligne}`,
              }} />
            )}

            {/* Branches + FE bubbles */}
            {groupe.etapes.map((etape, ei) => {
              const feCY = ei * FE_ROW_H + FE_ROW_H / 2;
              return (
                <React.Fragment key={etape.id ?? `${gi}-${ei}`}>
                  {/* Branche horizontale spine → FE */}
                  <div style={{
                    position: 'absolute',
                    left: S.spine,
                    top: feCY,
                    width: BRANCH_LEN,
                    transform: 'translateY(-1px)',
                    borderTop: `1.5px dashed ${C.ligne}`,
                  }} />
                  {/* Bulle FE */}
                  <div style={{
                    position: 'absolute',
                    left: S.feLeft,
                    top: feCY,
                    transform: 'translateY(-50%)',
                    zIndex: 1,
                  }}>
                    <BulleFE etape={etape} />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        );
      })}

      {/* Cercle d'arrivée */}
      <div style={{ position: 'relative', height: '20px', zIndex: 1 }}>
        <div style={{
          position: 'absolute',
          left: S.axis,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: C.en_cours,
          boxShadow: `0 0 0 3px ${C.fond}, 0 0 0 5px ${C.en_cours}55`,
          zIndex: 1,
        }} />
      </div>

      {/* Légende */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        marginTop: '28px',
        paddingTop: '16px',
        borderTop: `1px solid ${C.ligne}`,
      }}>
        {[
          { label: 'Mécanique', color: C.mecanique },
          { label: 'Chaotique', color: C.chaotique },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: `2px solid ${color}`,
              borderRadius: '4px',
              background: C.fond,
            }} />
            <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'Georgia, serif' }}>
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
