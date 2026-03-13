import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAcqOs52mATb9_4v95Ut_ygrpl4X_F9Mpw",
  authDomain: "hackathon-hack-1.firebaseapp.com",
  projectId: "hackathon-hack-1",
  storageBucket: "hackathon-hack-1.firebasestorage.app",
  messagingSenderId: "380007612968",
  appId: "1:380007612968:web:f7348b4b446278cd53ab1d"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);