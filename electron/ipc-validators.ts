// --- IPC argument validators -------------------------------------------------
// The IPC boundary receives `unknown` from the renderer; TypeScript types only
// hold at compile time. These guards reject malformed input before it reaches
// GitService / raw git commands. Kept in a dedicated module so they can be
// unit-tested independently of Electron's `ipcMain`.

export function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid argument: ${name} must be a non-empty string`);
  }
}

export function assertOptionalString(
  value: unknown,
  name: string,
): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`Invalid argument: ${name} must be a string`);
  }
}

export function assertStringArray(value: unknown, name: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid argument: ${name} must be a non-empty array`);
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error(`Invalid argument: ${name} must contain only non-empty strings`);
    }
  }
}

export function assertNonNegativeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid argument: ${name} must be a non-negative integer`);
  }
}

export function assertPositiveInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid argument: ${name} must be a positive integer`);
  }
}

export function assertBoundedLogLimit(limit: unknown): asserts limit is number {
  assertPositiveInteger(limit, 'limit');
  if ((limit as number) > 1000) {
    throw new Error('Invalid argument: limit must be <= 1000');
  }
}

export function assertStashIndex(index: unknown): asserts index is number {
  assertNonNegativeInteger(index, 'index');
}

export function assertCommitHash(value: unknown, name: string): asserts value is string {
  assertString(value, name);
  // Hex only: anything else (refs, flags like --output=...) must not reach
  // raw git commands, where a leading '-' is parsed as a flag.
  if (!/^[0-9a-f]{4,64}$/i.test(value as string)) {
    throw new Error(`Invalid argument: ${name} must be a commit hash`);
  }
}

export function assertBranchName(value: unknown, name: string): asserts value is string {
  assertString(value, name);
  const v = value as string;
  // A leading '-' would be parsed as a flag by raw git commands.
  if (v.startsWith('-')) {
    throw new Error(`Invalid argument: ${name} must not start with "-"`);
  }
  // Characters git itself forbids in ref names (see `git check-ref-format`):
  // control chars (< 0x20) + space (0x20), DEL (0x7f), and ~ ^ : ? * [ \.
  // Hyphens, dots and '/' are allowed — they are common in real branch names.
  if (/[\x00-\x20\x7f~^:?*[\\]/.test(v)) {
    throw new Error(`Invalid argument: ${name} contains invalid characters`);
  }
  // Sequences git forbids anywhere / at the ends of a ref name.
  if (
    v.includes('..') ||
    v.includes('@{') ||
    v.endsWith('.lock') ||
    v.endsWith('/') ||
    v.endsWith('.')
  ) {
    throw new Error(`Invalid argument: ${name} has an invalid ref format`);
  }
}
