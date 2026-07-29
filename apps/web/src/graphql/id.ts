/** Gate only — never use to mutate/normalize values before send. */
export function isNonWhitespaceId(value: string): boolean {
  return !/^\s*$/.test(value);
}
