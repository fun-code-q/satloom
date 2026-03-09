import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log("Initializing with config:", {
    ...config,
    apiKey: config.apiKey ? "***" : "missing",
});

const app = initializeApp(config);
const auth = getAuth(app);
const db = getDatabase(app);

async function runTest() {
    try {
        console.log("1. Signing in anonymously...");
        const userCred = await signInAnonymously(auth);
        console.log("Signed in with UID:", userCred.user.uid);

        const testRoomId = `test_room_${Date.now()}`;
        const messageRef = ref(db, `rooms/${testRoomId}/messages/test_msg`);

        console.log(`2. Attempting to write message to rooms/${testRoomId}/messages/test_msg...`);
        await set(messageRef, {
            text: "Hello World",
            sender: "TestScript",
            timestamp: Date.now(),
            roomId: testRoomId,
        });
        console.log("WRITE SUCCESS!");

        console.log(`3. Attempting to read from rooms/${testRoomId}/messages...`);
        const snapshot = await get(ref(db, `rooms/${testRoomId}/messages`));
        console.log("READ SUCCESS! Data:", snapshot.val());

        console.log(`4. Cleaning up...`);
        await remove(ref(db, `rooms/${testRoomId}`));
        console.log("CLEANUP SUCCESS!");

    } catch (error) {
        console.error("TEST FAILED:", error.message);
        if (error.code) {
            console.error("Error Code:", error.code);
        }
    } process.exit(0);
}

runTest();
