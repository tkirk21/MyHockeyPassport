import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

const auth = getAuth();
const LEAGUES_DATA = [
  "NHL", "KHL", "AHL", "ECHL", "SPHL", "FPHL", "LNAH", "OHL", "QMJHL", "WHL", "USHL", "NAHL", "NA3HL", "NCAA DIV I",
  "NCAA DIV II", "SHL", "HockeyAllsvenskan", "EHL", "LIIGA", "ELH", "DEL", "NL", "ICEHL", "Slovak Extraliga", "AIHL",
];

export default function FavoriteLeaguesScreen() {
  const router = useRouter();
  const [favoriteLeagues, setFavoriteLeagues] = useState<string[]>([]);
  const filteredLeagues = LEAGUES_DATA;

  useEffect(() => {
    const loadFavoriteLeagues = async () => {
      if (!auth.currentUser) {
        setFavoriteLeagues([]);
        return;
      }
      const docSnap = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
      const saved = docSnap.data()?.favoriteLeagues;

      if (Array.isArray(saved) && saved.length > 0) {
        setFavoriteLeagues(saved.filter(l => typeof l === 'string' && l.trim() !== ''));
      } else {
        setFavoriteLeagues([]);
      }
    };

    loadFavoriteLeagues();
  }, []);

  const toggleLeague = async (league: string) => {
    let updated: string[];
    if (favoriteLeagues.includes(league)) {
      updated = favoriteLeagues.filter(l => l !== league);
    } else {
      updated = [...favoriteLeagues, league];
    }
    setFavoriteLeagues(updated);
    if (auth.currentUser) {
      await setDoc(
        doc(db, 'profiles', auth.currentUser.uid),
        { favoriteLeagues: updated },
        { merge: true }
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A2940' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginLeft: 20 }}>
          Favorite Leagues
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.list}>
          {filteredLeagues.map(league => (
            <TouchableOpacity
              key={league}
              style={styles.leagueRow}
              onPress={() => toggleLeague(league)}
            >
              <Text style={styles.leagueText}>{league}</Text>
              {favoriteLeagues.includes(league) && (
                <Ionicons name="checkmark" size={24} color="#fff" />
              )}
            </TouchableOpacity>

          ))}
        </View>
      </ScrollView>
        <TouchableOpacity style={styles.saveButton} onPress={() => router.back()}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, },
  leagueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1A3A5A', },
  leagueText: { color: '#fff', fontSize: 18, },
  saveButton: { backgroundColor: "#0D2C42", borderWidth: 2, borderColor: '#2F4F68', paddingVertical: 16, borderRadius: 30, marginHorizontal: 20, marginTop: 10, marginBottom: 80, alignItems: 'center', width: 200, alignSelf: 'center', },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', },
});