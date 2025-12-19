// utils/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  console.log('🔥 registerForPushNotificationsAsync STARTED');

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.log('No user logged in');
    return;
  }
  console.log('User found:', user.uid);

  if (!Device.isDevice) {
    console.log('Not a physical device — push notifications disabled');
    return;
  }
  console.log('Running on physical device');

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('Current permission status:', existingStatus);

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    console.log('Permission not granted yet — requesting...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('Permission request result:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    console.log('Final permission NOT granted');
    await setDoc(doc(db, 'profiles', user.uid), { pushToken: null }, { merge: true });
    return;
  }
  console.log('Permission granted ✅');

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  console.log('Found projectId:', projectId);

  if (!projectId) {
    console.log('❌ NO projectId found — cannot get token');
    return;
  }

  try {
    console.log('Getting Expo push token...');
    const tokenObject = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenObject.data;
    console.log('✅ Got push token:', pushToken);

    await setDoc(
      doc(db, 'profiles', user.uid),
      {
        pushToken,
        pushNotifications: true,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    console.log('💾 Push token SAVED to Firestore');
  } catch (error) {
    console.error('❌ Error in getExpoPushTokenAsync or save:', error);
  }
}

// Call this when user toggles push OFF
export async function disablePushToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  await setDoc(
    doc(db, 'profiles', user.uid),
    {
      pushToken: null,
      pushNotifications: false,
    },
    { merge: true }
  );
}