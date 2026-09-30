import { Navigate } from "react-router-dom";

/** Legacy route — channels live in the sidebar now. */
export function ChannelsPage() {
  return <Navigate replace to="/" />;
}
