# Okta Onboarding Guide

This guide covers **customer-admin** steps for Okta SSO and optional People directory pull in `kimi`, plus what **you (the product team)** do once per tenant.

---

## A) Your side (kimiro / product team) — quick checklist

1. **Provision the tenant** (if not already): use the CLI so the tenant exists and (optionally) Neon is wired.
   ```bash
   pnpm --dir backend sso:onboard --slug <tenantSlug> --name "Company Name" --domain company.com --provider okta
   ```
2. **Copy two URLs from the CLI output** and send them to the customer:
   - **Setup URL** — one-time link (`/setup?token=...&provider=okta`).
   - **OAuth Redirect URL** — exact callback they must register in Okta (looks like `https://<your-app>/api/auth/sso/callback/okta`).
3. **After they finish setup** — confirm they can open `https://<your-app>/<tenantSlug>/chat` and sign in.
4. **People sync** — if they filled the Okta connector fields, they can go to `/<tenantSlug>/people` and click **Sync now**.

---

## B) Customer side — what the integration does

- **SSO**: Users sign in with Okta (OIDC) using their work email.
- **People sync (optional)**: Pulls users from the Okta **Users API** via an **API Services** app (**OAuth 2.0 client credentials** with a **private-key JWT** and **DPoP** when required). Used to populate the People directory and optional access checks.

---

## C) Customer prerequisites

- Okta **admin** access (or IT team) to create/configure an app integration.
- Company email domain already linked to the tenant in `kimi` (from onboarding).
- The **Setup URL** and **OAuth Redirect URL** from kimiro.

---

## D) Customer — Okta admin console (OIDC app for SSO)

1. Sign in to the Okta Admin Console (normal org URL looks like **`https://<your-org>.okta.com`** — not `-admin`).
2. Go to **Applications** → **Applications** → **Create App Integration**.
3. Choose **OIDC – OpenID Connect**, then **Web Application** (or the type your vendor recommends).
4. **Sign-in redirect URIs**: paste the **OAuth Redirect URL** from kimiro exactly (scheme, host, path).
5. **Sign-out redirect URIs** (optional): your app login URL if you use global logout later.
6. **Assignments**: assign users or groups who are allowed to use this app (**this controls who can SSO into `kimi`**).
7. Open the app → **General** tab and note:
   - **Client ID**
   - **Client secret**
8. **Issuer / Okta URL** — use the canonical issuer (typically `https://<your-org>.okta.com`). This must match OIDC discovery; do **not** use the `-admin.okta.com` console URL as the issuer.

---

## E) Customer — People directory pull (API Services app)

### E1) API Services app (OAuth, private key JWT)

1. In Okta Admin: **Applications** → **Create App Integration** → **API Services**.
2. Note the **Client ID**.
3. Under the app, add a **public key** (or generate a key pair). If Okta gives you a private **JWK JSON**, it normally includes a **`kid`** field — keep that in the pasted key.
4. Grant the app Okta API scopes such as **`okta.users.read`** and optionally **`okta.groups.read`**.
5. Assign the app an **admin role / resource set** so it can read users org-wide (scopes alone are not always enough).
6. In `kimi` → **People** → **Manage** (directory pull): set **Okta org base URL**, **OAuth client ID**, and paste the **private key** — either the **JSON JWK** Okta provides (one JSON object) or an **RSA PEM**.

**Troubleshooting — `invalid_client` / “does not have a JWKSet configured”:**  
Okta must store the **public** key for this app before it will accept `client_assertion` JWTs. In the **same API Services app**, open **General** (or **Authentication** / **Public keys** depending on your Okta UI) and **add** the public JWK or upload the public half of the key pair. If you only downloaded a private JWK locally but never registered the public key in Okta, add it now (or use **Generate new key** in Okta so it registers the public key automatically, then download the new private key).

## F) Customer — fill the `kimi` setup form

Open the **Setup URL** from kimiro. Choose **Okta**.

| Field | What to enter |
|--------|----------------|
| **Client ID** | From the Okta OIDC app |
| **Client Secret** | From the Okta OIDC app |
| **Issuer URL** | `https://<your-org>.okta.com` |
| **Admin emails** | People who manage the tenant in `kimi` |
| **Okta org base URL** | `https://<your-org>.okta.com` |
| **OAuth client ID + private key** | From E1 (required for directory pull) |

Save and complete the flow.

---

## G) Validate end-to-end

1. Open **Login**, enter a user email on the tenant domain, complete Okta sign-in.
2. Open `/<tenantSlug>/people`.
3. Click **Sync now** (admins). Confirm users appear and last sync updates.
4. Confirm only **assigned** Okta users can reach the app (per Okta app assignment).

---

## H) People field mapping (Okta)

- Email from Okta user profile.
- Name / department / title from profile where present.
- **Active / inactive** from Okta user status.

---

## I) Common issues

- **OIDC issuer mismatch** — Issuer must be the **org** URL (`https://<org>.okta.com`), not the admin console URL.
- **Redirect URI mismatch** — Must match the **OAuth Redirect URL** from kimiro character-for-character.
- **Sync returns few or no users** — Token permissions, wrong base URL, or API rate limits; confirm token and URL.
- **User can’t sign in** — Not assigned to the Okta application, or wrong domain / tenant configuration.

---

## J) Security recommendations

- Rotate the API Services app key pair on a schedule; update the public key in Okta and the private key in `kimi`.
- Use **least privilege** admin roles and resource sets on the service app (for example **Read-only Administrator** with an appropriate user resource set).
- Prefer **group-based assignments** in Okta for access control.
