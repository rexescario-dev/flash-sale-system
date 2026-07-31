import path from 'node:path';

export function stressRoot(): string {
  return path.resolve(__dirname, '..');
}

export function statePath(scenario: string): string {
  return path.join(stressRoot(), '.state', `${scenario}.json`);
}

export function resultsDir(scenario: string, profile: string): string {
  return path.join(stressRoot(), 'results', `${scenario}-${profile}`);
}
