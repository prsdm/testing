import { JWT } from "google-auth-library";
import { fetchAzureGraphAccessTokenWithCertificate } from "@/core/lib/people-sync/azure-entra-token";
import {
  type OktaDpopKeyPair,
  signOktaDpopProof,
} from "@/core/lib/people-sync/okta-dpop";
import { fetchOktaManagementAccessToken } from "@/core/lib/people-sync/okta-management-token";
import { decryptDirectoryCredentials } from "@/core/lib/security/directory-secrets";
import { ChatbotError } from "@/shared/errors";
import type {
  PeopleProfile,
  ProviderDirectoryCredentials,
  TenantProviderConfig,
} from "./types";

function parseCredentials(metadata: unknown): ProviderDirectoryCredentials {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  const directory = (metadata as { directory?: ProviderDirectoryCredentials })
    .directory;
  if (!directory || typeof directory !== "object") {
    return {};
  }
  return decryptDirectoryCredentials(directory);
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ChatbotError(
      "bad_request:api",
      `People sync provider request failed (${response.status})`
    );
  }
  return response.json();
}

function parseOktaNextUsersUrl(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
  return match?.[1]?.trim() ?? null;
}

function toAbsoluteOktaUrl(url: string, base: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const root = base.replace(/\/+$/, "");
  return url.startsWith("/") ? `${root}${url}` : `${root}/${url}`;
}

function oktaHtuForDpop(requestUrl: string): string {
  const u = new URL(requestUrl);
  return `${u.origin}${u.pathname}`;
}

function parseUseDpopNonceError(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error === "use_dpop_nonce";
  } catch {
    return text.includes("use_dpop_nonce");
  }
}

function extractDpopNonceFromHeaders(headers: Headers): string | undefined {
  const direct = headers.get("dpop-nonce");
  if (direct) {
    return direct;
  }
  const wwwAuthenticate = headers.get("www-authenticate");
  if (!wwwAuthenticate) {
    return undefined;
  }
  const match = wwwAuthenticate.match(/dpop-nonce="([^"]+)"/i);
  return match?.[1];
}

async function listAllOktaUsers(options: {
  baseUrl: string;
  accessToken: string;
  tokenType: string;
  dpop: OktaDpopKeyPair;
}): Promise<Record<string, unknown>[]> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const collected: Record<string, unknown>[] = [];
  let url: string | null = `${base}/api/v1/users?limit=200`;

  while (url) {
    const requestUrl = toAbsoluteOktaUrl(url, base);
    const requestUsersPage = (nonce?: string) => {
      const headers: Record<string, string> = {
        Authorization: `${options.tokenType.toLowerCase() === "dpop" ? "DPoP" : "Bearer"} ${options.accessToken}`,
        DPoP: signOktaDpopProof({
          accessToken: options.accessToken,
          dpopPrivateKey: options.dpop.privateKey,
          dpopPublicJwk: options.dpop.publicJwk,
          htm: "GET",
          htu: oktaHtuForDpop(requestUrl),
          nonce,
        }),
      };
      return fetch(requestUrl, { headers });
    };

    let response = await requestUsersPage();
    if (!response.ok) {
      const nonce = extractDpopNonceFromHeaders(response.headers);
      const text = await response.text();
      if (nonce && parseUseDpopNonceError(text)) {
        response = await requestUsersPage(nonce);
      } else {
        const wwwAuthenticate = response.headers.get("www-authenticate");
        throw new ChatbotError(
          "bad_request:api",
          `Okta users request failed (${response.status}): ${text.slice(0, 400)}${wwwAuthenticate ? ` [WWW-Authenticate: ${wwwAuthenticate.slice(0, 300)}]` : ""}`
        );
      }
    }

    if (!response.ok) {
      const text = await response.text();
      const wwwAuthenticate = response.headers.get("www-authenticate");
      throw new ChatbotError(
        "bad_request:api",
        `Okta users request failed (${response.status}): ${text.slice(0, 400)}${wwwAuthenticate ? ` [WWW-Authenticate: ${wwwAuthenticate.slice(0, 300)}]` : ""}`
      );
    }
    const batch = (await response.json()) as Record<string, unknown>[];
    collected.push(...batch);

    const nextFromLink = parseOktaNextUsersUrl(response.headers.get("link"));
    if (nextFromLink) {
      url = nextFromLink;
      continue;
    }
    if (batch.length === 200) {
      const lastId = batch.at(-1)?.id;
      if (typeof lastId === "string") {
        url = `${base}/api/v1/users?limit=200&after=${encodeURIComponent(lastId)}`;
        continue;
      }
    }
    url = null;
  }

  return collected;
}

function mapOktaUsersToProfiles(
  users: Record<string, unknown>[]
): PeopleProfile[] {
  return users.flatMap((user) => {
    const profile =
      (user.profile as Record<string, unknown> | undefined) ?? undefined;
    const emailValue = profile?.email;
    const loginValue = profile?.login;
    const email =
      typeof emailValue === "string" && emailValue.trim().length > 0
        ? emailValue.trim()
        : typeof loginValue === "string" && loginValue.trim().length > 0
          ? loginValue.trim()
          : "";
    if (!email) {
      return [];
    }
    const managerEmailValue = profile?.managerEmail;
    return [
      {
        department:
          typeof profile?.department === "string"
            ? profile.department
            : undefined,
        displayName:
          typeof profile?.displayName === "string"
            ? profile.displayName
            : undefined,
        email,
        externalId: String(user.id ?? email),
        firstName:
          typeof profile?.firstName === "string"
            ? profile.firstName
            : undefined,
        lastName:
          typeof profile?.lastName === "string" ? profile.lastName : undefined,
        location:
          typeof profile?.city === "string"
            ? profile.city
            : typeof profile?.location === "string"
              ? profile.location
              : undefined,
        managerEmail:
          typeof managerEmailValue === "string" ? managerEmailValue : undefined,
        raw: user,
        status: user.status === "ACTIVE" ? "active" : "inactive",
        title: typeof profile?.title === "string" ? profile.title : undefined,
      },
    ];
  });
}

async function fetchFromOkta(
  credentials: ProviderDirectoryCredentials
): Promise<PeopleProfile[]> {
  const baseUrl = credentials.baseUrl?.trim() ?? "";
  if (!baseUrl) {
    throw new ChatbotError(
      "bad_request:api",
      "Okta org base URL is required for directory sync."
    );
  }

  const clientId = credentials.oktaOAuthClientId?.trim() ?? "";
  if (!clientId || !credentials.oktaPrivateKey?.trim()) {
    throw new ChatbotError(
      "bad_request:api",
      "Okta directory sync requires an API Services app: OAuth client ID and private key. Save them under People settings."
    );
  }

  const base = baseUrl.replace(/\/+$/, "");
  const oauth = await fetchOktaManagementAccessToken({
    baseUrl: base,
    clientId,
    privateKeyPem: credentials.oktaPrivateKey,
  });
  const users = await listAllOktaUsers({
    accessToken: oauth.accessToken,
    baseUrl: base,
    dpop: oauth.dpop,
    tokenType: oauth.tokenType,
  });
  const profiles = mapOktaUsersToProfiles(users);
  if (users.length > 0 && profiles.length === 0) {
    throw new ChatbotError(
      "bad_request:api",
      "Okta returned users, but none had a usable email/login for mapping. Ensure users have profile.email or profile.login values."
    );
  }
  return profiles;
}

async function fetchFromEntra(
  credentials: ProviderDirectoryCredentials
): Promise<PeopleProfile[]> {
  const tenantId = credentials.tenantId?.trim() ?? "";
  const clientId = credentials.clientId?.trim() ?? "";
  if (!tenantId || !clientId) {
    return [];
  }

  const certBundle = credentials.azureClientCertificatePem?.trim() ?? "";
  if (!certBundle) {
    throw new ChatbotError(
      "bad_request:api",
      "Microsoft directory sync requires a certificate PEM (cert + private key) in People settings. Upload the matching .cer to Entra, then paste the PEM bundle."
    );
  }

  const accessToken = await fetchAzureGraphAccessTokenWithCertificate({
    certificatePemBundle: certBundle,
    clientId,
    tenantId,
  });

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
  };
  const select =
    "id,displayName,givenName,surname,mail,userPrincipalName,department,jobTitle,officeLocation,accountEnabled";
  let graphUrl: string | null =
    `https://graph.microsoft.com/v1.0/users?$select=${select}&$top=999`;
  const graphUsers: Record<string, unknown>[] = [];

  while (graphUrl) {
    const page = (await fetchJson(graphUrl, {
      headers: authHeaders,
    })) as {
      value?: Record<string, unknown>[];
      "@odata.nextLink"?: string;
    };
    graphUsers.push(...(page.value ?? []));
    const next = page["@odata.nextLink"];
    graphUrl = typeof next === "string" && next.length > 0 ? next : null;
  }

  return graphUsers.flatMap((user) => {
    const email = String(user.mail ?? user.userPrincipalName ?? "");
    if (!email) {
      return [];
    }
    return [
      {
        department:
          typeof user.department === "string" ? user.department : undefined,
        displayName:
          typeof user.displayName === "string" ? user.displayName : undefined,
        email,
        externalId: String(user.id ?? email),
        firstName:
          typeof user.givenName === "string" ? user.givenName : undefined,
        lastName: typeof user.surname === "string" ? user.surname : undefined,
        location:
          typeof user.officeLocation === "string"
            ? user.officeLocation
            : undefined,
        raw: user,
        status: user.accountEnabled === false ? "inactive" : "active",
        title: typeof user.jobTitle === "string" ? user.jobTitle : undefined,
      },
    ];
  });
}

async function fetchFromGoogle(
  credentials: ProviderDirectoryCredentials
): Promise<PeopleProfile[]> {
  if (
    !credentials.domain ||
    !credentials.delegatedAdminEmail ||
    !credentials.serviceAccountClientEmail ||
    !credentials.serviceAccountPrivateKey
  ) {
    return [];
  }
  const client = new JWT({
    email: credentials.serviceAccountClientEmail,
    key: credentials.serviceAccountPrivateKey.replaceAll("\\n", "\n"),
    scopes: ["https://www.googleapis.com/auth/admin.directory.user.readonly"],
    subject: credentials.delegatedAdminEmail,
  });
  const tokenResponse = await client.authorize();
  if (!tokenResponse.access_token) {
    throw new ChatbotError(
      "bad_request:api",
      "Failed to authorize Google Admin API"
    );
  }

  const allUsers: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      domain: credentials.domain,
      maxResults: "500",
      projection: "full",
      ...(pageToken ? { pageToken } : {}),
    });
    const payload = (await fetchJson(
      `https://admin.googleapis.com/admin/directory/v1/users?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
        },
      }
    )) as { users?: Record<string, unknown>[]; nextPageToken?: string };
    allUsers.push(...(payload.users ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return allUsers.flatMap((user) => {
    const email = String(user.primaryEmail ?? "");
    if (!email) {
      return [];
    }
    const name = (user.name as Record<string, unknown> | undefined) ?? {};
    const organizations = Array.isArray(user.organizations)
      ? (user.organizations as Record<string, unknown>[])
      : [];
    const primaryOrg = organizations.find((org) => org.primary === true);
    const orgUnitPath =
      typeof user.orgUnitPath === "string" ? user.orgUnitPath : undefined;
    return [
      {
        department:
          typeof primaryOrg?.department === "string"
            ? primaryOrg.department
            : undefined,
        displayName:
          typeof name.fullName === "string" ? name.fullName : undefined,
        email,
        externalId: String(user.id ?? email),
        firstName:
          typeof name.givenName === "string" ? name.givenName : undefined,
        lastName:
          typeof name.familyName === "string" ? name.familyName : undefined,
        location:
          typeof primaryOrg?.location === "string"
            ? primaryOrg.location
            : orgUnitPath,
        raw: user,
        status: user.suspended ? "inactive" : "active",
        title:
          typeof primaryOrg?.title === "string" ? primaryOrg.title : undefined,
      },
    ];
  });
}

export function fetchProviderPeople(
  config: TenantProviderConfig
): Promise<PeopleProfile[]> {
  const credentials = parseCredentials(config.metadata);

  if (config.provider === "okta") {
    return fetchFromOkta(credentials);
  }
  if (config.provider === "azure_ad") {
    return fetchFromEntra(credentials);
  }
  return fetchFromGoogle(credentials);
}
