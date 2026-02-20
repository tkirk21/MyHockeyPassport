//app/signup.tsx
import { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword, FacebookAuthProvider, fetchSignInMethodsForEmail, GoogleAuthProvider, OAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { auth, } from '@/firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '../hooks/useColorScheme';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();
WebBrowser.warmUpAsync();

export default function Signup() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({
    clientId: '763545830068611',
    redirectUri: `fb763545830068611://authorize`,
    scopes: ['public_profile', 'email'],
    authType: 'rerequest',
    responseType: 'token',
  });

  const ensureTrialStart = async (uid: string) => {
    try {
      const ref = doc(db, 'profiles', uid);
      const snap = await getDoc(ref);
      if (!snap.exists() || !snap.data()?.trialStart) {
        await setDoc(ref, { trialStart: serverTimestamp() }, { merge: true });
      }
    } catch (e) {
      // silently fail
    }
  };

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '853703034223-101527k79a64l7aupv9ru8h0ph5sb2lf.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);


  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const run = async () => {
        try {
          const { authentication } = fbResponse;
          if (!authentication?.accessToken) {
            setAlertTitle('Facebook Error');
            setAlertMessage('No access token returned from Facebook.');
            setAlertVisible(true);
            return;
          }

          const credential = FacebookAuthProvider.credential(authentication.accessToken);

          const cred = await signInWithCredential(auth, credential);

          const profileRef = doc(db, 'profiles', cred.user.uid);
          const profileSnap = await getDoc(profileRef);

          const profileExists = profileSnap.exists();

          if (profileExists) {
            Alert.alert(
              'Account Exists',
              'An account already exists with this email. Please go to the Login page.'
            );

            await signOut(auth);
            return;
          }

          await ensureTrialStart(cred.user.uid);

          router.replace('/(tabs)');
        } catch (error: any) {
          setAlertTitle('Facebook Sign-Up Failed');
          setAlertMessage(error.message || 'Unknown error');
          setAlertVisible(true);
        }
      };

      run();
    }

    if (fbResponse?.type === 'error') {
      setAlertTitle('Facebook Error');
      setAlertMessage(fbResponse.error?.message || 'Unknown');
      setAlertVisible(true);
    }
  }, [fbResponse]);


  const handleSignUp = async () => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      await ensureTrialStart(cred.user.uid);

      router.replace('/(tabs)');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setAlertTitle('Account Exists');
        setAlertMessage('An account already exists with this email. Please go to the Login page.');
        setAlertVisible(true);
      } else {
        Alert.alert('Error', err.message);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();

      const userInfo = await GoogleSignin.signIn();

      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        setAlertTitle('Error');
        setAlertMessage('No idToken returned from Google');
        setAlertVisible(true);
        return;
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(auth, googleCredential);

      const profileRef = doc(db, 'profiles', cred.user.uid);
      const profileSnap = await getDoc(profileRef);

      const profileExists = profileSnap.exists();

      if (profileExists) {
        setAlertTitle('Account Exists');
        setAlertMessage('An account already exists with this email. Please go to the Login page.');
        setAlertVisible(true);

        await signOut(auth);
        return;
      }

      await ensureTrialStart(cred.user.uid);

      router.replace('/(tabs)');

    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      } else if (error.code === statusCodes.IN_PROGRESS) {
        return;
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setAlertTitle('Error');
        setAlertMessage('Google Play Services not available');
        setAlertVisible(true);
      } else {
        setAlertTitle('Google Sign-Up Failed');
        setAlertMessage(error.message || 'Something went wrong.');
        setAlertVisible(true);
      }
    }
  };




  const handleAppleSignIn = async () => {
    try {
      const rawNonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        setAlertTitle('Error');
        setAlertMessage('No identityToken from Apple');
        setAlertVisible(true);
        return;
      }

      const provider = new OAuthProvider('apple.com');
      const appleCredential = provider.credential({
        idToken: credential.identityToken,
        rawNonce: rawNonce,
      });

      const cred = await signInWithCredential(auth, appleCredential);
      const isNewUser = cred.additionalUserInfo?.isNewUser === true;

      if (!isNewUser) {
        setAlertTitle('Account Exists');
        setAlertMessage('An account already exists with this Apple ID. Please go to the Login page.');
        setAlertVisible(true);
        await signOut(auth);
        return;
      }

      await ensureTrialStart(cred.user.uid);
      router.replace('/(tabs)');

    } catch (e: any) {
      if (e.code === 'ERR_CANCELED') {
        return;
      } else {
        setAlertTitle('Apple Sign-Up Failed');
        setAlertMessage(e.message || 'Unknown error');
        setAlertVisible(true);
      }
    }
  };

  const styles = StyleSheet.create({
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0F1E33' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: '#0D2C42', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 16 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertButton: { backgroundColor: '#0D2C42', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
    buttonPrimary: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', marginBottom: 20, width: '66%', alignItems: 'center', alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: colorScheme === 'dark' ? 0.5 : 0.2, shadowRadius: 4, elevation: 6, },
    buttonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 18, fontWeight: '600', },
    container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: colorScheme === 'dark' ? '#0A1420' : '#FFFFFF' },
    eyeButton: { padding: 8 },
    eyeIcon: { color: colorScheme === 'dark' ? '#BBBBBB' : '#2F4F68', fontSize: 22 },
    googleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DB4437', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6, },
    input: { height: 50, borderColor: colorScheme === 'dark' ? '#334155' : '#5E819F', borderWidth: 1, paddingHorizontal: 12, marginBottom: 16, borderRadius: 6, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF', },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colorScheme === 'dark' ? '#334155' : '#5E819F', borderRadius: 6, height: 50, marginBottom: 16, paddingRight: 12, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF', },
    passwordInput: { flex: 1, height: 50, paddingHorizontal: 12, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', backgroundColor: 'transparent', },
    socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20, },
   socialBtn: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#1877F2', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4, },
    title: { fontSize: 26, fontWeight: 'bold', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginBottom: 24, textAlign: 'center', },
    toggle: { marginTop: 16, alignItems: 'center', },
    toggleText: { color: colorScheme === 'dark' ? '#BBBBBB' : '#2F4F68', fontWeight: '500', },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0A1420' : '#FFFFFF', },
    socialIcon: { color: '#FFFFFF', fontSize: 20 },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0A1420' : '#FFFFFF', },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.screenBackground}>
          <View style={styles.container}>
            <Text style={styles.title}>Create Account</Text>

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
                  await WebBrowser.coolDownAsync();
                  await fbPromptAsync({
                    prompt: 'login',
                  });
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
      </ScrollView>
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>{alertTitle}</Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <TouchableOpacity onPress={() => setAlertVisible(false)} style={styles.alertButton}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}