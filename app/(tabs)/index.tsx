// app/(tabs)/index.tsx
import { Redirect } from 'expo-router';
import { Image, View, Text, StyleSheet, Dimensions } from 'react-native';
import { useEffect, useState } from 'react';

const { height } = Dimensions.get('window');

export default function TabsIndex() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1800); // 1.8 seconds — feels natural

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <View style={styles.container}>
        <Image
          source={require('../../assets/images/logo_with_font.png')} // ←←← UPDATE EXTENSION HERE ONCE YOU CONFIRM
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 40,
  },
  loadingText: {
    fontSize: 20,
    color: '#0A2940',
    fontWeight: '700',
  },
});