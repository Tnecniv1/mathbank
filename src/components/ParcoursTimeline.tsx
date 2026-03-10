'use client';

import React from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */
interface Etape {
  id?: string;
  numero: number;
  titre_snapshot: string;
  statut: string; // 'validee' | 'en_attente' | 'en_cours'
  validee_at?: string | null;
  autorisee_at?: string | null;
}

interface Props {
  etapes: Etape[];
}

/* ─── Palette ────────────────────────────────────────────────────── */
const COULEURS = {
  fond:       '#FDFAF6',
  encre:      '#2C1810',
  bordure:    '#E8E0D4',
  ligne:      '#D0C5B5',
  muted:      '#8B7355',
  validee:    '#BA69C8',
  en_cours:   '#83C5BE',
  en_attente: '#C8BBA8',
} as const;

/* ─── Helpers ────────────────────────────────────────────────────── */
function couleurStatut(statut: string): string {
  if (statut === 'validee')    return COULEURS.validee;
  if (statut === 'en_cours')   return COULEURS.en_cours;
  return COULEURS.en_attente;
}

function iconeStatut(statut: string): string {
  if (statut === 'validee')    return '✅';
  if (statut === 'en_cours')   return '🔄';
  if (statut === 'en_attente') return '⏳';
  return '🔒';
}

function dateEtape(etape: Etape): string | null {
  if (etape.statut === 'validee' && etape.validee_at)
    return new Date(etape.validee_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  if (etape.autorisee_at)
    return `Autorisée le ${new Date(etape.autorisee_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  return null;
}

/* ─── Sous-composant : bulle d'annotation ───────────────────────── */
function AnnotationBubble({ etape, side }: { etape: Etape; side: 'left' | 'right' }) {
  const color  = couleurStatut(etape.statut);
  const date   = dateEtape(etape);
  const icone  = iconeStatut(etape.statut);

  return (
    <div
      style={{
        background: COULEURS.fond,
        border: `1.5px solid ${color}`,
        borderRadius: '10px',
        padding: '10px 14px',
        maxWidth: '200px',
        color: COULEURS.encre,
        fontFamily: 'Georgia, serif',
        boxShadow: `0 2px 6px ${color}22`,
        textAlign: side === 'right' ? 'left' : 'right',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: side === 'right' ? 'flex-start' : 'flex-end' }}>
        <span style={{ fontSize: '14px' }}>{icone}</span>
        <span style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.3 }}>{etape.titre_snapshot}</span>
      </div>
      {date && (
        <div style={{ fontSize: '11px', color: COULEURS.muted, marginTop: '4px' }}>{date}</div>
      )}
    </div>
  );
}

/* ─── Sous-composant : connecteur pointillé horizontal ──────────── */
function ConnectorH({ color }: { color: string }) {
  return (
    <div
      style={{
        width: '24px',
        flexShrink: 0,
        borderTop: `2px dashed ${color}`,
        opacity: 0.7,
      }}
    />
  );
}

/* ─── Sous-composant : nœud oval ────────────────────────────────── */
function Noeud({ etape }: { etape: Etape }) {
  const color = couleurStatut(etape.statut);
  return (
    <div
      style={{
        background: color,
        borderRadius: '20px',
        width: '82px',
        height: '36px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: '13px',
        letterSpacing: '0.01em',
        boxShadow: `0 3px 10px ${color}55`,
        zIndex: 1,
        fontFamily: 'Georgia, serif',
      }}
    >
      Étape {etape.numero}
    </div>
  );
}

/* ─── Composant principal ────────────────────────────────────────── */
export default function ParcoursTimeline({ etapes }: Props) {
  if (etapes.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: COULEURS.muted, padding: '32px', fontFamily: 'Georgia, serif' }}>
        Aucune étape pour le moment.
      </div>
    );
  }

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
          borderLeft: `2px dashed ${COULEURS.ligne}`,
          zIndex: 0,
        }}
      />

      {/* Cercle de départ */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: '24px', zIndex: 1 }}>
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: COULEURS.fond,
            border: `3px solid ${COULEURS.ligne}`,
            boxShadow: `0 0 0 3px ${COULEURS.bordure}`,
          }}
        />
      </div>

      {/* Étapes */}
      {etapes.map((etape, index) => {
        const isOdd  = etape.numero % 2 === 1; // impaire → annotation à droite
        const color  = couleurStatut(etape.statut);
        const delay  = index * 110;

        return (
          <div
            key={etape.id ?? etape.numero}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              marginBottom: '32px',
              animation: `parcours-fade-in 0.4s ease both`,
              animationDelay: `${delay}ms`,
            }}
          >
            {/* Zone gauche */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: isOdd ? '0' : '0',
              }}
            >
              {!isOdd && (
                <>
                  <AnnotationBubble etape={etape} side="right" />
                  <ConnectorH color={color} />
                </>
              )}
            </div>

            {/* Nœud */}
            <Noeud etape={etape} />

            {/* Zone droite */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
              }}
            >
              {isOdd && (
                <>
                  <ConnectorH color={color} />
                  <AnnotationBubble etape={etape} side="left" />
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Cercle d'arrivée */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: '8px', zIndex: 1 }}>
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: COULEURS.fond,
            border: `3px solid ${COULEURS.ligne}`,
            boxShadow: `0 0 0 4px ${COULEURS.bordure}`,
          }}
        />
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes parcours-fade-in {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
