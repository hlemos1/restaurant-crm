"use client";

import { useMemo, useState } from "react";
import type {
  sinapseLayers,
  sinapseNodes,
  sinapseSynapses,
  NodeState,
  SynapseState,
} from "@/db/schema-sinapse";

type Layer = typeof sinapseLayers.$inferSelect;
type Node = typeof sinapseNodes.$inferSelect;
type Synapse = typeof sinapseSynapses.$inferSelect;

interface Props {
  layers: Layer[];
  nodes: Node[];
  synapses: Synapse[];
  onNodeClick?: (node: Node) => void;
  onSynapseClick?: (synapse: Synapse) => void;
}

const LAYER_WIDTH = 1100;
const LAYER_HEIGHT = 140;
const NODE_RADIUS_BASE = 14;
const NODE_RADIUS_PER_WEIGHT = 1.6;

const NODE_COLORS: Record<NodeState, string> = {
  active: "#22c55e",
  growing: "#3b82f6",
  dormant: "#eab308",
  inflamed: "#f97316",
  isolated: "#6b7280",
};

const SYNAPSE_COLORS: Record<SynapseState, string> = {
  healthy: "rgba(34, 197, 94, 0.55)",
  broken: "rgba(239, 68, 68, 0.85)",
  under_construction: "rgba(59, 130, 246, 0.65)",
  dormant: "rgba(234, 179, 8, 0.55)",
};

const SYNAPSE_DASH: Record<SynapseState, string> = {
  healthy: "0",
  broken: "6 4",
  under_construction: "2 3",
  dormant: "1 4",
};

/**
 * Mapa Neural — versao estatica do Mes 1.
 * Layout: camadas em faixas horizontais. Nodes distribuidos uniformemente.
 * Sinapses: paths SVG curvos com cor/dash por estado.
 *
 * Mes 4 substitui por D3 force simulation + Canvas para 500+ nodes.
 */
export function NeuralMap({ layers, nodes, synapses, onNodeClick, onSynapseClick }: Props) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredSynapse, setHoveredSynapse] = useState<string | null>(null);

  // Posicionar nodes por camada
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const layerSorted = [...layers].sort((a, b) => a.sortOrder - b.sortOrder);

    layerSorted.forEach((layer, layerIdx) => {
      const layerNodes = nodes.filter((n) => n.layerId === layer.id);
      const cy = LAYER_HEIGHT / 2 + layerIdx * LAYER_HEIGHT;

      layerNodes.forEach((node, idx) => {
        // Distribuir uniformemente
        const slot = (idx + 1) / (layerNodes.length + 1);
        const cx = slot * LAYER_WIDTH;

        positions.set(node.id, { x: cx, y: cy });
      });
    });

    return positions;
  }, [layers, nodes]);

  const totalHeight = layers.length * LAYER_HEIGHT;

  // Calcular sinapses visiveis com paths
  const synapsePaths = useMemo(() => {
    return synapses
      .map((syn) => {
        const source = nodePositions.get(syn.sourceNodeId);
        const target = nodePositions.get(syn.targetNodeId);
        if (!source || !target) return null;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        // Curva suave: control point no meio com offset perpendicular
        const mx = (source.x + target.x) / 2;
        const my = (source.y + target.y) / 2;
        const offset = Math.sqrt(dx * dx + dy * dy) * 0.12;
        const path = `M ${source.x} ${source.y} Q ${mx} ${my - offset} ${target.x} ${target.y}`;

        return { synapse: syn, path };
      })
      .filter((s): s is { synapse: Synapse; path: string } => s !== null);
  }, [synapses, nodePositions]);

  return (
    <div className="relative w-full overflow-auto bg-card rounded-lg border border-border">
      <svg
        width="100%"
        viewBox={`0 0 ${LAYER_WIDTH} ${totalHeight}`}
        className="block"
        style={{ minHeight: totalHeight, maxHeight: "75vh" }}
      >
        {/* Faixas de camadas */}
        {layers
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((layer, idx) => {
            const isAlt = idx % 2 === 0;
            return (
              <g key={layer.id}>
                <rect
                  x={0}
                  y={idx * LAYER_HEIGHT}
                  width={LAYER_WIDTH}
                  height={LAYER_HEIGHT}
                  fill={isAlt ? "rgba(0,0,0,0.02)" : "transparent"}
                />
                <text
                  x={16}
                  y={idx * LAYER_HEIGHT + 24}
                  fill={layer.color}
                  fontSize={12}
                  fontWeight={600}
                  className="uppercase tracking-wider"
                >
                  {layer.name}
                </text>
              </g>
            );
          })}

        {/* Sinapses (atras dos nodes) */}
        <g>
          {synapsePaths.map(({ synapse, path }) => {
            const isHovered = hoveredSynapse === synapse.id;
            const isRelated =
              hoveredNode === synapse.sourceNodeId || hoveredNode === synapse.targetNodeId;
            const opacity = hoveredNode && !isRelated ? 0.15 : 1;
            const strokeWidth = isHovered ? 3.5 : 1 + Number(synapse.weight) * 0.18;

            return (
              <path
                key={synapse.id}
                d={path}
                fill="none"
                stroke={SYNAPSE_COLORS[synapse.state]}
                strokeWidth={strokeWidth}
                strokeDasharray={SYNAPSE_DASH[synapse.state]}
                opacity={opacity}
                style={{ cursor: "pointer", transition: "all 200ms ease" }}
                onMouseEnter={() => setHoveredSynapse(synapse.id)}
                onMouseLeave={() => setHoveredSynapse(null)}
                onClick={() => onSynapseClick?.(synapse)}
              >
                <title>{`${synapse.type} · peso ${synapse.weight} · ${synapse.state}`}</title>
              </path>
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const radius = NODE_RADIUS_BASE + Number(node.weight) * NODE_RADIUS_PER_WEIGHT * 0.4;
            const isHovered = hoveredNode === node.id;
            const isRelated = synapses.some(
              (s) =>
                (s.sourceNodeId === hoveredNode && s.targetNodeId === node.id) ||
                (s.targetNodeId === hoveredNode && s.sourceNodeId === node.id)
            );
            const opacity = hoveredNode && !isHovered && !isRelated ? 0.3 : 1;

            return (
              <g
                key={node.id}
                style={{
                  cursor: "pointer",
                  transition: "opacity 200ms ease",
                  opacity,
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick?.(node)}
              >
                {/* Glow se inflamed ou dormant alto-peso */}
                {(node.state === "inflamed" ||
                  (node.state === "dormant" && Number(node.weight) >= 8)) && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius + 6}
                    fill={NODE_COLORS[node.state]}
                    opacity={0.25}
                  >
                    <animate
                      attributeName="r"
                      values={`${radius + 6};${radius + 12};${radius + 6}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.25;0.05;0.25"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius}
                  fill={NODE_COLORS[node.state]}
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={pos.x}
                  y={pos.y + radius + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                  className="font-medium"
                >
                  {node.name.length > 18 ? node.name.slice(0, 16) + "..." : node.name}
                </text>
                <title>{`${node.name} · peso ${node.weight} · ${node.state}`}</title>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legenda */}
      <div className="absolute bottom-3 right-3 flex flex-wrap gap-3 px-3 py-2 bg-background/90 backdrop-blur rounded border border-border text-xs">
        <LegendItem color={NODE_COLORS.active} label="ativo" />
        <LegendItem color={NODE_COLORS.growing} label="crescendo" />
        <LegendItem color={NODE_COLORS.dormant} label="dormente" />
        <LegendItem color={NODE_COLORS.inflamed} label="inflamado" />
        <LegendItem color={NODE_COLORS.isolated} label="isolado" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
