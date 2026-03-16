import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

export class VideoStreamManager {
    private videoElement: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private ffmpeg: any = null;
    private ffmpegLoaded: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            this.videoElement = document.createElement('video');
            this.videoElement.style.display = 'none';
            document.body.appendChild(this.videoElement);
        }
    }

    private async loadFFmpeg() {
        if (this.ffmpegLoaded) return;

        return new Promise<void>(async (resolve, reject) => {
            try {
                // Load FFmpeg from CDN
                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
                
                this.ffmpeg = new FFmpeg();

                this.ffmpeg.on('log', ({ message }: { message: string }) => {
                    console.log("[FFmpeg]", message);
                });

                await this.ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                });

                this.ffmpegLoaded = true;
                resolve();
            } catch (err) {
                console.error("Failed to load FFmpeg:", err);
                reject(err);
            }
        });
    }

    /**
     * Loads a local file into the video element and prepares it for streaming.
     */
    async loadFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
        return new Promise(async (resolve, reject) => {
            if (!this.videoElement) return reject(new Error("Video element not initialized"));

            // 1. Try native loading first
            const url = URL.createObjectURL(file);
            this.videoElement.src = url;
            this.videoElement.muted = true;

            this.videoElement.onloadedmetadata = () => {
                resolve(url);
            };

            this.videoElement.onerror = async () => {
                console.warn("Native playback failed, attempting client-side transcoding...");

                try {
                    await this.loadFFmpeg();
                    if (onProgress) {
                        this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
                            onProgress(Math.round(progress * 100));
                        });
                    }

                    // Use a fast remux if possible, but for broadly supported output, we'll go to webm
                    await this.ffmpeg.writeFile('input', await fetchFile(file));

                    // Simple remux to mp4 (fast) or convert to webm (safe but slow)
                    // We'll try remuxing to mp4 first as it's often just the container issue
                    await this.ffmpeg.exec(['-i', 'input', '-c', 'copy', 'output.mp4']);

                    const data = await this.ffmpeg.readFile('output.mp4');
                    const transcodedUrl = URL.createObjectURL(new Blob([(data as any).buffer], { type: 'video/mp4' }));

                    if (this.videoElement) {
                        this.videoElement.src = transcodedUrl;
                        this.videoElement.onloadedmetadata = () => resolve(transcodedUrl);
                        this.videoElement.onerror = (err) => reject(new Error("Conversion failed to produce a playable format."));
                    }
                } catch (err) {
                    console.error("Transcoding error:", err);
                    reject(new Error("Failed to process video. Browsers cannot play this format even with help."));
                }
            };
        });
    }

    /**
     * Captures the media stream from the video element.
     */
    captureStream(fps: number = 30): MediaStream {
        if (!this.videoElement) throw new Error("Video element not initialized");

        // @ts-ignore
        this.stream = this.videoElement.captureStream ? this.videoElement.captureStream(fps) : (this.videoElement as any).mozCaptureStream ? (this.videoElement as any).mozCaptureStream(fps) : null;

        if (!this.stream) {
            throw new Error("Stream capture not supported in this browser.");
        }

        return this.stream;
    }

    /**
     * Syncs the captured video playback with theater actions.
     */
    syncPlayback(action: 'play' | 'pause' | 'seek', time?: number) {
        if (!this.videoElement) return;

        if (action === 'play') {
            this.videoElement.play().catch(e => console.warn("Play blocked:", e));
        } else if (action === 'pause') {
            this.videoElement.pause();
        } else if (action === 'seek' && time !== undefined) {
            this.videoElement.currentTime = time;
        }
    }

    cleanup() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = "";
            this.videoElement.load();
            if (this.videoElement.parentNode) {
                this.videoElement.parentNode.removeChild(this.videoElement);
            }
            this.videoElement = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
                console.log(`VideoStreamManager: Stopped track: ${track.kind}`);
            });
        }
        this.stream = null;
    }
}
