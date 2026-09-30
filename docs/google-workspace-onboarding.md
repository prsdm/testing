# Google Workspace Onboarding Guide

This guide covers the exact customer-admin setup for Google Workspace SSO and People sync in `kimi`.

## 1) What this integration does

- Enables SSO login with Google Workspace (OIDC).
- Supports People sync via **Google Admin SDK Directory API pull** (service account).
- Pulls profile fields: name, email, status, department, and job title.

## 2) Prerequisites

- Google Workspace super admin access.
- Google Cloud project access.
- Permission to create service account keys (or org policy exception).
- Tenant onboarding setup link/token in `kimi`.

## 3) Google Cloud setup (one-time)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select your project.
2. Enable **Admin SDK API**:
   - `APIs & Services` -> `Library` -> search `Admin SDK API` -> Enable.
3. Create or open a service account:
   - `IAM & Admin` -> `Service Accounts`.
4. Enable **Domain-wide Delegation** for that service account.
5. Create JSON key:
   - Service account -> `Keys` -> `Add key` -> `Create new key` -> `JSON`.
6. Save these JSON values:
   - `client_email` (used in setup form)
   - `private_key` (used in setup form)
   - `client_id` (used in Google Admin Console delegation)

## 4) Google Admin Console setup (one-time)

1. Open [Google Admin Console](https://admin.google.com/).
2. Go to `Security` -> `API controls` -> `Domain-wide delegation`.
3. Add API client:
   - **Client ID**: service account `client_id`
   - **OAuth scope**:
     - `https://www.googleapis.com/auth/admin.directory.user.readonly`
4. Save and wait a few minutes for propagation.

## 5) If key creation is blocked

If you see "Service account key creation is disabled", check and update org policies:

- `iam.disableServiceAccountKeyCreation` (legacy)
- `iam.managed.disableServiceAccountKeyCreation` (managed)

Set the effective policy to **Not enforced** for the target project (or ask org policy admin).

Note: you need `roles/orgpolicy.policyAdmin` to edit these policies.

## 6) Fill `kimi` setup form

Choose provider: **Google Workspace**, then enter:

- `Client ID` and `Client Secret` (Google OAuth app for SSO)
- `Admin emails` (one or more tenant admins)
- `Workspace domain` (example: `kimiro.ai`)
- `Delegated Admin Email` (real Workspace admin account)
- `Service Account Client Email` (JSON `client_email`)
- `Service Account Private Key` (JSON `private_key`)

Click **Save & Validate**.

## 7) Validate end-to-end

1. Login using a Workspace user from the tenant domain.
2. Open `/{tenantSlug}/people`.
3. Click **Sync now**.
4. Confirm success message and users shown in the table.
5. Confirm `Last sync` updates.

## 8) People field mapping

- Name: Google profile name
- Email: `primaryEmail`
- Department: `organizations[].department` (primary org record)
- Job Title: `organizations[].title` (primary org record)
- Status: from suspended/active state

If Department or Job Title appears as `-`, that field is empty in Google profile data.

## 9) Department vs Groups

- **Department**: profile metadata for display/reporting.
- **Groups**: membership model for access and entitlements.

Use groups for authorization. Use department/job title for People directory context.

## 10) Common issues

- `403` on sync: domain-wide delegation missing/incorrect scope, wrong delegated admin email, Admin SDK API not enabled, or domain mismatch.
- Login says "Enter valid work email.": often generic UI text for backend SSO config issues (not email format).
- Sync succeeded but no visible list update: app now refreshes page data automatically after sync success.

## 11) Security recommendations

- Store service account private keys in a secure secret manager.
- Rotate keys periodically.
- Avoid sharing keys in chat/docs/screenshots.
- If policy was relaxed temporarily, re-enable strict key-creation policy after setup.
