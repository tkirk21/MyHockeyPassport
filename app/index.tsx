import { Redirect, Stack } from 'expo-router';
import { onAuthStateChanged, getAuth, signOut } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const auth = getAuth(firebaseApp);

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const stayLoggedIn = await AsyncStorage.getItem('stayLoggedIn');
        const activeLogin = await AsyncStorage.getItem('activeLogin');
        if (activeLogin === 'true') {
          await AsyncStorage.removeItem('activeLogin');
          setUser(currentUser);
        } else if (stayLoggedIn === 'session') {
          await AsyncStorage.removeItem('userEmail');
          await AsyncStorage.removeItem('stayLoggedIn');
          await signOut(auth);
          await GoogleSignin.signOut().catch(() => {});
          setUser(null);
        } else {
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A2940' }}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {user ? <Redirect href="/(tabs)" /> : <Redirect href="/login" />}
    </>
  );
}