// One-shot Firestore seeder. Uses the Admin SDK + the local
// serviceAccountKey.json to push SEED_COURSES / SEED_ANNOUNCEMENTS into
// the live database. Safe to re-run: writes are keyed by the seed `id`
// so a second run just overwrites with the same content.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  SEED_COURSES,
  SEED_ANNOUNCEMENTS,
} from "../src/data/seed.js";

const here = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(here, "..", "serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function seedCollection(name, docs, keyField = "id") {
  console.log(`→ ${name}: ${docs.length} docs`);
  const batch = db.batch();
  for (const item of docs) {
    const id = String(item[keyField]);
    const ref = db.collection(name).doc(id);
    batch.set(ref, { ...item, seededAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
}

async function main() {
  await seedCollection("courses", SEED_COURSES);
  await seedCollection(
    "announcements",
    SEED_ANNOUNCEMENTS.map((a) => ({
      ...a,
      createdAt: FieldValue.serverTimestamp(),
    })),
  );
  console.log("✓ seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
