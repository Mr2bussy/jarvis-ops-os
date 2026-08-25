// @ts-nocheck
import { CYAN, CYAN_BRIGHT, AMBER } from '../../theme';
import type { Workflow } from '../../data/os-data';

export function WorkflowDAG({
  workflow,
  highlightTeam,
}: {
  workflow: Workflow;
  highlightTeam?: string | null;
}) {
  const W = 900,
    H = 280;
  const { nodes, edges } = workflow;
  const byId: Record<string, (typeof nodes)[number]> = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {edges.map(([a, b], i) => {
        const A = byId[a],
          B = byId[b];
        if (!A || !B) return null;
        const mx = (A.x + B.x) / 2;
        const lit = highlightTeam && (A.team === highlightTeam || B.team === highlightTeam);
        return (
          <path
            key={i}
            d={`M ${A.x + 60} ${A.y + 18} C ${mx} ${A.y + 18}, ${mx} ${B.y + 18}, ${B.x} ${B.y + 18}`}
            stroke={lit ? AMBER : CYAN}
            strokeOpacity={lit ? 0.85 : 0.4}
            strokeWidth={lit ? 2 : 1.2}
            fill="none"
            className={lit ? undefined : 'anim-dash'}
          />
        );
      })}
      {nodes.map((n) => {
        const active = highlightTeam && n.team === highlightTeam;
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            {active && (
              <rect
                x="-3"
                y="-3"
                width="166"
                height="42"
                stroke={AMBER}
                strokeOpacity="0.7"
                fill={`${AMBER}12`}
                strokeWidth="1.5"
                rx="1"
              />
            )}
            <rect
              x="0"
              y="0"
              width="160"
              height="36"
              stroke={active ? AMBER : CYAN}
              strokeOpacity={active ? 1 : 0.6}
              fill={active ? 'oklch(0.13 0.022 75 / 0.85)' : 'oklch(0.10 0.018 240 / 0.7)'}
              strokeWidth={active ? 1.5 : 1}
            />
            <text
              x="8"
              y="14"
              fontSize="9"
              fontFamily="Orbitron"
              fill={active ? AMBER : CYAN_BRIGHT}
              letterSpacing="2"
            >
              {n.label}
            </text>
            <text
              x="8"
              y="28"
              fontSize="8.5"
              fontFamily="JetBrains Mono"
              fill={active ? AMBER : 'oklch(0.58 0.10 215)'}
            >
              {n.team}
            </text>
            {active && (
              <text x="152" y="14" fontSize="10" textAnchor="end" fill={AMBER} fontFamily="Orbitron">
                ◆
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
