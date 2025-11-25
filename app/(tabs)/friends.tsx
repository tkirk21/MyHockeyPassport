// app/(tabs)/friends.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firebaseApp from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, setDoc,  } from 'firebase/firestore';

import { logFriendship, logCheer } from "../../utils/activityLogger";
import LoadingPuck from "../../components/loadingPuck";

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const handleCheer = async (item: any) => {
  console.log("👉 Cheer pressed for", item.id, "on", userId);
  try {
    // Decide which user to target
    const targetId =
      item.type === "checkin"
        ? item.friendId
        : item.actorId || item.friendId || "unknown";
    await logCheer(item.id, String(targetId));
    alert("You cheered this 🎉");
  } catch (err) {
    console.error("🔥 Error cheering activity:", err);
    alert("Cheer failed: " + err.message);
  }
};

export default function FriendsTab() {
  function CheerButton({ friendId, checkinId }: { friendId: string; checkinId: string }) {
    const [cheerCount, setCheerCount] = useState(0);
    const [cheerNames, setCheerNames] = useState<string[]>([]);
    const [visible, setVisible] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const loadCheers = async () => {
        try {
          const cheersRef = collection(db, "profiles", friendId, "checkins", checkinId, "cheers");
          const snap = await getDocs(cheersRef);
          setCheerCount(snap.size);
          setCheerNames(snap.docs.map((d) => d.data().name));
        } catch (err) {
          console.error("Error loading cheers:", err);
        }
      };
      loadCheers();
    }, [friendId, checkinId]);

    const handleCheerPress = async () => {
      try {
        if (!auth.currentUser) return;
        const userId = auth.currentUser.uid;

        let userName = "Anonymous";
        try {
          const profileDoc = await getDoc(doc(db, "profiles", userId));
          if (profileDoc.exists() && profileDoc.data().name) {
            userName = profileDoc.data().name;
          } else if (auth.currentUser.displayName) {
            userName = auth.currentUser.displayName;
          }
        } catch (err) {
          console.warn("Could not fetch profile name:", err);
        }

        const cheerRef = doc(db, "profiles", friendId, "checkins", checkinId, "cheers", userId);
        const cheersSnap = await getDocs(collection(db, "profiles", friendId, "checkins", checkinId, "cheers"));
        const existing = cheersSnap.docs.find((d) => d.id === userId);

        if (existing) {
          // Remove cheer
          await deleteDoc(cheerRef);
          setCheerCount((c) => Math.max(0, c - 1));
          setCheerNames((names) => names.filter((n) => n !== userName));
          setVisible(false);
        } else {
          // Add cheer
          await setDoc(cheerRef, {
            name: userName,
            timestamp: new Date(),
          });
          await logCheer(checkinId, friendId);
          setCheerCount((c) => c + 1);
          setCheerNames((names) => [...names, userName]);
          setVisible(true);

          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();

          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => setVisible(false));
          }, 3000);
        }
      } catch (err) {
        console.error("Error toggling cheer:", err);
      }
    };

    return (
      <View style={{ marginTop: 4 }}>
        <TouchableOpacity
          onPress={handleCheerPress}
          style={{
            marginTop: 4,
            alignSelf: "flex-start",
            backgroundColor: "#1E3A8A",
            paddingVertical: 2,
            paddingHorizontal: 6,
            borderRadius: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold" }}>Cheer 🎉</Text>
          {cheerCount > 0 && (
            <View
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                backgroundColor: "#0A2940",
                borderRadius: 8,
                paddingHorizontal: 4,
                minWidth: 16,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#fff",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{cheerCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {visible && cheerNames.length > 0 && (
          <Animated.View
            style={{
              opacity: fadeAnim,
              backgroundColor: "rgba(13,44,66,0.95)",
              padding: 6,
              borderRadius: 8,
              marginTop: 4,
              alignSelf: "flex-start",
            }}
          >
            {cheerNames.map((n, i) => (
              <Text
                key={i}
                style={{
                  color: "#fff",
                  fontSize: 12,
                  marginBottom: 2,
                  paddingHorizontal: 4,
                }}
              >
                {n}
              </Text>
            ))}
          </Animated.View>
        )}
      </View>
    );
  }

  function ChirpBox({ friendId, checkinId }: { friendId: string; checkinId: string }) {
    const [chirps, setChirps] = useState<any[]>([]);
    const [message, setMessage] = useState("");

    useEffect(() => {
      const loadChirps = async () => {
        try {
          const chirpsRef = collection(db, "profiles", friendId, "checkins", checkinId, "chirps");
          const snap = await getDocs(query(chirpsRef, orderBy("timestamp", "asc")));
          setChirps(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
          console.error("Error loading chirps:", err);
        }
      };
      loadChirps();
    }, [friendId, checkinId]);

    const handleChirp = async () => {
      if (!auth.currentUser || !message.trim()) return;
      setLoading(true);

      const userId = auth.currentUser.uid;
      let name = "Someone";
      try {
        const profileSnap = await getDoc(doc(db, "profiles", userId));
        if (profileSnap.exists() && profileSnap.data().name) {
          name = profileSnap.data().name;
        }
      } catch (err) {
        console.warn("Could not fetch name:", err);
      }

      try {
        const user = auth.currentUser;
        const profileSnap = await getDoc(doc(db, "profiles", user.uid));
        const imageUrl = profileSnap.exists() ? profileSnap.data().imageUrl || null : null;

        const chirpRef = collection(db, "profiles", friendId, "checkins", checkinId, "chirps");
        await addDoc(chirpRef, {
          userId: user.uid,
          userName: name,
          userImage: imageUrl,
          text: message.trim(),
          timestamp: new Date(),
        });

        setChirps(prev => [
          ...prev,
          { userId: user.uid, userName: name, userImage: imageUrl, text: message.trim(), timestamp: new Date() },
        ]);
        setMessage("");
      } catch (err) {
        console.error("Error posting chirp:", err);
      } finally {
        setLoading(false);
      }
    };

    return (
      <View style={{ marginTop: 4, backgroundColor: "rgba(13,44,66,0.05)", borderRadius: 8, padding: 6 }}>
        {chirps.map((c) => (
          <View key={c.id || c.timestamp} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Image
              source={
                c.userImage
                  ? { uri: c.userImage }
                  : require("@/assets/images/icon.png") // placeholder
              }
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                marginRight: 8,
              }}
            />
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontWeight: "700", color: "#0A2940" }}>
                {c.userName || "Someone"}
              </Text>
              <Text style={{ color: "#0A2940", flexShrink: 1 }}>
                {c.text || c.message}
              </Text>
            </View>
          </View>
        ))}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>

          <TextInput
            style={{
              flex: 1,
              backgroundColor: "#fff",
              borderRadius: 8,
              paddingHorizontal: 8,
              height: 34,
              borderColor: "#ccc",
              borderWidth: 1,
            }}
            placeholder="Leave a chirp..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
          />
          <TouchableOpacity
            onPress={handleChirp}
            disabled={loading || !message.trim()}
            style={{
              marginLeft: 6,
              backgroundColor: "#1E3A8A",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
              opacity: loading || !message.trim() ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Chirp</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [blockedFriends, setBlockedFriends] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [userFriendsMap, setUserFriendsMap] = useState<{ [uid: string]: string[] }>({});

  const currentUser = auth.currentUser;
  const router = useRouter();

  const getMutualFriendsCount = (userId: string) => {
    const theirFriends = userFriendsMap[userId] || [];
    if (!theirFriends.length || !friends.length) return 0;
    return friends.filter(fid => theirFriends.includes(fid)).length;
  };

  useEffect(() => {
    const fetchUsersAndFriends = async () => {
      if (!currentUser) return;
      try {
        const friendsRef = collection(db, 'profiles', currentUser.uid, 'friends');
        const friendsSnap = await getDocs(friendsRef);
        const friendIds = friendsSnap.docs.map((d) => d.id);
        setFriends(friendIds);

        const requestsRef = collection(db, 'profiles', currentUser.uid, 'friendRequests');
        const requestsSnap = await getDocs(requestsRef);
        const requests = requestsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPendingRequests(requests);

        const snapshot = await getDocs(collection(db, 'profiles'));
        const users = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const tempMap: { [uid: string]: string[] } = {};
        for (let u of users) {
          try {
            const uFriendsRef = collection(db, 'profiles', u.id, 'friends');
            const uFriendsSnap = await getDocs(uFriendsRef);
            tempMap[u.id] = uFriendsSnap.docs.map((d) => d.id);
          } catch (err) {
            console.warn(`Could not fetch friends for ${u.id}:`, err);
            tempMap[u.id] = [];
          }
        }
        setUserFriendsMap(tempMap);

        const currentFriends = new Set(friendIds);
        const usersWithMutuals = users.map((u) => {
          const theirFriends = tempMap[u.id] || [];
          const mutuals = theirFriends.filter((fid) => currentFriends.has(fid));
          return {
            ...u,
            mutualCount: mutuals.length,
            mutualIds: mutuals,
          };
        });
        setAllUsers(usersWithMutuals);

        let activities: any[] = [];
        for (let friendId of friendIds) {
          const checkinsRef = collection(db, 'profiles', friendId, 'checkins');
          const checkinSnap = await getDocs(
            query(checkinsRef, orderBy('timestamp', 'desc'), limit(3))
          );
          checkinSnap.docs.forEach((doc) => {
            activities.push({
              id: doc.id,
              friendId,
              type: "checkin",
              ...doc.data(),
            });
          });

          const activityRef = collection(db, 'profiles', friendId, 'activity');
          const activitySnap = await getDocs(
            query(activityRef, orderBy('timestamp', 'desc'), limit(5))
          );
          activitySnap.docs.forEach((doc) => {
            activities.push({
              id: doc.id,
              friendId,
              ...doc.data(),
            });
          });
        }

        const safeActivities = activities.filter(
          (a) => !blockedFriends.some((b) => b.id === a.friendId)
        );
        setFeed(safeActivities.slice(0, 10));

        const blockedRef = collection(db, 'profiles', currentUser.uid, 'blocked');
        const blockedSnap = await getDocs(blockedRef);
        const blockedIds = blockedSnap.docs.map((d) => d.id);
        const blockedList = users.filter((u) => blockedIds.includes(u.id));
        setBlockedFriends(blockedList);
      } catch (error) {
        console.error('Error fetching users or feed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndFriends();
  }, []);

  const handleSendRequest = async (userId: string) => {
    if (!currentUser) return;
    try {
      const requestRef = doc(db, 'profiles', userId, 'friendRequests', currentUser.uid);
      await setDoc(requestRef, { fromId: currentUser.uid, createdAt: new Date() });
      setSentRequests((prev) => [...prev, userId]);
      alert('Friend request sent!');
    } catch (err) {
      console.error('Error sending friend request:', err);
      alert('Failed to send friend request. Try again.');
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
    if (!currentUser) return;
    setFriends((prev) => [...prev, senderId]);
    setPendingRequests((prev) => prev.filter((r) => r.id !== senderId));
    try {
      await setDoc(doc(db, 'profiles', currentUser.uid, 'friends', senderId), {
        addedAt: new Date(),
      });
      await setDoc(doc(db, 'profiles', senderId, 'friends', currentUser.uid), {
        addedAt: new Date(),
      });
      await deleteDoc(doc(db, 'profiles', currentUser.uid, 'friendRequests', senderId));
      await logFriendship(senderId);
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  };

  const handleDenyRequest = async (senderId: string) => {
    if (!currentUser) return;
    setPendingRequests((prev) => prev.filter((r) => r.id !== senderId));
    try {
      await deleteDoc(doc(db, 'profiles', currentUser.uid, 'friendRequests', senderId));
    } catch (err) {
      console.error('Error denying friend request:', err);
    }
  };

  const handleUnfriend = async (friendId: string) => {
    if (!currentUser) return;
    const myRef = doc(db, 'profiles', currentUser.uid, 'friends', friendId);
    const theirRef = doc(db, 'profiles', friendId, 'friends', currentUser.uid);
    try {
      await deleteDoc(myRef);
      setFriends((prev) => prev.filter((id) => id !== friendId));
      setSelectedFriend(null);
      try {
        await deleteDoc(theirRef);
      } catch (err) {
        console.warn('Unfriend cleanup (their side) failed:', err);
      }
    } catch (err) {
      console.error('Error unfriending user:', err);
    }
  };

  const handleBlock = async (user: any) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'profiles', currentUser.uid, 'blocked', user.id), {
        blockedAt: new Date(),
      });
      setBlockedFriends((prev) => [...prev, user]);
      setFriends((prev) => prev.filter((id) => id !== user.id));
      setSelectedFriend(null);
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  };

  const handleUnblock = async (userId: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'profiles', currentUser.uid, 'blocked', userId));
      setBlockedFriends((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Error unblocking user:', err);
    }
  };

  const filteredUsers = allUsers.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !friends.includes(user.id) &&
      !sentRequests.includes(user.id) &&
      !blockedFriends.some((b) => b.id === user.id)
  );

  if (loading) return <LoadingPuck />;

  return (
    <ImageBackground
      source={require('@/assets/images/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.overlay}>
        <Text style={styles.title}>Friends</Text>

        {/* Search Bar */}
        <View style={styles.card}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for users..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {searchQuery.length > 0 && filteredUsers.length > 0 && (
            <>
              <Text style={styles.subheading}>Search Results</Text>
              {filteredUsers.map((item) => (
                <View key={item.id} style={styles.searchRow}>
                  <Image
                    source={
                      item.imageUrl
                        ? { uri: item.imageUrl }
                        : require('@/assets/images/icon.png')
                    }
                    style={styles.avatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>{item.name}</Text>
                    <Text style={styles.mutualText}>{item.location || 'No location set'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleSendRequest(item.id)}>
                    <Text style={styles.button}>Add Friend</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Pending Friend Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Pending Friend Requests</Text>
            {pendingRequests.map((req) => {
              const sender = allUsers.find((u) => u.id === req.id);
              return (
                <View key={req.id} style={styles.listRow}>
                  <Image
                    source={
                      sender?.imageUrl
                        ? { uri: sender.imageUrl }
                        : require('@/assets/images/icon.png')
                    }
                    style={styles.avatar}
                  />
                  <Text style={[styles.itemText, { flex: 1 }]}>
                    {sender?.name || 'Unknown User'}
                  </Text>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(req.id)}
                  >
                    <Text style={styles.buttonTextWhite}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.denyButton}
                    onPress={() => handleDenyRequest(req.id)}
                  >
                    <Text style={styles.buttonTextWhite}>Deny</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Your Friends */}
        {friends.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Your Friends</Text>
            {allUsers
              .filter((u) => friends.includes(u.id) && !blockedFriends.some((b) => b.id === u.id))
              .map((item) => (
                <View key={item.id} style={styles.listRow}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() =>
                      router.push({
                        pathname: '/userprofile/[userId]',
                        params: { userId: item.id },
                      })
                    }
                  >
                    <Image
                      source={
                        item.imageUrl
                          ? { uri: item.imageUrl }
                          : require('@/assets/images/icon.png')
                      }
                      style={styles.avatar}
                    />
                    <Text style={styles.itemText}>{item.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedFriend(item)}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#0A2940" />
                  </TouchableOpacity>
                </View>
              ))}
          </View>
        )}

        {/* Blocked Friends */}
        {blockedFriends.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Blocked Friends</Text>
            {blockedFriends.map((item) => (
              <View key={item.id} style={styles.listRow}>
                <Image
                  source={
                    item.imageUrl ? { uri: item.imageUrl } : require('@/assets/images/icon.png')
                  }
                  style={styles.avatar}
                />
                <Text style={[styles.itemText, { flex: 1 }]}>{item.name}</Text>
                <TouchableOpacity onPress={() => handleUnblock(item.id)}>
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Friends Activity */}
        {/* Friends Activity */}
        {feed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Friends Activity</Text>
            {feed.map((item, index) => {
              const friend = allUsers.find((u) => u.id === item.friendId);
              const time = item.timestamp?.seconds
                ? new Date(item.timestamp.seconds * 1000).toLocaleString()
                : "Unknown time";

              // === Check-in event ===
              if (item.type === "checkin") {
                const arenaName = item.arenaName ?? "Unknown arena";
                const league = item.league ?? "Unknown league";

                // ✅ pull colorCode from arenas.json
                const arenasData = require("@/assets/data/arenas.json");
                const arenaData = (arenasData as any[]).find(
                  (a) => a.arena === item.arenaName || a.arena === item.arena
                );
                const colorCode = arenaData?.colorCode || "#6B7280";
                const bgColor = colorCode + "22";

                return (
                  <TouchableOpacity
                    key={index}
                    style={{
                      backgroundColor: bgColor,
                      borderLeftColor: colorCode,
                      borderLeftWidth: 6,
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 12,
                      shadowColor: "#000",
                      shadowOpacity: 0.05,
                      shadowOffset: { width: 0, height: 1 },
                      shadowRadius: 3,
                      elevation: 2,
                    }}
                    onPress={() =>
                      router.push({
                        pathname: "/checkin/[checkinId]",
                        params: { checkinId: item.id, userId: item.friendId },
                      })
                    }
                  >
                    <View
                      style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        borderWidth: 1.5,
                        borderColor: colorCode,
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colorCode }}>
                        {league}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#0D2C42" }}>
                      {arenaName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: "#2F4F68",
                        marginBottom: 6,
                      }}
                    >
                      {item.teamName} vs {item.opponent}
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>
                        {new Date(
                          item.timestamp?.seconds ? item.timestamp.seconds * 1000 : Date.now()
                        ).toLocaleDateString()}
                      </Text>
                      <CheerButton friendId={item.friendId} checkinId={item.id} />
                    </View>

                    <ChirpBox friendId={item.friendId} checkinId={item.id} />
                  </TouchableOpacity>
                );
              }

              // === Cheer event ===
              if (item.type === "cheer") {
                const actor = allUsers.find((u) => u.id === item.actorId);
                return (
                  <View
                    key={index}
                    style={{
                      backgroundColor: "#dce3ff",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 12,
                      shadowColor: "#000",
                      shadowOpacity: 0.05,
                      shadowOffset: { width: 0, height: 1 },
                      shadowRadius: 3,
                      elevation: 2,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                      <Image
                        source={
                          actor?.imageUrl
                            ? { uri: actor.imageUrl }
                            : require("@/assets/images/icon.png")
                        }
                        style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
                      />
                      <Text style={{ fontSize: 15, color: "#0A2940" }}>
                        <Text style={{ fontWeight: "bold" }}>
                          {actor?.name || "Someone"}
                        </Text>{" "}
                        cheered a check-in 🎉
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>{time}</Text>
                  </View>
                );
              }

              // === Friendship event ===
              if (item.type === "friendship") {
                const userA = allUsers.find((u) => u.id === item.actorId);
                const userB = allUsers.find((u) => u.id === item.targetId);
                return (
                  <View
                    key={index}
                    style={{
                      backgroundColor: "#dce3ff",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 12,
                      shadowColor: "#000",
                      shadowOpacity: 0.05,
                      shadowOffset: { width: 0, height: 1 },
                      shadowRadius: 3,
                      elevation: 2,
                    }}
                  >
                    <Text style={{ fontSize: 15, color: "#0A2940" }}>
                      <Text style={{ fontWeight: "bold" }}>
                        {userA?.name || "Someone"}
                      </Text>{" "}
                      became friends with{" "}
                      <Text style={{ fontWeight: "bold" }}>
                        {userB?.name || "Someone"}
                      </Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                      {time}
                    </Text>
                  </View>
                );
              }

              // === Other activities fallback ===
              return (
                <View
                  key={index}
                  style={{
                    backgroundColor: "#dce3ff",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 12,
                    shadowColor: "#000",
                    shadowOpacity: 0.05,
                    shadowOffset: { width: 0, height: 1 },
                    shadowRadius: 3,
                    elevation: 2,
                  }}
                >
                  <Text style={{ fontSize: 15, color: "#0A2940" }}>
                    {item.message || "Unknown activity"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                    {time}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {selectedFriend && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{selectedFriend.name}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setSelectedFriend(null);
                  router.push({
                    pathname: '/userprofile/[userId]',
                    params: { userId: selectedFriend.id },
                  });
                }}
              >
                <Text style={styles.modalButtonText}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => handleUnfriend(selectedFriend.id)}
              >
                <Text style={styles.modalButtonText}>Unfriend</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => handleBlock(selectedFriend)}
              >
                <Text style={styles.modalButtonText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                onPress={() => setSelectedFriend(null)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 8,
  },
  denyButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 8,
  },
  button: {
    color: '#1E3A8A',
    fontWeight: 'bold'
  },
  buttonTextWhite: {
    color: '#fff',
    fontWeight: 'bold'
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 3,
    borderColor: '#2F4F68',
  },
  cheerButton: {
    backgroundColor: "#1E3A8A",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: "flex-end",
  },
  cheerButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  itemText: {
    fontSize: 16,
    color: '#0A2940'
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#0A2940',
    textAlign: 'center',
  },
  modalButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalButtonText: {
    fontSize: 16,
    color: '#1E3A8A'
  },
  mutualText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  overlay: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16
  },
  subheading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E3A8A',
    textAlign: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#0D2C42',
    marginTop: 30,
    marginBottom: 15,
    textAlign: 'center',
    textShadowColor: '#ffffff',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  unblockText: {
    color: '#1E3A8A',
    fontWeight: 'bold',
  },
});