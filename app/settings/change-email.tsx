//app/settings/change-email.tsx
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Modal, ScrollView,  StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmailAuthProvider, getAuth, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { useColorScheme } from '../../hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const auth = getAuth();

export default function ChangeEmailScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const handleChangeEmail = async () => {
    if (newEmail !== confirmEmail) {
      setAlertTitle('Error');
      setAlertMessage('Email addresses do not match.');
      setAlertVisible(true);
      return;
    }

    if (!newEmail.includes('@') || newEmail.length < 5) {
      setAlertTitle('Error');
      setAlertMessage('Please enter a valid email address.');
      setAlertVisible(true);
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('No user logged in');

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      await verifyBeforeUpdateEmail(user, newEmail);

      setAlertTitle('Verification Required');
      setAlertMessage(`We sent a verification email to ${newEmail}.\n\nClick the link in the email to complete the email change.\n\nAfter clicking, log back in with your new email.`);
      setAlertVisible(true);

    } catch (error: any) {
      let message = 'Failed to send verification email.';

      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'Incorrect current password.';
      } else if (error.code === 'auth/email-already-in-use') {
        message = 'That email is already taken by another account.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      }

      setAlertTitle('Error');
      setAlertMessage(message);
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 16 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30 },
    alertButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontWeight: '700', fontSize: 16 },
    backArrow: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    eyeIcon: { padding: 10 },
    eyeIconColor: { color: colorScheme === 'dark' ? '#BBBBBB' : '#888888' },
    field: { marginBottom: 20 },
    headerRow: { paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' },
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

      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>{alertTitle}</Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => {
                setAlertVisible(false);
                if (alertTitle === 'Verification Required') router.back();
              }}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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