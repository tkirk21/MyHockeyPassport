import { collection, doc, setDoc, serverTimestamp, getFirestore, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseApp from "@/firebaseConfig";

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// helper to write a generic activity doc
async function logActivity(userId: string, data: any) {
  const activityRef = doc(collection(db, "profiles", userId, "activity"));
  await setDoc(activityRef, {
    ...data,
    timestamp: serverTimestamp(), // always set timestamp on server
  });
}

// ✅ Log a new friendship (store both display names)
export async function logFriendship(friendId: string) {
  const user = auth.currentUser;
  if (!user) return;

  // fetch current user's profile
  const userProfileRef = doc(db, "profiles", user.uid);
  const userProfileSnap = await getDoc(userProfileRef);
  const userName = userProfileSnap.exists()
    ? userProfileSnap.data().name
    : user.displayName || "Someone";

  // fetch friend’s profile
  const friendProfileRef = doc(db, "profiles", friendId);
  const friendProfileSnap = await getDoc(friendProfileRef);
  const friendName = friendProfileSnap.exists()
    ? friendProfileSnap.data().name
    : "Unknown User";

  await logActivity(user.uid, {
    type: "friendship",
    actorId: user.uid,
    targetId: friendId,
    message: `${userName} is now friends with ${friendName}`,
  });
}

// ✅ Log a cheer on any activity (usually a check-in)
export async function logCheer(checkinId: string, friendId: string) {
  const user = auth.currentUser;
  if (!user) return;

  const userSnap = await getDoc(doc(db, "profiles", user.uid));
  const userName =
    userSnap.exists() && userSnap.data().name
      ? userSnap.data().name
      : user.displayName || "Someone";

  // 1️⃣ Save cheer in the check-in's subcollection
  await setDoc(
      doc(db, "profiles", friendId, "checkins", checkinId, "cheers", user.uid),
      {
        userId: user.uid,
        name: userName,
        timestamp: serverTimestamp(),
      }
    );

  // 2️⃣ Log as activity for the feed
  await logActivity(user.uid, {
    type: "cheer",
    actorId: user.uid,
    targetId: checkinId,
    friendId,
    message: `${userName} cheered a check-in 🎉`,
  });
}

// ✅ Log a chirp (comment) on a friend’s check-in
export async function logChirp(checkinId: string, friendId: string, text: string) {
  const user = auth.currentUser;
  if (!user) return;
  await logActivity(user.uid, {
    type: "chirp",
    actorId: user.uid,
    targetId: checkinId,
    friendId,
    text,
    message: `${user.displayName || "Someone"} chirped: ${text}`,
  });
}

// ✅ Log when a profile field is updated (favourite team, location, etc.)
export async function logProfileUpdate(field: string, value: string) {
  const user = auth.currentUser;
  if (!user) return;
  await logActivity(user.uid, {
    type: "profileUpdate",
    actorId: user.uid,
    field,
    value,
    message: `${user.displayName || "Someone"} updated ${field} → ${value}`,
  });
}