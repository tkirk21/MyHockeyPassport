import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

admin.initializeApp({
  storageBucket: "myhockeypassport.firebasestorage.app",
});

const db = admin.firestore();

/* ============================
   DELETE USER ACCOUNT
============================ */

export const deleteUserAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const uid = request.auth.uid;
  const bucket = admin.storage().bucket();

  try {
    // Remove user from other users' friend-related subcollections
    const profilesSnap = await db.collection("profiles").get();

    for (const profileDoc of profilesSnap.docs) {
      const otherUid = profileDoc.id;
      if (otherUid === uid) continue;

      const batch = db.batch();

      batch.delete(
        db.collection("profiles").doc(otherUid)
          .collection("friends").doc(uid)
      );

      batch.delete(
        db.collection("profiles").doc(otherUid)
          .collection("friendRequests").doc(uid)
      );

      batch.delete(
        db.collection("profiles").doc(otherUid)
          .collection("sentFriendRequests").doc(uid)
      );

      await batch.commit();
    }

    // Recursively delete entire profile tree (includes checkins, cheers, chirps, etc.)
    await admin.firestore().recursiveDelete(
      db.collection("profiles").doc(uid)
    );

    // Delete storage folders
    await bucket.deleteFiles({ prefix: `profilePictures/${uid}` });
    await bucket.deleteFiles({ prefix: `checkins/${uid}` });

    // Delete auth user
    await admin.auth().deleteUser(uid);

    return { success: true };

  } catch (error) {
    console.error("Account deletion failed:", error);
    throw new HttpsError("internal", "Account deletion failed.");
  }
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

export const deleteCheckin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated.");
  }

  const { checkinId, folderName } = request.data;
  const uid = request.auth.uid;

  if (!checkinId || !folderName) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }

  try {
    const bucket = admin.storage().bucket();

    // 1️⃣ Recursively delete Firestore checkin (includes cheers & chirps)
    await admin.firestore().recursiveDelete(
      db.collection("profiles")
        .doc(uid)
        .collection("checkins")
        .doc(checkinId)
    );

    // 2️⃣ Delete storage folder
    await bucket.deleteFiles({
      prefix: `checkins/${uid}/${folderName}`
    });

    return { success: true };

  } catch (error) {
    console.error("Checkin deletion failed:", error);
    throw new HttpsError("internal", "Deletion failed.");
  }
});