//version 2 - keyboard safe
//login.tsx
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter } from 'expo-router';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('Login error:', error.code);
      let message = 'Login failed.';
      switch (error.code) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = 'Incorrect email or password.';
          break;
      }
      Alert.alert('Error', message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Password Reset', 'Check your email for reset instructions.');
    } catch (error: any) {
      let message = 'Unable to send reset email.';
      if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
      if (error.code === 'auth/user-not-found') message = 'Email not found.';
      Alert.alert('Error', message);
    }
  };

  const handleGoToSignup = () => {
    router.replace('/signup');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Image
            source={require('@/assets/images/logo_with_font.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome Back</Text>

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
            autoCapitalize="none"
            secureTextEntry
          />

          <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleForgotPassword}
            style={{ alignItems: 'center', marginTop: 12, marginBottom: 16 }}
          >
            <Text style={{ color: colors.accent, fontWeight: '500' }}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleGoToSignup} style={styles.linkContainer}>
            <Text style={styles.link}>Don't have an account? Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const colors = {
  primary: '#0D2C42',
  secondary: '#2F4F68',
  accent: '#5E819F',
  light: '#FFFFFF',
};

const styles = StyleSheet.create({
  buttonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 0,
    width: '70%',
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    color: colors.light,
    fontSize: 18,
    fontWeight: '600',
  },
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
    fontSize: 28,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: 'bold',
    color: colors.primary,
  },
  input: {
    height: 48,
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 6,
    color: colors.primary,
  },
  linkContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  link: {
    color: colors.secondary,
    fontWeight: '500',
  },
});