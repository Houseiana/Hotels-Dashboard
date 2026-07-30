import type { z } from 'zod';

/**
 * A validation issue with its message already reduced to an i18n key.
 * `path` is dot/bracket joined so form fields can look themselves up cheaply.
 */
export type FieldIssue = {
  path: string;
  segments: (string | number)[];
  key: string;
};

const joinPath = (segments: readonly PropertyKey[]): string =>
  segments
    .map((s) => (typeof s === 'number' ? `[${s}]` : String(s)))
    .join('.')
    .replace(/\.\[/g, '[');

export function collectIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: joinPath(issue.path),
    segments: issue.path.map((s) => (typeof s === 'symbol' ? String(s) : (s as string | number))),
    key: issue.message,
  }));
}

export type ValidationResult<T> =
  | { ok: true; data: T; issues: [] }
  | { ok: false; data: null; issues: FieldIssue[] };

export function validate<T>(schema: z.ZodType<T>, value: unknown): ValidationResult<T> {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data, issues: [] };
  return { ok: false, data: null, issues: collectIssues(result.error) };
}

/** Index issues by path for O(1) per-field lookups in forms. */
export function issueMap(issues: FieldIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    if (!(issue.path in map)) map[issue.path] = issue.key;
  }
  return map;
}
