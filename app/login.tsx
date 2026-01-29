//app/login.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, webClientId } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import LoadingPuck from "../components/loadingPuck";
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { useColorScheme } from '../hooks/useColorScheme';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const switchTrackTrueColor = colorScheme === 'dark' ? '#5E819F' : '#0D2C42';
  const switchThumbActiveColor = '#0D2C42';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('Error');
  const [alertMessage, setAlertMessage] = useState('');

  const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({
    clientId: '763545830068611',
    redirectUri: 'fb763545830068611://authorize',
  });

  const spinValue = useRef(new Animated.Value(0)).current;

  const getStartupTabRoute = async () => {
      const user = auth.currentUser;
      if (!user) return 'index';

      try {
        const docSnap = await getDoc(doc(db, 'profiles', user.uid));
        if (docSnap.exists()) {
          const saved = docSnap.data()?.startupTab;
          const tabMap: Record<string, string> = {
            home: 'index',
            profile: 'profile',
            checkin: 'checkin',
            map: 'map',
            friends: 'friends',
          };
          return tabMap[saved] || 'index';
        }
      } catch (error) {
        console.error('Failed to load startup tab:', error);
      }
      return 'index';
    };

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
      if (savedUser && auth.currentUser) {
        const targetTab = await getStartupTabRoute();
        router.replace(`/${targetTab === 'index' ? '' : targetTab}`);
      }
    };
    checkStoredLogin();
  }, []);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '853703034223-101527k79a64l7aupv9ru8h0ph5sb2lf.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const { authentication } = fbResponse;
      const credential = FacebookAuthProvider.credential(authentication?.accessToken);
      signInWithCredential(auth, credential)
        .then(async () => {
          const targetTab = await getStartupTabRoute();
          router.replace(`/${targetTab === 'index' ? '' : targetTab}`);
        })
        .catch(err => {
          setAlertTitle('Error');
          setAlertMessage(err.message);
          setAlertVisible(true);
        });
    }
  }, [fbResponse]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (stayLoggedIn) {
        await AsyncStorage.setItem('userEmail', email);
      } else {
        await AsyncStorage.removeItem('userEmail');
      }

      const targetTab = await getStartupTabRoute();
      router.replace(`/${targetTab === 'index' ? '' : targetTab}`);
    } catch (error: any) {
      console.log('Login error:', error.code);
      let message = 'Login failed.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential')
        message = 'Incorrect email or password.';
      setAlertTitle('Error');
      setAlertMessage(message);
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAlertTitle('Error');
      setAlertMessage('Please enter your email first.');
      setAlertVisible(true);
      return;
    }
    try {
      setAlertTitle('Password Reset');
      setAlertMessage('Check your email for reset instructions.');
      setAlertVisible(true);
    } catch (error: any) {
      let message = 'Unable to send reset email.';
      if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
      if (error.code === 'auth/user-not-found') message = 'Email not found.';
      setAlertTitle('Error');
      setAlertMessage(message);
      setAlertVisible(true);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();

      const userInfo = await GoogleSignin.signIn();

      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        Alert.alert('Error', 'No idToken returned from Google');
        return;
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);

      await signInWithCredential(auth, googleCredential);

      const targetTab = await getStartupTabRoute();
      router.replace(`/${targetTab === 'index' ? '' : targetTab}`);
    } catch (error: any) {
      console.log('Full Google error in login:', error);
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        setAlertTitle('Error');
        setAlertMessage('Google sign-in failed. Try again.');
        setAlertVisible(true);
      }
    }
  };

  const handleAppleSignIn = async () => {
    try {
      console.log('Starting Apple sign-in on login...');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('Apple credential received:', credential);

      if (!credential.identityToken) {
        console.log('No identityToken from Apple');
        Alert.alert('Error', 'No identityToken from Apple');
        return;
      }

      const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      console.log('Generated nonce:', nonce);

      const provider = new OAuthProvider('apple.com');
      const appleCredential = provider.credential({
        idToken: credential.identityToken,
        rawNonce: nonce,
      });

      console.log('Apple credential created for Firebase');

      await signInWithCredential(auth, appleCredential);

      console.log('Apple sign-in successful on login');

      const targetTab = await getStartupTabRoute();
      router.replace(`/${targetTab === 'index' ? '' : targetTab}`);
    } catch (e: any) {
      console.error('Apple sign-in error on login:', e);
      if (e.code === 'ERR_CANCELED') {
        console.log('User cancelled Apple sign-in');
      } else {
        Alert.alert('Apple Sign-In Failed', e.message || 'Unknown error');
      }
    }
  };

  const handleGoToSignup = () => {
    router.replace('/signup');
  };

  const styles = StyleSheet.create({
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0F1E33' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: '#0D2C42', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 16 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    alertMessageText: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertButton: { backgroundColor: '#0D2C42', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
    buttonPrimary: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', marginBottom: 10, width: '70%', alignItems: 'center', alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: colorScheme === 'dark' ? 0.5 : 0.2, shadowRadius: 4, elevation: 6, },
    buttonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 18, fontWeight: '600', },
    container: { flex: 1, padding: 24, justifyContent: 'center', },eyeButton: { position: 'absolute', right: 12, },
    eyeIcon: { color: colorScheme === 'dark' ? '#BBBBBB' : '#2F4F68', fontSize: 22 },
    forgotPasswordContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 2, },
    forgotPasswordText: { color: '#5E819F', fontWeight: '500', },
    fullScreenLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
    googleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DB4437', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6, },
    input: { height: 48, borderColor: colorScheme === 'dark' ? '#334155' : '#5E819F', borderWidth: 1, paddingHorizontal: 12, marginBottom: 12, borderRadius: 12, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF', },
    link: { color: colorScheme === 'dark' ? '#5E819F' : '#5E819F', fontWeight: '600', },
    linkContainer: { marginTop: 16, alignItems: 'center', },
    logo: { width: 400, height: 200, alignSelf: 'center', },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', height: 48, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: colorScheme === 'dark' ? '#334155' : '#5E819F', backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF', },
    passwordInput: { flex: 1, height: '100%', paddingHorizontal: 12, paddingVertical: 0, backgroundColor: 'transparent', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0A1420' : '#FFFFFF', },
    scrollContent: { flexGrow: 1, justifyContent: 'center' },
    socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20, },
    socialBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1877F2', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6, },
    socialIcon: { color: '#FFFFFF', fontSize: 20 },
    switchTrack: { false: '#767577', true: colorScheme === 'dark' ? '#5E819F' : '#0D2C42' },
    switchThumb: { color: stayLoggedIn ? '#0D2C42' : '#f4f3f4' },
    toggleRowWithMargin: { marginBottom: 20 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '70%', alignSelf: 'center', marginTop: 0, marginBottom: -20, },
    toggleText: { fontSize: 13, color: colorScheme === 'dark' ? '#BBBBBB' : '#2F4F68', fontWeight: '500', marginRight: -10, },
  });

  return (
    <View style={styles.screenBackground}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <Image
              source={colorScheme === 'dark' ? require('@/assets/images/logo_with_font_dark.jpg') : require('@/assets/images/logo_with_font.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={handleGoogleSignIn}
              >
                <Ionicons name="logo-google" style={styles.socialIcon} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialBtn}
                onPress={async () => {
                  if (fbRequest) {
                    await fbPromptAsync();
                  } else {
                    Alert.alert('Error', 'Facebook login not ready');
                  }
                }}
              >
                <Ionicons name="logo-facebook" style={styles.socialIcon} />
              </TouchableOpacity>

              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={20}
                style={{ width: 40, height: 40 }}
                onPress={handleAppleSignIn}
              />

            </View>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#AAAAAA"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#AAAAAA"
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
                  style={styles.eyeIcon}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.toggleRow, styles.toggleRowWithMargin]}>
              <Text style={styles.toggleText}>Stay logged in  </Text>
              <Switch
                value={stayLoggedIn}
                onValueChange={setStayLoggedIn}
                trackColor={{ false: '#767577', true: switchTrackTrueColor }}
                thumbColor={stayLoggedIn ? switchThumbActiveColor : '#f4f3f4'}
              />
            </View>

            <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin}>
              <Text style={styles.buttonText}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPasswordContainer}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGoToSignup} style={styles.linkContainer}>
              <Text style={styles.link}>Don't have an account? Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        {loading && (
          <View style={styles.fullScreenLoading}>
            <LoadingPuck size={240} />
          </View>
        )}
      </KeyboardAvoidingView>
      {/* CUSTOM THEMED ALERT MODAL */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>{alertTitle}</Text>
            <Text style={styles.alertMessageText}>{alertMessage}</Text>
            <TouchableOpacity onPress={() => setAlertVisible(false)} style={styles.alertButton}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}