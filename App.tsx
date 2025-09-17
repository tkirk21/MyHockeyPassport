//version 1 - 10am friday 1st of august
//App.tsx
import { Image, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function App() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/signup');
    }, 2000); // Show splash screen for 2 seconds
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require('./assets/images/logo_with_font.png')} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A2940',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 280,
    height: 280,
    resizeMode: 'contain',
  },
});