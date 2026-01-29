//app/checkin/edit/[checkinId].tsx
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';
import firebaseApp from "@/firebaseConfig";
import LoadingPuck from "@/components/loadingPuck";
import EditCheckinForm from "@/components/editCheckinForm";

const db = getFirestore(firebaseApp);

export default function editCheckinScreen() {
  const { checkinId, userId } = useLocalSearchParams();
  const [checkin, setCheckin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!checkinId || !userId) {
      Alert.alert("Error", "Missing info");
      router.back();
      return;
    }

    const load = async () => {
      try {
        const ref = doc(db, "profiles", userId as string, "checkins", checkinId as string);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setCheckin({ id: snap.id, ...snap.data() });
        } else {
          Alert.alert("Error", "Check-in not found");
          router.back();
        }
      } catch {
        Alert.alert("Error", "Failed to load");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [checkinId, userId]);

  if (loading) return <LoadingPuck />;
  if (!checkin) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Edit Check-In" }} />
      <EditCheckinForm initialData={checkin} />
    </>
  );
}