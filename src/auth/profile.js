// Persists the adhérent's FFAB licence number locally. The actual profile
// data (name, grade, history) lives in Firestore; this is just the key the
// app uses to fetch its own doc.

const STORAGE_KEY = "kanjo-aikido:member-licence";
const DEVICE_KEY = "kanjo-aikido:device-id";

export function loadLicenceFromStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function persistLicence(licence) {
  try {
    if (licence) localStorage.setItem(STORAGE_KEY, String(licence).trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode — silent failure, app falls back to anonymous browsing.
  }
}

// Identifiant local stable pour l'appareil — sert au verrouillage à une
// seule connexion membre active. Généré au premier lancement et persistant
// localement. Aucune donnée perso, juste un UUID opaque.
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
