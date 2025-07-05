// ========== FIREBASE CONFIG ========== //
const firebaseConfig = {
    apiKey: "AIzaSyDeksN3qPZCmNuoASlEqG38XVmag6ecTh8",
    authDomain: "satloom-rtc.firebaseapp.com",
    databaseURL: "https://satloom-rtc-default-rtdb.firebaseio.com",
    projectId: "satloom-rtc",
    storageBucket: "satloom-rtc.firebasestorage.app",
    messagingSenderId: "273627860564",
    appId: "1:273627860564:web:c326b1bb6ffcb32fb0e7c1"
};

// Public TURN server credentials
const turnConfig = {
    servers: [
        {
            urls: 'turn:global.turn.twilio.com:3478?transport=udp',
            username: 'satloom',
            credential: 'satloom123'
        },
        {
            urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
            username: 'satloom',
            credential: 'satloom123'
        },
        {
            urls: 'turn:numb.viagenie.ca:3478',
            username: 'satloom@satloom.com',
            credential: 'satloom123'
        },
        {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            username: 'satloom',
            credential: 'satloom123'
        }
    ]
};
