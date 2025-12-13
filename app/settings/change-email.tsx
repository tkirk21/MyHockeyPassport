// app/settings/change-email.tsx
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

const auth = getAuth();

export default function ChangeEmailScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);

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

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update the email
      await updateEmail(user, newEmail);

      Alert.alert('Success', 'Email changed successfully!\nCheck your new inbox for verification.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Wrong password', 'The current password you entered is incorrect');
      } else if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Email in use', 'That email address is already taken');
      } else if (error.code === 'auth/requires-recent-login') {
        Alert.alert('Re-login required', 'For security, please log out and log back in before changing email');
      } else {
        Alert.alert('Error', error.message || 'Failed to change email');
      }
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
          <TextInput
            style={styles.input}
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Required to confirm identity"
            placeholderTextColor="#888"
          />
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
  field: { marginBottom: 20 },
  label: { color: '#fff', fontSize: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    color: '#000',
  },
  saveButton: {
    backgroundColor: '#0D9488',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    alignSelf: 'center',
    width: 200,
  },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});