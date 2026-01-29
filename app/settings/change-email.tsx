//app/settings/change-email.tsx
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmailAuthProvider, getAuth, reauthenticateWithCredential, sendSignInLinkToEmail, updateEmail, verifyBeforeUpdateEmail  } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useColorScheme } from '../../hooks/useColorScheme';

const auth = getAuth();
const db = getFirestore();

export default function ChangeEmailScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
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

  const styles = StyleSheet.create({
    backArrow: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    eyeIcon: { padding: 10 },
    eyeIconColor: { color: colorScheme === 'dark' ? '#BBBBBB' : '#888888' },
    field: { marginBottom: 20 },
    headerRow: { paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 28, fontWeight: '700', marginLeft: 20 },
    input: { flex: 1, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', paddingVertical: 12, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF' },
    label: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 16, marginBottom: 8 },
    newEmailPlaceholder: { color: colorScheme === 'dark' ? '#BBBBBB' : '#888888' },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#334155' : '#0D2C42', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF' },
    passwordInput: { flex: 1, fontSize: 16, color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', paddingVertical: 12 },
    passwordPlaceholder: { color: colorScheme === 'dark' ? '#BBBBBB' : '#888888' },
    saveButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 14, borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', width: '70%', alignSelf: 'center', alignItems: 'center' },
    saveButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 18, fontWeight: '600' },
    screenBackground: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF' },
  });

  return (
    <View style={styles.screenBackground}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={styles.backArrow.color} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Email</Text>
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
              placeholderTextColor={styles.passwordPlaceholder.color}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color={styles.eyeIconColor.color}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>New Email</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="Enter new email"
              placeholderTextColor={styles.newEmailPlaceholder.color}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm New Email</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              value={confirmEmail}
              onChangeText={setConfirmEmail}
              placeholder="Confirm new email"
              placeholderTextColor={styles.newEmailPlaceholder.color}
            />
          </View>
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