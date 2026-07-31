const profilesFile = __ENV.STRESS_PROFILES_FILE;
if (!profilesFile) {
  throw new Error('STRESS_PROFILES_FILE is required');
}

const PROFILES = JSON.parse(open(profilesFile));

export function resolveProfile(name) {
  const key = name || 'smoke';
  const p = PROFILES[key];
  if (!p) throw new Error(`Unknown profile: ${key}`);
  return { name: key, ...p };
}
