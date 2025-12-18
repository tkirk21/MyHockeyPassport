//app/signup.tsx
import { useState, useEffect } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword, FacebookAuthProvider, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, webClientId, androidClientId } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Configure Google Signin with the web client ID from Firebase
  GoogleSignin.configure({
    webClientId: webClientId,       // REQUIRED for Firebase token
    offlineAccess: true,            // helps force native flow
    forceCodeForRefreshToken: true, // another flag for native
  });

  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Check if Play Services are available (Android only, harmless on iOS)
      await GoogleSignin.hasPlayServices();

      // Trigger the native Google sign-in flow
      const userInfo = await GoogleSignin.signIn();

      // Get the idToken
      const idToken = userInfo.idToken;  // note: it's under .data in newer versions

      if (!idToken) {
        throw new Error('No ID token returned from Google');
      }

      // Create Firebase credential
      const credential = GoogleAuthProvider.credential(idToken);

      // Sign in to Firebase
      await signInWithCredential(auth, credential);

      // Success → go to tabs
      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('Google sign-in error:', error);
      Alert.alert('Google Sign-In Failed', error.message || 'Unknown error');
    }
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Create Account</Text>

      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleSignIn}>
          <Ionicons name="logo-google" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialBtn, { backgroundColor: '#1877F2' }]}
          onPress={() => Alert.alert('Coming Soon', 'Facebook login is temporarily unavailable')}
        >
          <Ionicons name="logo-facebook" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      <View style={styles.passwordContainer}>
        <TextInput style={styles.passwordInput} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
          <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={22} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.buttonPrimary} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/login')} style={styles.toggle}>
        <Text style={styles.toggleText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const colors = { primary: '#0D2C40', secondary: '#2F4F68', accent: '#5E819F', light: '#FFFFFF', };
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.light, },
  logo: { width: 340, height: 170, alignSelf: 'center', marginBottom: 0, },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.primary, marginBottom: 24, textAlign: 'center', },
  orText: { textAlign: 'center', color: colors.secondary, marginVertical: 12, fontWeight: '500', },
  input: { height: 50, borderColor: colors.accent, borderWidth: 1, paddingHorizontal: 12, marginBottom: 16, borderRadius: 6, fontSize: 16, color: colors.primary, },
  buttonPrimary: { backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, marginBottom: 20, width: '66%', alignItems: 'center', alignSelf: 'center', },
  buttonText: { color: colors.light, fontSize: 18, fontWeight: '600', },
  toggle: { marginTop: 16, alignItems: 'center', },
  toggleText: { color: colors.secondary, fontWeight: '500', },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20, },
  socialBtn: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#DB4437', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4, },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 6, height: 50, marginBottom: 16, paddingRight: 12, },
  passwordInput: { flex: 1, height: 50, paddingHorizontal: 12, fontSize: 16, color: colors.primary, },
  eyeButton: { position: 'absolute', right: 12, },
});