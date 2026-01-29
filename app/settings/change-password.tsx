//app/settings/change-password.tsx
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useColorScheme } from '../../hooks/useColorScheme';

const auth = getAuth();

export default function ChangePasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('No user logged in');

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Change password
      await updatePassword(user, newPassword);

      Alert.alert('Success', 'Password changed successfully');
      router.back();
    } catch (error: any) {
      let title = 'Error';
      let message = 'Failed to change password. Please try again.';

      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        title = 'Incorrect Password';
        message = 'Your current password is incorrect. Please try again.';
      } else if (error.code === 'auth/weak-password') {
        message = 'New password is too weak. It must be at least 6 characters.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again later.';
      } else if (error.code) {
        // For any other known Firebase error, show a clean version
        message = error.message.replace(/^Firebase: /, '').replace(/\(auth\/.*\)/, '');
      }

      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    backArrow: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    eyeIcon: { padding: 16 },
    eyeIconColor: { color: colorScheme === 'dark' ? '#BBBBBB' : '#888888' },
    field: { marginBottom: 20 },
    headerRow: { paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 28, fontWeight: '700', marginLeft: 20 },
    label: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', fontSize: 16, marginBottom: 8 },
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
        <Text style={styles.headerTitle}>Change Password</Text>
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
          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor="#888"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowNew(!showNew)}
            >
              <Ionicons
                name={showNew ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color="#888"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor="#888"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirm(!showConfirm)}
            >
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color="#888"
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={loading}>
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Change Password'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}