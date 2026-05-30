/**
 * compliance — pwplan-core's seam into the pwos-core compliance packages.
 *
 * Because the planning contract is PII-free BY CONSTRUCTION (contract/planning.ts),
 * pii-guard's job here is not redaction — it is a FAIL-CLOSED TRIPWIRE. If client
 * identity data ever appears in an outbound payload (an upstream transform bug),
 * the call throws rather than silently scrubbing. The structural guarantee is the
 * primary defense; this is the second layer.
 *
 * Identity→planning-variable transformation (DOB→age, strip names) happens
 * UPSTREAM, in pw-api, never in this repo. pwplan-core never receives PII to scrub.
 *
 * @protocolwealthos/* are optional peer deps. The no-op fallbacks keep the app
 * runnable for local UI dev ONLY (VITE_COMPLIANCE_NOOP=1); CI fails any build
 * that commits the no-op flag.
 */

// Real implementations (peer dependencies):
//   import { Scanner } from "@protocolwealthos/pii-guard";
//   import { AuditLogger } from "@protocolwealthos/audit-log";

type AuditEntry = { tool: string; contractVersion: string };

const DEV_NOOP = import.meta.env.VITE_COMPLIANCE_NOOP === "1";

export class PiiTripwireError extends Error {
  constructor(detail: string) {
    super(
      `PII tripwire: identity data found in a PII-free planning payload (${detail}). ` +
        `The upstream de-identification in pw-api is broken; refusing to dispatch.`,
    );
    this.name = "PiiTripwireError";
  }
}

/**
 * Assert an outbound payload carries no PII, then return it unchanged.
 * Throws PiiTripwireError if pii-guard detects identity data.
 */
export function assertNoPII<T>(payload: T): T {
  if (DEV_NOOP) {
    console.warn(
      "[pwplan-core] COMPLIANCE NO-OP: pii tripwire disabled. Local dev only.",
    );
    return payload;
  }
  // const scanner = new Scanner();
  // const findings = scanner.scan(payload);
  // if (findings.length) throw new PiiTripwireError(findings.map((f) => f.kind).join(","));
  // return payload;
  throw new Error(
    "pii-guard not wired. Install @protocolwealthos/pii-guard or set " +
      "VITE_COMPLIANCE_NOOP=1 for local UI dev.",
  );
}

/**
 * Append an entry to the pwos-core audit-log hash chain and return its id.
 * The id is forwarded to the engine so engine-side and client-side audit
 * trails reconcile during an SEC examination.
 */
export async function auditCall(entry: AuditEntry): Promise<string> {
  if (DEV_NOOP) {
    return `dev-${entry.tool}-${crypto.randomUUID()}`;
  }
  // const logger = new AuditLogger();
  // return logger.append({ kind: "engine_call", ...entry });
  throw new Error(
    "audit-log not wired. Install @protocolwealthos/audit-log or set " +
      "VITE_COMPLIANCE_NOOP=1 for local UI dev.",
  );
}
