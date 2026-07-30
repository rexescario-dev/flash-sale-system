export function formatIdentityStatus(userId: null | string): string {
  return userId === null ? 'Shopping as Guest' : `Shopping as ${userId}`;
}
