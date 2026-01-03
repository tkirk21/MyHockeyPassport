//app/signup.tsx
import { useState, useEffect } from 'react';
import { Alert, Image, Request, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword, FacebookAuthProvider, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, webClientId, androidClientId } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '../hooks/useColorScheme';

export default function Signup() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const styles = StyleSheet.create({
    buttonPrimary: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', marginBottom: 20, width: '66%', alignItems: 'center', alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: colorScheme === 'dark' ? 0.5 : 0.2, shadowRadius: 4, elevation: 6, },
    buttonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 18, fontWeight: '600', },
    container: { padding: 20, paddingBottom: 100, backgroundColor: colorScheme === 'dark' ? '#0A1420' : '#FFFFFF', },
    eyeIcon: { color: colorScheme === 'dark' ? '#BBBBBB' : '#2F4F68', fontSize: 22 },
    googleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DB4437', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6, },
    input: { height: 50, borderColor: colorScheme === 'dark' ? '#334155' : '#5E819F', borderWidth: 1, paddingHorizontal: 12, marginBottom: 16, borderRadius: 6, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF', },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colorScheme === 'dark' ? '#334155' : '#5E819F', borderRadius: 6, height: 50, marginBottom: 16, paddingRight: 12, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF', },
    passwordInput: { flex: 1, height: 50, paddingHorizontal: 12, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', backgroundColor: 'transparent', },
    socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20, },
    socialBtn: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#DB4437', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4, },
    title: { fontSize: 26, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginBottom: 24, textAlign: 'center', },
    toggle: { marginTop: 16, alignItems: 'center', },
    toggleText: { color: colorScheme === 'dark' ? '#BBBBBB' : '#2F4F68', fontWeight: '500', },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0A1420' : '#FFFFFF', },
    socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20, },
    socialBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1877F2', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6, },
    socialIcon: { color: '#FFFFFF', fontSize: 20 },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0A1420' : '#FFFFFF', },
  });

  return (
    <View style={styles.screenBackground}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>

        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={() => Alert.alert('Coming Soon', 'Google sign-in is temporarily unavailable')}
          >
            <Ionicons name="logo-google" style={styles.socialIcon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => Alert.alert('Coming Soon', 'Facebook login is temporarily unavailable')}
          >
            <Ionicons name="logo-facebook" style={styles.socialIcon} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#AAAAAA"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#AAAAAA"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Ionicons name={showPassword ? 'eye' : 'eye-off'} style={styles.eyeIcon} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.buttonPrimary} onPress={handleSignUp}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/login')} style={styles.toggle}>
          <Text style={styles.toggleText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}