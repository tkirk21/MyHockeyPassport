import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { db } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// Ask for permission + get the push token
export async function registerForPushNotificationsAsync() {
  let token = '';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#000000',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token – notifications won’t work');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'a164aec3-4dc0-4576-b32e-273e889b6ada',
    })).data;
  } else {
    alert('Must use physical device for push notifications');
  }

  return token;
}

// Save token to Firestore under the current user
export async function saveTokenToDatabase(token: string) {
  const user = getAuth().currentUser;
  if (!user) return;

  await setDoc(doc(db, 'users', user.uid), {
    pushToken: token,
  }, { merge: true });
}

// Call this once on app start (e.g. in App.tsx)
export async function setupNotifications() {
  try {
    const token = await registerForPushNotificationsAsync();

    if (token) {
      await saveTokenToDatabase(token);
    } else {
    }
  } catch (error) {
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}