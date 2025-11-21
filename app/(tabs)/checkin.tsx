// app/(tabs)/checkin.tsx
import React from 'react';
import { Dimensions, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function CheckInScreen() {
  const router = useRouter();

  return (
    <ImageBackground
      source={require("@/assets/images/background.jpg")}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Grey overlay only on the background */}
      <View style={styles.overlay} />

      {/* All your content on top */}
      <Text style={styles.header}>Check In</Text>
      <Text style={styles.subHeader}>Log your game experience</Text>
      <Image source={require('@/assets/images/checkin_icon.png')} style={styles.heroImage} resizeMode="contain" />

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.buttonPrimary} onPress={() => router.push('/checkin/live')}>
          <Text style={styles.buttonText}>Check In to a Live Game</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.push('/checkin/manual')}>
          <Text style={styles.buttonText}>Add a Past Game</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    position: "absolute",
    top: 50,                 // ← change only this number to move header up/down
    left: 0,
    right: 0,
    fontSize: 34,
    fontWeight: "bold",
    color: "#0D2C42",
    textAlign: "center",
    textShadowColor: "#ffffff",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  subHeader: {
    position: "absolute",
    top: 100,                // ← change only this number to move subheader
    left: 0,
    right: 0,
    fontSize: 16,
    color: "#0A2940",
    textAlign: "center",
  },

  heroImage: {
    position: "absolute",
    top: 130,                // ← change only this number to move the icon
    width: Dimensions.get("window").width * 0.6,
    height: 160,
    alignSelf: "center",
  },

  buttons: {
    position: "absolute",
    paddingHorizontal: 60,
    bottom: 139,             // ← change only this number to move BOTH buttons together
    left: 24,
    right: 24,
    gap: 40,                 // ← change only this number to adjust gap between the two buttons
  },

  buttonPrimary: {
    backgroundColor: "#0D2C42",
    borderWidth: 2,
    borderColor: '#2F4F68',
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonSecondary: {
    backgroundColor: "#0D2C42",
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#2F4F68',
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30, 30, 30, 0.1)",   // pure grey, 60% opacity
  },

});

