import { createMiddleware } from 'hono/factory';

/**
 * Tailscale CGNAT allowlist middleware.
 * Reject requests whose origin IP is outside Tailscale's 100.64.0.0/10 or
 * fd7a:115c:a1e0::/48 ranges, unless ELAWS_AUTH_DISABLED=1 (for local dev).
 */
export function tailscaleAuth() {
  const disabled = process.env.ELAWS_AUTH_DISABLED === '1';

  return createMiddleware(async (c, next) => {
    if (disabled) return next();

    const xff = c.req.header('x-forwarded-for');
    const remote = c.env?.incoming?.socket?.remoteAddress as string | undefined;
    const ip = (xff?.split(',')[0]?.trim()) ?? remote ?? '';

    if (isLocalOrTailscale(ip)) return next();

    return c.json({ error: 'forbidden', ip }, 403);
  });
}

function isLocalOrTailscale(ip: string): boolean {
  if (!ip) return false;
  // localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  // Tailscale CGNAT 100.64.0.0/10
  const ipv4 = ip.replace(/^::ffff:/, '');
  const m = ipv4.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = parseInt(m[1]!, 10);
    const b = parseInt(m[2]!, 10);
    if (a === 100 && b >= 64 && b <= 127) return true;
    // also allow local LAN for dev convenience
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  // Tailscale IPv6 fd7a:115c:a1e0::/48
  if (ip.toLowerCase().startsWith('fd7a:115c:a1e0')) return true;
  return false;
}
