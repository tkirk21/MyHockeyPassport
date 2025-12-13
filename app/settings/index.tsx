//app/settings/index.tsx
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { useRouter, Stack } from 'expo-router';
import React from 'react';

const auth = getAuth();

export default function SettingsScreen() {
  const router = useRouter();

  const logout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', onPress: () => auth.signOut().then(() => router.replace('/login')) },
    ]);
  };

  const deleteAccount = () => {
    Alert.alert('Delete Account', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => auth.signOut().then(() => router.replace('/login')) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A2940' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header – exactly like Blocked Users */}
      <View style={{ paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginLeft: 20 }}>
          Settings
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.inner}>
          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>

            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/blocked')}>
              <Ionicons name="ban-outline" size={26} color="#fff" />
              <Text style={styles.label}>Blocked Users</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/change-email')}>
              <Ionicons name="mail-outline" size={26} color="#fff" />
              <Text style={styles.label}>Change Email</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/change-password')}>
              <Ionicons name="lock-closed-outline" size={26} color="#fff" />
              <Text style={styles.label}>Change Password</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={deleteAccount}>
              <Ionicons name="trash-outline" size={26} color="#EF4444" />
              <Text style={[styles.label, { color: '#EF4444' }]}>Delete Account</Text>
            </TouchableOpacity>
          </View>

          {/* Notifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/notifications')}>
              <Ionicons name="notifications-outline" size={26} color="#fff" />
              <Text style={styles.label}>Push Notifications</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.row}>
              <Ionicons name="mail-outline" size={26} color="#fff" />
              <Text style={styles.label}>Email Notifications</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>

            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/startup-tab')}>
              <Ionicons name="home-outline" size={26} color="#fff" />
              <Text style={styles.label}>Default Startup Tab</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/location-radius')}>
              <Ionicons name="location-outline" size={26} color="#fff" />
              <Text style={styles.label}>Location Discovery Radius</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/theme')}>
              <Ionicons name="moon-outline" size={26} color="#fff" />
              <Text style={styles.label}>Theme</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Support */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>

            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://apps.apple.com/app/idYOUR_ID/reviews')}>
              <Ionicons name="star-outline" size={26} color="#fff" />
              <Text style={styles.label}>Rate the App</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('mailto:support@myhockeypassport.com')}>
              <Ionicons name="mail-outline" size={26} color="#fff" />
              <Text style={styles.label}>Contact Support</Text>
            </TouchableOpacity>
          </View>

          {/* Legal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>

            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://yourwebsite.com/privacy')}>
              <Text style={styles.link}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://yourwebsite.com/terms')}>
              <Text style={styles.link}>Terms of Service</Text>
            </TouchableOpacity>
          </View>

          {/* Log Out */}
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <View style={styles.version}>
            <Text style={styles.versionText}>
              Version {Constants.expoConfig?.version || '1.0.0'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 16, opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  label: { flex: 1, color: '#fff', fontSize: 18, marginLeft: 16 },
  link: { color: '#fff', fontSize: 17, paddingVertical: 12 },
  version: { paddingVertical: 20 },
  versionText: { color: '#888', fontSize: 16 },
  logoutButton: { marginTop: 40, backgroundColor: '#EF4444', padding: 18, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});