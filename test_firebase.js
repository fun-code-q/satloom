const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, remove } = require('firebase/database');
const { getAuth, signInAnonymously } = require('firebase/auth');
const fs = require('fs');

// Simple manual .env parser so we don't need dotenv
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        env[match[1]] = match[2];
    }
});

const config = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log("Config loaded, projectId:", config.projectId, "databaseURL:", config.databaseURL);

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
        console.error("TEST FAILED");
        console.error("Message:", error.message);
        if (error.code) console.error("Code:", error.code);
    }
    process.exit(0);
}

runTest();
