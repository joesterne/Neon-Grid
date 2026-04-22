import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration priority:
// 1. Environment Secrets (VITE_FIREBASE_*)
// 2. AI Studio provisioned config (firebase-applet-config.json)
const getFirebaseConfig = () => {
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DB_ID?.trim() || '(default)'
  };

  if (envConfig.apiKey && envConfig.apiKey.startsWith('AIza')) {
    return envConfig;
  }

  // Fallback conditionally to the local auto-generated file.
  // Using import.meta.glob instead of static import ensures the Vite build
  // won't permanently break if someone clones this repository from GitHub
  // and the file is missing (since it's in .gitignore).
  try {
    const localConfigs = import.meta.glob('../firebase-applet-config.json', { eager: true });
    const localPath = '../firebase-applet-config.json';
    if (localConfigs && localConfigs[localPath]) {
      const localConfig = (localConfigs[localPath] as any).default || localConfigs[localPath];
      if (localConfig && localConfig.apiKey && localConfig.apiKey.startsWith('AIza')) {
        return {
          apiKey: localConfig.apiKey,
          authDomain: localConfig.authDomain,
          projectId: localConfig.projectId,
          storageBucket: localConfig.storageBucket,
          messagingSenderId: localConfig.messagingSenderId,
          appId: localConfig.appId,
          firestoreDatabaseId: localConfig.firestoreDatabaseId || '(default)'
        };
      }
    }
  } catch (err) {
    // silently ignore import errors
  }

  console.warn(
    "FIREBASE CONFIGURATION MISSING: Please ensure you've configured your Firebase variables in the secrets panel."
  );
  return null;
};

const config = getFirebaseConfig();

// Initialize Firebase only if we have a valid configuration
const app = config ? initializeApp(config) : null;
export const db = (app && config) ? getFirestore(app, config.firestoreDatabaseId) : ({} as any);
export const auth = app ? getAuth(app) : ({} as any);
export const isFirebaseConfigured = !!app;
