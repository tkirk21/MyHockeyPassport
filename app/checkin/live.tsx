// app/checkin/live.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LiveCheckInScreen() {
  const [rating, setRating] = useState(0);
  const [favoritePlayer, setFavoritePlayer] = useState('');
  const [companions, setCompanions] = useState('');
  const [notes, setNotes] = useState('');
  const [merch, setMerch] = useState({ jersey: false, puck: false, });
  const [concessions, setConcessions] = useState({ beer: false, hotdog: false, });

  const toggleMerch = (key) => {
      setMerch({ ...merch, [key]: !merch[key] });
  };

  const toggleConcession = (key) => {
    setConcessions({ ...concessions, [key]: !concessions[key] });
  };

  const handleRatingPress = (value) => {
    setRating(value === rating ? value - 0.5 : value);
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const isFull = rating >= i;
      const isHalf = rating + 0.5 === i;

      stars.push(
        <TouchableOpacity key={i} onPress={() => handleRatingPress(i)}>
          <Ionicons
            name={isFull ? 'star' : isHalf ? 'star-half' : 'star-outline'}
            size={32}
            color="#FFD700"
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Live Game Check-In</Text>

      {/* Star Rating */}
      <Text style={styles.label}>Rating</Text>
      <View style={styles.starContainer}>{renderStars()}</View>

      {/* Favorite Player */}
      <Text style={styles.label}>Favorite Player</Text>
      <TextInput
        style={styles.input}
        value={favoritePlayer}
        onChangeText={setFavoritePlayer}
        placeholder="Enter favorite player"
        placeholderTextColor="#999"
      />

      {/* Companions */}
      <Text style={styles.label}>Who did you go with?</Text>
      <TextInput
        style={styles.input}
        value={companions}
        onChangeText={setCompanions}
        placeholder="e.g. Dad, Sarah, etc."
        placeholderTextColor="#999"
      />

      {/* Notes */}
      <Text style={styles.label}>Notes / Memory</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Write a quick memory or highlight..."
        placeholderTextColor="#999"
        multiline
      />

      {/* Merch Checkboxes */}
      <Text style={styles.label}>Merch Bought</Text>
      <View style={styles.checkboxGroup}>
        {Object.keys(merch).map((item) => (
          <TouchableOpacity key={item} style={styles.checkboxRow} onPress={() => toggleMerch(item)}>
            <Ionicons
              name={merch[item] ? 'checkbox' : 'square-outline'}
              size={24}
              color="#0A2940"
            />
            <Text style={styles.checkboxLabel}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Concessions Checkboxes */}
      <Text style={styles.label}>Concessions Bought</Text>
      <View style={styles.checkboxGroup}>
        {Object.keys(concessions).map((item) => (
          <TouchableOpacity key={item} style={styles.checkboxRow} onPress={() => toggleConcession(item)}>
            <Ionicons
              name={concessions[item] ? 'checkbox' : 'square-outline'}
              size={24}
              color="#0A2940"
            />
            <Text style={styles.checkboxLabel}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Submit Button Placeholder */}
      <TouchableOpacity style={styles.submitButton}>
        <Text style={styles.submitButtonText}>Submit Check-In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0A2940',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    color: '#0A2940',
  },
  input: {
    borderColor: '#CBD5E0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    fontSize: 16,
    color: '#0A2940',
  },
  textArea: {
    height: 80,
  },
  starContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  checkboxGroup: {
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#0A2940',
  },
  submitButton: {
    backgroundColor: '#0A2940',
    padding: 14,
    borderRadius: 10,
    marginTop: 30,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
