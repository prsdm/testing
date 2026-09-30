export type ParsedGoogleServiceAccount = {
  clientEmail: string;
  privateKey: string;
};

export function parseGoogleServiceAccountJson(raw: string): {
  parsed?: ParsedGoogleServiceAccount;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Upload a Google service account JSON key file." };
  }

  try {
    const json = JSON.parse(trimmed) as {
      type?: unknown;
      web?: unknown;
      client_email?: unknown;
      private_key?: unknown;
    };

    if (json.web) {
      return {
        error:
          "This looks like an OAuth client JSON file. Upload a service account key (type service_account).",
      };
    }

    if (json.type !== "service_account") {
      return {
        error:
          "Unknown credential type. Upload a service account key JSON from Google Cloud.",
      };
    }

    const clientEmail =
      typeof json.client_email === "string" ? json.client_email.trim() : "";
    const privateKey =
      typeof json.private_key === "string" ? json.private_key : "";
    if (!clientEmail || !privateKey) {
      return {
        error: "JSON must include client_email and private_key.",
      };
    }

    return { parsed: { clientEmail, privateKey } };
  } catch {
    return {
      error: "Invalid JSON. Use the .json file downloaded from Google Cloud.",
    };
  }
}
