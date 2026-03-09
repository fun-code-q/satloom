export class ImageCompressor {
    private static readonly MAX_WIDTH = 1920
    private static readonly MAX_HEIGHT = 1080
    private static readonly QUALITY = 0.8
    private static readonly MIME_TYPE = "image/webp"

    /**
     * Compresses an image file by resizing it and converting to WebP.
     * @param file The original File object
     * @returns A Promise resolving to the compressed File object
     */
    static async compress(file: File): Promise<File> {
        // Only compress images
        if (!file.type.startsWith("image/")) {
            return file
        }

        // Skip small images or SVGs
        if (file.size < 1024 * 1024 || file.type === "image/svg+xml") {
            return file
        }

        return new Promise((resolve, reject) => {
            const img = new Image()
            const url = URL.createObjectURL(file)

            img.onload = () => {
                URL.revokeObjectURL(url)

                let width = img.width
                let height = img.height

                // Calculate new dimensions while maintaining aspect ratio
                if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
                    const ratio = Math.min(this.MAX_WIDTH / width, this.MAX_HEIGHT / height)
                    width *= ratio
                    height *= ratio
                }

                const canvas = document.createElement("canvas")
                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext("2d")
                if (!ctx) {
                    reject(new Error("Could not get canvas context"))
                    return
                }

                ctx.drawImage(img, 0, 0, width, height)

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // Create new file with .webp extension
                            const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp"
                            const compressedFile = new File([blob], newName, {
                                type: this.MIME_TYPE,
                                lastModified: Date.now(),
                            })

                            console.log(`Compressed ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) to ${newName} (${(compressedFile.size / 1024 / 1024).toFixed(2)}MB)`)
                            resolve(compressedFile)
                        } else {
                            reject(new Error("Compression failed"))
                        }
                    },
                    this.MIME_TYPE,
                    this.QUALITY
                )
            }

            img.onerror = (error) => {
                URL.revokeObjectURL(url)
                reject(error)
            }

            img.src = url
        })
    }
}
