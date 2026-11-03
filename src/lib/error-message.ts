export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function describeError(err: unknown): string {
  const parts: string[] = [];
  let next: unknown = err;
  for (let depth = 0; next !== undefined && next !== null && depth < 5; depth++) {
    const text = errorMessage(next);
    if (text && !parts.includes(text)) parts.push(text);
    next = next instanceof Error ? (next as Error & { cause?: unknown }).cause : undefined;
  }
  return parts.join(' — caused by: ');
}

/** `new Error(message, { cause })` without the ES2022 lib this target lacks. */
export function errorWithCause(message: string, cause: unknown): Error {
  const err = new Error(message) as Error & { cause?: unknown };
  err.cause = cause;
  return err;
}

export function errorLogId(err: unknown): string | undefined {
  const id = (err as { logId?: unknown } | null)?.logId;
  return typeof id === 'string' ? id : undefined;
}
