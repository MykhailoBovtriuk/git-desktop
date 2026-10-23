import { appApi } from '../api/app-api';
import { useAsync } from './use-async';

export function useAppVersion(): string | null {
  return useAsync(appApi.getVersion, []) ?? null;
}
