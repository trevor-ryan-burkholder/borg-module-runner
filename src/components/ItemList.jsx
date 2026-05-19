export default function ItemList({ items }) {
  if (!items || items.length === 0) {
    return <p className="empty">No items here. The grave gives nothing freely.</p>;
  }
  return (
    <ul className="item-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
