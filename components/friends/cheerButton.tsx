// components/friends/cheerButton.tsx
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';
import { useColorScheme } from '../../hooks/useColorScheme';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

type Props = {
  friendId: string;
  checkinId: string;
};

export default function CheerButton({ friendId, checkinId }: Props) {
  const [cheerCount, setCheerCount] = useState(0);
  const [cheerNames, setCheerNames] = useState<string[]>([]);
  const colorScheme = useColorScheme();

  useEffect(() => {
    const loadCheers = async () => {
      try {
        const cheersRef = collection(db, "profiles", friendId, "checkins", checkinId, "cheers");
        const snap = await getDocs(cheersRef);
        setCheerCount(snap.size);
        setCheerNames(snap.docs.map(d => d.data().name || "Someone"));
      } catch (err) {
        console.error("Error loading cheers:", err);
      }
    };
    loadCheers();
  }, [friendId, checkinId]);

  const handleCheerPress = async () => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;

    let userName = "Anonymous";
    try {
      const profileDoc = await getDoc(doc(db, "profiles", userId));
      if (profileDoc.exists() && profileDoc.data()?.name) {
        userName = profileDoc.data()?.name;
      }
    } catch (err) {}

    const cheerRef = doc(db, "profiles", friendId, "checkins", checkinId, "cheers", userId);
    const cheersSnap = await getDocs(collection(db, "profiles", friendId, "checkins", checkinId, "cheers"));
    const existing = cheersSnap.docs.find(d => d.id === userId);

    try {
      if (existing) {
        await deleteDoc(cheerRef);
        setCheerCount(c => Math.max(0, c - 1));
        setCheerNames(names => names.filter(n => n !== userName));
      } else {
        await setDoc(cheerRef, {
          name: userName,
          userId,
          actorId: userId,
          targetId: friendId,
          checkinId,
          timestamp: serverTimestamp(),
          type: "cheer"
        });
        setCheerCount(c => c + 1);
        setCheerNames(names => [...names, userName]);
      }
    } catch (err) {
      console.error("Error toggling cheer:", err);
    }
  };

  const styles = {
    badge: { position: "absolute", top: -8, right: -8, backgroundColor: "#0A2940",borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff", },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    button: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', paddingHorizontal: 7, paddingVertical: 6, borderRadius: 30, minWidth: 55, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#2F4F68", marginLeft: -20, },
    container: { marginLeft: -12, alignItems: "flex-start", },
    nameText: { color: colorScheme === 'dark' ? '#fff' : '#0A2940', fontSize: 11, marginTop: 2, },
    namesContainer: { marginTop: 4, },
    text: { color: colorScheme === 'dark' ? '#fff' : '#0A2940', fontSize: 10, fontWeight: "bold", }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleCheerPress} style={styles.button} activeOpacity={0.7}>
        <Text style={styles.text}>Cheer🎉</Text>
        {cheerCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{cheerCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {cheerCount > 0 && (
        <View style={styles.namesContainer}>
          {cheerNames.map((name, i) => (
            <Text key={i} style={styles.nameText}>{name}</Text>
          ))}
        </View>
      )}
    </View>
  );
}



