import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { db } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// Ask for permission + get the push token
export async function setupNotifications() {
  try {
    const user = getAuth().currentUser;
    if (!user) return;

    // Load the pushNotifications setting from profile
    const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
    const pushEnabled = profileSnap.exists() ? profileSnap.data().pushNotifications ?? true : true;

    if (!pushEnabled) {
      // User turned off push – don't register token
      return;
    }

    const token = await registerForPushNotificationsAsync();

    if (token) {
      await saveTokenToDatabase(token);
    }
  } catch (error) {
    console.log('Push setup error:', error);
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}