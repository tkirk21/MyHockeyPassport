// app/(tabs)/friends.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firebaseApp from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, setDoc,  } from 'firebase/firestore';

import { logFriendship, logCheer } from "../../utils/activityLogger";
import LoadingPuck from "../../components/loadingPuck";
import CheerButton from '@/components/friends/cheerButton';
import ChirpBox from '@/components/friends/chirpBox';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const arenasData = require("@/assets/data/arenas.json");
const arenaHistory = require("@/assets/data/arenaHistory.json");
const historicalTeams = require("@/assets/data/historicalTeams.json");

const resolveTeamName = (item: any): string => {
  return (
    item.teamName ||
    item.team ||
    item.homeTeam ||
    item.team_name || // legacy
    "Unknown"
  );
};

const resolveTeamCode = (item: any): string | null => {
  return (
    item.teamCode ||
    item.team_code ||
    item.homeTeamCode ||
    item.team_code_alt ||
    null
  );
};

const resolveArenaName = (item: any): string => {
  return (
    item.arenaName ||
    item.arena ||
    item.locationArena ||
    item.venue ||
    item.arena_name || // older format
    item.checkinArena ||
    item.arenaSelected ||
    "Unknown arena"
  );
};

const getTimestamp = (ts: any): Date => {
  if (!ts) return new Date(0);
  if (ts.seconds) return new Date(ts.seconds * 1000);        // Firestore Timestamp object (seconds + nanoseconds)
  if (ts instanceof Date) return ts;                         // JS Date object passed directly
  if (typeof ts === "string") return new Date(ts);           // ISO string (unlikely but safe)

  return new Date(0);
};

export default function FriendsTab() {

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

        // Load sent friend requests (safe mode)
        let sentList: string[] = [];
        try {
          const sentRef = collection(db, "profiles", currentUser.uid, "sentFriendRequests");
          const sentSnap = await getDocs(sentRef);
          sentList = sentSnap.docs.map((d) => d.id);
        } catch (err) {
          console.warn("Could not load sentFriendRequests:", err);
        }
        setSentRequests(sentList);

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
            const data = doc.data();

            activities.push({
              id: doc.id,
              friendId,
              type: data.type || "unknown",   // normalize type
              ...data,
            });
          });
        }

        const safeActivities = activities.filter(
          (a) => !isBlocked(a.friendId)
        );
        setFeed(
          safeActivities
            .sort((a, b) => getTimestamp(b.timestamp).getTime() - getTimestamp(a.timestamp).getTime())
            .slice(0, 10)
        );

        const blockedRef = collection(db, 'profiles', currentUser.uid, 'blocked');
        const blockedSnap = await getDocs(blockedRef);
        const blockedIds = blockedSnap.docs.map((d) => d.id);
        const blockedList = blockedIds
          .map((id) => users.find((u) => u.id === id))
          .filter((u) => u)                                // remove nulls
          .map((u) => ({
            id: u.id,
            name: u.name || "Unknown",
            imageUrl: u.imageUrl || null,
            location: u.location || "",
          }));

        setBlockedFriends(blockedList);
      } catch (error) {
        console.error('Error fetching users or feed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndFriends();
  }, []);

  // Live feed updates — safe, no duplicates, friends list untouched
  useEffect(() => {
    if (!currentUser || friends.length === 0) return;

    const unsubs: (() => void)[] = [];

    friends.forEach(friendId => {
      if (isBlocked(friendId)) return;

      // Only new check-ins
      const checkinsQuery = query(
        collection(db, 'profiles', friendId, 'checkins'),
        orderBy('timestamp', 'desc')
      );

      const unsubCheckins = onSnapshot(checkinsQuery, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            const newItem = {
              id: change.doc.id,
              friendId,
              type: "checkin",
              ...data
            };

            setFeed(prev => {
              if (prev.some(i => i.id === newItem.id && i.type === "checkin")) return prev;
              return [...prev, newItem]
                .sort((a, b) => getTimestamp(b.timestamp).getTime() - getTimestamp(a.timestamp).getTime())
                .slice(0, 10);
            });
          }
        });
      });
      unsubs.push(unsubCheckins);

      // Only new activity (cheers, friendships)
      const activityQuery = query(
        collection(db, 'profiles', friendId, 'activity'),
        orderBy('timestamp', 'desc')
      );

      const unsubActivity = onSnapshot(activityQuery, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            const newItem = {
              id: change.doc.id,
              friendId,
              ...data
            };

            setFeed(prev => {
              if (prev.some(i => i.id === newItem.id)) return prev;
              return [...prev, newItem]
                .sort((a, b) => getTimestamp(b.timestamp).getTime() - getTimestamp(a.timestamp).getTime())
                .slice(0, 10);
            });
          }
        });
      });
      unsubs.push(unsubActivity);
    });

    return () => unsubs.forEach(u => u());
  }, [currentUser, friends, blockedFriends]);

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

  const isBlocked = (userId: string) => {
    return blockedFriends.some((u) => u.id === userId);
  };

  const filteredUsers = allUsers.filter(
    (user) =>
      user.id !== currentUser.uid && // ⬅️ NEW — prevent showing yourself
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !friends.includes(user.id) &&
      !sentRequests.includes(user.id) &&
      !blockedFriends.some((b) => b.id === user.id)
  );

  if (loading) {
    return (
      <View style={styles.loadingOverlay}>
        <LoadingPuck />
      </View>
    );
  }

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
              .filter((u) => friends.includes(u.id) && !isBlocked(u.id))
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
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedFriend({
                        id: item.id,
                        name: item.name || "Unknown",
                        imageUrl: item.imageUrl || null,
                      })
                    }
                  >
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
        {feed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subheading}>Friends Activity</Text>
            {feed.map((item, index) => {
              const friend = allUsers.find((u) => u.id === item.friendId);
              const friendName = friend?.name || "Unknown User";
              const friendImage = friend?.imageUrl || null;
              const time = getTimestamp(item.timestamp).toLocaleString();

              // === Check-in event ===
              if (item.type === "checkin") {
                const arenaName = resolveArenaName(item);
                const league = item.league || item.leagueName || item.league_code || "Unknown league";
                const teamCode = resolveTeamCode(item);
                const teamName = resolveTeamName(item);

                let arenaData: any = null;

                // 1. Try to match CURRENT arenas (exact + league-safe)
                arenaData = (arenasData as any[]).find(
                  (a) =>
                    a.league === item.league &&
                    (
                      a.arena === item.arenaName ||
                      a.arena === item.arena
                    )
                );

                // 2. If not found, try ARENA HISTORY names (old arenas)
                if (!arenaData) {
                  const historyEntry = (arenaHistory as any[]).find(
                    (h) =>
                      h.league === item.league &&
                      h.teamName === resolveTeamName(item) &&
                      h.history.some(
                        (old) =>
                          old.name === item.arenaName ||
                          old.name === item.arena
                      )
                  );

                  if (historyEntry) {
                    arenaData = (arenasData as any[]).find(
                      (a) =>
                        a.league === historyEntry.league &&
                        a.teamName === historyEntry.teamName &&
                        a.arena === historyEntry.currentArena
                    );
                  }
                }

                // 3. If still not found → historical teams (relocated, renamed, folded)
                if (!arenaData) {
                  arenaData = (historicalTeams as any[]).find(
                    (h) =>
                      h.league === item.league &&
                      (
                        h.teamName === resolveTeamName(item) ||
                        h.teamCode === resolveTeamCode(item)
                      )
                  );
                }

                // === Final fallback color safety ===
                const colorCode = arenaData?.colorCode || "#6B7280";
                const bgColor = `${colorCode}22`;

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
                      {resolveTeamName(item)} vs {resolveTeamName(item.opponent ? { teamName: item.opponent } : item)}
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
                        {getTimestamp(item.timestamp).toLocaleDateString()}
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
                          {actor?.name || "Unknown User"}
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
                        {userA?.name || "Unknown User"}
                      </Text>{" "}
                      became friends with{" "}
                      <Text style={{ fontWeight: "bold" }}>
                        {userB?.name || "Unknown User"}
                      </Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                      {getTimestamp(item.timestamp).toLocaleString()}
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
                    {getTimestamp(item.timestamp).toLocaleString()}
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
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff", // or your background color
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