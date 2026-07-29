import type { Request } from 'express';

import { resolveClientIp } from './client-ip';

function buildReq(partial: {
  ip?: string;
  remoteAddress?: string;
  xForwardedFor?: string;
}): Request {
  return {
    get(name: string) {
      if (name.toLowerCase() === 'x-forwarded-for') {
        return partial.xForwardedFor;
      }
      return undefined;
    },
    headers: partial.xForwardedFor ? { 'x-forwarded-for': partial.xForwardedFor } : {},
    ip: partial.ip,
    socket: { remoteAddress: partial.remoteAddress },
  } as unknown as Request;
}

describe('resolveClientIp', () => {
  it('trustedProxy=false ignores X-Forwarded-For and uses socket remote address', () => {
    const req = buildReq({
      ip: '198.51.100.1',
      remoteAddress: '203.0.113.10',
      xForwardedFor: '198.51.100.1',
    });

    expect(resolveClientIp(req, false)).toBe('203.0.113.10');
  });

  it('trustedProxy=true uses req.ip', () => {
    const req = buildReq({
      ip: '198.51.100.1',
      remoteAddress: '203.0.113.10',
      xForwardedFor: '198.51.100.1',
    });

    expect(resolveClientIp(req, true)).toBe('198.51.100.1');
  });

  it('does not normalize IPv4-mapped IPv6 strings', () => {
    const mapped = '::ffff:203.0.113.10';
    const req = buildReq({ remoteAddress: mapped });

    expect(resolveClientIp(req, false)).toBe(mapped);
    expect(resolveClientIp(req, false)).not.toBe('203.0.113.10');
  });

  it('falls back to unknown when no address is available', () => {
    const req = buildReq({});
    expect(resolveClientIp(req, false)).toBe('unknown');
  });

  it('trustedProxy=true falls back to socket when req.ip is empty', () => {
    const req = buildReq({
      ip: '',
      remoteAddress: '203.0.113.10',
    });

    expect(resolveClientIp(req, true)).toBe('203.0.113.10');
  });
});
