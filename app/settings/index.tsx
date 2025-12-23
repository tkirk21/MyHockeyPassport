//app/settings/index.tsx
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import React, { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import PushSwitch from '@/components/PushSwitch';
import { Dropdown } from 'react-native-element-dropdown';
import { useFocusEffect } from '@react-navigation/native';

const auth = getAuth();

export default function SettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'miles' | 'km'>('miles');
  const [favoriteLeagues, setFavoriteLeagues] = useState<string[]>([]);
  const [startupTab, setStartupTab] = useState<'home' | 'profile' | 'checkin' | 'map' | 'friends'>('home');

  useEffect(() => {
    const loadPushSetting = async () => {
      if (!auth.currentUser) return;
      const docSnap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
      if (docSnap.exists()) {
        setPushEnabled(docSnap.data().pushNotifications ?? true);
      }
    };
    loadPushSetting();
  }, []);

  useEffect(() => {
    const loadDistanceUnit = async () => {
      if (!auth.currentUser) return;
      const docSnap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
      if (docSnap.exists()) {
        const unit = docSnap.data().distanceUnit;
        if (unit === 'km') {
          setDistanceUnit('km');
        } else {
          setDistanceUnit('miles');
        }
      } else {
        setDistanceUnit('miles');
      }
    };
    loadDistanceUnit();
  }, []);

  useEffect(() => {
    const loadStartupTab = async () => {
      if (!auth.currentUser) return;
      const docSnap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
      if (docSnap.exists()) {
        const saved = docSnap.data().startupTab;
        if (saved === 'home' || saved === 'profile' || saved === 'checkin' || saved === 'map' || saved === 'friends') {
          setStartupTab(saved);
        } else {
          setStartupTab('home');
        }
      } else {
        setStartupTab('home');
      }
    };
    loadStartupTab();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const loadFavoriteLeagues = async () => {
        if (!auth.currentUser) return;
        const docSnap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
        if (docSnap.exists()) {
          const saved = docSnap.data()?.favoriteLeagues;
          if (Array.isArray(saved)) {
            setFavoriteLeagues(saved);
          }
        }
      };

      loadFavoriteLeagues();
    }, [])
  );

  const togglePushNotifications = async (value: boolean) => {
    if (!auth.currentUser) return;
    setPushEnabled(value);
    await setDoc(doc(db, 'profiles', auth.currentUser.uid), { pushNotifications: value }, { merge: true });
  };

  const updateDistanceUnit = async (unit: 'miles' | 'km') => {
    if (!auth.currentUser) return;
    setDistanceUnit(unit);
    await setDoc(doc(db, 'profiles', auth.currentUser.uid), { distanceUnit: unit }, { merge: true });
  };

  const updateStartupTab = async (tab: 'home' | 'profile' | 'checkin' | 'map' | 'friends') => {
    if (!auth.currentUser) return;
    setStartupTab(tab);
    await setDoc(doc(db, 'profiles', auth.currentUser.uid), { startupTab: tab }, { merge: true });
  };

  const logout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        onPress: async () => {
          try {
            await auth.signOut();
            // Force full navigation reset – unmounts EVERYTHING
            router.dismissAll();  // clears the entire stack
            router.replace('/login');
          } catch (error) {
            console.error('Logout error:', error);
          }
        },
      },
    ]);
  };

  const deleteAccount = () => {
    Alert.alert('Delete Account', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await auth.signOut();
            // Force full navigation reset – unmounts all tabs and kills all listeners
            router.dismissAll();
            router.replace('/login');
          } catch (error) {
            console.error('Delete account logout error:', error);
          }
        },
      },
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 50 }}
        >
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
            <PushSwitch />

            <TouchableOpacity style={styles.row}>
              <Ionicons name="mail-outline" size={26} color="#fff" />
              <Text style={styles.label}>Email Notifications</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>

            <View style={styles.row}>
              <Ionicons name="home-outline" size={26} color="#fff" />
              <Text style={styles.label}>Default Startup Tab</Text>
              <Dropdown
                data={[
                  { label: 'Home', value: 'home' },
                  { label: 'Profile', value: 'profile' },
                  { label: 'Check-In', value: 'checkin' },
                  { label: 'Map', value: 'map' },
                  { label: 'Friends', value: 'friends' },
                ]}
                labelField="label"
                valueField="value"
                value={startupTab}
                onChange={(item) => updateStartupTab(item.value as 'home' | 'profile' | 'checkin' | 'map' | 'friends')}
                style={styles.distanceDropdown}
                selectedTextStyle={styles.distanceSelectedText}
                placeholderStyle={{ opacity: 0 }}
                iconStyle={styles.distanceIcon}
                containerStyle={styles.distanceListContainer}
                itemContainerStyle={styles.distanceItemContainer}
                itemTextStyle={styles.distanceItemText}
                activeColor="transparent"
                renderRightIcon={() => (
                  <Ionicons name="chevron-down" size={24} color="#fff" />
                )}
              />
            </View>

            {/* Distance Unit */}
            <View style={styles.row}>
              <Ionicons name="speedometer-outline" size={26} color="#fff" />
              <Text style={styles.label}>Distance Unit</Text>
              <Dropdown
                data={[
                  { label: 'miles', value: 'miles' },
                  { label: 'kms', value: 'km' },
                ]}
                labelField="label"
                valueField="value"
                value={distanceUnit}
                onChange={(item) => updateDistanceUnit(item.value as 'mile' | 'km')}
                style={styles.distanceDropdown}
                selectedTextStyle={styles.distanceSelectedText}
                placeholderStyle={{ opacity: 0 }}
                iconStyle={styles.distanceIcon}
                containerStyle={styles.distanceListContainer}
                itemContainerStyle={styles.distanceItemContainer}
                itemTextStyle={styles.distanceItemText}
                activeColor="transparent"   // <--- add this exact line
                renderRightIcon={() => (
                  <Ionicons name="chevron-down" size={24} color="#fff" />
                )}
              />
            </View>

            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/location-radius')}>
              <Ionicons name="location-outline" size={26} color="#fff" />
              <Text style={styles.label}>Closest Arenas Radius</Text>
              <Ionicons name="chevron-forward" size={24} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/favorite-leagues')}>
              <Ionicons name="star-outline" size={26} color="#fff" />
              <Text style={styles.label}>Favorite Leagues</Text>
              <Text style={{ color: '#aaa', fontSize: 16 }}>
                {favoriteLeagues.length === 0 ? 'All leagues' : `${favoriteLeagues.length} selected`}
              </Text>
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

          <View style={styles.version}>
            <Text style={styles.versionText}>
              Version {Constants.expoConfig?.version || '1.0.0'}
            </Text>
          </View>

          {/* Log Out */}
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 16, opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  label: { flex: 1, color: '#fff', fontSize: 18, marginLeft: 16 },
  link: { color: '#fff', fontSize: 17, },
  version: { paddingBottom: 20 },
  versionText: { color: '#888', fontSize: 16 },
  logoutButton: { backgroundColor: '#EF4444', padding: 18, borderRadius: 12, alignItems: 'center', width: 200, alignSelf: 'center', marginBottom: 30, },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  distanceDropdown: { height: 35, width: 130, backgroundColor: '#1A3A5A', borderRadius: 12, paddingHorizontal: 12, },
  distanceSelectedText: { color: '#fff', fontSize: 18, },
  distanceIcon: { width: 30, height: 30, },
  distanceListContainer: { backgroundColor: '#1A3A5A', borderRadius: 12, overflow: 'hidden' as const, },
  distanceItemContainer: { backgroundColor: '#1A3A5A', },
  distanceItemText: { color: '#fff', fontSize: 18, },
  });