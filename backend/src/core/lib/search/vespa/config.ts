export function getVespaUrl() {
  return process.env.VESPA_URL ?? "http://localhost:8080";
}

export function getVespaConfigUrl() {
  return process.env.VESPA_CONFIG_URL ?? "http://localhost:19071";
}
