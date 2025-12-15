//app/settings/change-email.tsx
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmailAuthProvider, getAuth, reauthenticateWithCredential, sendSignInLinkToEmail, updateEmail, verifyBeforeUpdateEmail  } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const auth = getAuth();
const db = getFirestore();

export default function ChangeEmailScreen() {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

const handleChangeEmail = async () => {
    if (newEmail !== confirmEmail) {
      Alert.alert('Error', 'Email addresses do not match');
      return;
    }

    if (!newEmail.includes('@') || newEmail.length < 5) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('No user logged in');

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Send verification to the NEW email and update automatically when clicked
      await verifyBeforeUpdateEmail(user, newEmail);

      // Show clear success message upfront
      Alert.alert(
        'Verification Required',
        `We sent a verification email to ${newEmail}.\n\nClick the link in the email to complete the email change.\n\nAfter clicking, log back in with your new email.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      let message = 'Failed to send verification email.';

      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'Incorrect current password.';
      } else if (error.code === 'auth/email-already-in-use') {
        message = 'That email is already taken by another account.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      }

      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A2940' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header */}
      <View style={{ paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginLeft: 20 }}>
          Change Email
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        <View style={styles.field}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry={!showPassword}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Required to confirm identity"
              placeholderTextColor="#888"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color="#888"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>New Email</Text>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="Enter new email"
            placeholderTextColor="#888"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm New Email</Text>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            value={confirmEmail}
            onChangeText={setConfirmEmail}
            placeholder="Confirm new email"
            placeholderTextColor="#888"
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleChangeEmail} disabled={loading}>
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Change Email'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  eyeIcon: { padding: 16 },
  field: { marginBottom: 20 },
  input: { backgroundColor: '#fff', padding: 16, borderRadius: 12, fontSize: 18, color: '#000' },
  label: { color: '#fff', fontSize: 16, marginBottom: 8 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12 },
  passwordInput: { flex: 1, padding: 16, fontSize: 18, color: '#000' },
  saveButton: { backgroundColor: '#0D9488', padding: 18, borderRadius: 30, borderColor: '#2F4F68', borderWidth: 2, alignItems: 'center', marginTop: 30, alignSelf: 'center', width: 200 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});