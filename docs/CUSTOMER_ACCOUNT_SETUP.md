# Customer accounts — Grqaser

Implemented: phone + SMS sign-in, Google sign-in, linked sign-in methods, 30-day server sessions, profile, up to 10 Yerevan delivery addresses, paginated private order history and checkout address filling. Interfaces are Armenian, Russian and English. Email/password registration is not used.

## Provider activation

Both providers are disabled by default. The public page clearly says when a method is unavailable; no placeholder code can sign a customer in. Keep secrets in `/opt/grqaser/.env`, never in Git or `NEXT_PUBLIC_*` variables.

### Google

1. In the owner's [Google Cloud / Google Auth Platform](https://console.cloud.google.com/auth/clients), create or select a project. Configure branding as **Grqaser / Գրքասեր**, the owner-controlled support address and the audience. Create an OAuth client of type **Web application**.
2. Register the exact callback for the currently deployed site:

   `https://grqaser.digitalize.am/api/v1/customer/auth/google/callback`

   When the real domain is active, separately register:

   `https://grqaser.am/api/v1/customer/auth/google/callback`

3. Install `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server and set `CUSTOMER_GOOGLE_ENABLED=true`. `NEXT_PUBLIC_SITE_URL` must be the actual HTTPS site origin; Compose passes it to the API as `CUSTOMER_SITE_URL`.
4. If the Google app is in Testing, add the owner's Google account as a test user. Publish the OAuth app to the intended audience before offering public sign-in, subject to Google's current requirements.

The authorization code flow uses state tied to an HttpOnly browser cookie, a one-use database flow, PKCE and nonce. ID-token signatures/audience/issuer/expiry are checked by the official `google-auth-library`. Only `openid email profile` scopes are requested. This does not grant access to Gmail messages. Immutable Google `sub`, not an email match, identifies a customer. Methods can be explicitly linked from an already authenticated account; identities owned by another account are rejected.

Official implementation references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google Node.js auth library](https://github.com/googleapis/google-auth-library-nodejs).

### SMS

An adapter for Twilio Verify is prepared. No account, subscription or paid SMS is created by this change.

1. Create a Verify Service in an owner-controlled Twilio account. Configure **6 digits**, SMS, fraud protection, and Armenia geo permissions. Check actual Armenian operator delivery and pricing in the provider account.
2. Install `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` and set `CUSTOMER_SMS_ENABLED=true`.
3. Recreate the API container after updating environment variables. Verify delivery to an owner-controlled phone before enabling the service for customers.

Codes are verified by Twilio; raw codes are not stored or logged by Grqaser. Only Armenian numbers are accepted. There is a 60-second cooldown, five sends per number per day, ten sends per IP per hour, a global cap of 100 sends per day, and five code attempts per challenge. Counters and one-use challenge consumption are durable in PostgreSQL. Provider failures do not create a session.

References: [start verification](https://www.twilio.com/docs/verify/api/verification), [check code](https://www.twilio.com/docs/verify/api/verification-check).

## Data and deployment

- Migration `20261021000000_customer_accounts` only adds account tables and nullable order ownership. Existing orders and catalog entries remain valid. Apply migrations before starting the new API.
- New orders created during an authenticated checkout carry the server-derived customer ID. An idempotent replay never reassigns an existing order. Guest checkout continues to work. Previous guest orders are not exposed merely because a phone/email matches a new account.
- API responses for the account require an unexpired server session and are `no-store`; addresses/orders are queried using the authenticated ID. Private order projections exclude supplier/source/cost/margin data.
- Secure production cookies use `__Host-`, `HttpOnly`, `SameSite=Lax`, `Secure`, `Path=/` and no domain. Database rows store only hashes of random session tokens. Logout revokes the session in the database; “all devices” revokes all sessions for that customer.
- Mutations require an exact configured origin and the storefront's custom request header. TLS terminates at the existing reverse proxy. Keep API access behind the same site origin.
- Favourites and the guest cart still use browser storage; the account does not claim cross-device synchronisation for those collections.
- Before deploying, take and inspect a PostgreSQL dump and retain the previous API/web image tags. After applying the additive migration, older code can run for rollback while leaving the new tables in place.

Provider activation requires real credentials and cannot be inferred from being signed in to Gmail in a browser.
