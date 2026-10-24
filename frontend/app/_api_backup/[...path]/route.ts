import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://api:4000';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

async function handleProxy(request: NextRequest, pathParts: string[]) {
  const path = pathParts.join('/');
  const targetUrl = `${BACKEND_URL}/api/${path}${request.nextUrl.search}`;

  try {
    const headers = new Headers();
    // Copy necessary headers
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const accept = request.headers.get('accept');
    if (accept) headers.set('accept', accept);

    const isBodyAllowed = !['GET', 'HEAD'].includes(request.method);
    const body = isBodyAllowed ? await request.text() : undefined;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    // Handle Server-Sent Events (SSE) streaming responses
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[API Proxy Error] Failed to proxy to ${targetUrl}:`, errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GATEWAY_PROXY_ERROR',
          message: `Unable to reach backend API at ${BACKEND_URL}: ${errorMessage}`,
        },
      },
      { status: 502 }
    );
  }
}
