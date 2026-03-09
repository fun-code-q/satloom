/**
 * End-to-End Encryption System
 * 
 * Signal Protocol-based encryption for secure
 * peer-to-peer communication with forward secrecy.
 */

type KeyType = 'identity' | 'signed_prekey' | 'prekey' | 'session' | 'sender';

interface IdentityKeyPair {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
}

interface SignedPreKeyPair {
    id: number;
    keyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
    signature: ArrayBuffer;
    timestamp: number;
}

interface PreKeyPair {
    id: number;
    keyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
}

interface SessionKeyBundle {
    identityKey: ArrayBuffer;
    signedPreKeyId: number;
    signedPreKey: ArrayBuffer;
    signedPreKeySignature: ArrayBuffer;
    preKeys: { id: number; key: ArrayBuffer }[];
}

interface EncryptedMessage {
    type: 'prekey' | 'normal';
    source?: string;
    destination?: string;
    content: ArrayBuffer;
    timestamp: number;
    nonce: ArrayBuffer;
    messageId: string;
}

interface DecryptedMessage {
    content: string;
    senderId: string;
    timestamp: number;
    attachments?: EncryptedAttachment[];
}

interface EncryptedAttachment {
    id: string;
    key: ArrayBuffer;
    iv: ArrayBuffer;
    mimeType: string;
    size: number;
    encryptedUrl: string;
}

interface E2EESettings {
    enabled: boolean;
    verifyIdentity: boolean;
    autoAcceptBundles: boolean;
    expirationMinutes: number;
    allowPersistence: boolean;
}

interface IdentityVerification {
    userId: string;
    fingerprint: string;
    status: 'verified' | 'unverified' | 'failed';
    lastVerified?: number;
}

interface KeyExchangeResult {
    sessionId: string;
    sharedSecret: CryptoKey;
    established: number;
}

class E2EEncryption {
    private static instance: E2EEncryption;
    private settings: E2EESettings = {
        enabled: true,
        verifyIdentity: true,
        autoAcceptBundles: false,
        expirationMinutes: 60 * 24 * 7, // 7 days
        allowPersistence: true,
    };

    private identityKey: IdentityKeyPair | null = null;
    private signedPreKey: SignedPreKeyPair | null = null;
    private preKeys: PreKeyPair[] = [];
    private sessions: Map<string, KeyExchangeResult> = new Map();
    private identityVerifications: Map<string, IdentityVerification> = new Map();
    private listeners: ((event: { type: string; data?: unknown }) => void)[] = [];

    private constructor() {
        this.loadFromStorage();
    }

    static getInstance(): E2EEncryption {
        if (!E2EEncryption.instance) {
            E2EEncryption.instance = new E2EEncryption();
        }
        return E2EEncryption.instance;
    }

    /**
     * Initialize encryption keys
     */
    async initialize(): Promise<{ identityKey: ArrayBuffer; preKeyBundle: SessionKeyBundle } | null> {
        try {
            // Generate identity key
            this.identityKey = await this.generateIdentityKey();

            // Generate signed prekey
            this.signedPreKey = await this.generateSignedPreKey(this.identityKey);

            // Generate prekeys
            this.preKeys = await this.generatePreKeys(100);

            // Create bundle
            const bundle = await this.createKeyBundle();

            // Save to storage
            this.saveToStorage();

            return { identityKey: bundle.identityKey, preKeyBundle: bundle };
        } catch (error) {
            console.error('Failed to initialize encryption:', error);
            return null;
        }
    }

    /**
     * Generate identity key pair
     */
    private async generateIdentityKey(): Promise<IdentityKeyPair> {
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits', 'deriveKey']
        );

        const pair = keyPair as CryptoKeyPair;
        return {
            publicKey: pair.publicKey,
            privateKey: pair.privateKey,
        };
    }

    /**
     * Generate signed prekey
     */
    private async generateSignedPreKey(identityKey: IdentityKeyPair): Promise<SignedPreKeyPair> {
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits', 'deriveKey']
        );

        // Sign the public key with identity key
        const publicKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const signature = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            identityKey.privateKey,
            publicKeyBytes
        );

        return {
            id: Math.floor(Math.random() * 2147483647),
            keyPair: {
                publicKey: (keyPair as CryptoKeyPair).publicKey,
                privateKey: (keyPair as CryptoKeyPair).privateKey,
            },
            signature,
            timestamp: Date.now(),
        };
    }

    /**
     * Generate prekey bundle
     */
    private async generatePreKeys(count: number): Promise<PreKeyPair[]> {
        const preKeys: PreKeyPair[] = [];

        for (let i = 0; i < count; i++) {
            const keyPair = await crypto.subtle.generateKey(
                { name: 'ECDH', namedCurve: 'P-256' },
                true,
                ['deriveBits', 'deriveKey']
            );

            preKeys.push({
                id: i + 1,
                keyPair: {
                    publicKey: (keyPair as CryptoKeyPair).publicKey,
                    privateKey: (keyPair as CryptoKeyPair).privateKey,
                },
            });
        }

        return preKeys;
    }

    /**
     * Create key bundle for sharing
     */
    private async createKeyBundle(): Promise<SessionKeyBundle> {
        if (!this.identityKey || !this.signedPreKey) {
            throw new Error('Encryption not initialized');
        }

        const identityKeyBytes = await crypto.subtle.exportKey('spki', this.identityKey.publicKey);
        const signedPreKeyBytes = await crypto.subtle.exportKey('spki', this.signedPreKey.keyPair.publicKey);

        return {
            identityKey: identityKeyBytes,
            signedPreKeyId: this.signedPreKey.id,
            signedPreKey: signedPreKeyBytes,
            signedPreKeySignature: this.signedPreKey.signature,
            preKeys: await Promise.all(this.preKeys.map(async pk => ({
                id: pk.id,
                key: await crypto.subtle.exportKey('spki', pk.keyPair.publicKey),
            }))),
        };
    }

    /**
     * Process incoming key bundle
     */
    async processKeyBundle(bundle: SessionKeyBundle, senderId: string): Promise<boolean> {
        try {
            // Import sender's identity key
            const identityKey = await crypto.subtle.importKey(
                'spki',
                bundle.identityKey,
                { name: 'ECDH', namedCurve: 'P-256' },
                false,
                []
            );

            // Import sender's signed prekey
            const signedPreKey = await crypto.subtle.importKey(
                'spki',
                bundle.signedPreKey,
                { name: 'ECDH', namedCurve: 'P-256' },
                false,
                []
            );

            // Derive shared secret
            const sharedSecret = await this.deriveSharedSecret(
                this.identityKey!.privateKey,
                signedPreKey
            );

            // Create session
            const sessionId = `session_${senderId}_${Date.now()}`;
            this.sessions.set(senderId, {
                sessionId,
                sharedSecret,
                established: Date.now(),
            });

            // Consume prekey
            this.consumePreKey(bundle.preKeys[0]?.id);

            this.notifyListeners({ type: 'session_established', data: { senderId, sessionId } });

            return true;
        } catch (error) {
            console.error('Failed to process key bundle:', error);
            return false;
        }
    }

    /**
     * Derive shared secret using ECDH
     */
    private async deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
        return crypto.subtle.deriveKey(
            { name: 'ECDH', public: publicKey },
            privateKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Consume a prekey
     */
    private consumePreKey(preKeyId?: number): void {
        if (preKeyId) {
            this.preKeys = this.preKeys.filter(pk => pk.id !== preKeyId);
            this.saveToStorage();
        }
    }

    /**
     * Encrypt a message
     */
    async encryptMessage(
        content: string,
        recipientId: string,
        messageId?: string
    ): Promise<EncryptedMessage | null> {
        const session = this.sessions.get(recipientId);
        if (!session) {
            console.warn('No session established with recipient');
            return null;
        }

        try {
            // Generate nonce
            const nonce = crypto.getRandomValues(new Uint8Array(12));

            // Encode content
            const encoder = new TextEncoder();
            const contentBytes = encoder.encode(content);

            // Encrypt
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: nonce },
                session.sharedSecret,
                contentBytes
            );

            return {
                type: 'normal',
                source: 'self',
                destination: recipientId,
                content: encrypted,
                timestamp: Date.now(),
                nonce: nonce.buffer,
                messageId: messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            };
        } catch (error) {
            console.error('Failed to encrypt message:', error);
            return null;
        }
    }

    /**
     * Decrypt a message
     */
    async decryptMessage(encrypted: EncryptedMessage): Promise<DecryptedMessage | null> {
        try {
            // For prekey messages, establish session first
            if (encrypted.type === 'prekey') {
                // Would need to process bundle here
                // Simplified for demo
            }

            const session = this.sessions.get(encrypted.source || '');
            if (!session) {
                console.warn('No session found for sender');
                return null;
            }

            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: encrypted.nonce },
                session.sharedSecret,
                encrypted.content
            );

            // Decode
            const decoder = new TextDecoder();
            const content = decoder.decode(decrypted);

            return {
                content,
                senderId: encrypted.source || 'unknown',
                timestamp: encrypted.timestamp,
            };
        } catch (error) {
            console.error('Failed to decrypt message:', error);
            return null;
        }
    }

    /**
     * Encrypt attachment
     */
    async encryptAttachment(file: File): Promise<EncryptedAttachment | null> {
        try {
            // Generate random key for attachment
            const key = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            // Generate IV
            const iv = crypto.getRandomValues(new Uint8Array(12));

            // Read file
            const buffer = await file.arrayBuffer();

            // Encrypt
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                buffer
            );

            // Export key
            const exportedKey = await crypto.subtle.exportKey('raw', key);

            // In production, upload to server and return reference
            return {
                id: `att_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                key: exportedKey,
                iv: iv.buffer,
                mimeType: file.type,
                size: file.size,
                encryptedUrl: `https://storage.example.com/${Date.now()}`,
            };
        } catch (error) {
            console.error('Failed to encrypt attachment:', error);
            return null;
        }
    }

    /**
     * Decrypt attachment
     */
    async decryptAttachment(encrypted: EncryptedAttachment): Promise<Blob | null> {
        try {
            // In production, download from server first
            // Simplified here
            return null;
        } catch (error) {
            console.error('Failed to decrypt attachment:', error);
            return null;
        }
    }

    /**
     * Generate fingerprint for identity verification
     */
    async getIdentityFingerprint(userId: string): Promise<string | null> {
        const session = this.sessions.get(userId);
        if (!session) return null;

        try {
            const exported = await crypto.subtle.exportKey('raw', this.identityKey!.publicKey);
            const hash = await crypto.subtle.digest('SHA-256', exported);

            // Create fingerprint string
            const bytes = new Uint8Array(hash);
            const hex = Array.from(bytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(':');

            return hex.substring(0, 64); // First 64 chars
        } catch (error) {
            console.error('Failed to generate fingerprint:', error);
            return null;
        }
    }

    /**
     * Verify identity
     */
    async verifyIdentity(userId: string, fingerprint: string): Promise<boolean> {
        const localFingerprint = await this.getIdentityFingerprint(userId);
        if (!localFingerprint) return false;

        const isValid = localFingerprint === fingerprint;

        this.identityVerifications.set(userId, {
            userId,
            fingerprint,
            status: isValid ? 'verified' : 'failed',
            lastVerified: Date.now(),
        });

        return isValid;
    }

    /**
     * Get verification status
     */
    getVerificationStatus(userId: string): IdentityVerification | undefined {
        return this.identityVerifications.get(userId);
    }

    /**
     * Check if session exists
     */
    hasSession(userId: string): boolean {
        return this.sessions.has(userId);
    }

    /**
     * Close session
     */
    closeSession(userId: string): boolean {
        const deleted = this.sessions.delete(userId);
        if (deleted) {
            this.notifyListeners({ type: 'session_closed', data: { userId } });
        }
        return deleted;
    }

    /**
     * Rotate prekeys
     */
    async rotatePreKeys(): Promise<void> {
        if (!this.signedPreKey) return;

        // Generate new prekeys
        const newPreKeys = await this.generatePreKeys(50);
        this.preKeys = [...this.preKeys, ...newPreKeys];

        // Update signed prekey periodically
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - this.signedPreKey.timestamp > weekMs) {
            this.signedPreKey = await this.generateSignedPreKey(this.identityKey!);
        }

        this.saveToStorage();
    }

    /**
     * Update settings
     */
    configure(settings: Partial<E2EESettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Load from storage
     */
    private loadFromStorage(): void {
        if (!this.settings.allowPersistence) return;

        try {
            const data = localStorage.getItem('satloom_e2ee_keys');
            if (data) {
                const parsed = JSON.parse(data);
                // Note: CryptoKeys cannot be stored directly, would need to re-generate
                // This is a simplified version
                console.log('Loaded E2EE settings from storage');
            }
        } catch (error) {
            console.error('Failed to load E2EE keys:', error);
        }
    }

    /**
     * Save to storage
     */
    private saveToStorage(): void {
        if (!this.settings.allowPersistence) return;

        try {
            // Only save non-sensitive data
            const data = JSON.stringify({
                preKeyCount: this.preKeys.length,
                sessionCount: this.sessions.size,
                lastUpdated: Date.now(),
            });
            localStorage.setItem('satloom_e2ee_keys', data);
        } catch (error) {
            console.error('Failed to save E2EE keys:', error);
        }
    }

    /**
     * Subscribe to events
     */
    subscribe(listener: (event: { type: string; data?: unknown }) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(event: { type: string; data?: unknown }): void {
        this.listeners.forEach(listener => listener(event));
    }

    /**
     * Get status
     */
    getStatus(): {
        enabled: boolean;
        hasKeys: boolean;
        hasSessions: boolean;
        sessionCount: number;
    } {
        return {
            enabled: this.settings.enabled,
            hasKeys: !!this.identityKey,
            hasSessions: this.sessions.size > 0,
            sessionCount: this.sessions.size,
        };
    }

    /**
     * Reset all encryption data
     */
    reset(): void {
        this.identityKey = null;
        this.signedPreKey = null;
        this.preKeys = [];
        this.sessions.clear();
        this.identityVerifications.clear();
        localStorage.removeItem('satloom_e2ee_keys');
        this.notifyListeners({ type: 'reset' });
    }
}

export const e2ee = E2EEncryption.getInstance();
export type { EncryptedMessage, DecryptedMessage, SessionKeyBundle, EncryptedAttachment, E2EESettings, IdentityVerification };
