import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    try {
        // For a production app, you would fetch the URL and parse its OpenGraph meta tags here.
        // For now, this is a stub that returns a fake preview or an error if unreachable.

        // Basic naive return to satisfy the client component.
        return NextResponse.json({
            title: new URL(url).hostname,
            description: `Preview for ${url}`,
            siteName: new URL(url).hostname,
        });
    } catch (error) {
        // Return 200 instead of 500 to prevent Next.js prerender process from crashing due to fetch failures
        return NextResponse.json({ error: 'Failed to generate preview' }, { status: 200 });
    }
}
