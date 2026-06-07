import { useHistory } from '../hooks/useHistory.js';

export default function BreadcrumbTrail({
  history,
  currentNode,
  nodeById,
  onJump,
  onOpenMap,
  bookmarks,
}) {
  const trail = useHistory(history, nodeById);
  if (trail.length === 0) return null;
  // Collapse repeats so a back-and-forth doesn't bloat the trail.
  const collapsed = trail.filter(
    (entry, i) => i === 0 || entry.id !== trail[i - 1].id
  );

  const stars = (bookmarks ?? [])
    .map((id) => ({ id, node: nodeById(id) }))
    .filter((b) => !!b.node);

  return (
    <nav className="breadcrumbs" aria-label="path through adventure">
      <ol>
        {collapsed.map((entry, i) => {
          const isCurrent = entry.id === currentNode;
          return (
            <li key={`${entry.id}-${i}`}>
              <button
                type="button"
                className={`breadcrumb ${isCurrent ? 'breadcrumb--current' : ''}`}
                onClick={() => !isCurrent && onJump(entry.id)}
                disabled={isCurrent}
              >
                {entry.title}
              </button>
              {i < collapsed.length - 1 && <span className="breadcrumb-sep">›</span>}
            </li>
          );
        })}

        {stars.length > 0 && <li className="breadcrumbs__star-sep" aria-hidden="true">·</li>}
        {stars.map((b) => (
          <li key={`star-${b.id}`} className="breadcrumbs__star">
            <button
              type="button"
              className={`breadcrumb breadcrumb--star ${b.id === currentNode ? 'breadcrumb--current' : ''}`}
              onClick={() => b.id !== currentNode && onJump(b.id)}
              disabled={b.id === currentNode}
              title={`★ ${b.node.title || b.id}`}
            >
              ★ {b.node.title || b.id}
            </button>
          </li>
        ))}

        {onOpenMap && (
          <li className="breadcrumbs__map">
            <button
              type="button"
              className="breadcrumb breadcrumb--map"
              onClick={onOpenMap}
              title="Open the adventure map (M)"
            >
              ⌖ map
            </button>
          </li>
        )}
      </ol>
    </nav>
  );
}
