# Golden Oremar Staff MFA Recovery Runbook

This runbook is for emergency recovery when an active Super Admin has lost access to every verified TOTP authenticator. It is not a normal factor-management path and must never be used to bypass AAL2.

## Normal path first

If at least one verified authenticator is still available, sign in normally, complete AAL2, open **Yönetim MFA ve Authenticator**, add a backup authenticator, verify it, and only then remove an obsolete factor. The application and database both prevent removal of the final verified staff TOTP factor.

Supabase Auth does not provide recovery codes for TOTP MFA. Golden Oremar therefore supports multiple verified authenticator factors and recommends at least two independently recoverable authenticators for Super Admin accounts.

## Security invariants

- Staff management capabilities are denied at AAL1.
- `mfa.self_manage` is the only staff capability intentionally available while enrollment or challenge is incomplete.
- The staff MFA security state remains `enforced` during break-glass recovery.
- Recovery opens a maximum 10-minute factor-reset window. It does not grant AAL2 and does not grant management capabilities.
- The recovery RPCs are executable only with Supabase `service_role`. Never put that credential in a browser, mobile build, source control, CI artifact, chat, log, screenshot, or shell history.
- Removing a verified factor through Supabase Auth Admin MFA invalidates the user's active sessions according to the Supabase Auth contract.
- After the final verified TOTP is removed, Golden Oremar immediately closes the recovery window. The account remains fail-closed until a new TOTP factor is enrolled, verified, and a fresh AAL2 session is established.
- Recovery start, cancellation, factor reset, enrollment, factor verification, challenge success, and privileged-session establishment are written to the private admin audit ledger. Client-observed challenge failures are explicitly marked as client-observed evidence rather than server-authoritative Auth failure telemetry.

## Preconditions

1. Confirm the target UUID belongs to the intended active Super Admin through a trusted administrative source.
2. Confirm the incident is genuine device/factor loss, not a suspicious login or account takeover. If compromise is suspected, block the account first and investigate before factor reset.
3. Obtain the Supabase service-role credential only through the approved secret-management path. Do not copy it into source files or `.env` files that can be committed.
4. Record a recovery reason of at least 20 characters describing the incident and operator context without including passwords, TOTP secrets, access tokens, refresh tokens, service keys, or personal secrets.

## Read-only status check

From a trusted operations workstation with the repository checked out and production dependencies installed:

```bash
SUPABASE_URL="https://rmfcziawxjgcnxexbrvw.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<retrieve-from-approved-secret-store>" \
node scripts/super-admin-mfa-recovery.mjs status <SUPER_ADMIN_USER_UUID>
```

Expected normal enforced output includes `state: "enforced"`, `active: false`, and a positive `verifiedTotpFactorCount` before a reset.

## Emergency reset of all verified TOTP factors

The utility requires an explicit confirmation string derived from the target UUID. This prevents accidental execution against a mistyped target.

```bash
export SUPABASE_URL="https://rmfcziawxjgcnxexbrvw.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<retrieve-from-approved-secret-store>"
export MFA_RECOVERY_USER_ID="<SUPER_ADMIN_USER_UUID>"
export MFA_RECOVERY_REASON="Lost all registered authenticator devices; incident verified by approved owner recovery procedure."
export MFA_RECOVERY_CONFIRM="RESET-MFA-<LAST_8_UUID_CHARACTERS_UPPERCASE>"
node scripts/super-admin-mfa-recovery.mjs reset-all "$MFA_RECOVERY_USER_ID"
```

The utility performs these checks and actions in order:

1. Reads the server-side recovery state and verified TOTP count.
2. Requires the account to remain in `enforced` state.
3. Lists the target user's factors through the official Supabase Auth Admin MFA API.
4. Requires the Auth factor count to match the database security-state count.
5. Opens the audited 10-minute recovery window.
6. Deletes only verified TOTP factors through `supabase.auth.admin.mfa.deleteFactor()`.
7. Re-reads recovery state and requires all of these postconditions: `state=enforced`, recovery window inactive, verified TOTP count zero.
8. If any step fails after the window opens, the utility attempts to cancel the recovery window before exiting with failure.

Do not manually delete rows from `auth.mfa_factors` and do not alter `private.staff_mfa_security_state` directly.

## Cancel an unused recovery window

If a recovery was opened but the reset should not continue:

```bash
SUPABASE_URL="https://rmfcziawxjgcnxexbrvw.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<retrieve-from-approved-secret-store>" \
MFA_RECOVERY_REASON="Recovery cancelled after target verification changed; no factor reset should continue." \
node scripts/super-admin-mfa-recovery.mjs cancel <SUPER_ADMIN_USER_UUID>
```

Cancellation removes the active reset window immediately and records `mfa.break_glass_recovery_cancelled` when a live window existed.

## Mandatory post-recovery sequence

1. Sign in with the Super Admin's normal first factor. The session must be AAL1 and management capabilities must remain unavailable.
2. The Golden Oremar staff MFA gate must require new authenticator enrollment.
3. Scan the new QR code using the new authenticator. The TOTP secret must never be logged or stored outside the authenticator and the in-memory enrollment flow.
4. Verify the 6-digit TOTP. Supabase Auth must issue an AAL2 session.
5. Confirm `authorization_context_v1` reports `staffMfaState=enforced`, `mfaFactorEnrolled=true`, `mfaSatisfied=true`, and `authenticatorAssuranceLevel=aal2`.
6. Immediately add a second independently recoverable authenticator from **Yönetim MFA ve Authenticator** and verify it.
7. Review the private audit sequence for the incident. Expected recovery-related events include `mfa.break_glass_recovery_started`, `mfa.factor_removed`, `mfa.break_glass_factor_reset`, subsequent `mfa.enrollment_started`, `mfa.factor_verified`, `mfa.challenge_succeeded`, and `mfa.privileged_session_established`.
8. Remove the service-role credential from the process environment and close the trusted operations session.

## Prohibited shortcuts

Never create fixed OTPs, master TOTP secrets, hard-coded recovery codes, fake AAL2 JWTs, direct capability grants, direct database factor rows, or a permanent MFA bypass. Never weaken the last-factor trigger to solve a recovery incident. Recovery is an audited factor reset only; authorization stays fail-closed until real MFA is re-established.

## External contract references

The implementation follows the current Supabase Auth MFA contract: TOTP enrollment/challenge/verify, JWT `aal` enforcement, multiple factors instead of recovery codes, Admin MFA factor deletion, and Auth-side challenge/verify rate limiting. Review current Supabase documentation before changing this runbook or the recovery implementation because Auth behavior and limits can evolve.
