# Merchant Home QA, Security, and Operations Runbook

สถานะเอกสาร: draft สำหรับ staging gate

เอกสารนี้แยกหลักฐานที่รันได้ใน repository ออกจากหลักฐานที่ต้องรันบน PostgreSQL/staging และ browser จริง ห้ามทำเครื่องหมายผ่านจากการตรวจ source เพียงอย่างเดียว

## Current evidence

- [x] Contract unit tests: `node --test server/integration/merchantHomeContract.test.cjs`
- [x] Server diagnostics: `get_errors` ผ่านสำหรับ `server.cjs` และ Merchant Home contract module
- [x] Transaction INSERT mapping reviewed and corrected: `storeId`, `userId`, `currency`, `transactionType` map to their declared columns
- [x] Public landing browser smoke at 390px: nonblank heading, screenshot captured, and no horizontal overflow (`375px` content width in a `390px` viewport)
- [x] Unauthenticated API smoke: `GET /api/db/home` returns `401` without a session
- [x] Unauthenticated UI route smoke: `/merchant#home` resolves to public landing when no server session exists
- [ ] PostgreSQL migration 008 applied and verified in the target environment
- [ ] Seeded/staging merchant session available for authenticated browser evidence; current connected database has no demo merchant account
- [ ] API permission matrix executed with real sessions
- [ ] Browser evidence captured at 390px, 430px, and desktop
- [ ] Browser storage, URL, console, network, and server-log leakage inspection completed
- [ ] Backup/restore rehearsal completed
- [ ] Product, Finance, Security, and Operations sign-off recorded

## Automated contract coverage

The focused contract tests cover:

- pagination bounds and invalid-value defaults;
- transaction filter allowlisting;
- STOPPAY role and current-state transition boundaries;
- duplicate command replay returning the first event without a second side effect.

The following tests require PostgreSQL fixtures and must be run in staging before the checklist can be marked complete:

- missing, malformed, expired, and revoked HttpOnly session;
- merchant, agent, PD, compliance, and admin permission matrix;
- wrong Store identifier and cross-Store notification/transaction access;
- transaction duplicate create with the same idempotency key;
- STOPPAY duplicate request, invalid transition, concurrent requests, and audit count;
- notification read and read-all retry/race behavior;
- database timeout/reconnect and stale Home response behavior.

## Browser evidence matrix

Capture a screenshot and record console/network inspection for each row. Use test accounts and synthetic data only.

| Surface | 390px | 430px | Desktop | Refresh/back-forward | Expected evidence |
| --- | --- | --- | --- | --- | --- |
| POS | [ ] | [ ] | [ ] | [ ] | correct target, Store context, no fake balance |
| Wallet | [ ] | [ ] | [ ] | [ ] | masked/unavailable balance state, no secret in URL/storage |
| Transactions | [ ] | [ ] | [ ] | [ ] | filters, pagination, empty/error/retry states |
| Orders | [ ] | [ ] | [ ] | [ ] | target resolves and active state remains correct |
| Services | [ ] | [ ] | [ ] | [ ] | target resolves without cross-Store data |
| Salespage | [ ] | [ ] | [ ] | [ ] | target is `salespage`, not a legacy placeholder |
| Settings | [ ] | [ ] | [ ] | [ ] | profile/store selector and session behavior |

For each viewport also check keyboard focus, minimum touch target, text overflow, safe-area padding, loading skeleton stability, stale indicator, empty state, API error/retry, and notification drawer behavior.

## Security test matrix

Run with a clean browser profile and capture status code plus a redacted response summary.

| Case | Expected result | Evidence |
| --- | --- | --- |
| no cookie / no Authorization | `401`, no private payload | [ ] |
| malformed or expired session | `401`, no private payload | [ ] |
| revoked session | `401`, no private payload | [ ] |
| merchant requests another Store | `403` or `404`, no other Store data | [ ] |
| agent/PD requests merchant-only action | `403` | [ ] |
| unauthorized notification ID | `404`, no existence leak | [ ] |
| invalid STOPPAY transition | `409` | [ ] |
| duplicate STOPPAY idempotency key | `200` replay, one state change and one audit event | [ ] |
| duplicate transaction idempotency key | `200` replay, one transaction row | [ ] |
| altered body with reused command key | conflict/rejection, no second side effect | [ ] |

Inspect localStorage, sessionStorage, cookies, URL query/hash, browser console, network payloads, and server logs for access tokens, bearer/signing secrets, full signatures, payment credentials, unnecessary phone numbers, and unredacted KYC data. HttpOnly session cookies may appear in browser cookie tooling, but their values must not be copied into evidence.

## Monitoring and alerts

`GET /api/health/metrics` remains restricted to `admin` and `compliance`. It exposes aggregate process metrics and the `merchantHome` aggregate only: request count, error count, total latency, and status-code counts. It must not include Store IDs, user IDs, request bodies, tokens, phone numbers, or notification text.

Track these derived values per deployment window:

- Home error rate: `merchantHome.errors / merchantHome.requests`;
- Home p95 latency from the reverse proxy/APM, because the in-process counter stores total latency only;
- 401/403/404/409/429/5xx counts;
- database readiness failures and connection-pool exhaustion;
- idempotency conflict and replay counts;
- STOPPAY invalid-transition and audit-write failures.

Suggested staging alert thresholds, to be tuned with Operations:

- page on Home 5xx rate above 2% for 5 minutes or readiness failure for 2 consecutive checks;
- page on p95 Home latency above 1.5 seconds for 10 minutes;
- investigate 401/403 spikes, 409 spikes, or replay/conflict ratio changes after rollout;
- page on any evidence of secret, token, or PII logging.

Incident owner: Merchant Platform on-call. Backup owner: Security/Operations on-call. Replace these role names with the actual escalation contacts before production approval.

## Feature flag and rollout

`MERCHANT_HOME_CONTRACT_ENABLED` defaults to `false`. When disabled, authenticated Home contract routes return `404 FEATURE_DISABLED`; this is the rollback switch and prevents an incomplete contract from becoming available by accident.

Rollout gate:

1. Apply and verify migration 008 in staging.
2. Run the PostgreSQL security/idempotency matrix with synthetic Store data.
3. Capture the browser matrix and inspect leakage surfaces.
4. Confirm monitoring, alert routing, backup, restore, and support contacts.
5. Enable for one internal Store or allowlisted cohort.
6. Observe one normal business cycle and compare error/latency/status metrics.
7. Expand in staged cohorts only after Product, Backend, QA, Security, and Operations approval.

Rollback:

1. Set `MERCHANT_HOME_CONTRACT_ENABLED=false` and restart/redeploy the API.
2. Confirm private Home routes return `404 FEATURE_DISABLED` and public `/` remains available.
3. Preserve correlation IDs, aggregate metrics, and redacted logs for incident analysis.
4. Do not run destructive SQL rollback in production. The migration runner has no automatic down migration; restore an approved backup or apply a reviewed forward migration after incident review.
5. Re-enable only after the owner records the root cause, fix, replay/idempotency result, and a new canary check.

## Support readiness

The support handoff must include the current flag state, migration version, deployment identifier, incident owner, escalation contacts, known unavailable fields (`availableBalance`, billing, benefits, and STOPPAY when capability is false), and the exact redacted correlation ID format. Support must never request or paste cookies, bearer tokens, signing secrets, payment credentials, or raw KYC documents into tickets.
