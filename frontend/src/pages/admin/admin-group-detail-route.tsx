import { useParams } from "react-router-dom";
import { AdminGroupDetailPage } from "./admin-routes";

export function AdminGroupDetailRoute() {
  const { groupId } = useParams<{ groupId: string }>();
  if (!groupId) {
    return null;
  }

  return <AdminGroupDetailPage groupId={groupId} />;
}
