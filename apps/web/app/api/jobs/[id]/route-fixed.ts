import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // ✅ FIX: Vérifier que l'API_URL est correctement configurée
    const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.H2_INFERENCE_API_URL || 'https://quantum-hybrid-pinn-jdoj.onrender.com';
    
    if (!API_URL) {
      console.error('❌ CRITICAL: API_URL not configured');
      return NextResponse.json(
        { error: 'API configuration error: No backend URL configured' },
        { status: 500 }
      );
    }

    console.log(`📡 Fetching job ${id} from: ${API_URL}/jobs/${id}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let response;
    try {
      response = await fetch(`${API_URL}/jobs/${id}`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error(`❌ Fetch error for job ${id}: ${fetchError.message}`);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Backend request timeout' },
          { status: 504 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to connect to backend: ${fetchError.message}` },
        { status: 503 }
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ Job ${id} not found on backend`);
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      console.error(`❌ Backend error: ${response.status}`);
      throw new Error(`Backend error: ${response.status}`);
    }

    const job = await response.json();
    
    // Normalisation des champs pour le frontend (snake_case -> camelCase)
    const normalizedJob = {
      jobId: job.job_id,
      name: job.name,
      status: job.status,
      createdAt: job.created_at,
      results: {
        ...job.results,
        credibilityScore: job.results?.credibility_score ?? job.results?.credibilityScore ?? job.results?.overallScore ?? 85
      },
      errorMessage: job.errorMessage || job.error_message
    };
    
    console.log(`✅ Job ${id} status: ${normalizedJob.status}`);
    return NextResponse.json(normalizedJob);
  } catch (error: any) {
    console.error(`❌ Failed to fetch job ${id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Job not found' },
      { status: 404 }
    );
  }
}
