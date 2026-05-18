import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUunv1VCqselof5V6Jqj3gMthoer_fguE",
  authDomain: "fazendinha-7489e.firebaseapp.com",
  projectId: "fazendinha-7489e",
  storageBucket: "fazendinha-7489e.firebasestorage.app",
  messagingSenderId: "79868797370",
  appId: "1:79868797370:web:f995a32f2320b9b2de3d83"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const googleProvider = new GoogleAuthProvider();

export function listenAuthState(callback){
  return onAuthStateChanged(auth, callback);
}

export function loginWithGoogle(){
  return signInWithPopup(auth, googleProvider);
}

export function loginAnonymously(){
  return signInAnonymously(auth);
}

export function logoutFirebase(){
  return signOut(auth);
}

export async function saveGameDocument(uid, data){
  return setDoc(doc(db, 'games', uid), {
    ...data,
    savedAt: serverTimestamp()
  });
}

export async function loadGameDocument(uid){
  const snap = await getDoc(doc(db, 'games', uid));
  return snap.exists() ? snap.data() : null;
}
