//version 1 - 10am friday 1st of august
// app/(tabs)/checkin.tsx
import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View, } from 'react-native';
import { useRouter } from 'expo-router';

export default function CheckInScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Check In</Text>
      <Text style={styles.subHeader}>Log your game experience</Text>

      <Image
        source={require('@/assets/images/checkin_icon.png')} // optional graphic
        style={styles.heroImage}
        resizeMode="contain"
      />

      <TouchableOpacity style={styles.buttonPrimary} onPress={() => router.push('/checkin/live')}>
        <Text style={styles.buttonText}>Check In to a Live Game</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.push('/checkin/manual')}>
        <Text style={styles.buttonText}>Add a Past Game</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0A2940',
    marginBottom: 8,
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 16,
    color: '#0A2940',
    marginBottom: 30,
    textAlign: 'center',
  },
  heroImage: {
    width: Dimensions.get('window').width * 0.6,
    height: 160,
    marginBottom: 40,
  },
  buttonPrimary: {
    backgroundColor: '#0A2940',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  buttonSecondary: {
    backgroundColor: '#0A2940',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});

