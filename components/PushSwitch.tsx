// components/PushSwitch.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

export default function PushSwitch() {
  const [enabled, setEnabled] = useState(true);
  const user = getAuth().currentUser;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const snap = await getDoc(doc(db, 'profiles', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setEnabled(data.pushNotifications ?? true);
      }
    };
    load();
  }, [user]);

  const toggle = async (value: boolean) => {
    if (!user) return;

    setEnabled(value);

    // Save the preference
    await setDoc(doc(db, 'profiles', user.uid), { pushNotifications: value }, { merge: true });

    if (value) {
      // Turning ON → register token (requests permission if needed)
      const { registerForPushNotificationsAsync } = await import('@/utils/pushNotifications');
      registerForPushNotificationsAsync();
    } else {
      // Turning OFF → clear token
      const { disablePushToken } = await import('@/utils/pushNotifications');
      disablePushToken();
    }
  };

  return (
    <View style={styles.row}>
      <Ionicons name="notifications-outline" size={26} color="#fff" />
      <Text style={styles.label}>Push Notifications</Text>
      <Switch
        value={enabled}
        onValueChange={toggle}
        trackColor={{ false: '#EF4444', true: '#FFFFFF' }}
        thumbColor={enabled ? '#FFFFFF' : '#EF4444'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  label: { flex: 1, color: '#fff', fontSize: 18, marginLeft: 16 },
});