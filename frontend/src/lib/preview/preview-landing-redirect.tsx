import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PREVIEW_CHANNEL_ID,
} from "@/lib/preview/preview-sample-data";
import { isPreviewMode } from "@/lib/preview/is-preview-mode";
import { chatConversationPath } from "@/shared/chat/routes";

/** Opens #product-launch by default on static preview deploys. */
export function PreviewLandingRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isPreviewMode()) {
      return;
    }
    if (pathname === "/") {
      navigate(chatConversationPath(PREVIEW_CHANNEL_ID), { replace: true });
    }
  }, [navigate, pathname]);

  return null;
}
