"use client"

interface OfficePreviewProps {
    url: string
}

export function OfficePreview({ url }: OfficePreviewProps) {
    // Use Microsoft Office Online Viewer
    const encodedUrl = encodeURIComponent(url)
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`

    return (
        <div className="w-full h-[70vh] bg-white rounded-lg overflow-hidden">
            <iframe
                src={viewerUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                title="Office Document Preview"
            />
        </div>
    )
}
