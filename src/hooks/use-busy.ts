import { useRef, useState } from 'react';

export function useBusy() {
  const [busy, setBusy] = useState(false);
  // `busy` only disables controls after a re-render; a quick double click lands before that.
  const inFlight = useRef(false);

  const track = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return [busy, track] as const;
}
