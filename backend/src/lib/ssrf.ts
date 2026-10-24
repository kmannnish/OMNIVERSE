import dns from 'node:dns/promises';
import net from 'node:net';

export class SsrfSecurityError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'SSRF_BLOCKED') {
    super(message);
    this.name = 'SsrfSecurityError';
    this.code = code;
  }
}

/**
 * Checks if an IPv4 address is in private, loopback, link-local, or reserved ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // Malformed is treated as dangerous
  }

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (RFC 1918)
  if (a === 10) return true;

  // 100.64.0.0/10 (Carrier-grade NAT RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link Local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.168.0.0/16 (RFC 1918)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future Use)
  if (a >= 240) return true;

  // Broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in private, loopback, or reserved ranges.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback ::1
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified ::
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // IPv4-mapped IPv6 ::ffff:192.0.2.128
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.replace('::ffff:', '');
    if (net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
    }
  }

  // Unique Local Address fc00::/7 (fc00... or fd00...)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-Local fe80::/10
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  // Documentation 2001:db8::/32
  if (normalized.startsWith('2001:db8') || normalized.startsWith('2001:0db8')) return true;

  return false;
}

/**
 * Validates a media URL strictly against SSRF attacks.
 * Rejects non-HTTP/HTTPS schemes, private/internal IP ranges, metadata endpoints, and non-resolvable hosts.
 * Returns the sanitized URL object if valid.
 */
export async function validateMediaUrl(rawUrl: string): Promise<URL> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new SsrfSecurityError('URL must be a non-empty string', 'INVALID_URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new SsrfSecurityError('Malformed URL provided', 'MALFORMED_URL');
  }

  // 1. Enforce strict protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfSecurityError(
      `Protocol '${parsed.protocol}' is forbidden. Only HTTP and HTTPS are permitted.`,
      'FORBIDDEN_PROTOCOL'
    );
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new SsrfSecurityError('Embedded credentials in URLs are forbidden.', 'EMBEDDED_CREDENTIALS');
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Detect streaming portal webpages (YouTube, Vimeo, etc.)
  if (
    hostname.includes('youtube.com') ||
    hostname.includes('youtu.be') ||
    hostname.includes('vimeo.com') ||
    hostname.includes('dailymotion.com')
  ) {
    throw new SsrfSecurityError(
      `Streaming webpage links ('${hostname}') are HTML portals, not direct media streams. Please provide a direct video or audio URL (e.g. .mp4, .webm, .m3u8, S3 pre-signed link) or try one of the quick test samples below.`,
      'STREAMING_PORTAL_DETECTED'
    );
  }

  // 4. Blacklist special hostnames
  const blockedHostnames = ['localhost', 'broadcasthost', 'local', 'internal', 'lan', 'home'];
  if (
    blockedHostnames.includes(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.arpa')
  ) {
    throw new SsrfSecurityError(`Hostname '${hostname}' is disallowed.`, 'FORBIDDEN_HOST');
  }

  // 4. Check if hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isPrivateIPv4(hostname)) {
      throw new SsrfSecurityError(`Direct private IPv4 address '${hostname}' is blocked.`, 'PRIVATE_IP_BLOCKED');
    }
    if (net.isIPv6(hostname) && isPrivateIPv6(hostname)) {
      throw new SsrfSecurityError(`Direct private IPv6 address '${hostname}' is blocked.`, 'PRIVATE_IP_BLOCKED');
    }
    return parsed;
  }

  // 5. DNS Resolution check (prevent DNS rebinding & private domain resolution)
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses || addresses.length === 0) {
      throw new SsrfSecurityError(`Hostname '${hostname}' could not be resolved.`, 'DNS_RESOLUTION_FAILED');
    }

    for (const record of addresses) {
      const { address, family } = record;
      if (family === 4 && isPrivateIPv4(address)) {
        throw new SsrfSecurityError(
          `Resolved IP '${address}' for host '${hostname}' is in a restricted private range.`,
          'RESOLVED_PRIVATE_IP'
        );
      }
      if (family === 6 && isPrivateIPv6(address)) {
        throw new SsrfSecurityError(
          `Resolved IP '${address}' for host '${hostname}' is in a restricted private range.`,
          'RESOLVED_PRIVATE_IP'
        );
      }
    }
  } catch (err: unknown) {
    if (err instanceof SsrfSecurityError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new SsrfSecurityError(`DNS lookup failed for '${hostname}': ${message}`, 'DNS_ERROR');
  }

  return parsed;
}
