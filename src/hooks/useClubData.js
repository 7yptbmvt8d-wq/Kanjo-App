import { useCollection } from "../firebase/firestore.js";
import { SEED_ANNOUNCEMENTS, SEED_COURSES } from "../data/seed.js";

export function useCourses() {
  return useCollection("courses", SEED_COURSES);
}

export function useAnnouncements() {
  return useCollection("announcements", SEED_ANNOUNCEMENTS, "createdAt");
}
