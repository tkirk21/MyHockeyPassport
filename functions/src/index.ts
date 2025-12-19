import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

admin.initializeApp();
const expo = new Expo();

// Helper to send push
async function sendPush(token: string, title: string, body: string, data: Record<string, unknown> = {}) {
  if (!Expo.isExpoPushToken(token)) {
    console.log(`Invalid Expo push token: ${token}`);
    return;
  }

  const message: ExpoPushMessage = {
    to: token,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const receipts = await expo.sendPushNotificationsAsync([message]);
    console.log(`Push sent to ${token}`, receipts);
  } catch (error) {
    console.error('Push send error:', error);
  }
}

// 1. New chirp in a thread you've joined (friend's checkin only)
export const onChirpInThread = onDocumentCreated(
  'profiles/{ownerId}/checkins/{checkinId}/chirps/{chirpId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const chirp = snap.data();
    const ownerId = event.params.ownerId;
    const chirperId = chirp.userId;
    const chirperName = chirp.userName || 'Someone';

    // Get all previous chirps
    const previousChirpsSnap = await admin.firestore()
      .collection(`profiles/${ownerId}/checkins/${event.params.checkinId}/chirps`)
      .where('timestamp', '<', chirp.timestamp)
      .get();

    const previousChirperIds = new Set<string>();
    previousChirpsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.userId && data.userId !== chirperId) {
        previousChirperIds.add(data.userId);
      }
    });

    if (previousChirperIds.size === 0) return;

    const recipientSnaps = await Promise.all(
      Array.from(previousChirperIds).map((uid) =>
        admin.firestore().doc(`profiles/${uid}`).get()
)
);

for (const recipientSnap of recipientSnaps) {
      const recipient = recipientSnap.data();
      if (!recipient?.pushNotifications || !recipient.pushToken) continue;

      await sendPush(
        recipient.pushToken,
        'New reply in thread',
        `${chirperName} replied to a chirp you're in`,
        { type: 'thread_reply', checkinOwnerId: ownerId, checkinId: event.params.checkinId }
      );
    }
  }
);

// 2. New chirp or cheer on YOUR checkin
export const onActivityOnMyCheckin = onDocumentCreated(
  'profiles/{ownerId}/checkins/{checkinId}/{collection}/{docId}',
  async (event) => {
    const { ownerId, collection } = event.params;
    if (collection !== 'chirps' && collection !== 'cheers') return;

    const snap = event.data;
    if (!snap) return;

    const newDoc = snap.data();
    const actorId = newDoc.userId;
    const actorName = newDoc.userName || 'Someone';

    if (actorId === ownerId) return; // ignore self

    const ownerSnap = await admin.firestore().doc(`profiles/${ownerId}`).get();
    const owner = ownerSnap.data();
    if (!owner?.pushNotifications || !owner.pushToken) return;

    const title = collection === 'chirps' ? 'New chirp on your check-in' : 'New cheer on your check-in';
    const body = `${actorName} ${collection === 'chirps' ? 'chirped' : 'cheered'} your check-in`;

    await sendPush(owner.pushToken, title, body, {
      type: 'my_checkin_activity',
      checkinId: event.params.checkinId,
    });
  }
);

// 3. New incoming friend request
export const onFriendRequest = onDocumentCreated(
  'profiles/{recipientId}/friendRequests/{requestId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const request = snap.data();
    const recipientId = event.params.recipientId;
    const senderId = request.senderId;
    const senderName = request.senderName || 'Someone';

    const recipientSnap = await admin.firestore().doc(`profiles/${recipientId}`).get();
    const recipient = recipientSnap.data();
    if (!recipient?.pushNotifications || !recipient.pushToken) return;

    await sendPush(
      recipient.pushToken,
      'New friend request',
      `${senderName} sent you a friend request`,
      { type: 'friend_request', senderId }
    );
  }
);