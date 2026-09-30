# Microsoft Entra ID (Azure AD) Onboarding Guide

This guide covers **customer-admin** steps for Microsoft Entra ID (Azure AD) SSO and optional People directory sync via **Microsoft Graph**, plus what **you (the product team)** do once per tenant.

---

## A) Your side (kimiro / product team) — quick checklist

1. **Provision the tenant** (if not already):
   ```bash
   pnpm --dir backend sso:onboard --slug <tenantSlug> --name "Company Name" --domain company.com --provider azure_ad
   ```
2. **Send the customer**:
   - **Setup URL** from the CLI (`/setup?token=...&provider=azure_ad`).
   - **OAuth Redirect URL** — must be added in Entra exactly (e.g. `https://<your-app>/api/auth/sso/callback/azure`).
3. After setup, confirm SSO to `/<tenantSlug>/chat` and (if configured) **People** → **Sync now**.

---

## B) Customer side — what the integration does

- **SSO**: Users sign in with Microsoft (OIDC) using their Entra identities.
- **People sync (optional)**: Calls **Microsoft Graph** `GET /users` using **application** (client credentials) permissions — requires a registered app and **admin consent** for Directory permissions.

The setup form has two credential areas:

1. **Top “Client ID / Client Secret / Issuer”** — Used for **user sign-in (SSO)** with Better Auth.
2. **“Directory Tenant ID / Directory Client ID / Directory Client Secret”** — Used **only for People sync** (Graph).

**Simple approach (one app):** Often the same Entra **App registration** is used for both: paste the **same** Application (client) ID and client secret into SSO fields **and** Directory fields, set **Directory Tenant ID** (and issuer tenant) to your **Directory (tenant) ID**.

**Stricter approach (two apps):** One registration for interactive SSO only; a second registration (no public redirect) with only **application** Graph permissions for sync.

---

## C) Customer prerequisites

- Entra roles: ability to register apps and grant **admin consent** (e.g. Global Administrator or Application Administrator plus Privileged Role Administrator depending on tenant policy).
- **Setup URL** + **OAuth Redirect URL** from kimiro.
- **Tenant ID** (Directory ID) from Microsoft Entra admin center.

Where to find **Tenant ID**:

- Entra admin center → **Identity** → **Overview** → **Tenant ID**.

---

## D) Customer — App registration (SSO)

1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Identity** → **Applications** → **App registrations** → **New registration**.
2. **Name**: e.g. `Kimi SSO`.
3. **Supported account types**: usually **Accounts in this organizational directory only** (single tenant) for typical B2B customers.
4. **Redirect URI** → **Web**: paste kimiro **OAuth Redirect URL** exactly (`.../api/auth/sso/callback/azure`).
5. After creation, open **Certificates & secrets** → **New client secret** — copy the **Value** (secret) once.
6. Note **Application (client) ID** from the **Overview** page.

### API permissions for **sign-in** (delegated)

1. **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Add at least:
   - `openid`
   - `email`
   - `profile`
   - `offline_access` (if you use refresh tokens / long sessions — your IdP session still applies)
3. Click **Grant admin consent for \<tenant\>** if your org requires it.

### Issuer URL for the setup form

Use the **tenant-specific** v2 issuer (recommended for single-tenant):

`https://login.microsoftonline.com/<tenant-id>/v2.0`

Replace `<tenant-id>` with your **Directory (tenant) ID**.

Avoid `.../common/...` in production unless you intentionally run multi-tenant sign-in and your app supports it.

---

## E) Customer — Graph access for People sync (optional)

The app needs **application** permissions to read users (no signed-in user).

1. Same app registration (or a dedicated “Kimi Directory Sync” app).
2. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**.
3. Add **`User.Read.All`** (read all users’ full profiles — matches current Graph calls).
4. **Grant admin consent for \<tenant\>**.

**Note:** Microsoft may offer more restricted permissions in some tenants; `User.Read.All` is the straightforward match for directory-wide user listing used by `kimi` today.

5. For the **Directory** section of the setup form (or **People** → **Manage** after onboarding):
   - **Directory Tenant ID** = Directory (tenant) ID  
   - **Directory Client ID** = Application (client) ID of the app that has **User.Read.All (application)**  
   - **Certificate (required for directory pull):** In the app registration → **Certificates & secrets** → **Certificates**, upload your public **.cer**. In `kimi` → **People** → **Manage**, paste a **PEM bundle**: the `-----BEGIN CERTIFICATE-----` … block **and** the matching unencrypted `-----BEGIN PRIVATE KEY-----` … block (same pair you registered in Entra). You can export from Azure Key Vault or OpenSSL; the private key is only stored in your tenant settings like a secret—use least privilege and rotation.

If you use **one** app for SSO + sync, Directory **Client ID** often matches the top **Client ID**. You can use a **client secret** for SSO (Better Auth) and a **certificate** for Microsoft Graph directory sync on the same app registration.

---

## F) Customer — fill the `kimi` setup form

Open the **Setup URL**. Choose **Azure AD**.

| Field | What to enter |
|--------|----------------|
| **Client ID** | App registration Application (client) ID (SSO) |
| **Client Secret** | That app’s client secret |
| **Issuer URL** | `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| **Admin emails** | Tenant admins in `kimi` |
| **Directory Tenant ID** | Directory (tenant) ID |
| **Directory Client ID** | App with Graph **application** `User.Read.All` |
| **Directory certificate PEM** | Full PEM with cert + private key (required for Graph directory pull) |

Submit **Save & Validate**.

---

## G) Validate end-to-end

1. **Login** with a user in the tenant domain → Microsoft sign-in completes → lands in `/<tenantSlug>/chat`.
2. **People** → **Sync now** (admins). Users should fill from Graph (`mail` / `userPrincipalName`, names, department, job title, enabled flag).
3. **Access**: Use Entra **Conditional Access** and **enterprise app assignment** to control who may use the app (same idea as Okta app assignment).

---

## H) People field mapping (Graph)

- Email: `mail` if set, otherwise `userPrincipalName`
- Names: `givenName`, `surname`, `displayName`
- Department / job title / office: `department`, `jobTitle`, `officeLocation`
- Status: `accountEnabled` → active / inactive in `kimi`

---

## I) Common issues

- **AADSTS50011 / redirect URI mismatch** — Redirect in Entra must match kimiro’s **OAuth Redirect URL** exactly.
- **Invalid issuer** — Use tenant-specific issuer `.../\<tenant-id\>/v2.0`, not a stale or wrong GUID.
- **People sync empty or 403** — Admin consent missing for **application** `User.Read.All`, wrong Directory client ID, bad or expired **client secret**, or **certificate** not uploaded to the app / PEM does not match the registered cert.
- **Wrong users / wrong tenant** — Directory Tenant ID must be the customer’s Entra tenant that holds their users.

---

## J) Security recommendations

- Prefer **separate** client secrets for “human SSO” vs “automation sync” if you want blast-radius isolation.
- Rotate secrets on a schedule; store in a vault.
- Enforce **Conditional Access** (MFA, compliant device, location) at Entra for production.
