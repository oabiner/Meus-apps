import { initializeApp } from 'firebase/app';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig;

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  firebaseConfig = JSON.parse(configData);
} catch (error) {
  console.error('Error reading firebase-applet-config.json:', error);
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
setLogLevel('silent');
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
