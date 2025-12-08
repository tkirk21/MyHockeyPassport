// components/friends/chirpBox.tsx
import React, { useEffect, useState } from 'react';
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addDoc, collection, doc, deleteDoc, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    const chirpsRef = collection(db, "profiles", friendId, "checkins", checkinId, "chirps");
    const q = query(chirpsRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const loaded: any[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() });
      });
      setChirps(loaded);
    }, (err) => {
      console.error("Chirp listener error:", err);
    });

    return () => unsub();
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

  const deleteChirp = async (chirpId: string) => {
      if (!auth.currentUser) return;

      try {
        const chirpRef = doc(db, "profiles", friendId, "checkins", checkinId, "chirps", chirpId);
        await deleteDoc(chirpRef);

        setChirps(prev => prev.filter(c => c.id !== chirpId));
      } catch (err) {
        console.error("Delete failed:", err);
      }
    };

return (
    <View style={styles.chirpSectionWrapper}>
      {chirps.map((c) => {
        const isOwnChirp = c.userId === auth.currentUser?.uid;
        const isEditing = editingId === c.id;

        return (
          <View key={c.id || c.timestamp} style={styles.chirpRow}>
            <Image
              source={c.userImage ? { uri: c.userImage } : require("@/assets/images/icon.png")}
              style={styles.avatar}
            />

            <View style={styles.textContainer}>
              <Text style={styles.userName}>{c.userName || "Someone"}</Text>

              {isEditing ? (
                <TextInput
                  style={[styles.input, { marginBottom: 4 }]}
                  value={editText}
                  onChangeText={setEditText}
                  autoFocus
                  selectTextOnFocus
                />
              ) : (
                <Text style={styles.chirpText}>{c.text}</Text>
              )}

              {isOwnChirp && !isEditing && (
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingId(c.id);
                      setEditText(c.text);
                    }}
                  >
                    <Text style={{ color: "#1E3A8A", fontSize: 13, fontWeight: "600" }}>
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => deleteChirp(c.id)}>
                    <Text style={{ color: "#F44336", fontSize: 13, fontWeight: "600" }}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {isEditing && (
                <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      if (!editText.trim()) return;

                      try {
                        const chirpRef = doc(db, "profiles", friendId, "checkins", checkinId, "chirps", c.id);
                        await updateDoc(chirpRef, { text: editText.trim() });

                        setChirps(prev =>
                          prev.map(ch => (ch.id === c.id ? { ...ch, text: editText.trim() } : ch))
                        );
                      } catch (err) {
                        console.error("Edit failed:", err);
                      } finally {
                        setEditingId(null);
                        setEditText('');
                      }
                    }}
                  >
                    <Text style={{ color: "#4CAF50", fontWeight: "bold", fontSize: 13 }}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setEditingId(null);
                      setEditText('');
                    }}
                  >
                    <Text style={{ color: "#999", fontSize: 13 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {/* Input row to send a new chirp */}
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