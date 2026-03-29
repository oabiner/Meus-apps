import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDSXSkp9-BzoMxn0slTFhaDf3tNQwMREL8",
  authDomain: "gen-lang-client-0961584770.firebaseapp.com",
  projectId: "gen-lang-client-0961584770",
  storageBucket: "gen-lang-client-0961584770.firebasestorage.app",
  messagingSenderId: "549289166593",
  appId: "1:549289166593:web:2ed81b5710df06d6143d00"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
