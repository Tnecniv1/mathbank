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
  fond:       '#FDFAF6',
  encre:      '#2C1810',
  bordure:    '#E8E0D4',
  ligne:      '#D0C5B5',
  muted:      '#8B7355',
  validee:    '#BA69C8',
  en_cours:   '#83C5BE',
  en_attente: '#C8BBA8',
} as const;

/* ─── Constantes layout ──────────────────────────────────────────── */
const FE_ROW_H    = 72;  // hauteur allouée par FE satellite
const NOEUD_W     = 140;
const NOEUD_H     = 48;
const CONNECTOR_W = 36;

/* ─── Helpers ────────────────────────────────────────────────────── */
function couleurStatut(statut: string): string {
  if (statut === 'validee')  return C.validee;
  if (statut === 'en_cours') return C.en_cours;
  return C.en_attente;
}

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
    return `Autorisée le ${new Date(etape.autorisee_at).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short',
    })}`;
  return null;
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

/* ─── Bulle FE satellite ─────────────────────────────────────────── */
function BulleFE({ etape, side }: { etape: Etape; side: 'left' | 'right' }) {
  const color = couleurStatut(etape.statut);
  const date  = dateEtape(etape);
  const icone = iconeStatut(etape.statut);

  return (
    <div
      style={{
        background: C.fond,
        border: `1.5px solid ${color}`,
        borderRadius: '10px',
        padding: '7px 11px',
        maxWidth: '220px',
        minWidth: '100px',
        color: C.encre,
        fontFamily: 'Georgia, serif',
        boxShadow: `0 2px 8px ${color}28`,
        textAlign: side === 'left' ? 'left' : 'right',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
      }}>
        <span style={{ fontSize: '13px', flexShrink: 0 }}>{icone}</span>
        <span style={{
          fontWeight: 700,
          fontSize: '12px',
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

/* ─── Connecteur horizontal pointillé ───────────────────────────── */
function ConnH({ color }: { color: string }) {
  return (
    <div style={{
      width: `${CONNECTOR_W}px`,
      flexShrink: 0,
      borderTop: `1.5px dashed ${color}`,
      opacity: 0.6,
    }} />
  );
}

/* ─── Ovale nœud (chapitre) ──────────────────────────────────────── */
function OvaleNoeud({ groupe }: { groupe: Groupe }) {
  const color    = couleurNoeud(groupe);
  const label    = groupe.chapitre_snapshot ?? '—';
  const derniere = groupe.etapes[groupe.etapes.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
      <div
        style={{
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
          letterSpacing: '0.01em',
          boxShadow: `0 3px 14px ${color}55`,
          fontFamily: 'Georgia, serif',
          padding: '4px 10px',
          textAlign: 'center',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          zIndex: 2,
          cursor: 'default',
        }}
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
          lineHeight: 1,
        }}>
          ✓
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
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '640px',
        margin: '0 auto',
        padding: '32px 16px',
        fontFamily: 'Georgia, serif',
      }}
    >
      {/* Ligne verticale centrale */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          transform: 'translateX(-1px)',
          borderLeft: `2px dashed ${C.ligne}`,
          zIndex: 0,
        }}
      />

      {/* Cercle de départ */}
      <div style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '28px',
        zIndex: 1,
      }}>
        <div style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: C.validee,
          boxShadow: `0 0 0 3px ${C.fond}, 0 0 0 5px ${C.validee}55`,
        }} />
      </div>

      {/* Groupes — un par nœud/chapitre */}
      {groupes.map((groupe, gi) => {
        const n        = groupe.etapes.length;
        const groupH   = n * FE_ROW_H;
        // Centre vertical du nœud dans le groupe
        const noeudTop = groupH / 2 - NOEUD_H / 2;
        const delay    = gi * 150;

        return (
          <div
            key={gi}
            style={{
              marginBottom: '44px',
              animation: 'parcours-fade-in 0.45s ease both',
              animationDelay: `${delay}ms`,
            }}
          >
            {/* Zone relative du groupe */}
            <div style={{ position: 'relative', height: `${groupH}px` }}>

              {/* Nœud oval — centré verticalement et horizontalement */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: `${noeudTop}px`,
                transform: 'translateX(-50%)',
                zIndex: 2,
              }}>
                <OvaleNoeud groupe={groupe} />
              </div>

              {/* FE satellites */}
              {groupe.etapes.map((etape, ei) => {
                const isRight = (ei + 1) % 2 === 1; // impair → droite
                const color   = couleurStatut(etape.statut);
                // Centrer la bulle dans sa rangée
                const rowTop  = ei * FE_ROW_H + (FE_ROW_H - 38) / 2;

                return (
                  <div
                    key={etape.id ?? `${gi}-${ei}`}
                    style={{
                      position: 'absolute',
                      top: `${rowTop}px`,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {/* Zone gauche */}
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                    }}>
                      {!isRight && (
                        <>
                          <BulleFE etape={etape} side="right" />
                          <ConnH color={color} />
                        </>
                      )}
                    </div>

                    {/* Placeholder centre — même largeur que le nœud */}
                    <div style={{ width: `${NOEUD_W}px`, flexShrink: 0 }} />

                    {/* Zone droite */}
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                    }}>
                      {isRight && (
                        <>
                          <ConnH color={color} />
                          <BulleFE etape={etape} side="left" />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Cercle d'arrivée */}
      <div style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        marginTop: '8px',
        zIndex: 1,
      }}>
        <div style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: C.en_cours,
          boxShadow: `0 0 0 3px ${C.fond}, 0 0 0 5px ${C.en_cours}55`,
        }} />
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
