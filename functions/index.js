const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp({
  storageBucket: "myhockeypassport.firebasestorage.app"
});

const db = admin.firestore();

/* ============================================================
   PUSH HELPER
============================================================ */

async function sendPushToUser(targetUid, title, body) {
  const profileSnap = await db.collection("profiles").doc(targetUid).get();

  if (!profileSnap.exists) return;

  const pushToken = profileSnap.data().pushToken;
  const pushEnabled = profileSnap.data().pushNotifications;

  if (!pushToken || pushEnabled === false) return;

  const message = {
    to: pushToken,
    sound: "default",
    title,
    body,
  };

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
}

/* ============================================================
   FRIEND REQUEST TRIGGER
============================================================ */

exports.onFriendRequest = onDocumentCreated(
  "profiles/{targetUid}/friendRequests/{requestId}",
  async (event) => {

    const targetUid = event.params.targetUid;
    const data = event.data.data();

    const senderUid = data.senderUid;
    const senderName = data.senderName || "Someone";

    await sendPushToUser(
      targetUid,
      "New Friend Request",
      `${senderName} sent you a friend request`
    );
  }
);

/* ============================================================
   CHEERS + CHIRPS ON MY CHECKIN
============================================================ */

exports.onActivityOnMyCheckin = onDocumentCreated(
  "profiles/{ownerUid}/checkins/{checkinId}/{subcollection}/{docId}",
  async (event) => {

    const ownerUid = event.params.ownerUid;
    const subcollection = event.params.subcollection;

    if (subcollection !== "cheers" && subcollection !== "chirps") return;

    const data = event.data.data();
    const actorName = data.userName || "Someone";
    const actorUid = data.userId;

    if (actorUid === ownerUid) return;

    await sendPushToUser(
      ownerUid,
      "New Activity",
      `${actorName} interacted with your check-in`
    );
  }
);

/* ============================================================
   CHIRP REPLY IN THREAD
============================================================ */

exports.onChirpInThread = onDocumentCreated(
  "profiles/{ownerUid}/checkins/{checkinId}/chirps/{chirpId}/replies/{replyId}",
  async (event) => {

    const ownerUid = event.params.ownerUid;
    const data = event.data.data();

    const senderName = data.userName || "Someone";
    const senderUid = data.userId;

    if (senderUid === ownerUid) return;

    await sendPushToUser(
      ownerUid,
      "New Reply",
      `${senderName} replied to a thread you're in`
    );
  }
);

/* ============================================================
   DELETE USER (UNCHANGED)
============================================================ */

exports.deleteUserAccount = onCall(async (request) => {

  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated."
    );
  }

  const uid = request.auth.uid;
  const bucket = admin.storage().bucket();
  const profileRef = db.collection("profiles").doc(uid);

  const checkinsSnap = await profileRef.collection("checkins").get();

  for (const checkinDoc of checkinsSnap.docs) {

    const checkinRef = profileRef.collection("checkins").doc(checkinDoc.id);

    const cheersSnap = await checkinRef.collection("cheers").get();
    await Promise.all(cheersSnap.docs.map(doc => doc.ref.delete()));

    const chirpsSnap = await checkinRef.collection("chirps").get();
    await Promise.all(chirpsSnap.docs.map(doc => doc.ref.delete()));

    await checkinRef.delete();
  }

  const friendsSnap = await profileRef.collection("friends").get();
  await Promise.all(friendsSnap.docs.map(doc => doc.ref.delete()));

  const notificationsSnap = await profileRef.collection("notifications").get();
  await Promise.all(notificationsSnap.docs.map(doc => doc.ref.delete()));

  await profileRef.delete();

  await bucket.deleteFiles({ prefix: `checkins/${uid}/` });
  await bucket.file(`profilePictures/${uid}`).delete().catch(() => {});

  await admin.auth().deleteUser(uid);

  return { success: true };
});
