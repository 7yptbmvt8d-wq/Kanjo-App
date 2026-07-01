// Lightweight client-side gate for the "Mode prof" toggle. Each prof has
// their own 4-6 digit PIN, injected at build time via VITE_PROF_CODE_*
// env vars. The pin grants access AND identifies who is acting — so the
// app can pre-fill announcement/roll-call drafts with their name.
//
// This is intentionally NOT real auth: the PINs land in the client bundle
// and a determined user could read them with devtools. Threat model is
// casual confusion ("oops, wrong button") not malicious actors. For a
// hardened setup, swap this for Firebase Auth + Firestore role check.

const STORAGE_KEY = "kanjo-aikido:prof";

// Map prof display name → PIN code. Names match PROFS in seed.js so the
// existing author dropdowns keep working.
const PROF_CODES = {
  "Sébastien": import.meta.env.VITE_PROF_CODE_SEBASTIEN || "",
  "Jean-Charles": import.meta.env.VITE_PROF_CODE_JC || "",
};

export const profGateConfigured = Object.values(PROF_CODES).some(Boolean);

export function authenticateProf(code) {
  if (!code) return null;
  const trimmed = code.trim();
  for (const [name, expected] of Object.entries(PROF_CODES)) {
    if (expected && trimmed === expected) return name;
  }
  return null;
}

export function loadProfFromStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function persistProf(name) {
  try {
    if (name) localStorage.setItem(STORAGE_KEY, name);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}
