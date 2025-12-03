// components/friends/chirpBox.tsx
import React, { useEffect, useState } from 'react';
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseApp from '@/firebaseConfig';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

type Props = {
  friendId: string;
  checkinId: string;
};

export default function ChirpBox({ friendId, checkinId }: Props) {
  const [chirps, setChirps] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadChirps = async () => {
      try {
        const chirpsRef = collection(db, "profiles", friendId, "checkins", checkinId, "chirps");
        const q = query(chirpsRef, orderBy("timestamp", "asc"));
        const snap = await getDocs(q);
        setChirps(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading chirps:", err);
      }
    };
    loadChirps();
  }, [friendId, checkinId]);

  const sendChirp = async () => {
    if (!auth.currentUser || !message.trim() || loading) return;
    setLoading(true);

    const userId = auth.currentUser.uid;
    let userName = "Someone";
    let userImage = null;

    try {
      const profileSnap = await getDoc(doc(db, "profiles", userId));
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        userName = data?.name || userName;
        userImage = data?.imageUrl || null;
      }
    } catch (err) {}

    try {
      const newChirp = {
        userId,
        userName,
        userImage,
        text: message.trim(),
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, "profiles", friendId, "checkins", checkinId, "chirps"), newChirp);

      setChirps(prev => [...prev, {
            id: Date.now().toString(),
            ...newChirp,
            timestamp: new Date(),
          }]);
      setMessage('');
    } catch (err) {
      console.error("Error sending chirp:", err);
    } finally {
      setLoading(false);
    }
  };

return (
    <View style={styles.chirpSectionWrapper}>
      {chirps.map((c) => (
        <View key={c.id || c.timestamp} style={styles.chirpRow}>
          <Image
            source={c.userImage ? { uri: c.userImage } : require("@/assets/images/icon.png")}
            style={styles.avatar}
          />
          <View style={styles.textContainer}>
            <Text style={styles.userName}>{c.userName || "Someone"}</Text>
            <Text style={styles.chirpText}>{c.text}</Text>
          </View>
        </View>
      ))}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a chirp..."
          placeholderTextColor="#999"
          value={message}
          onChangeText={setMessage}
        />
        <TouchableOpacity
          onPress={sendChirp}
          disabled={loading || !message.trim()}
          style={styles.sendButton}
        >
          <Text style={styles.sendText}>Chirp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
  },
  chirpRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  chirpText: {
    color: "#0A2940",
    fontSize: 13,
    flexShrink: 1,
  },
  container: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  sendButton: {
    backgroundColor: '#0A2940',
    marginLeft: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#2F4F68",
    opacity: 1,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  textContainer: {
    flex: 1,
  },
  userName: {
    fontWeight: "700",
    color: "#0A2940",
    fontSize: 13,
    marginBottom: 2,
  },
  chirpSectionWrapper: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
  },
};