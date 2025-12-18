const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

admin.initializeApp();

const expo = new Expo();

exports.sendChirpPush = functions.firestore
  .document('profiles/{userId}/checkins/{checkinId}/chirps/{chirpId}')
  .onCreate(async (snap, context) => {
    const chirp = snap.data();
    const userId = context.params.userId;

    const profileSnap = await admin.firestore().doc(`profiles/${userId}`).get();
    const profile = profileSnap.data();

    if (!profile || !profile.pushNotifications) {
      return null;
    }

    const pushToken = profile.pushToken;

    if (!Expo.isExpoPushToken(pushToken)) {
      return null;
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title: 'New Chirp!',
      body: `${chirp.userName} chirped your check-in`,
      data: { type: 'chirp' },
    };

    await expo.sendPushNotificationsAsync([message]);

    return null;
  });