# Customer accounts — Grqaser

Implemented: email/password registration and sign-in, 30-day server sessions, profile, up to 10 Yerevan delivery addresses, paginated private order history and checkout address filling. Interfaces are Armenian, Russian and English.

## Email and password

Registration works immediately, without SMS or email confirmation and without an external authentication provider. PostgreSQL must be available. The email is a case-normalized login identifier; it is not verified proof of mailbox ownership. Never mark it verified, use it to import guest orders, merge a Google identity by email, or send private account data merely because an address matches.

For local Docker HTTP development, apply `infra/docker-compose.local.yml` after the base file as shown in README. Never use that development override on the public server; the normal production configuration remains HTTPS-only.

- `POST /api/v1/customer/auth/register`: full name, email, password and locale. Creates the account and a server session immediately.
- `POST /api/v1/customer/auth/login`: email and password. Invalid credentials receive the same generic response, including unknown email addresses.
- `POST /api/v1/customer/auth/password`: authenticated request with current and new passwords. Revokes existing sessions and returns a fresh current-device session.
- Passwords contain 15–128 characters, support passphrases, and are never silently trimmed or truncated. They are stored only as versioned, individually salted scrypt hashes (N=32768, r=8, p=3); comparison is timing-safe. Expensive hashing has bounded concurrency and durable request limits.
- Mutations require the exact configured origin and `X-Grqaser-Client: storefront`. Production requires an HTTPS `CUSTOMER_SITE_URL`. Keep the API behind the existing same-origin reverse proxy.
- No email-based password reset or password disclosure is implemented. Public support is `grqaser@gmail.com`; an unverified email match alone must never authorize recovery.

The storefront no longer offers phone/SMS sign-in. Phone numbers remain necessary for order communication and delivery addresses. Legacy database phone/challenge columns are retained to avoid deleting historical identity data; the old SMS endpoints cannot authenticate.

Official security references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

## Optional Google sign-in — deferred

Google is not required for email/password accounts. Leave `CUSTOMER_GOOGLE_ENABLED=false` until the owner resumes setup; the storefront hides an unavailable Google option. SMS also stays disabled. Never add credentials to Git or `NEXT_PUBLIC_*` variables.

For future activation:

1. In the owner's [Google Auth Platform](https://console.cloud.google.com/auth/clients), complete the application's saved branding/audience/contact configuration and create a Web application OAuth client. Check the persisted result rather than relying only on an automation success message.
2. Register the exact callback for the deployed site:

   `https://grqaser.digitalize.am/api/v1/customer/auth/google/callback`

   When the real domain is active, separately register:

   `https://grqaser.am/api/v1/customer/auth/google/callback`

3. Install `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` only in `/opt/grqaser/.env`, then set `CUSTOMER_GOOGLE_ENABLED=true`. `NEXT_PUBLIC_SITE_URL` must be the actual HTTPS origin; Compose passes it to the API as `CUSTOMER_SITE_URL`.
4. Verify the owner's complete login and callback. For only `openid email profile`, Google's [basic-identity Testing exception](https://support.google.com/cloud/answer/15549945?hl=en) does not require a test-user allowlist or impose the ordinary seven-day authorization expiry. Testing does not make this login owner-only.
5. Public production readiness separately requires truthful support details, account/Google-data privacy and terms links, and verified domain ownership. Do not infer domain verification from SSH access or accept new owner policy attestations without approval. See [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

The existing authorization-code flow uses cookie-bound state, a one-use database flow, PKCE and nonce. The official library validates ID-token signature, audience, issuer and expiry. Only `openid email profile` are requested; this grants no access to Gmail messages. Immutable Google `sub`, not an email match, identifies an account. Linking requires an explicit authenticated action and verified provider identity.

## Data and deployment

- Migration `20261021000000_customer_accounts` added account tables and nullable order ownership. Migration `20261021010000_customer_password_auth` adds nullable login email/password-hash columns and extends identity constraints without deleting legacy accounts or orders. Apply migrations before starting the new API.
- New authenticated orders carry the server-derived customer ID. Idempotent replay never changes an existing order's owner. Guest checkout works, and previous guest orders are not imported by phone/email match.
- Private account responses are `no-store` and scoped to the authenticated ID. Order projections exclude supplier/source/cost/margin data.
- Production cookies use `__Host-`, `HttpOnly`, `SameSite=Lax`, `Secure`, `Path=/` and no domain. Database rows store only hashes of random session tokens. Logout revokes the server session; “all devices” revokes all customer sessions.
- Favourites and the cart remain browser-local; no cross-device synchronisation is claimed.
- Before deployment, inspect a PostgreSQL backup and retain previous API/web images. Validate new account flows in an isolated guarded QA schema, never by adding fixture users or orders to production. Leave migrations in place during a rollback; an older image does not implement password login for new email accounts.
- Check the effective trusted-proxy CIDRs and Nginx forwarded headers before relying on per-client-IP limits. Never accept arbitrary forwarded IP headers.

Provider keys and Google setup are not prerequisites for ordinary registration.
