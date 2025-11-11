//version 1 - 10am friday 1st of august
// app/signup.tsx
import { useState, useEffect } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, webClientId } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: webClientId,
    androidClientId: '853703034223-kd7chdctst44rgnh8r9pjr74v04fi6tv.apps.googleusercontent.com',
    webClientId: webClientId,
    redirectUri: 'https://auth.expo.io/@tkirk21/MyHockeyPassport',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(() => {
          Alert.alert('Success', 'Signed up with Google!');
          router.replace('/(tabs)');
        })
        .catch((error) => {
          console.error('Google sign-up error:', error);
          Alert.alert('Error', 'Google sign-up failed. Try again.');
        });
    }
  }, [response]);

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

      <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => promptAsync({ useProxy: true })}
                disabled={!request}
              >
                <Ionicons name="logo-google" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.orText}>or</Text>

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
  primary: '#0D2C40',
  secondary: '#2F4F68',
  accent: '#5E819F',
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
  googleButton: {
    backgroundColor: '#DB4437',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
    width: '66%',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  googleButtonText: {
    color: colors.light,
    fontSize: 18,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: colors.secondary,
    marginVertical: 12,
    fontWeight: '500',
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
  socialRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    socialBtn: {
      width: 40,
      height: 40,
      borderRadius: 15,
      backgroundColor: '#DB4437',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
});


