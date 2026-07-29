import type { Request } from 'express';

/**
 * Resolve the client IP for purchaseItem rate limiting.
 * When trustedProxy is false, only the socket remote address is used (X-Forwarded-For ignored).
 * When trustedProxy is true, Express `req.ip` is used (requires trust proxy hop count set in main).
 * IPv4-mapped IPv6 strings are not normalized in this epic.
 */
export function resolveClientIp(req: Request, trustedProxy: boolean): string {
  if (trustedProxy) {
    const ip = req.ip;
    if (typeof ip === 'string' && ip.length > 0) return ip;
  }
  const remote = req.socket.remoteAddress;
  if (typeof remote === 'string' && remote.length > 0) return remote;
  return 'unknown';
}
