import { NextResponse } from 'next/server'

// Whitelist of domains that are allowed to be proxied
const ALLOWED_DOMAINS = [
    'archive.org',
    'www.archive.org',
    // Add other domains as needed
]

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
        return new NextResponse('URL parameter is required', { status: 400 })
    }

    try {
        const parsedUrl = new URL(url)
        const hostname = parsedUrl.hostname

        // Check if the domain is in the allowed list
        if (!ALLOWED_DOMAINS.includes(hostname)) {
            return new NextResponse('Domain not allowed', { status: 403 })
        }

        // Fetch the remote resource
        const response = await fetch(url, {
            headers: {
                // Forward relevant headers if needed
                'User-Agent': request.headers.get('User-Agent') || '',
            },
        })

        if (!response.ok) {
            return new NextResponse(`Failed to fetch resource: ${response.status}`, { status: response.status })
        }

        // Get the content type from the response, default to octet-stream if not present
        const contentType = response.headers.get('content-type') || 'application/octet-stream'

        // Create a new response with the remote data
        const newResponse = new NextResponse(response.body, {
            status: response.status,
            headers: {
                'Content-Type': contentType,
                // CORS headers to allow the frontend to use the audio
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        })

        return newResponse
    } catch (error) {
        console.error('Audio proxy error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}