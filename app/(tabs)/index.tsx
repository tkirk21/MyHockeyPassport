// app/(tabs)/index.tsx
import { Redirect } from 'expo-router';
import { Image, View, Text, StyleSheet, Dimensions } from 'react-native';
import { useEffect, useState } from 'react';
import { useColorScheme } from '../../hooks/useColorScheme';
import { getAuth } from 'firebase/auth';

const { height } = Dimensions.get('window');
const auth = getAuth();

export default function TabsIndex() {
  const user = auth.currentUser;
  if (!user) {
    return <Redirect href="/login" />;
  }
  const [showSplash, setShowSplash] = useState(true);
  const colorScheme = useColorScheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1800); // 1.8 seconds — feels natural

    return () => clearTimeout(timer);
  }, []);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0A1420' : '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
    logo: { width: 200, height: 200, marginBottom: 40 },
    loadingText: { fontSize: 20, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700' },
  });

  if (showSplash) {
    return (
      <View style={styles.container}>
        <Image
          source={colorScheme === 'dark' ? require('../../assets/images/logo_with_font_dark.jpg') : require('../../assets/images/logo_with_font.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return <Redirect href="/home" />;
}