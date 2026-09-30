import { useParams } from "react-router-dom";
import { AdminIntegrationDetailPage } from "./admin-routes";

export function AdminIntegrationDetailRoute() {
  const { integrationKey } = useParams<{ integrationKey: string }>();
  if (!integrationKey) {
    return null;
  }

  return <AdminIntegrationDetailPage integrationKey={integrationKey} />;
}
