export const PROFILES = {
  full: { attempts: 10000, vus: 100 },
  smoke: { attempts: 100, vus: 10 },
  standard: { attempts: 1000, vus: 50 },
};

export function resolveProfile(name) {
  const key = name || 'smoke';
  const p = PROFILES[key];
  if (!p) throw new Error(`Unknown profile: ${key}`);
  return { name: key, ...p };
}
