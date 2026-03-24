import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [coupleData, setCoupleData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUser = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // ✅ Block unverified users — treat them as logged out
      if (firebaseUser && !firebaseUser.emailVerified) {
        setUser(null);
        setUserData(null);
        setCoupleData(null);
        setLoading(false);
        return;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        const userRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const uData = userDoc.data();
          setUserData(uData);

          const coupleDoc = await getDoc(doc(db, "couples", uData.coupleId));
          if (coupleDoc.exists()) setCoupleData({ id: coupleDoc.id, ...coupleDoc.data() });

          unsubUser = onSnapshot(userRef, (snap) => {
            if (snap.exists()) setUserData(snap.data());
          });
        }
      } else {
        setUser(null);
        setUserData(null);
        setCoupleData(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, []);

  const value = useMemo(() => ({
    user, userData, coupleData, loading, setCoupleData
  }), [user, userData, coupleData, loading]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};