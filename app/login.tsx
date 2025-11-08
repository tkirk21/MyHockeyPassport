//version 2 - keyboard safe
//login.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import LoadingPuck from "../components/loadingPuck";
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  }, [loading]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    const checkStoredLogin = async () => {
      const savedUser = await AsyncStorage.getItem('userEmail');
      if (savedUser) router.replace('/(tabs)');
    };
    checkStoredLogin();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // if toggle is ON, store the user email
      if (stayLoggedIn) {
        await AsyncStorage.setItem('userEmail', email);
      } else {
        await AsyncStorage.removeItem('userEmail');
      }

      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('Login error:', error.code);
      let message = 'Login failed.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential')
        message = 'Incorrect email or password.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
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

          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={colors.secondary}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? 'eye' : 'eye-off'}
                size={22}
                color={colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Stay logged in  </Text>
            <Switch
              value={stayLoggedIn}
              onValueChange={setStayLoggedIn}
              trackColor={{ false: '#ccc', true: colors.accent }}
              thumbColor={stayLoggedIn ? colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={{ alignItems: 'center', marginTop: 10, backgroundColor: colors.light }}>
            <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin}>
              <Text style={styles.buttonText}>Log In</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleForgotPassword}
            style={{ alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 16 }}
          >
            <Text style={{ color: colors.accent, fontWeight: '500' }}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleGoToSignup} style={styles.linkContainer}>
            <Text style={styles.link}>Don't have an account? Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {loading && <LoadingPuck />}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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
    marginBottom: -15,
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
    marginBottom: 12,   // down from 16
    borderRadius: 12,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 150, // moves it upward
  },
  puckContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  puck: {
    width: 360,
    height: 360,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    marginBottom: 0,     // cleaner vertical balance
    height: 48,
    paddingRight: 12,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
  },
  passwordInput: {
    borderWidth: 0,
    flex: 1,
    marginBottom: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '70%',          // matches button and inputs
    alignSelf: 'center',
    marginTop: 0,          // gives breathing room below password box
    marginBottom: -20,      // consistent with spacing above button

  },
  toggleText: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '500',
    marginRight: -10, // tighten spacing between text and switch
  },
});