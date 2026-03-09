"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, Stage, useGLTF } from "@react-three/drei"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"

interface ModelPreviewProps {
    url: string
}

function Model({ url }: { url: string }) {
    const { scene } = useGLTF(url)
    return <primitive object={scene} />
}

export function ModelPreview({ url }: ModelPreviewProps) {
    return (
        <div className="h-[60vh] w-full bg-slate-900 rounded-lg overflow-hidden relative">
            <Suspense
                fallback={
                    <div className="absolute inset-0 flex items-center justify-center text-cyan-400">
                        <Loader2 className="w-8 h-8 animate-spin mr-2" />
                        <span>Loading 3D Model...</span>
                    </div>
                }
            >
                <Canvas shadows dpr={[1, 2]} camera={{ fov: 50 }}>
                    <Stage environment="city" intensity={0.6}>
                        <Model url={url} />
                    </Stage>
                    <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
                </Canvas>
            </Suspense>
        </div>
    )
}
