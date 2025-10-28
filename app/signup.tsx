//version 1 - 10am friday 1st of august
//signup.tsx
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter } from 'expo-router';

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert('Success', 'Account created successfully!');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const goToLogin = () => {
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/logo_with_font.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.secondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.secondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.buttonPrimary} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={goToLogin} style={styles.toggle}>
        <Text style={styles.toggleText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const colors = {
  primary: '#0D2C42',     // Deep blue from logo
  secondary: '#2F4F68',   // Mid blue-gray from logo
  accent: '#5E819F',      // Lighter blue from logo
  light: '#FFFFFF',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: colors.light,
  },
  logo: {
    width: 400,
    height: 200,
    alignSelf: 'center',
    marginBottom: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 6,
    fontSize: 16,
    color: colors.primary,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
    width: '66%',
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    color: colors.light,
    fontSize: 18,
    fontWeight: '600',
  },
  toggle: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleText: {
    color: colors.secondary,
    fontWeight: '500',
  },
});


