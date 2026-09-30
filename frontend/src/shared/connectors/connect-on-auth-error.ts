export function isConnectorAuthErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  return (
    normalized.includes("credential not found") ||
    normalized.includes("access token missing") ||
    normalized.includes("not connected") ||
    normalized.includes("add a connection") ||
    normalized.includes("connector_not_connected") ||
    normalized.includes("connect google drive in connectors") ||
    normalized.includes("(401)") ||
    normalized.includes('"status":401') ||
    normalized.includes('"code":"unauthorized"') ||
    normalized.includes("invalid_grant") ||
    normalized.includes("token has been expired") ||
    normalized.includes("token has been revoked") ||
    normalized.includes("token_expired") ||
    normalized.includes("token_revoked") ||
    normalized.includes("connection expired") ||
    normalized.includes("reconnect") ||
    normalized.includes("authentication required")
  );
}

export function connectUrlIfAuthError(args: { error: unknown }): {
  connectUrl?: string;
} {
  if (!(args.error instanceof Error)) {
    return {};
  }
  if (!isConnectorAuthErrorMessage(args.error.message)) {
    return {};
  }
  return { connectUrl: "/connectors" };
}
