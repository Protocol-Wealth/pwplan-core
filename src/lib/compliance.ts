/**
 * compliance — pwplan-core's lightweight, dependency-free PII tripwire.
 *
 * SCOPE NOTE (open-source repo): this file is NOT the production compliance
 * stack. Real PII de-identification (DOB→age, name stripping), books-and-records
 * audit logging, and the pwos-core integration are OUT OF SCOPE for this OSS repo.
 * They live only in the private fork that syncs into pw-api; integrators should
 * follow the pwos-core repo's guidelines. See README "Compliance scope" + NOTICE.
 *
 * Because the planning contract is PII-free BY CONSTRUCTION (contract/planning.ts),
 * `assertNoPII` here is a structural, always-on, fail-closed tripwire — the second
 * layer behind the contract. It refuses (throws) any outbound payload that carries
 * an identity-shaped key; it never redacts, transforms, or stores anything. This
 * makes the open demo safe for real engine data + fake/de-identified clients.
 */

/** Identity-shaped keys, normalized (lowercased, separators removed). Mirrors the
 *  forbidden field list enforced on the contract by contract/planning.test.ts. */
const FORBIDDEN_IDENTITY_KEYS = new Set([
  "name",
  "firstname",
  "lastname",
  "fullname",
  "dob",
  "dateofbirth",
  "ssn",
  "socialsecuritynumber",
  "email",
  "phone",
  "phonenumber",
  "address",
  "streetaddress",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Depth-first search for the first identity-shaped key in a payload. Returns the
 * dotted path to the offending key, or null if the payload is clean.
 */
export function findIdentityKey(
  value: unknown,
  path: string[] = [],
): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findIdentityKey(value[i], [...path, String(i)]);
      if (hit) return hit;
    }
    return null;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_IDENTITY_KEYS.has(normalizeKey(key))) {
        return [...path, key].join(".");
      }
      const hit = findIdentityKey(child, [...path, key]);
      if (hit) return hit;
    }
  }
  return null;
}

export class PiiTripwireError extends Error {
  constructor(keyPath: string) {
    super(
      `PII tripwire: identity-shaped key "${keyPath}" found in a PII-free planning ` +
        `payload. The contract carries no identity by construction; refusing to ` +
        `dispatch. De-identify upstream (age, not DOB; no name/SSN/email/phone/address).`,
    );
    this.name = "PiiTripwireError";
  }
}

/**
 * Assert an outbound payload carries no identity-shaped fields, then return it
 * unchanged. Always on (no env flag, no dependency). Throws PiiTripwireError on
 * the first offending key. This is a tripwire, never a redactor.
 */
export function assertNoPII<T>(payload: T): T {
  const hit = findIdentityKey(payload);
  if (hit) throw new PiiTripwireError(hit);
  return payload;
}

type AuditEntry = { tool: string; contractVersion: string };

/**
 * No-op audit seam. This OSS repo keeps NO books-and-records audit trail; it
 * returns a local, non-persisted id only so the dispatch path is byte-identical
 * to the private (pw-api) build, which swaps in the real pwos-core AuditLogger
 * here. Nothing is written or transmitted by this function.
 */
export async function auditCall(entry: AuditEntry): Promise<string> {
  return `local-${entry.tool}-${crypto.randomUUID()}`;
}
