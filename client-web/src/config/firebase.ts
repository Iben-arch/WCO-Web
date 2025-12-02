import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBWoEbC3wKJPUXMEBr5c44qKAdhoqIu8zE",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "oct-center.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "oct-center",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "oct-center.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "843369793424",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:843369793424:web:60ed7adbe3d5daa7825515"
};

// Initialize Firebase
let app: FirebaseApp | undefined;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log('✅ Firebase initialized successfully for project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  console.error('Please check your Firebase configuration');
}

export { auth, db, storage };
export default app;

