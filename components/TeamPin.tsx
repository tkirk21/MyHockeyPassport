//components/TeamPin.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TeamPin() {
  return (
    <View style={styles.pin}>
      <Text style={styles.text}>TEST</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 20,
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
  },
});