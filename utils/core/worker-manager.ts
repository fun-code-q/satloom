/**
 * Web Worker Manager
 * 
 * Offloads heavy computations to Web Workers for better performance.
 * Supports: Image compression, encryption/decryption, data processing.
 */

export type WorkerTaskType =
  | "image-compression"
  | "encryption"
  | "decryption"
  | "data-processing"
  | "analytics"

interface WorkerTask {
  id: string
  type: WorkerTaskType
  payload: any
  priority: number
  timestamp: number
}

interface WorkerResult {
  id: string
  success: boolean
  result?: any
  error?: string
}

type WorkerCallback = (result: WorkerResult) => void

class WorkerManager {
  private static instance: WorkerManager
  private workers: Map<string, Worker> = new Map()
  private taskQueue: WorkerTask[] = []
  private pendingResults: Map<string, WorkerCallback> = new Map()
  private maxConcurrentWorkers: number = navigator.hardwareConcurrency || 4
  private activeWorkers: number = 0

  private constructor() {
    // Initialize worker count based on hardware
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      this.maxConcurrentWorkers = Math.min(navigator.hardwareConcurrency, 8)
    }
  }

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager()
    }
    return WorkerManager.instance
  }

  /**
   * Create a worker from a function string
   */
  private createWorkerFromFunction(workerFunction: Function): Worker {
    const workerCode = `
      self.onmessage = function(e) {
        try {
          const result = (${workerFunction.toString()})(e.data);
          self.postMessage({ success: true, result });
        } catch (error) {
          self.postMessage({ success: false, error: error.message });
        }
      };
    `
    const blob = new Blob([workerCode], { type: "application/javascript" })
    const workerUrl = URL.createObjectURL(blob)
    const worker = new Worker(workerUrl)
    return worker
  }

  /**
   * Process a task with a worker
   */
  private async processWithWorker(worker: Worker, task: WorkerTask): Promise<WorkerResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          id: task.id,
          success: false,
          error: "Worker timeout",
        })
      }, 30000) // 30 second timeout

      const handleMessage = (e: MessageEvent) => {
        clearTimeout(timeout)
        worker.removeEventListener("message", handleMessage)
        resolve({
          id: task.id,
          success: e.data.success,
          result: e.data.result,
          error: e.data.error,
        })
      }

      worker.addEventListener("message", handleMessage)
      worker.postMessage(task.payload)
    })
  }

  /**
   * Submit a task to be processed
   */
  async submitTask<T>(
    type: WorkerTaskType,
    payload: any,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        payload,
        priority,
        timestamp: Date.now(),
      }

      // Set up callback
      this.pendingResults.set(task.id, (result) => {
        if (result.success) {
          resolve(result.result)
        } else {
          reject(new Error(result.error))
        }
      })

      // Add to queue
      this.taskQueue.push(task)
      this.taskQueue.sort((a, b) => b.priority - a.priority)

      // Process queue
      this.processQueue()
    })
  }

  /**
   * Process the task queue
   */
  private async processQueue() {
    if (this.activeWorkers >= this.maxConcurrentWorkers) {
      return
    }

    const task = this.taskQueue.shift()
    if (!task) {
      return
    }

    this.activeWorkers++

    try {
      const worker = this.createWorkerForTask(task.type)
      const result = await this.processWithWorker(worker, task)
      this.activeWorkers--

      // Notify callback
      const callback = this.pendingResults.get(task.id)
      if (callback) {
        callback(result)
        this.pendingResults.delete(task.id)
      }

      // Process next task
      this.processQueue()
    } catch (error) {
      this.activeWorkers--
      this.processQueue()
    }
  }

  /**
   * Create a worker for a specific task type
   */
  private createWorkerForTask(type: WorkerTaskType): Worker {
    const workerId = `worker_${type}`

    if (this.workers.has(workerId)) {
      return this.workers.get(workerId)!
    }

    let workerCode = ""

    switch (type) {
      case "image-compression":
        workerCode = `
          self.onmessage = function(e) {
            const { imageData, quality, maxWidth } = e.data;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Resize if needed
            let width = imageData.width;
            let height = imageData.height;
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.putImageData(imageData, 0, 0);
            
            canvas.toBlob((blob) => {
              self.postMessage({ blob, width, height });
            }, 'image/jpeg', quality);
          };
        `
        break

      case "encryption":
        workerCode = `
          self.onmessage = async function(e) {
            const { data, key } = e.data;
            const encoder = new TextEncoder();
            
            try {
              // 1. Derive key from string using SHA-256
              const keyBuf = await crypto.subtle.digest('SHA-256', encoder.encode(key));
              const cryptoKey = await crypto.subtle.importKey(
                'raw', keyBuf, { name: 'AES-GCM' }, false, ['encrypt']
              );
              
              // 2. Generate random IV
              const iv = crypto.getRandomValues(new Uint8Array(12));
              
              // 3. Encrypt data
              const encodedData = encoder.encode(JSON.stringify(data));
              const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv }, cryptoKey, encodedData
              );
              
              // 4. Combine IV and Ciphertext
              const combined = new Uint8Array(iv.length + encrypted.byteLength);
              combined.set(iv);
              combined.set(new Uint8Array(encrypted), iv.length);
              
              self.postMessage({ result: Array.from(combined) });
            } catch (error) {
              self.postMessage({ success: false, error: 'Encryption failed: ' + error.message });
            }
          };
        `
        break

      case "decryption":
        workerCode = `
          self.onmessage = async function(e) {
            const { data, key } = e.data;
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            
            try {
              const combined = new Uint8Array(data);
              const iv = combined.slice(0, 12);
              const ciphertext = combined.slice(12);
              
              // 1. Derive key
              const keyBuf = await crypto.subtle.digest('SHA-256', encoder.encode(key));
              const cryptoKey = await crypto.subtle.importKey(
                'raw', keyBuf, { name: 'AES-GCM' }, false, ['decrypt']
              );
              
              // 2. Decrypt
              const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv }, cryptoKey, ciphertext
              );
              
              self.postMessage({ result: JSON.parse(decoder.decode(decrypted)) });
            } catch (err) {
              self.postMessage({ error: 'Decryption failed: ' + err.message });
            }
          };
        `
        break

      case "data-processing":
        workerCode = `
          self.onmessage = function(e) {
            const { data, operation } = e.data;
            let result;
            
            switch (operation) {
              case 'sort':
                result = [...data].sort((a, b) => a - b);
                break;
              case 'filter':
                result = data.filter((item: any) => item !== null && item !== undefined);
                break;
              case 'map':
                result = data.map((item: any) => String(item));
                break;
              case 'reduce':
                result = data.reduce((acc: number, curr: number) => acc + curr, 0);
                break;
              default:
                result = data;
            }
            
            self.postMessage({ result });
          };
        `
        break

      case "analytics":
        workerCode = `
          self.onmessage = function(e) {
            const { events, timeRange } = e.data;
            
            // Process analytics events
            const processed = events.filter((event: any) => {
              const timestamp = new Date(event.timestamp).getTime();
              const startTime = new Date(timeRange.start).getTime();
              const endTime = new Date(timeRange.end).getTime();
              return timestamp >= startTime && timestamp <= endTime;
            });
            
            // Calculate statistics
            const uniqueUsers = new Set(processed.map((e: any) => e.userId)).size;
            const eventCounts: Record<string, number> = {};
            processed.forEach((e: any) => {
              eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;
            });
            
            self.postMessage({ 
              result: {
                totalEvents: processed.length,
                uniqueUsers,
                eventCounts,
                averageEventsPerUser: uniqueUsers > 0 ? (processed.length / uniqueUsers).toFixed(2) : 0
              }
            });
          };
        `
        break
    }

    const blob = new Blob([workerCode], { type: "application/javascript" })
    const workerUrl = URL.createObjectURL(blob)
    const worker = new Worker(workerUrl)
    this.workers.set(workerId, worker)

    return worker
  }

  /**
   * Compress an image using a worker
   */
  async compressImage(
    imageData: ImageData,
    quality: number = 0.8,
    maxWidth: number = 1920
  ): Promise<{ blob: Blob; width: number; height: number }> {
    return this.submitTask("image-compression", { imageData, quality, maxWidth })
  }

  /**
   * Encrypt data using a worker
   */
  async encryptData(data: any, key: string): Promise<number[]> {
    return this.submitTask("encryption", { data, key })
  }

  /**
   * Decrypt data using a worker
   */
  async decryptData(data: number[], key: string): Promise<any> {
    return this.submitTask("decryption", { data, key })
  }

  /**
   * Process data using a worker
   */
  async processData<T>(data: T[], operation: "sort" | "filter" | "map" | "reduce"): Promise<T[] | number> {
    return this.submitTask("data-processing", { data, operation })
  }

  /**
   * Process analytics using a worker
   */
  async processAnalytics(
    events: any[],
    timeRange: { start: string; end: string }
  ): Promise<any> {
    return this.submitTask("analytics", { events, timeRange })
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { pending: number; active: number; max: number } {
    return {
      pending: this.taskQueue.length,
      active: this.activeWorkers,
      max: this.maxConcurrentWorkers,
    }
  }

  /**
   * Clear all pending tasks
   */
  clearQueue(): void {
    this.taskQueue.forEach((task) => {
      const callback = this.pendingResults.get(task.id)
      if (callback) {
        callback({ id: task.id, success: false, error: "Queue cleared" })
      }
    })
    this.taskQueue = []
    this.pendingResults.clear()
  }

  /**
   * Clean up all workers
   */
  destroy(): void {
    this.clearQueue()
    this.workers.forEach((worker) => {
      worker.terminate()
    })
    this.workers.clear()
  }
}

export const workerManager = WorkerManager.getInstance()
export type { WorkerTask, WorkerResult }
