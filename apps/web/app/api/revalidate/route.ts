import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * ISR Revalidation Endpoint
 * Triggers on-demand revalidation of static pages
 * 
 * Usage: POST /api/revalidate?secret=YOUR_SECRET&path=/dashboard/projects/123
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const path = request.nextUrl.searchParams.get('path');

  // Verify secret for security
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json(
      { message: 'Invalid secret' },
      { status: 401 }
    );
  }

  if (!path) {
    return NextResponse.json(
      { message: 'Missing path parameter' },
      { status: 400 }
    );
  }

  try {
    // Revalidate the specified path
    revalidatePath(path);
    
    return NextResponse.json(
      { 
        revalidated: true, 
        path,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { 
        message: 'Error revalidating',
        error: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
