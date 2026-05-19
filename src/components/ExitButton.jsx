export default function ExitButton({ exit, onClick, unlocked }) {
  const locked = exit.locked && !unlocked;
  const className = `exit-button ${locked ? 'exit-button--locked' : ''}`.trim();
  return (
    <button
      type="button"
      className={className}
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
  );
}
