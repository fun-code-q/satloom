// Global browser type declarations
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="esnext" />

// Extend MediaRecorder constructor
interface MediaRecorderConstructor {
    prototype: MediaRecorder
    new(stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder
}

// MediaRecorder global declarations
declare var MediaRecorder: MediaRecorderConstructor

// BlobEvent interface
interface BlobEvent extends Event {
    data: Blob
}

// Navigator mediaDevices extension
interface NavigatorMediaDevices extends EventTarget {
    getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>
}

// Extend Navigator with mediaDevices
interface Navigator {
    mediaDevices: NavigatorMediaDevices
}
