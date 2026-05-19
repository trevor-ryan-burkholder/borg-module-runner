export default function EnemyCard({ enemy }) {
  if (!enemy) return null;
  return (
    <article className="enemy-card">
      <header className="enemy-card__header">
        <h4 className="enemy-card__name">{enemy.name}</h4>
        <dl className="enemy-card__stats">
          <div>
            <dt>HP</dt>
            <dd>{enemy.hp}</dd>
          </div>
          <div>
            <dt>Morale</dt>
            <dd>{enemy.morale}</dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>{enemy.speed}</dd>
          </div>
        </dl>
      </header>

      {enemy.attack && (
        <p className="enemy-card__attack">
          <span className="label">Attack:</span> {enemy.attack}
        </p>
      )}

      {enemy.special && (
        <p className="enemy-card__special">
          <span className="label">Special:</span> {enemy.special}
        </p>
      )}

      {enemy.notes && (
        <p className="enemy-card__notes">
          <span className="label">Notes:</span> {enemy.notes}
        </p>
      )}
    </article>
  );
}
