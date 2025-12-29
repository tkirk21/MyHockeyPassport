import { Redirect, Stack } from 'expo-router';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

const auth = getAuth(firebaseApp);

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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