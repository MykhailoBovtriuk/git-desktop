import { useEffect, useState, type DependencyList } from 'react';

export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    load()
      .then(v => alive && setValue(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
