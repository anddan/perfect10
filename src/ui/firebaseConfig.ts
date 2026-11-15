// The web settings of the Firebase project perfect10-190ed (not a secret: they are in every web page that uses Firebase; what keeps the data
// safe is the rules, see firestore.rules). If this is null the top list is not connected: the best score and the name are then only kept on
// this device. The settings are those of the web app "Perfect 10" of the project (`firebase apps:sdkconfig`).
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const FIREBASE_CONFIG: FirebaseWebConfig | null = {
  apiKey: "AIzaSyAJmW_fqDoU7B3MzW8H8B9EG_fuqHjqtJw",
  authDomain: "perfect10-190ed.firebaseapp.com",
  projectId: "perfect10-190ed",
  storageBucket: "perfect10-190ed.firebasestorage.app",
  messagingSenderId: "641696714310",
  appId: "1:641696714310:web:d381a8c90445d4392ec447",
};
