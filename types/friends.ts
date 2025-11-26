TypeScript// types/friends.ts
export interface Profile {
  id: string;
  name: string;
  imageUrl?: string | null;
  location?: string;
  favouriteTeam?: string;
}

export interface Checkin {
  id: string;
  timestamp: any;
  arenaName?: string;
  arena?: string;
  league?: string;
  teamName?: string;
  opponent?: string;
  userId: string;
}

export interface ActivityItem {
  id: string;
  friendId: string;
  type: "checkin" | "cheer" | "friendship" | string;
  timestamp: any;
  [key: string]: any;
}

export interface Chirp {
  id: string;
  userId: string;
  userName: string;
  userImage?: string | null;
  text: string;
  timestamp: any;
}