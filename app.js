// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========== STATE MANAGEMENT ========== //
const appState = {
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    roomId: null,
    isInitiator: false,
    isStarted: false,
    timer: null,
    startTime: null,
    currentMode: 'audio-call',
    userId: generateUserId(),
    chatRef: null,
    sidebarVisible: false
};

// ========== DOM ELEMENT REFERENCES ========== //
const domRefs = {
    sidebarToggle: document.getElementById('sidebarToggle'),
    themeToggle: document.getElementById('themeToggle'),
    notification: document.getElementById('globalNotification'),
    notificationTitle: document.getElementById('notificationTitle'),
    notificationMessage: document.getElementById('notificationMessage'),
    connectionStatus: document.getElementById('connectionStatus'),
    statusText: document.getElementById('statusText'),
    audioCallTimer: document.getElementById('audioCallTimer'),
    videoCallTimer: document.getElementById('videoCallTimer'),
    sections: {
        'audio-call': document.getElementById('audio-call-section'),
        'video-call': document.getElementById('video-call-section'),
        'settings': document.getElementById('settings-section'),
        'about': document.getElementById('about-section')
    }
};

// ========== WEBRTC CONFIG ========== //
const pcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// ========== SECTION ACTIVATION ========== //
function activateSection(sectionId) {
    // Update navigation state
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });
    
    // Update UI sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        if (section.id === `${sectionId}-section`) {
            section.classList.add('active');
        }
    });
    
    appState.currentMode = sectionId;
}

// ========== INITIALIZATION ========== //
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    setupEventListeners();
    loadSettings();
    autoJoinRoom();
    updateSidebarToggleIcon();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    // Theme toggle
    domRefs.themeToggle.addEventListener('click', toggleTheme);
    
    // Sidebar toggle
    domRefs.sidebarToggle.addEventListener('click', toggleSidebar);

    // Audio call controls
    document.getElementById('generateAudioRoom').addEventListener('click', () => generateRoom('audio'));
    document.getElementById('joinAudioRoom').addEventListener('click', () => joinRoom('audio'));
    document.getElementById('endAudioCall').addEventListener('click', () => hangup('audio'));
    document.getElementById('audioAudioToggle').addEventListener('click', () => toggleAudio('audio'));
    document.getElementById('copyAudioLink').addEventListener('click', () => copyLink('audio'));

    // Video call controls
    document.getElementById('generateVideoRoom').addEventListener('click', () => generateRoom('video'));
    document.getElementById('joinVideoRoom').addEventListener('click', () => joinRoom('video'));
    document.getElementById('endVideoCall').addEventListener('click', () => hangup('video'));
    document.getElementById('videoVideoToggle').addEventListener('click', toggleVideo);
    document.getElementById('videoAudioToggle').addEventListener('click', () => toggleAudio('video'));
    document.getElementById('copyVideoLink').addEventListener('click', () => copyLink('video'));

    // Settings
    document.getElementById('notifications-toggle').addEventListener('change', saveSettings);
    document.getElementById('notification-sound-toggle').addEventListener('change', saveSettings);
}

function loadSettings() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.className = `${savedTheme}-mode`;
    domRefs.themeToggle.innerHTML = savedTheme === 'dark' ? 
        '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';

    document.getElementById('notifications-toggle').checked = 
        localStorage.getItem('notifications') !== 'false';
    document.getElementById('notification-sound-toggle').checked = 
        localStorage.getItem('notificationSound') !== 'false';
    
    // Load sidebar state
    appState.sidebarVisible = localStorage.getItem('sidebarVisible') === 'true';
    updateSidebarState();
}

function autoJoinRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const modeParam = urlParams.get('mode');
    
    if (roomParam && modeParam) {
        // Activate the correct section based on mode
        if (modeParam === 'video') {
            activateSection('video-call');
        } else {
            activateSection('audio-call');
        }
        
        document.getElementById(`${modeParam}-room-id`).value = roomParam;
        setTimeout(() => joinRoom(modeParam), 1000);
    }
}

function generateUserId() {
    // Generate a random user ID for chat
    if (!localStorage.getItem('userId')) {
        const userId = 'user-' + Math.random().toString(36).substr(2, 8);
        localStorage.setItem('userId', userId);
    }
    return localStorage.getItem('userId');
}

// ========== SIDEBAR MANAGEMENT ========== //
function toggleSidebar() {
    appState.sidebarVisible = !appState.sidebarVisible;
    localStorage.setItem('sidebarVisible', appState.sidebarVisible);
    updateSidebarState();
}

function updateSidebarState() {
    if (appState.sidebarVisible) {
        document.body.classList.add('sidebar-visible');
    } else {
        document.body.classList.remove('sidebar-visible');
    }
    updateSidebarToggleIcon();
}

function updateSidebarToggleIcon() {
    domRefs.sidebarToggle.innerHTML = appState.sidebarVisible ? 
        '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
}

// ========== NAVIGATION ========== //
function handleNavigation(e) {
    e.preventDefault();
    const sectionId = this.getAttribute('data-section');
    activateSection(sectionId);
}

// ========== THEME MANAGEMENT ========== //
function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode', !isDark);
    document.body.classList.toggle('light-mode', isDark);
    domRefs.themeToggle.innerHTML = isDark ? 
        '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// ========== NOTIFICATION SYSTEM ========== //
function showNotification(title, message, type = 'info') {
    if (!document.getElementById('notifications-toggle').checked) return;
    
    domRefs.notification.style.display = 'flex';
    domRefs.notificationTitle.textContent = title;
    domRefs.notificationMessage.textContent = message;
    
    // Set notification color based on type
    domRefs.notification.style.backgroundColor = 
        type === 'error' ? 'rgba(244, 67, 54, 0.8)' :
        type === 'success' ? 'rgba(76, 175, 80, 0.8)' :
        'rgba(58, 123, 213, 0.8)';
    
    setTimeout(() => {
        domRefs.notification.style.display = 'none';
    }, 3000);
}

// ========== STATUS UPDATES ========== //
function updateStatus(text, isConnected = false) {
    domRefs.statusText.textContent = text;
    domRefs.connectionStatus.className = 
        `status-indicator ${isConnected ? 'status-connected' : ''}`;
}

// ========== TIMER MANAGEMENT ========== //
function startTimer() {
    appState.startTime = Date.now();
    appState.timer = setInterval(() => {
        const time = Date.now() - appState.startTime;
        const minutes = Math.floor(time / 60000);
        const seconds = Math.floor((time % 60000) / 1000);
        const timerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        domRefs.videoCallTimer.textContent = timerText;
        domRefs.audioCallTimer.textContent = timerText;
    }, 1000);
}

function stopTimer() {
    clearInterval(appState.timer);
    domRefs.videoCallTimer.textContent = '00:00';
    domRefs.audioCallTimer.textContent = '00:00';
}

// ========== MEDIA MANAGEMENT ========== //
async function initMedia(mode) {
    try {
        const constraints = mode === 'video' ? 
            { video: true, audio: true } : { audio: true };
        
        appState.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (mode === 'video') {
            document.getElementById('video-local-video').srcObject = appState.localStream;
            document.getElementById('videoControls').style.display = 'flex';
        } else {
            document.getElementById('audioControls').style.display = 'flex';
        }
        
        return true;
    } catch (err) {
        console.error('Media access error:', err);
        showNotification('Media Error', 
            `Could not access ${mode === 'video' ? 'camera/microphone' : 'microphone'}. 
            Please check permissions.`, 'error');
        return false;
    }
}

// ========== WEBRTC CONNECTION MANAGEMENT ========== //
function createPeerConnection() {
    try {
        appState.peerConnection = new RTCPeerConnection(pcConfig);
        
        // Add local stream tracks
        if (appState.localStream) {
            appState.localStream.getTracks().forEach(track => {
                appState.peerConnection.addTrack(track, appState.localStream);
            });
        }
        
        // Set up event handlers
        appState.peerConnection.ontrack = handleRemoteStream;
        appState.peerConnection.onicecandidate = handleICECandidate;
        appState.peerConnection.oniceconnectionstatechange = handleICEConnectionStateChange;
        
        return true;
    } catch (err) {
        console.error('Peer connection error:', err);
        showNotification('Connection Error', 
            `Failed to create peer connection: ${err.message}`, 'error');
        return false;
    }
}

function handleRemoteStream(event) {
    console.log('Remote stream received');
    const remoteVideo = document.getElementById('video-remote-video');
    remoteVideo.srcObject = event.streams[0];
    appState.remoteStream = event.streams[0];
    
    // Hide spinner when video starts playing
    document.getElementById('videoSpinner').style.display = 'none';
}

function handleICECandidate(event) {
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
        });
    }
}

function handleICEConnectionStateChange() {
    if (appState.peerConnection.iceConnectionState === 'disconnected') {
        hangup(appState.currentMode);
    }
}

// ========== SIGNALING ========== //
function initSignaling() {
    const dbRef = database.ref(`rooms/${appState.roomId}/messages`);
    
    dbRef.on('child_added', snapshot => {
        const message = JSON.parse(snapshot.val());
        
        if (!appState.peerConnection) createPeerConnection();
        
        switch (message.type) {
            case 'offer':
                if (!appState.isInitiator && !appState.isStarted) {
                    handleOffer(message);
                }
                break;
            case 'answer':
                if (appState.isStarted) {
                    appState.peerConnection.setRemoteDescription(
                        new RTCSessionDescription(message));
                }
                break;
            case 'candidate':
                if (appState.isStarted) {
                    appState.peerConnection.addIceCandidate(
                        new RTCIceCandidate(message));
                }
                break;
            case 'bye':
                if (appState.isStarted) {
                    hangup(appState.currentMode);
                }
                break;
        }
    });
}

async function handleOffer(offer) {
    await appState.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer));
    
    const answer = await appState.peerConnection.createAnswer();
    await appState.peerConnection.setLocalDescription(answer);
    
    sendMessage(answer);
    appState.isStarted = true;
    startTimer();
    updateStatus(`In ${appState.currentMode} call (${appState.roomId})`, true);
}

function sendMessage(message) {
    const dbRef = database.ref(`rooms/${appState.roomId}/messages`);
    dbRef.push(JSON.stringify(message));
}

// ========== ROOM MANAGEMENT ========== //
async function generateRoom(mode) {
    appState.roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Update UI
    document.getElementById(`${mode}-room-id`).value = appState.roomId;
    
    // FIXED: Include the correct path in the generated link
    const basePath = location.origin + location.pathname;
    const roomLink = `${basePath}?room=${appState.roomId}&mode=${mode}`;
    
    document.getElementById(`${mode}RoomLink`).textContent = roomLink;
    document.getElementById(`${mode}RoomLinkContainer`).style.display = 'block';
    
    showNotification('Room Generated', `Room ID: ${appState.roomId}. Share with others.`, 'success');
    
    // Initialize media and connection
    const mediaInitialized = await initMedia(mode);
    if (!mediaInitialized) return;
    
    const peerCreated = createPeerConnection();
    if (!peerCreated) return;
    
    // Create offer
    appState.isInitiator = true;
    initSignaling();
    
    try {
        const offer = await appState.peerConnection.createOffer();
        await appState.peerConnection.setLocalDescription(offer);
        sendMessage(offer);
        
        appState.isStarted = true;
        startTimer();
        updateStatus(`In ${mode} call (${appState.roomId})`, true);
        showNotification('Call Started', `Connected to room: ${appState.roomId}`, 'success');
    } catch (err) {
        console.error('Error creating offer:', err);
        showNotification('Error', 'Failed to start call', 'error');
        updateStatus('Call failed', false);
    }
}

async function joinRoom(mode) {
    appState.roomId = document.getElementById(`${mode}-room-id`).value.trim();
    if (!appState.roomId) {
        showNotification('Error', 'Please enter a room ID', 'error');
        return;
    }
    
    const mediaInitialized = await initMedia(mode);
    if (mediaInitialized) {
        createPeerConnection();
        appState.isInitiator = false;
        initSignaling();
        
        if (mode === 'video') {
            document.getElementById('videoSpinner').style.display = 'block';
        }
        
        updateStatus(`Joining ${mode} call...`, false);
        showNotification('Joining Room', `Connecting to room: ${appState.roomId}`);
    }
}

// ========== CALL CONTROLS ========== //
function hangup(mode) {
    if (appState.peerConnection) {
        appState.peerConnection.close();
        appState.peerConnection = null;
    }
    
    if (appState.localStream) {
        appState.localStream.getTracks().forEach(track => track.stop());
        appState.localStream = null;
    }
    
    document.getElementById(`${mode}Controls`).style.display = 'none';
    document.getElementById(`${mode}RoomLinkContainer`).style.display = 'none';
    
    if (mode === 'video') {
        document.getElementById('video-remote-video').srcObject = null;
        document.getElementById('video-local-video').srcObject = null;
        document.getElementById('videoSpinner').style.display = 'none';
    }
    
    stopTimer();
    updateStatus('Call ended', false);
    showNotification('Call Ended', 'Your call has been disconnected');
    
    if (appState.roomId) {
        sendMessage({ type: 'bye' });
    }
    
    appState.isStarted = false;
    appState.roomId = null;
}

function toggleVideo() {
    if (appState.localStream) {
        const videoTrack = appState.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const button = document.getElementById('videoVideoToggle');
            button.innerHTML = videoTrack.enabled ? 
                '<i class="fas fa-video"></i>' : 
                '<i class="fas fa-video-slash"></i>';
        }
    }
}

function toggleAudio(mode) {
    if (appState.localStream) {
        const audioTrack = appState.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const button = document.getElementById(`${mode}AudioToggle`);
            button.innerHTML = audioTrack.enabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
        }
    }
}

// ========== UTILITY FUNCTIONS ========== //
function copyLink(mode) {
    const link = document.getElementById(`${mode}RoomLink`).textContent;
    navigator.clipboard.writeText(link).then(() => {
        showNotification('Copied', 'Room link copied to clipboard', 'success');
    });
}

function saveSettings() {
    localStorage.setItem('notifications', 
        document.getElementById('notifications-toggle').checked);
    localStorage.setItem('notificationSound', 
        document.getElementById('notification-sound-toggle').checked);
}
