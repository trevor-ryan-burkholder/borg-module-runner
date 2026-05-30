import { useEffect, useRef, useState } from 'react';

// A number input that lets you actually type. Plain `<input type="number"
// value={n} onChange={parseInt}>` strips the value back to the parsed integer
// every keystroke, which makes the field unclearable and breaks "select all,
// type 12" flows. NumberField holds its own string state, commits valid
// integers up, and re-syncs only when the *external* value changes (e.g. via a
// +/− button) so the field is genuinely editable.
export default function NumberField({ value, onChange, ...rest }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  // Track the last value we emitted so we can tell an external change from our
  // own echo and avoid stomping on the user's in-progress text.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(value == null ? '' : String(value));
      lastEmitted.current = value;
    }
  }, [value]);

  return (
    <input
      type="number"
      value={text}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (v === '') return; // allow transient empty; don't commit yet
        const n = parseInt(v, 10);
        if (Number.isNaN(n)) return;
        if (n !== value) {
          lastEmitted.current = n;
          onChange(n);
        }
      }}
      onBlur={() => {
        const n = parseInt(text, 10);
        if (Number.isNaN(n)) {
          // Empty / invalid on blur — snap back to the committed value.
          setText(value == null ? '' : String(value));
        }
      }}
      {...rest}
    />
  );
}
