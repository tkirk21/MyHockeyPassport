//app/checkin/edit/[checkinId].tsx
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import firebaseApp from "@/firebaseConfig";
import LoadingPuck from "@/components/loadingPuck";
import EditCheckinForm from "@/components/editCheckinForm";
import { useColorScheme } from '@/hooks/useColorScheme';

const db = getFirestore(firebaseApp);

export default function editCheckinScreen() {
  const { checkinId, userId } = useLocalSearchParams();
  const auth = getAuth(firebaseApp);
  const user = auth.currentUser;
  if (!user) return null;
  const [checkin, setCheckin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const router = useRouter();
  const colorScheme = useColorScheme();
  const auth2 = getAuth(firebaseApp);

  useEffect(() => { const unsub = onAuthStateChanged(auth, (u) => { if (!u) { router.replace('/auth/login'); } }); return () => unsub(); }, []);

  useEffect(() => {
    if (!checkinId || !userId) {
      setAlertTitle("Error");
      setAlertMessage("Missing info");
      setAlertVisible(true);
      return;
    }

    const load = async () => {
      try {
        const ref = doc(db, "profiles", userId as string, "checkins", checkinId as string);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setCheckin({ id: snap.id, ...snap.data() });
        } else {
          setAlertTitle("Error");
          setAlertMessage("Check-in not found");
          setAlertVisible(true);
        }
      } catch {
        setAlertTitle("Error");
        setAlertMessage("Failed to load");
        setAlertVisible(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [checkinId, userId]);

const styles = StyleSheet.create({
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20, },
    alertContainer: { backgroundColor: colorScheme === 'dark' ? '#0A2940' : '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 3, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 16, },
    alertTitle: { fontSize: 18, fontWeight: '700', color: colorScheme === 'dark' ? '#FFFFFF' : '#0A2940', textAlign: 'center', marginBottom: 12, },
    alertMessage: { fontSize: 15, color: colorScheme === 'dark' ? '#CCCCCC' : '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22, },
    alertButton: { backgroundColor: colorScheme === 'dark' ? '#0D2C42' : '#E0E7FF', borderWidth: 2, borderColor: colorScheme === 'dark' ? '#666666' : '#2F4F68', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30, },
    alertButtonText: { color: colorScheme === 'dark' ? '#FFFFFF' : '#1F2937', fontWeight: '700', fontSize: 16, },
  });

  if (loading) return <LoadingPuck />;
  if (!checkin) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Edit Check-In" }} />

      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>{alertTitle}</Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => {
                setAlertVisible(false);
                router.back();
              }}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <EditCheckinForm initialData={checkin} />
    </>
  );
}