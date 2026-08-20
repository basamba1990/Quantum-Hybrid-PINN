import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.H2_INFERENCE_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';
    
    if (!API_URL) {
      return NextResponse.json(
        { error: 'API configuration error: No backend URL configured' },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(`${API_URL}/jobs/${id}`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({ error: 'Backend request timeout' }, { status: 504 });
      }
      return NextResponse.json({ error: `Failed to connect to backend: ${fetchError.message}` }, { status: 503 });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      throw new Error(`Backend error: ${response.status}`);
    }

    const job = await response.json();
    
    const normalizedJob = {
      jobId: job.job_id,
      name: job.name,
      status: job.status,
      createdAt: job.created_at,
      results: {
        ...job.results,
        credibilityScore: job.results?.credibility_score ?? job.results?.credibilityScore ?? job.results?.overallScore ?? null
      },
      errorMessage: job.errorMessage || job.error_message
    };
    
    return NextResponse.json(normalizedJob);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Job not found' }, { status: 404 });
  }
}
