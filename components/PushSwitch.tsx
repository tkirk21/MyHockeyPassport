// components/PushSwitch.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function PushSwitch() {
  const colorScheme = useColorScheme();
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

  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
    label: { flex: 1, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', fontSize: 18, marginLeft: 16 },
    rowIcon: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940' },
    switchTrackFalse: { color: '#EF4444' },
    switchTrackTrue: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42' },
    switchThumbEnabled: { color: '#FFFFFF' },
    switchThumbDisabled: { color: '#EF4444' },
  });

  return (
    <View style={styles.row}>
      <Ionicons name="notifications-outline" size={26} color={styles.rowIcon.color} />
      <Text style={styles.label}>Push Notifications</Text>
      <Switch
        value={enabled}
        onValueChange={toggle}
        trackColor={{ false: styles.switchTrackFalse.color, true: styles.switchTrackTrue.color }}
        thumbColor={enabled ? styles.switchThumbEnabled.color : styles.switchThumbDisabled.color}
      />
    </View>
  );
}