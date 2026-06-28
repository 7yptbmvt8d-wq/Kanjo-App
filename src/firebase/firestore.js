import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, firebaseEnabled, storage } from "./config.js";

// ---- Subscriptions ----

export function useCollection(name, fallback, orderField = null) {
  const [docs, setDocs] = useState(fallback);

  useEffect(() => {
    if (!firebaseEnabled) {
      setDocs(fallback);
      return undefined;
    }
    const ref = collection(db, name);
    const q = orderField ? query(ref, orderBy(orderField, "desc")) : ref;
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        setDocs(list.length ? list : fallback);
      },
      // Surface listener errors instead of silently freezing the UI on the
      // last-known state — at minimum we want to see them in devtools.
      (err) => console.error(`Firestore[${name}] snapshot error:`, err),
    );
    // We intentionally use the stable fallback reference only on mount —
    // re-subscribing on every render would tear down Firestore listeners
    // for no functional gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, orderField]);

  return docs;
}

// ---- Writes ----

export async function addAnnouncement(entry) {
  if (!firebaseEnabled) return null;
  return addDoc(collection(db, "announcements"), {
    ...entry,
    createdAt: serverTimestamp(),
  });
}

export async function addRollCall(entry) {
  if (!firebaseEnabled) return null;
  return addDoc(collection(db, "announcements"), {
    ...entry,
    type: "presence",
    createdAt: serverTimestamp(),
  });
}

export async function updateCourse(id, patch) {
  if (!firebaseEnabled) return null;
  return setDoc(doc(db, "courses", String(id)), patch, { merge: true });
}

export async function deleteAnnouncement(id) {
  if (!firebaseEnabled) return null;
  return deleteDoc(doc(db, "announcements", String(id)));
}

export async function toggleAnnouncementPin(id, nextPinned) {
  if (!firebaseEnabled) return null;
  return setDoc(
    doc(db, "announcements", String(id)),
    { pinned: Boolean(nextPinned), pinnedAt: nextPinned ? serverTimestamp() : null },
    { merge: true },
  );
}

// ---- Members ----

// Subscribe to a single member doc. Returns null while loading and after a
// not-found, so callers can render the "create profile" CTA in both cases.
export function useMember(licenseNum) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!firebaseEnabled || !licenseNum) {
      setData(null);
      return undefined;
    }
    return onSnapshot(
      doc(db, "members", String(licenseNum)),
      (snap) => setData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (err) => console.error("member snapshot error:", err),
    );
  }, [licenseNum]);

  return data;
}

// Live list of every member doc, sorted lastName / firstName for the prof
// roster. Returns [] while offline / unconfigured.
export function useAllMembers() {
  const [list, setList] = useState([]);

  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    return onSnapshot(
      collection(db, "members"),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const al = (a.lastName || "").toLocaleLowerCase("fr");
          const bl = (b.lastName || "").toLocaleLowerCase("fr");
          if (al !== bl) return al.localeCompare(bl);
          return (a.firstName || "").localeCompare(b.firstName || "");
        });
        setList(docs);
      },
      (err) => console.error("members snapshot error:", err),
    );
  }, []);

  return list;
}

export async function createOrUpdateMember(licenseNum, { firstName, lastName, grade, gradeObtainedAt, birthYM, practiceLocations }) {
  if (!firebaseEnabled) return null;
  const id = String(licenseNum).trim();
  const ref = doc(db, "members", id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    // Only refresh the display name on existing members — never reset
    // grade history. The prof reassigns grades through assignGrade().
    const patch = {};
    if (firstName) patch.firstName = firstName;
    if (lastName) patch.lastName = lastName;
    if (typeof birthYM === "string") patch.birthYM = birthYM;
    else if (birthYM === null) patch.birthYM = null;
    if (Array.isArray(practiceLocations)) patch.practiceLocations = practiceLocations;
    if (Object.keys(patch).length === 0) return null;
    return setDoc(ref, patch, { merge: true });
  }
  return setDoc(ref, {
    firstName,
    lastName,
    grade: grade || "debutant",
    gradeObtainedAt: gradeObtainedAt instanceof Date ? gradeObtainedAt : serverTimestamp(),
    gradeHistory: [],
    birthYM: typeof birthYM === "string" ? birthYM : null,
    // Par défaut : aucun lieu coché → on tag les 2 dojos pour rester
    // permissif tant que le prof n'a pas tranché.
    practiceLocations: Array.isArray(practiceLocations) && practiceLocations.length > 0
      ? practiceLocations
      : ["Santa Maria Poggio", "Vescovato"],
    createdAt: serverTimestamp(),
  });
}

// Fetch a member doc once, without subscribing. Used by the "identify with
// licence" flow so the modal can pre-fill the name from the existing doc.
export async function fetchMember(licenseNum) {
  if (!firebaseEnabled || !licenseNum) return null;
  const snap = await getDoc(doc(db, "members", String(licenseNum).trim()));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Update the member's grade and/or its obtention date.
// - When `newGrade` differs from the current grade: push the current one
//   onto gradeHistory with its existing obtainedAt, then stamp the new
//   grade with `obtainedAt` (defaulting to now).
// - When only `obtainedAt` changes: just patch the date — no history push,
//   it's a correction not a promotion.
// - `birthYM` ("YYYY-MM" | null | undefined) is patched only when provided
//   so the same flow lets the prof backfill the birthdate on existing
//   members.
export async function assignGrade(licenseNum, newGrade, obtainedAt, birthYM, practiceLocations) {
  if (!firebaseEnabled) return null;
  const ref = doc(db, "members", String(licenseNum));
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const history = Array.isArray(data.gradeHistory) ? data.gradeHistory.slice() : [];
  const gradeChanged = data.grade !== newGrade;
  if (gradeChanged && data.grade && data.gradeObtainedAt) {
    history.push({ grade: data.grade, obtainedAt: data.gradeObtainedAt });
  }
  const stamp = obtainedAt instanceof Date ? obtainedAt : null;
  const patch = {
    grade: newGrade,
    gradeObtainedAt: stamp || serverTimestamp(),
    gradeHistory: history,
  };
  if (typeof birthYM === "string") patch.birthYM = birthYM;
  else if (birthYM === null) patch.birthYM = null;
  if (Array.isArray(practiceLocations)) patch.practiceLocations = practiceLocations;
  return setDoc(ref, patch, { merge: true });
}

export async function deleteMember(licenseNum) {
  if (!firebaseEnabled) return null;
  return deleteDoc(doc(db, "members", String(licenseNum)));
}

// Verrouillage à un seul appareil — le nouveau téléphone prend la main,
// l'ancien voit le changement par snapshot et se déconnecte tout seul.
// On stocke l'id local opaque + un horodatage utile au debug.
export async function claimDevice(licenseNum, deviceId) {
  if (!firebaseEnabled || !deviceId) return null;
  return setDoc(
    doc(db, "members", String(licenseNum)),
    { activeDeviceId: deviceId, deviceClaimedAt: serverTimestamp() },
    { merge: true },
  );
}

// Soft-delete : marque l'adhérent comme parti. La fiche reste en base
// (la Cloud Function pose la date de départ dans le Google Sheet) mais
// l'app la cache des listes actives. Pour réactiver, passer null.
export async function markMemberLeft(licenseNum, leftAt) {
  if (!firebaseEnabled) return null;
  return setDoc(
    doc(db, "members", String(licenseNum)),
    { leftAt: leftAt instanceof Date ? leftAt : (leftAt === null ? null : serverTimestamp()) },
    { merge: true },
  );
}

// ---- Attendance (pointage prof) ----

export function useAttendanceSessions(limitN = 200) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    return onSnapshot(
      query(collection(db, "attendance"), orderBy("date", "desc")),
      (snap) => {
        const docs = snap.docs.slice(0, limitN).map((d) => ({ id: d.id, ...d.data() }));
        setList(docs);
      },
      (err) => console.error("attendance snapshot error:", err),
    );
  }, [limitN]);
  return list;
}

export async function recordAttendance({
  courseId,
  courseTitle,
  location,
  day,
  start,
  prof,
  presentIds,
  absentIds,
}) {
  if (!firebaseEnabled) return null;
  return addDoc(collection(db, "attendance"), {
    date: serverTimestamp(),
    courseId,
    courseTitle,
    location,
    day,
    start,
    prof,
    presentIds: Array.from(new Set(presentIds || [])),
    absentIds: Array.from(new Set(absentIds || [])),
  });
}

// Mise à jour d'une session existante — corrige les listes de présents /
// absents (et garde une trace de qui a corrigé via correctedBy /
// correctedAt). Le `date` et le `prof` d'origine ne bougent pas, on garde
// l'audit du pointage initial.
export async function updateAttendance(sessionId, { presentIds, absentIds, correctedBy }) {
  if (!firebaseEnabled) return null;
  return setDoc(
    doc(db, "attendance", String(sessionId)),
    {
      presentIds: Array.from(new Set(presentIds || [])),
      absentIds: Array.from(new Set(absentIds || [])),
      correctedAt: serverTimestamp(),
      correctedBy: correctedBy || null,
    },
    { merge: true },
  );
}

export async function deleteAttendance(sessionId) {
  if (!firebaseEnabled) return null;
  return deleteDoc(doc(db, "attendance", String(sessionId)));
}

// ---- Stages ----

export function useStages(limitN = 200) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    return onSnapshot(
      query(collection(db, "stages"), orderBy("date", "desc")),
      (snap) => {
        const docs = snap.docs.slice(0, limitN).map((d) => ({ id: d.id, ...d.data() }));
        setList(docs);
      },
      (err) => console.error("stages snapshot error:", err),
    );
  }, [limitN]);
  return list;
}

// Upload une image dans /stages/<stageId>/<filename> et renvoie l'URL
// publique persistante. Le doc Firestore est créé en amont par
// recordStage() pour disposer d'un id stable.
export async function uploadStageAffiche(stageId, file) {
  if (!firebaseEnabled || !storage || !file) return null;
  const safeName = `affiche-${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const ref = storageRef(storage, `stages/${stageId}/${safeName}`);
  await uploadBytes(ref, file, { contentType: file.type });
  return getDownloadURL(ref);
}

// Annonce d'un stage — pas de liste de participants : le but est de
// signaler l'événement, pas de pointer qui y va. L'affiche est un URL
// optionnel posé après l'upload Storage.
export async function recordStage({ title, type, instructor, date, endDate, afficheUrl, recordedBy }) {
  if (!firebaseEnabled) return null;
  return addDoc(collection(db, "stages"), {
    title: String(title || "").trim(),
    type: type || "dojo",
    instructor: String(instructor || "").trim(),
    date: date instanceof Date ? date : serverTimestamp(),
    // endDate optionnelle : null = stage d'un seul jour (= date).
    endDate: endDate instanceof Date ? endDate : null,
    afficheUrl: afficheUrl || null,
    recordedBy: recordedBy || null,
    createdAt: serverTimestamp(),
  });
}

export async function updateStageAffiche(stageId, afficheUrl) {
  if (!firebaseEnabled) return null;
  return setDoc(doc(db, "stages", String(stageId)), { afficheUrl: afficheUrl || null }, { merge: true });
}

export async function deleteStage(stageId) {
  if (!firebaseEnabled) return null;
  return deleteDoc(doc(db, "stages", String(stageId)));
}

// Self-declaration : l'adhérent déclare avoir participé à un stage. On
// stocke sa licence dans `attendeeIds` (set d'unique ids). Re-tap retire
// la déclaration.
export async function toggleStageAttendance(stageId, licence, claim) {
  if (!firebaseEnabled || !licence) return null;
  const ref = doc(db, "stages", String(stageId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const ids = new Set(Array.isArray(data.attendeeIds) ? data.attendeeIds : []);
  if (claim) ids.add(String(licence));
  else ids.delete(String(licence));
  return setDoc(ref, { attendeeIds: Array.from(ids) }, { merge: true });
}

// Badges attribués manuellement par le prof — id du badge dans une
// liste sur la fiche membre. Setteur full-replace pour rester simple.
export async function setMemberManualBadges(licenseNum, badgeIds) {
  if (!firebaseEnabled) return null;
  return setDoc(
    doc(db, "members", String(licenseNum)),
    { manualBadges: Array.from(new Set(badgeIds || [])) },
    { merge: true },
  );
}

// Si response est null → on supprime le doc (la rule ne laisse passer
// que 'present' / 'absent' en écriture). Sinon on setDoc avec merge.
export async function recordPresence({ rollCallId, userId, response }) {
  if (!firebaseEnabled) return null;
  const ref = doc(db, "announcements", rollCallId, "responses", userId);
  if (!response) return deleteDoc(ref);
  return setDoc(ref, { response, at: serverTimestamp() }, { merge: true });
}

// Subscribe à la réponse de l'utilisateur courant pour chaque appel listé.
// Renvoie un map { rollCallId: "present"|"absent"|null } qui se met à jour
// en temps réel — l'adhérent retrouve son vote même après redémarrage de
// l'app. Hors connexion / sans licence, renvoie un objet vide.
// Subscribe à TOUTES les réponses d'un appel. Sert au prof pour voir
// le compte agrégé (présents / absents) avec les ids des votants —
// donc qui répond quoi. Renvoie un map { rollCallId: { presents,
// absents, presentIds[], absentIds[] } }.
export function usePresenceAggregates(rollCallIds) {
  const [map, setMap] = useState({});
  const key = (rollCallIds || []).map(String).join("|");
  useEffect(() => {
    if (!firebaseEnabled || !rollCallIds || rollCallIds.length === 0) {
      setMap({});
      return undefined;
    }
    const unsubs = rollCallIds.map((id) =>
      onSnapshot(
        collection(db, "announcements", String(id), "responses"),
        (snap) => {
          const presentIds = [];
          const absentIds = [];
          for (const d of snap.docs) {
            const v = d.data()?.response;
            if (v === "present") presentIds.push(d.id);
            else if (v === "absent") absentIds.push(d.id);
          }
          setMap((prev) => ({
            ...prev,
            [id]: {
              presents: presentIds.length,
              absents: absentIds.length,
              presentIds,
              absentIds,
            },
          }));
        },
        (err) => console.error("responses aggregate snapshot error:", err),
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

export function usePresenceResponses(rollCallIds, userId) {
  const [map, setMap] = useState({});
  const key = (rollCallIds || []).map(String).join("|");
  useEffect(() => {
    if (!firebaseEnabled || !userId || !rollCallIds || rollCallIds.length === 0) {
      setMap({});
      return undefined;
    }
    const unsubs = rollCallIds.map((id) =>
      onSnapshot(
        doc(db, "announcements", String(id), "responses", String(userId)),
        (snap) => {
          setMap((prev) => ({
            ...prev,
            [id]: snap.exists() ? snap.data().response : null,
          }));
        },
        (err) => console.error("response snapshot error:", err),
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key]);
  return map;
}
