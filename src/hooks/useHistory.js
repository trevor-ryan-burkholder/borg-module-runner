import { useMemo } from 'react';

export function useHistory(history, nodeById) {
  return useMemo(() => {
    return history.map((id, i) => {
      const node = nodeById(id);
      return {
        id,
        title: node?.title ?? id,
        step: i,
      };
    });
  }, [history, nodeById]);
}
