import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseEnabled } from "./config.js";

const PROF_FLAG_DOC = (uid) => doc(db, "members", uid);

export function useAuth() {
  const [state, setState] = useState({
    ready: !firebaseEnabled,
    user: null,
    role: "anonymous",
  });

  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ ready: true, user: null, role: "anonymous" });
        return;
      }
      let role = "member";
      try {
        const snap = await getDoc(PROF_FLAG_DOC(user.uid));
        if (snap.exists() && snap.data().role) role = snap.data().role;
      } catch {
        // members doc may not exist yet — keep default role
      }
      setState({ ready: true, user, role });
    });
  }, []);

  return state;
}

export async function signInWithGoogle() {
  if (!firebaseEnabled) throw new Error("Firebase not configured");
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signInWithEmail(email, password) {
  if (!firebaseEnabled) throw new Error("Firebase not configured");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  if (!firebaseEnabled) return;
  await fbSignOut(auth);
}
