// Shape Recognition for Whiteboard
// Uses pattern recognition to detect shapes from drawn strokes

export type ShapeType = "line" | "rectangle" | "circle" | "ellipse" | "arrow" | "triangle" | "unknown"

export interface Point {
    x: number
    y: number
}

export interface Stroke {
    id: string
    points: Point[]
    color: string
    width: number
    closed?: boolean
}

export interface RecognizedShape {
    type: ShapeType
    confidence: number // 0-1
    boundingBox: {
        x: number
        y: number
        width: number
        height: number
    }
    center: Point
    properties?: {
        width?: number
        height?: number
        radius?: number
        angle?: number
    }
}

// Shape Recognition Class
export class ShapeRecognizer {
    private static readonly CIRCLE_THRESHOLD = 0.85
    private static readonly RECTANGLE_THRESHOLD = 0.80
    private static readonly LINE_THRESHOLD = 0.90
    private static readonly TRIANGLE_THRESHOLD = 0.75

    // Recognize shape from stroke points
    static recognize(points: Point[]): RecognizedShape {
        if (points.length < 3) {
            const boundingBox = this.getBoundingBox(points)
            const lineShape = this.recognizeLine(points)
            return {
                ...lineShape,
                boundingBox,
                center: {
                    x: boundingBox.x + boundingBox.width / 2,
                    y: boundingBox.y + boundingBox.height / 2,
                },
            }
        }

        // Calculate bounding box
        const boundingBox = this.getBoundingBox(points)

        // Calculate various metrics
        const aspectRatio = boundingBox.width / boundingBox.height
        const circularity = this.calculateCircularity(points, boundingBox)
        const rectangularity = this.calculateRectangularity(points, boundingBox)
        const straightness = this.calculateStraightness(points)

        // Determine shape type
        const shape = this.determineShape(
            points,
            boundingBox,
            aspectRatio,
            circularity,
            rectangularity,
            straightness
        )

        return {
            ...shape,
            boundingBox,
            center: {
                x: boundingBox.x + boundingBox.width / 2,
                y: boundingBox.y + boundingBox.height / 2,
            },
        }
    }

    // Determine shape type based on metrics
    private static determineShape(
        points: Point[],
        boundingBox: { x: number; y: number; width: number; height: number },
        aspectRatio: number,
        circularity: number,
        rectangularity: number,
        straightness: number
    ): Omit<RecognizedShape, "boundingBox" | "center"> {
        // Check for circle/ellipse
        if (circularity > this.CIRCLE_THRESHOLD) {
            const isCircle = Math.abs(aspectRatio - 1) < 0.2
            return {
                type: isCircle ? "circle" : "ellipse",
                confidence: circularity,
                properties: {
                    radius: Math.max(boundingBox.width, boundingBox.height) / 2,
                },
            }
        }

        // Check for rectangle
        if (rectangularity > this.RECTANGLE_THRESHOLD) {
            return {
                type: "rectangle",
                confidence: rectangularity,
                properties: {
                    width: boundingBox.width,
                    height: boundingBox.height,
                },
            }
        }

        // Check for line
        if (straightness > this.LINE_THRESHOLD) {
            return this.recognizeLine(points)
        }

        // Check for triangle
        if (points.length >= 3) {
            const triangleConfidence = this.calculateTriangleConfidence(points, boundingBox)
            if (triangleConfidence > this.TRIANGLE_THRESHOLD) {
                return {
                    type: "triangle",
                    confidence: triangleConfidence,
                    properties: {
                        width: boundingBox.width,
                        height: boundingBox.height,
                    },
                }
            }
        }

        return {
            type: "unknown",
            confidence: Math.min(circularity, rectangularity, straightness),
        }
    }

    // Recognize line
    private static recognizeLine(points: Point[]): Omit<RecognizedShape, "boundingBox" | "center"> {
        if (points.length < 2) {
            return { type: "unknown", confidence: 0 }
        }

        const start = points[0]
        const end = points[points.length - 1]
        const length = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
        )

        // Calculate deviation from straight line
        let maxDeviation = 0
        for (const point of points) {
            const deviation = this.pointToLineDistance(point, start, end)
            maxDeviation = Math.max(maxDeviation, deviation)
        }

        const straightness = 1 - Math.min(maxDeviation / (length / 2), 1)

        return {
            type: "line",
            confidence: straightness,
            properties: {
                width: length,
                angle: Math.atan2(end.y - start.y, end.x - start.x),
            },
        }
    }

    // Calculate circularity (how circular the shape is)
    private static calculateCircularity(
        points: Point[],
        boundingBox: { x: number; y: number; width: number; height: number }
    ): number {
        const center = {
            x: boundingBox.x + boundingBox.width / 2,
            y: boundingBox.y + boundingBox.height / 2,
        }
        const avgRadius = (boundingBox.width + boundingBox.height) / 4

        let variance = 0
        for (const point of points) {
            const distance = Math.sqrt(
                Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
            )
            variance += Math.pow(distance - avgRadius, 2)
        }

        const stdDev = Math.sqrt(variance / points.length)
        return Math.max(0, 1 - stdDev / avgRadius)
    }

    // Calculate rectangularity (how rectangular the shape is)
    private static calculateRectangularity(
        points: Point[],
        boundingBox: { x: number; y: number; width: number; height: number }
    ): number {
        const corners = this.getCorners(boundingBox)
        let cornerHits = 0

        for (const point of points) {
            for (const corner of corners) {
                const distance = Math.sqrt(
                    Math.pow(point.x - corner.x, 2) + Math.pow(point.y - corner.y, 2)
                )
                if (distance < 20) {
                    cornerHits++
                    break
                }
            }
        }

        return cornerHits / points.length
    }

    // Calculate straightness (how straight the lines are)
    private static calculateStraightness(points: Point[]): number {
        if (points.length < 3) return 1

        const start = points[0]
        const end = points[points.length - 1]
        const length = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
        )

        if (length < 10) return 1

        let totalDeviation = 0
        for (let i = 1; i < points.length - 1; i++) {
            totalDeviation += this.pointToLineDistance(points[i], start, end)
        }

        const avgDeviation = totalDeviation / (points.length - 2)
        return Math.max(0, 1 - avgDeviation / (length / 4))
    }

    // Calculate triangle confidence
    private static calculateTriangleConfidence(
        points: Point[],
        boundingBox: { x: number; y: number; width: number; height: number }
    ): number {
        const corners = this.getCorners(boundingBox)
        let cornerHits = 0

        for (const point of points) {
            for (const corner of corners) {
                const distance = Math.sqrt(
                    Math.pow(point.x - corner.x, 2) + Math.pow(point.y - corner.y, 2)
                )
                if (distance < 25) {
                    cornerHits++
                    break
                }
            }
        }

        // Check if points form roughly triangular distribution
        const centerX = boundingBox.x + boundingBox.width / 2
        const centerY = boundingBox.y + boundingBox.height / 2

        let topPoints = 0
        let bottomPoints = 0

        for (const point of points) {
            if (point.y < centerY) topPoints++
            else bottomPoints++
        }

        const distributionRatio = Math.min(topPoints, bottomPoints) / Math.max(topPoints, bottomPoints)

        return (cornerHits / 3) * 0.6 + distributionRatio * 0.4
    }

    // Get bounding box
    private static getBoundingBox(points: Point[]): { x: number; y: number; width: number; height: number } {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity

        for (const point of points) {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        }
    }

    // Get corners of bounding box
    private static getCorners(boundingBox: { x: number; y: number; width: number; height: number }): Point[] {
        return [
            { x: boundingBox.x, y: boundingBox.y },
            { x: boundingBox.x + boundingBox.width, y: boundingBox.y },
            { x: boundingBox.x + boundingBox.width, y: boundingBox.y + boundingBox.height },
            { x: boundingBox.x, y: boundingBox.y + boundingBox.height },
        ]
    }

    // Calculate distance from point to line
    private static pointToLineDistance(
        point: Point,
        lineStart: Point,
        lineEnd: Point
    ): number {
        const A = point.x - lineStart.x
        const B = point.y - lineStart.y
        const C = lineEnd.x - lineStart.x
        const D = lineEnd.y - lineStart.y

        const dot = A * C + B * D
        const lenSq = C * C + D * D
        let param = -1

        if (lenSq !== 0) {
            param = dot / lenSq
        }

        let xx, yy

        if (param < 0) {
            xx = lineStart.x
            yy = lineStart.y
        } else if (param > 1) {
            xx = lineEnd.x
            yy = lineEnd.y
        } else {
            xx = lineStart.x + param * C
            yy = lineStart.y + param * D
        }

        return Math.sqrt(Math.pow(point.x - xx, 2) + Math.pow(point.y - yy, 2))
    }

    // Smooth stroke points
    static smoothPoints(points: Point[], factor: number = 0.2): Point[] {
        if (points.length < 3) return points

        const smoothed: Point[] = [points[0]]

        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1]
            const curr = points[i]
            const next = points[i + 1]

            smoothed.push({
                x: prev.x + (next.x - prev.x) * factor,
                y: prev.y + (next.y - prev.y) * factor,
            })
        }

        smoothed.push(points[points.length - 1])
        return smoothed
    }

    // Resample stroke to uniform points
    static resample(points: Point[], numPoints: number): Point[] {
        if (points.length < 2) return points

        // Calculate total length
        let totalLength = 0
        for (let i = 1; i < points.length; i++) {
            totalLength += this.distance(points[i - 1], points[i])
        }

        const interval = totalLength / (numPoints - 1)
        const resampled: Point[] = [points[0]]
        let currentDist = 0

        for (let i = 1; i < points.length; i++) {
            let segmentLength = this.distance(points[i - 1], points[i])

            while (currentDist + segmentLength >= interval) {
                const remaining = interval - currentDist
                const ratio = remaining / segmentLength

                const newPoint = {
                    x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio,
                    y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio,
                }

                resampled.push(newPoint)
                points.splice(i, 0, newPoint)
                currentDist = 0
                segmentLength -= remaining
            }

            currentDist += segmentLength
        }

        // Ensure we have exactly numPoints
        while (resampled.length < numPoints) {
            resampled.push(points[points.length - 1])
        }

        return resampled.slice(0, numPoints)
    }

    private static distance(p1: Point, p2: Point): number {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
    }

    // Convert recognized shape to SVG path
    static shapeToSvgPath(shape: RecognizedShape): string {
        const { boundingBox, type, properties } = shape
        const { x, y, width, height } = boundingBox

        switch (type) {
            case "rectangle":
                return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`

            case "circle":
                const radius = properties?.radius || width / 2
                const cx = x + width / 2
                const cy = y + height / 2
                return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy}`

            case "ellipse":
                const rx = width / 2
                const ry = height / 2
                const ex = x + rx
                const ey = y + ry
                return `M ${ex - rx} ${ey} A ${rx} ${ry} 0 1 0 ${ex + rx} ${ey} A ${rx} ${ry} 0 1 0 ${ex - rx} ${ey}`

            case "triangle":
                const topX = x + width / 2
                const topY = y
                return `M ${topX} ${topY} L ${x + width} ${y + height} L ${x} ${y + height} Z`

            case "line":
                if (properties?.angle !== undefined) {
                    const length = properties.width || width
                    const angle = properties.angle
                    const cx = x + width / 2
                    const cy = y + height / 2
                    const dx = Math.cos(angle) * length / 2
                    const dy = Math.sin(angle) * length / 2
                    return `M ${cx - dx} ${cy - dy} L ${cx + dx} ${cy + dy}`
                }
                return `M ${x} ${y} L ${x + width} ${y + height}`

            default:
                return ""
        }
    }
}
