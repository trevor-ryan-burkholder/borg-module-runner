let counter = 0;

// Short, collision-resistant id for client-side entities (party members,
// combatants). Not cryptographic — just needs to be unique within a session.
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
}
