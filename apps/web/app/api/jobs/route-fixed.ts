import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
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

    console.log(`📡 Fetching jobs from: ${API_URL}/jobs`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let response;
    try {
      response = await fetch(`${API_URL}/jobs`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error(`❌ Fetch error: ${fetchError.message}`);
      
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
      console.error(`❌ Backend error: ${response.status}`);
      throw new Error(`Backend error: ${response.status}`);
    }

    const jobs = await response.json();
    
    // Normalisation de la liste des jobs pour le frontend
    const normalizedJobs = Array.isArray(jobs) ? jobs.map((job: any) => ({
      jobId: job.job_id,
      name: job.name,
      status: job.status,
      createdAt: job.created_at,
      results: job.results,
      errorMessage: job.errorMessage || job.error_message
    })) : [];
    
    console.log(`✅ Fetched ${normalizedJobs.length} jobs`);
    return NextResponse.json(normalizedJobs);
  } catch (error: any) {
    console.error('❌ Failed to fetch jobs from backend:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
