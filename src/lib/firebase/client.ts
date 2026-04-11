import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBIU_ZOSwaWcX3H822OvrVv67D5ToJ3hrE",
  authDomain: "agent-name-29da3.firebaseapp.com",
  databaseURL: "https://agent-name-29da3.firebaseio.com",
  projectId: "agent-name-29da3",
  storageBucket: "agent-name-29da3.firebasestorage.app",
  messagingSenderId: "1054730966135",
  appId: "1:1054730966135:web:53aa41b15a94029558e272",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firebaseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
