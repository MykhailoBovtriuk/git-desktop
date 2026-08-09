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
  if (!/^[0-9a-f]{4,64}$/i.test(value as string)) {
    throw new Error(`Invalid argument: ${name} must be a commit hash`);
  }
}

export function assertBranchName(value: unknown, name: string): asserts value is string {
  assertString(value, name);
  const v = value as string;
  if (v.startsWith('-')) {
    throw new Error(`Invalid argument: ${name} must not start with "-"`);
  }
  if (/[\x00-\x20\x7f~^:?*[\\]/.test(v)) {
    throw new Error(`Invalid argument: ${name} contains invalid characters`);
  }
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
