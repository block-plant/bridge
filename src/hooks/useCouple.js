import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

export const useCouple = () => {
  const { userData, coupleData } = useAuth();
  const [partner, setPartner] = useState(null);

  useEffect(() => {
    if (!coupleData) return;

    if (!coupleData.members || coupleData.members.length < 2) return;

    const partnerUid = coupleData.members.find(
      (id) => id !== coupleData.createdBy || coupleData.members.indexOf(id) !== 0
    );

    if (!partnerUid) return;

    const unsub = onSnapshot(doc(db, "users", partnerUid), (snap) => {
      if (snap.exists()) setPartner({ id: snap.id, ...snap.data() });
    });

    return () => unsub();
  }, [coupleData, userData]);

  const updateMood = async (mood) => {
    if (!userData) return;
    await updateDoc(doc(db, "users", coupleData.members[0] === userData.coupleId ? coupleData.members[0] : coupleData.members.find(id => id !== partner?.id)), { mood });
  };

  const setNextMeetup = async (date) => {
    if (!coupleData) return;
    await updateDoc(doc(db, "couples", coupleData.id), { nextMeetup: date });
  };

  const setAnniversary = async (date) => {
    if (!coupleData) return;
    await updateDoc(doc(db, "couples", coupleData.id), { anniversaryDate: date });
  };

  return { partner, updateMood, setNextMeetup, setAnniversary };
};