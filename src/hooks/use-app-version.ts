import { useEffect, useState } from 'react';
import { appApi } from '../api/app-api';

export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    appApi
      .getVersion()
      .then(v => alive && setVersion(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return version;
}
