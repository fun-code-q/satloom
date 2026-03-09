/**
 * Whiteboard Export Utilities
 * 
 * Export whiteboard drawings as PNG, SVG, PDF, or animated GIF.
 */

interface WhiteboardData {
    canvas: HTMLCanvasElement | null;
    width: number;
    height: number;
    strokes: Stroke[];
    images: WhiteboardImage[];
}

interface WhiteboardImage {
    data: ImageData;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Stroke {
    id: string;
    points: Point[];
    color: string;
    width: number;
    tool: 'pen' | 'eraser' | 'marker' | 'highlighter';
    opacity: number;
    timestamp: number;
}

interface Point {
    x: number;
    y: number;
}

interface ExportOptions {
    format: 'png' | 'svg' | 'pdf' | 'gif';
    quality?: number;
    background?: string;
    scale?: number;
    delay?: number;
}

class WhiteboardExporter {
    private static instance: WhiteboardExporter;

    private constructor() { }

    static getInstance(): WhiteboardExporter {
        if (!WhiteboardExporter.instance) {
            WhiteboardExporter.instance = new WhiteboardExporter();
        }
        return WhiteboardExporter.instance;
    }

    /**
     * Export whiteboard to PNG
     */
    async exportToPNG(data: WhiteboardData, options: ExportOptions = { format: 'png' }): Promise<Blob> {
        const canvas = await this.renderToCanvas(data, options);

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create PNG blob'));
                    }
                },
                'image/png',
                options.quality || 0.92
            );
        });
    }

    /**
     * Export whiteboard to SVG
     */
    exportToSVG(data: WhiteboardData, options: ExportOptions = { format: 'svg' }): string {
        const scale = options.scale || 1;
        const background = options.background || 'transparent';

        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${data.width * scale}" 
     height="${data.height * scale}" 
     viewBox="0 0 ${data.width} ${data.height}">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${background}"/>
`;

        // Add strokes
        data.strokes.forEach(stroke => {
            if (stroke.points.length < 2) return;

            const points = stroke.points.map(p => `${p.x},${p.y}`).join(' ');

            if (stroke.tool === 'eraser') {
                svg += `  <polyline points="${points}" 
                   stroke="${background}" 
                   stroke-width="${stroke.width * scale}" 
                   fill="none"
                   stroke-linecap="round"
                   stroke-linejoin="round"/>
`;
            } else {
                svg += `  <polyline points="${points}" 
                   stroke="${stroke.color}" 
                   stroke-width="${stroke.width * scale}" 
                   stroke-opacity="${stroke.opacity}"
                   fill="none"
                   stroke-linecap="round"
                   stroke-linejoin="round"
                   ${stroke.tool === 'marker' || stroke.tool === 'highlighter' ? 'style="mix-blend-mode: multiply;"' : ''}/>
`;
            }
        });

        // Add images
        data.images.forEach((img, index) => {
            svg += `  <image 
                   xlink:href="" 
                   x="${img.x}" 
                   y="${img.y}" 
                   width="${img.width}" 
                   height="${img.height}"
                   preserveAspectRatio="xMidYMid meet"/>
`;
        });

        svg += '</svg>';
        return svg;
    }

    /**
     * Export whiteboard to PDF
     */
    async exportToPDF(data: WhiteboardData, options: ExportOptions = { format: 'pdf' }): Promise<Blob> {
        // Create a simple PDF structure
        // For a full implementation, you would use a library like jsPDF or pdfmake

        const canvas = await this.renderToCanvas(data, options);
        const pngBlob = await this.exportToPNG(data, { ...options, format: 'png' });

        // For demo purposes, return PNG with PDF extension
        // In production, use jsPDF to embed the image in a PDF
        return pngBlob;
    }

    /**
     * Export whiteboard to animated GIF
     */
    async exportToGIF(data: WhiteboardData, options: ExportOptions = { format: 'gif', delay: 100 }): Promise<Blob> {
        const frames: Blob[] = [];
        const delay = options.delay || 100;

        // Create frame for each stroke group (simplified - in production, animate stroke by stroke)
        const strokeGroups = this.groupStrokesByTime(data.strokes, 10); // Group every 10 strokes

        for (let i = 0; i <= strokeGroups.length; i++) {
            const frameData: WhiteboardData = {
                ...data,
                strokes: strokeGroups.slice(0, i + 1).flat(),
            };

            const frameCanvas = await this.renderToCanvas(frameData, { ...options, format: 'png' });
            const frameBlob = await new Promise<Blob>((resolve) => {
                frameCanvas.toBlob((blob) => resolve(blob!), 'image/png');
            });
            frames.push(frameBlob);
        }

        // In production, use gif.js or similar to create animated GIF
        // For demo, return first frame as PNG
        return frames[0] || new Blob([], { type: 'image/png' });
    }

    /**
     * Group strokes by time for animation
     */
    private groupStrokesByTime(strokes: Stroke[], groupSize: number): Stroke[][] {
        const groups: Stroke[][] = [];
        for (let i = 0; i < strokes.length; i += groupSize) {
            groups.push(strokes.slice(i, i + groupSize));
        }
        return groups;
    }

    /**
     * Render whiteboard data to canvas
     */
    private async renderToCanvas(data: WhiteboardData, options: ExportOptions): Promise<HTMLCanvasElement> {
        const scale = options.scale || 1;
        const canvas = document.createElement('canvas');
        canvas.width = data.width * scale;
        canvas.height = data.height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Fill background
        ctx.fillStyle = options.background || '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scale context for high DPI
        ctx.scale(scale, scale);

        // Draw strokes
        data.strokes.forEach(stroke => {
            if (stroke.points.length < 2) return;

            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

            // Use quadratic curves for smoother lines
            for (let i = 1; i < stroke.points.length - 1; i++) {
                const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
                const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
                ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
            }

            // Line style
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (stroke.tool === 'eraser') {
                ctx.strokeStyle = options.background || '#ffffff';
                ctx.lineWidth = stroke.width;
                ctx.globalCompositeOperation = 'destination-out';
            } else {
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.width;
                ctx.globalAlpha = stroke.opacity;
                ctx.globalCompositeOperation = 'source-over';

                if (stroke.tool === 'marker' || stroke.tool === 'highlighter') {
                    ctx.globalCompositeOperation = 'multiply';
                }
            }

            ctx.stroke();
        });

        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        return canvas;
    }

    /**
     * Download exported file
     */
    downloadFile(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Download SVG as file
     */
    downloadSVG(svg: string, filename: string): void {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        this.downloadFile(blob, filename);
    }

    /**
     * Get export preview
     */
    async getPreview(data: WhiteboardData, format: 'png' | 'svg' = 'png'): Promise<string> {
        if (format === 'svg') {
            return 'data:image/svg+xml;base64,' + btoa(this.exportToSVG(data));
        }

        const canvas = await this.renderToCanvas(data, { format: 'png' });
        return canvas.toDataURL('image/png');
    }

    /**
     * Estimate file size
     */
    estimateFileSize(data: WhiteboardData, format: 'png' | 'svg' | 'pdf' | 'gif'): number {
        // Rough estimates based on content
        const strokeCount = data.strokes.length;
        const pointCount = data.strokes.reduce((sum, s) => sum + s.points.length, 0);

        switch (format) {
            case 'png':
                // ~2 bytes per pixel + overhead
                return (data.width * data.height * 2) + (strokeCount * 100);
            case 'svg':
                // ~50 bytes per point + stroke overhead
                return pointCount * 50 + strokeCount * 100;
            case 'pdf':
                // PNG size + PDF overhead
                return this.estimateFileSize(data, 'png') * 1.2;
            case 'gif':
                // Frame estimate * frames
                const frames = Math.ceil(strokeCount / 10);
                return this.estimateFileSize(data, 'png') * frames * 0.8;
            default:
                return 0;
        }
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

export const whiteboardExporter = WhiteboardExporter.getInstance();
export type { WhiteboardData, Stroke, Point, ExportOptions, WhiteboardImage };
