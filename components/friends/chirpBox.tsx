// components/friends/chirpBox.tsx
import React, { useEffect, useState } from 'react';
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addDoc, collection, doc, deleteDoc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    // If no authenticated user, clear chirps and don't set up listener
    if (!auth.currentUser?.uid) {
      setChirps([]);
      return;
    }

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

    // Cleanup on unmount or when user/friendId/checkinId changes
    return () => unsub();
  }, [friendId, checkinId, auth.currentUser?.uid]);

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
      setMenuOpenId(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const saveEdit = async (chirpId: string) => {
    if (!editText.trim()) return;

    try {
      const chirpRef = doc(db, "profiles", friendId, "checkins", checkinId, "chirps", chirpId);
      await updateDoc(chirpRef, { text: editText.trim() });

      setChirps(prev =>
        prev.map(chirp =>
          chirp.id === chirpId ? { ...chirp, text: editText.trim() } : chirp
        )
      );
    } catch (err) {
      console.error("Edit save failed:", err);
    } finally {
      setEditingId(null);
      setEditText('');
      setMenuOpenId(null);
    }
  };

  return (
    <View style={styles.chirpSectionWrapper}>
      {chirps.map((c) => {
        const isOwnChirp = c.userId === auth.currentUser?.uid;
        const isEditing = editingId === c.id;

        return (
          <View key={c.id} style={styles.chirpRow}>
            <Image
              source={c.userImage ? { uri: c.userImage } : require("@/assets/images/icon.png")}
              style={styles.avatar}
            />

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.userName}>{c.userName || "Someone"}</Text>

                {isOwnChirp && (
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      onPress={() => setMenuOpenId(menuOpenId === c.id ? null : c.id)}
                    >
                      <Text style={{ fontSize: 24, color: '#666' }}>⋮</Text>
                    </TouchableOpacity>

                    {menuOpenId === c.id && !isEditing && (
                      <View style={styles.dropdownMenu}>
                        <TouchableOpacity onPress={() => { setEditingId(c.id); setEditText(c.text); setMenuOpenId(null); }}>
                          <Text style={styles.menuTextEdit}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteChirp(c.id)}>
                          <Text style={styles.menuTextDelete}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {isEditing ? (
                <View style={{ marginTop: 8 }}>
                  <TextInput
                    style={[styles.input, { borderColor: '#10B981', borderWidth: 1.5 }]}
                    value={editText}
                    onChangeText={setEditText}
                    autoFocus
                    selectTextOnFocus
                    multiline
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => { setEditingId(null); setEditText(''); }}>
                      <Text style={{ color: '#666', fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => saveEdit(c.id)}>
                      <Text style={{ color: '#10B981', fontWeight: '600' }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.chirpText}>{c.text}</Text>
              )}
            </View>
          </View>
        );
      })}

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
          style={[styles.sendButton, (loading || !message.trim()) && { opacity: 0.5 }]}
        >
          <Text style={styles.sendText}>Chirp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  chirpSectionWrapper: { marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, },
  chirpRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16, },
  chirpText: { color: "#0A2940", fontSize: 14, marginTop: 4, lineHeight: 20 },
  dropdownMenu: { position: 'absolute', right: -8, top: 32, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#0D2C42', paddingVertical: 6, minWidth: 60, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, zIndex: 999, },
  input: { flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#ddd", fontSize: 14 },
  inputRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  menuTextEdit: { color: '#1E3A8A', fontWeight: '600', paddingVertical: 4, paddingHorizontal: 8 },
  menuTextDelete: { color: '#F44336', fontWeight: '600', paddingVertical: 4, paddingHorizontal: 8, },
  sendButton: { backgroundColor: '#0A2940', marginLeft: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30, },
  sendText: { color: "#fff", fontWeight: "bold", fontSize: 14, },
  userName: { fontWeight: "700", color: "#0A2940", fontSize: 14, },
};