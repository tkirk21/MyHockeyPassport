const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp({
  storageBucket: "myhockeypassport.firebasestorage.app"
});

exports.deleteUserAccount = onCall(async (request) => {

  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated."
    );
  }

  const uid = request.auth.uid;

  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const profileRef = db.collection("profiles").doc(uid);

  // Delete checkins and nested subcollections
  const checkinsSnap = await profileRef.collection("checkins").get();

  for (const checkinDoc of checkinsSnap.docs) {

    const checkinRef = profileRef.collection("checkins").doc(checkinDoc.id);

    const cheersSnap = await checkinRef.collection("cheers").get();
    await Promise.all(cheersSnap.docs.map(doc => doc.ref.delete()));

    const chirpsSnap = await checkinRef.collection("chirps").get();
    await Promise.all(chirpsSnap.docs.map(doc => doc.ref.delete()));

    await checkinRef.delete();
  }

  // Delete other subcollections
  const friendsSnap = await profileRef.collection("friends").get();
  await Promise.all(friendsSnap.docs.map(doc => doc.ref.delete()));

  const notificationsSnap = await profileRef.collection("notifications").get();
  await Promise.all(notificationsSnap.docs.map(doc => doc.ref.delete()));

  await profileRef.delete();

  // Delete storage folders
  await bucket.deleteFiles({ prefix: `checkins/${uid}/` });
  await bucket.file(`profilePictures/${uid}`).delete().catch(() => {});


  // Delete auth user
  await admin.auth().deleteUser(uid);

  return { success: true };
});

