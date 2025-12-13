// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';          // ← NEW
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
apiKey: 'AIzaSyBramj8qFsZfjXUZmAm8HMc8JVmZBHIDR8',
authDomain: 'myhockeypassport.firebaseapp.com',
projectId: 'myhockeypassport',
storageBucket: 'myhockeypassport.appspot.com',
messagingSenderId: '853703034223',
appId: '1:853703034223:android:3437691b39e5488b0ed49a',
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

const db = getFirestore(app);                             // ← NEW

// EXACT IDs FROM YOUR GOOGLE CLOUD CONSOLE
export const webClientId = '853703034223-101527k79a64l7aupy9ru8h0ph5sb2lf.apps.googleusercontent.com';
export const androidClientId = '853703034223-kd7c1r5j5q6b0q5r0q6r5j5q6b0q5r0q.apps.googleusercontent.com';

export { app, auth, db };