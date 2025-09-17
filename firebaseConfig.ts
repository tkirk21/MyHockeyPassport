//version 2 - 1010am friday 1st of august
// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
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

export { app, auth };