import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubscribeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const openGoogleSubscriptions = () => {
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  const styles = StyleSheet.create({
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
          • $3.99 per month after trial{'\n'}
          • Unlimited check-ins, maps, and stats{'\n'}
          • Support ongoing development
        </Text>

        <TouchableOpacity style={styles.button} onPress={openGoogleSubscriptions}>
          <Text style={styles.buttonText}>Manage Subscription</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
