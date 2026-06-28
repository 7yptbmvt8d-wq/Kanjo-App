import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, db, firebaseEnabled } from "./config.js";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function pushSupported() {
  if (!firebaseEnabled || !VAPID_KEY) return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  return isSupported();
}

// Ask for permission, mint an FCM token and persist it. We do NOT pass a
// serviceWorkerRegistration so the SDK auto-registers firebase-messaging-sw.js
// at its dedicated scope, leaving the Workbox PWA worker untouched.
export async function enablePush() {
  if (!(await pushSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  if (!token) return null;

  // Doc id === token so re-registering the same device is idempotent.
  await setDoc(
    doc(db, "pushTokens", token),
    {
      token,
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return token;
}

export function currentPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export function onForegroundPush(handler) {
  if (!firebaseEnabled) return () => {};
  let unsub = () => {};
  isSupported().then((ok) => {
    if (!ok) return;
    const messaging = getMessaging(app);
    unsub = onMessage(messaging, handler);
  });
  return () => unsub();
}
