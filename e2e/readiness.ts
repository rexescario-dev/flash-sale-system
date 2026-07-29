async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

export async function waitForStack(): Promise<void> {
  const apiHealth = process.env.E2E_API_HEALTH_URL ?? 'http://127.0.0.1:3000/health';
  const webBase = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
  await waitForHttp(apiHealth);
  await waitForHttp(webBase);
}
