import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

admin.initializeApp({
  storageBucket: "myhockeypassport.firebasestorage.app",
});

const db = admin.firestore();

/* ============================
   DELETE USER ACCOUNT FUNCTION
============================ */

export const deleteUserAccount = onCall(async (request) => {

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
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


/* ============================
   SEND PUSH NOTIFICATION
============================ */

export const sendPushNotification = onCall(async (request) => {

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { targetUid, title, body } = request.data;

  if (!targetUid || !title || !body) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }

  const profileSnap = await db.collection("profiles").doc(targetUid).get();

  if (!profileSnap.exists) {
    return { success: false };
  }

  const pushToken = profileSnap.data()?.pushToken;

  if (!pushToken) {
    return { success: false };
  }

  const message = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data: { targetUid },
  };

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  return { success: true };
});

import { onDocumentCreated } from "firebase-functions/v2/firestore";

/* ============================
   FRIEND REQUEST TRIGGER
============================ */

export const onFriendRequest = onDocumentCreated(
  "profiles/{targetUid}/friendRequests/{requestId}",
  async (event) => {

    const snapshot = event.data;
    if (!snapshot) return;

    const targetUid = event.params.targetUid;
    const requestData = snapshot.data();

    const senderUid = requestData?.fromUid;
    if (!senderUid) return;

    const senderProfile = await db.collection("profiles").doc(senderUid).get();
    const senderName = senderProfile.data()?.name || "Someone";

    const targetProfile = await db.collection("profiles").doc(targetUid).get();
    const pushToken = targetProfile.data()?.pushToken;

    if (!pushToken) return;

    const message = {
      to: pushToken,
      sound: "default",
      title: "New Friend Request",
      body: `${senderName} sent you a friend request.`,
      data: { type: "friend_request" },
    };

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  }
);

/* ============================
   CHEER TRIGGER
============================ */

export const onCheerAdded = onDocumentCreated(
  "profiles/{ownerUid}/checkins/{checkinId}/cheers/{cheerId}",
  async (event) => {

    const snapshot = event.data;
    if (!snapshot) return;

    const ownerUid = event.params.ownerUid;
    const cheerData = snapshot.data();

    const senderUid = cheerData?.userId;
    if (!senderUid || senderUid === ownerUid) return;

    const senderProfile = await db.collection("profiles").doc(senderUid).get();
    const senderName = senderProfile.data()?.name || "Someone";

    const ownerProfile = await db.collection("profiles").doc(ownerUid).get();
    const pushToken = ownerProfile.data()?.pushToken;

    if (!pushToken) return;

    const message = {
      to: pushToken,
      sound: "default",
      title: "New Cheer",
      body: `${senderName} cheered your check-in!`,
      data: { type: "cheer" },
    };

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  }
);

/* ============================
   CHIRP TRIGGER
============================ */

export const onChirpAdded = onDocumentCreated(
  "profiles/{ownerUid}/checkins/{checkinId}/chirps/{chirpId}",
  async (event) => {

    const snapshot = event.data;
    if (!snapshot) return;

    const ownerUid = event.params.ownerUid;
    const chirpData = snapshot.data();

    const senderUid = chirpData?.userId;
    if (!senderUid || senderUid === ownerUid) return;

    const senderProfile = await db.collection("profiles").doc(senderUid).get();
    const senderName = senderProfile.data()?.name || "Someone";

    const ownerProfile = await db.collection("profiles").doc(ownerUid).get();
    const pushToken = ownerProfile.data()?.pushToken;

    if (!pushToken) return;

    const message = {
      to: pushToken,
      sound: "default",
      title: "New Comment",
      body: `${senderName} commented on your check-in.`,
      data: { type: "chirp" },
    };

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  }
);