import { useCallback, useState } from "react";

type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function useHistory<T>(initialValue: T, limit = 20) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialValue,
    future: [],
  });

  const commit = useCallback(
    (next: T) => {
      setState((current) => ({
        past: [...current.past.slice(-(limit - 1)), current.present],
        present: next,
        future: [],
      }));
    },
    [limit],
  );

  const replace = useCallback((next: T) => {
    setState((current) => ({
      ...current,
      present: next,
    }));
  }, []);

  const undo = useCallback(() => {
    setState((current) => {
      const previous = current.past.at(-1);

      if (!previous) {
        return current;
      }

      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      const next = current.future[0];

      if (!next) {
        return current;
      }

      return {
        past: [...current.past, current.present].slice(-limit),
        present: next,
        future: current.future.slice(1),
      };
    });
  }, [limit]);

  const reset = useCallback((next: T) => {
    setState({
      past: [],
      present: next,
      future: [],
    });
  }, []);

  return {
    canRedo: state.future.length > 0,
    canUndo: state.past.length > 0,
    commit,
    present: state.present,
    redo,
    replace,
    reset,
    undo,
  };
}

