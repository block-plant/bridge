import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./config";

export const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export const signUpAndCreateRoom = async (email, password, displayName) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  // Send verification email
  await sendEmailVerification(cred.user);

  const coupleId = `couple_${cred.user.uid}`;
  const inviteCode = generateInviteCode();

  await setDoc(doc(db, "couples", coupleId), {
    createdAt: new Date(), createdBy: cred.user.uid,
    inviteCode, members: [cred.user.uid], partnerJoined: false,
    anniversaryDate: null, coupleName: null,
  });

  await setDoc(doc(db, "users", cred.user.uid), {
    displayName, email, coupleId, role: "creator",
    createdAt: new Date(), mood: "😊", city: "",
  });

  return { user: cred.user, coupleId, inviteCode };
};

export const signUpAndJoinRoom = async (email, password, displayName, inviteCode) => {
  const q = query(collection(db, "couples"), where("inviteCode", "==", inviteCode.toUpperCase()));
  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err) {
    throw new Error(err.message);
  }

  if (snapshot.empty) throw new Error("Invalid invite code. Please check and try again.");

  const coupleDoc = snapshot.docs[0];
  const coupleData = coupleDoc.data();

  if (coupleData.partnerJoined) throw new Error("This couple room is already full.");

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  // Send verification email
  await sendEmailVerification(cred.user);

  const coupleId = coupleDoc.id;

  await updateDoc(doc(db, "couples", coupleId), {
    members: [...coupleData.members, cred.user.uid],
    partnerJoined: true, partnerJoinedAt: new Date(),
  });

  await setDoc(doc(db, "users", cred.user.uid), {
    displayName, email, coupleId, role: "partner",
    createdAt: new Date(), mood: "😊", city: "",
  });

  return { user: cred.user, coupleId };
};

export const signIn = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Block unverified users from signing in
  if (!cred.user.emailVerified) {
    await signOut(auth);
    throw new Error("Please verify your email before signing in. Check your inbox for the verification link.");
  }

  const userDoc = await getDoc(doc(db, "users", cred.user.uid));
  if (!userDoc.exists()) throw new Error("User data not found.");
  return { user: cred.user, userData: userDoc.data() };
};

export const resendVerificationEmail = async (email, password) => {
  // Sign in temporarily to get the user object, then send verification
  const cred = await signInWithEmailAndPassword(auth, email, password);
  if (cred.user.emailVerified) {
    throw new Error("Email is already verified. Please sign in.");
  }
  await sendEmailVerification(cred.user);
  await signOut(auth); // sign out again since they're not verified
};

export const logOut = () => signOut(auth);

export const getCoupleData = async (coupleId) => {
  const coupleDoc = await getDoc(doc(db, "couples", coupleId));
  return coupleDoc.exists() ? coupleDoc.data() : null;
};