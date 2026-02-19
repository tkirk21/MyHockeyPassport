//+not-found.tsx
import { Stack } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen does not exist.</Text>
        <Link href="/" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>Go to home screen!</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {  flex: 1, alignItems: 'center',  justifyContent: 'center', padding: 20, },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', },
  link: { marginTop: 15, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#0A2940', borderRadius: 5, },
  linkText: { color: '#fff', fontSize: 16, },
});