import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';

interface UserProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  wins: number;
  totalGames: number;
  fastestGame?: number;
  longestSurvivalTime?: number;
  achievements: string[];
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  isBypassed: boolean;
  bypassAuth: () => void;
  unlockAchievement: (id: string) => Promise<void>;
  recordGameStats: (won: boolean, timeElapsed: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isConfigured: true,
  isBypassed: false,
  bypassAuth: () => {},
  unlockAchievement: async () => {},
  recordGameStats: async () => {}
});

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBypassed, setIsBypassed] = useState(false);

  const bypassAuth = () => {
    setIsBypassed(true);
    const mockUser = {
      uid: 'simulation-guest-' + Math.random().toString(36).substr(2, 9),
      displayName: 'SIM_USER',
      photoURL: null,
      isAnonymous: true,
    } as User;
    setUser(mockUser);
    setProfile({
      uid: mockUser.uid,
      displayName: 'SIMULATION_USER',
      photoURL: null,
      wins: 0,
      totalGames: 0,
      fastestGame: 0,
      longestSurvivalTime: 0,
      achievements: []
    });
    setLoading(false);
  };

  const unlockAchievement = async (achievementId: string) => {
    if (!user || !profile || isBypassed) return;
    if (profile.achievements.includes(achievementId)) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        achievements: Array.from(new Set([...profile.achievements, achievementId]))
      }, { merge: true });
    } catch (error) {
      console.error("FAILED_TO_UNLOCK_ACHIEVEMENT:", error);
    }
  };

  const recordGameStats = async (won: boolean, timeElapsed: number) => {
    if (!user || !profile || isBypassed) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      
      const newTotalGames = Math.max((profile.totalGames || 0) + 1, 0); // clamp positive
      let newWins = profile.wins || 0;
      let newFastestGame = profile.fastestGame;
      let newLongestSurvival = profile.longestSurvivalTime;

      if (won) {
        newWins += 1;
        if (!newFastestGame || timeElapsed < newFastestGame) {
          newFastestGame = timeElapsed;
        }
      }
      
      if (!newLongestSurvival || timeElapsed > newLongestSurvival) {
        newLongestSurvival = timeElapsed;
      }

      await setDoc(userRef, {
        totalGames: newTotalGames,
        wins: newWins,
        fastestGame: newFastestGame,
        longestSurvivalTime: newLongestSurvival
      }, { merge: true });

    } catch (error) {
      console.error("FAILED_TO_RECORD_GAME_STATS:", error);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        
        if (u) {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName,
              photoURL: u.photoURL,
              wins: 0,
              totalGames: 0,
              fastestGame: 0,
              longestSurvivalTime: 0,
              achievements: []
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            setProfile(userSnap.data() as UserProfile);
            const unsubscribeProfile = onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setProfile(doc.data() as UserProfile);
              }
            });
            // We can't easily return the unsubscribe from here as it's an async closure
            // but we can store it in a ref if needed. 
            // For now, let's keep it simple.
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("FIREBASE_SYNC_CRITICAL_FAILURE:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isConfigured: isFirebaseConfigured, 
      isBypassed,
      bypassAuth, 
      unlockAchievement,
      recordGameStats
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
