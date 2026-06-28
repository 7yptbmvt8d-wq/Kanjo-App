import { useCallback, useEffect, useState } from "react";
import {
  currentPermission,
  enablePush,
  onForegroundPush,
  pushSupported,
} from "../firebase/messaging.js";

// Drives the "Activer les notifications" affordance and surfaces foreground
// messages (FCM only fires the SW handler when the app is backgrounded; when
// it's open we get the payload here and show an in-app toast instead).
export function usePush() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState(() => currentPermission());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    pushSupported().then(setSupported);
  }, []);

  useEffect(() => {
    if (!supported) return undefined;
    return onForegroundPush((payload) => {
      const d = payload.data || payload.notification || {};
      setToast({ title: d.title || "Nouvelle annonce", body: d.body || "" });
    });
  }, [supported]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await enablePush();
    } catch (err) {
      console.error("enablePush failed:", err);
    } finally {
      setPermission(currentPermission());
      setBusy(false);
    }
  }, []);

  return {
    supported,
    permission,
    busy,
    toast,
    dismissToast: () => setToast(null),
    enable,
    // Show the CTA only while it can still do something.
    canPrompt: supported && permission === "default",
  };
}
