// The web settings of the Firebase project (not a secret: they are in every web page that uses Firebase). While this is null
// the top list is not connected: the best score and the name are only kept on this device.
//
// To connect it: in the Firebase console of the project, add a web app (Project settings > Your apps > Web) and create the
// Firestore database, then paste the settings that the console shows over null, and deploy the rules (firestore.rules).
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const FIREBASE_CONFIG: FirebaseWebConfig | null = null;
