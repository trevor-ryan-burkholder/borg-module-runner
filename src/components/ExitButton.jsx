export default function ExitButton({ exit, onClick, unlocked, onUnlock }) {
  const locked = exit.locked && !unlocked;
  return (
    <div className={`exit-button-wrap ${locked ? 'exit-button-wrap--locked' : ''}`.trim()}>
      <button
        type="button"
        className={`exit-button ${locked ? 'exit-button--locked' : ''}`.trim()}
        onClick={() => onClick(exit)}
        title={exit.condition || ''}
        aria-disabled={locked}
      >
        <span className="exit-button__arrow">⟶</span>
        <span className="exit-button__label">{exit.label}</span>
        {exit.condition && (
          <span className="exit-button__condition">{exit.condition}</span>
        )}
      </button>
      {locked && onUnlock && (
        <button
          type="button"
          className="exit-button__unlock"
          onClick={() => onUnlock(exit.id)}
          title="Mark this exit unlocked (condition met)"
          aria-label={`Unlock exit: ${exit.label}`}
        >
          🔒
        </button>
      )}
    </div>
  );
}
