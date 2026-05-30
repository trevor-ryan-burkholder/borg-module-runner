import { useMemo } from 'react';

const NODE_W = 160;
const NODE_H = 56;
const COL_GAP = 240;
const ROW_GAP = 96;
const PAD = 32;

function layoutNodes(adventure) {
  const nodes = adventure.nodes ?? [];
  if (nodes.length === 0) return { positions: new Map(), width: 280, height: 120, columns: [] };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const startId = adventure.meta?.startNode || nodes[0].id;

  // BFS to assign depth.
  const depth = new Map();
  const order = new Map();
  let orderCounter = 0;
  const queue = [startId];
  depth.set(startId, 0);
  order.set(startId, orderCounter++);

  while (queue.length) {
    const id = queue.shift();
    const node = byId.get(id);
    if (!node) continue;
    const d = depth.get(id);
    for (const exit of node.exits ?? []) {
      const t = exit?.target;
      if (!t || !byId.has(t) || depth.has(t)) continue;
      depth.set(t, d + 1);
      order.set(t, orderCounter++);
      queue.push(t);
    }
  }

  // Orphans go after the last reachable depth, in a single "unreachable" column.
  const maxDepth = depth.size > 0 ? Math.max(...depth.values()) : 0;
  for (const n of nodes) {
    if (!depth.has(n.id)) {
      depth.set(n.id, maxDepth + 1);
      order.set(n.id, orderCounter++);
    }
  }

  // Group by depth, sort by order within group.
  const columns = new Map();
  for (const n of nodes) {
    const d = depth.get(n.id);
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d).push(n);
  }
  for (const col of columns.values()) {
    col.sort((a, b) => order.get(a.id) - order.get(b.id));
  }

  // Position.
  const positions = new Map();
  const depthsSorted = [...columns.keys()].sort((a, b) => a - b);
  let maxRows = 0;
  for (const d of depthsSorted) {
    const col = columns.get(d);
    if (col.length > maxRows) maxRows = col.length;
    col.forEach((node, i) => {
      const colHeight = col.length * NODE_H + (col.length - 1) * (ROW_GAP - NODE_H);
      const centerOffsetY = -colHeight / 2 + NODE_H / 2;
      positions.set(node.id, {
        x: PAD + d * COL_GAP,
        y: PAD + i * ROW_GAP + centerOffsetY,
      });
    });
  }

  // Compute bounds so the SVG fits.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  const width = maxX - minX + PAD * 2;
  const height = maxY - minY + PAD * 2;
  const offsetX = -minX + PAD;
  const offsetY = -minY + PAD;

  for (const [id, p] of positions) {
    positions.set(id, { x: p.x + offsetX, y: p.y + offsetY });
  }

  return { positions, width, height, columns: depthsSorted };
}

function edgePath(from, to) {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export default function MapView({ adventure, currentNode, visited, onJump, onClose }) {
  const layout = useMemo(() => layoutNodes(adventure), [adventure]);
  const visitedSet = new Set(visited || []);

  const edges = [];
  for (const node of adventure.nodes ?? []) {
    const from = layout.positions.get(node.id);
    if (!from) continue;
    for (const exit of node.exits ?? []) {
      const to = layout.positions.get(exit?.target);
      if (!to) continue;
      edges.push({
        from,
        to,
        sourceId: node.id,
        targetId: exit.target,
        locked: exit.locked,
        bothVisited: visitedSet.has(node.id) && visitedSet.has(exit.target),
      });
    }
  }

  return (
    <div className="map-overlay" role="dialog" aria-modal="true" aria-label="Adventure map" onClick={onClose}>
      <div className="map" onClick={(e) => e.stopPropagation()}>
        <header className="map__header">
          <h2>THE MAP</h2>
          <div className="map__legend">
            <span className="map-legend map-legend--current">current</span>
            <span className="map-legend map-legend--visited">visited</span>
            <span className="map-legend map-legend--unvisited">unvisited</span>
            <span className="map-legend map-legend--unreachable">unreachable</span>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close map">
            ✕
          </button>
        </header>

        <div className="map__scroll">
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            // Let CSS size the rendered SVG so a 40-node adventure isn't a tiny
            // scrollbox on mobile; the viewBox handles the aspect.
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#b8941a" />
              </marker>
              <marker
                id="arrow-locked"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#6e6a5e" />
              </marker>
            </defs>

            <g className="map-edges">
              {edges.map((e, i) => (
                <path
                  key={i}
                  d={edgePath(e.from, e.to)}
                  fill="none"
                  stroke={e.locked ? '#6e6a5e' : e.bothVisited ? '#f5c518' : '#b8941a'}
                  strokeOpacity={e.locked ? 0.5 : e.bothVisited ? 0.95 : 0.5}
                  strokeWidth={e.bothVisited ? 2 : 1.4}
                  strokeDasharray={e.locked ? '4 3' : '0'}
                  markerEnd={`url(#${e.locked ? 'arrow-locked' : 'arrow'})`}
                />
              ))}
            </g>

            <g className="map-nodes">
              {(adventure.nodes ?? []).map((n) => {
                const pos = layout.positions.get(n.id);
                if (!pos) return null;
                const isCurrent = n.id === currentNode;
                const isVisited = visitedSet.has(n.id);
                const reachable = n.id === adventure.meta?.startNode || edges.some((e) => e.targetId === n.id);
                const cls = isCurrent
                  ? 'map-node map-node--current'
                  : isVisited
                  ? 'map-node map-node--visited'
                  : reachable
                  ? 'map-node map-node--unvisited'
                  : 'map-node map-node--unreachable';
                return (
                  <g
                    key={n.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className={cls}
                    onClick={() => onJump(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onJump(n.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <rect width={NODE_W} height={NODE_H} rx={2} ry={2} />
                    <text
                      x={NODE_W / 2}
                      y={NODE_H / 2}
                      dominantBaseline="middle"
                      textAnchor="middle"
                    >
                      {n.title?.length > 22 ? n.title.slice(0, 21) + '…' : n.title || n.id}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <footer className="map__foot">
          <small>{adventure.nodes?.length ?? 0} nodes · {edges.length} exits · click any node to jump</small>
        </footer>
      </div>
    </div>
  );
}
