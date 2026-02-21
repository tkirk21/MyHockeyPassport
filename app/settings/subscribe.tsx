import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';;[;]
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubscribeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const openGoogleSubscriptions = async () => {
    try {
      const supported = await Linking.canOpenURL('https://play.google.com/store/account/subscriptions');
      if (!supported) {
        setAlertTitle('Unavailable');
        setAlertMessage('Unable to open subscription settings on this device.');
        setAlertVisible(true);
        return;
      }

      await Linking.openURL('https://play.google.com/store/account/subscriptions');
    } catch {
      setAlertTitle('Error');
      setAlertMessage('Failed to open subscription settings. Please try again.');
      setAlertVisible(true);
    }
  };

  const styles = StyleSheet.create({
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0F1E33' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 16 },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', textAlign: 'center', marginBottom: 12 },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68' },
    alertButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', fontWeight: '700', fontSize: 16 },
    button: { backgroundColor: '#0D2C42', paddingVertical: 14, borderRadius: 30, alignItems: 'center', },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', },
    card: { backgroundColor: colorScheme === 'dark' ? '#0F1E33' : '#F8FAFC', borderRadius: 16, padding: 20, borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, },
    headerTitle: { fontSize: 28, fontWeight: '700', marginLeft: 20, color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', },
    screen: { flex: 1, backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF', paddingTop: insets.top + 10, paddingHorizontal: 20, },
    text: { fontSize: 16, lineHeight: 22, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', marginBottom: 20, },
    title: { fontSize: 22, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42', marginBottom: 10, },
  });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={28}
            color={colorScheme === 'dark' ? '#FFFFFF' : '#0D2C42'}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>My Sports Passport Premium</Text>
        <Text style={styles.text}>
          • 3-day free trial{'\n'}
          • $2.99 per month after trial{'\n'}
          • Unlimited check-ins, maps, and stats{'\n'}
          • Support ongoing development
        </Text>

        <TouchableOpacity style={styles.button} onPress={openGoogleSubscriptions}>
          <Text style={styles.buttonText}>Manage Subscription</Text>
        </TouchableOpacity>

        <Modal visible={alertVisible} transparent animationType="fade">
          <View style={styles.alertOverlay}>
            <View style={styles.alertContainer}>
              <Text style={styles.alertTitle}>{alertTitle}</Text>
              <Text style={styles.alertMessage}>{alertMessage}</Text>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => setAlertVisible(false)}
              >
                <Text style={styles.alertButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </View>
  );
}
