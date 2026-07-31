/**
 * Load stress state JSON written by the seeder.
 * Must be called from k6 init context (open() is init-only).
 *
 * @returns {object}
 */
export function loadState() {
  const path = __ENV.STRESS_STATE_FILE;
  if (!path) {
    throw new Error('STRESS_STATE_FILE env is required');
  }

  let raw;
  try {
    raw = open(path);
  } catch (err) {
    throw new Error(`Failed to open STRESS_STATE_FILE (${path}): ${err}`);
  }

  if (raw === undefined || raw === null || raw === '') {
    throw new Error(`STRESS_STATE_FILE is empty or missing: ${path}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse STRESS_STATE_FILE (${path}): ${err}`);
  }
}
