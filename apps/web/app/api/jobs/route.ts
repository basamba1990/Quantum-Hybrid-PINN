import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-hybrid-pinn-jdoj.onrender.com';
    const response = await fetch(`${API_URL}/jobs`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
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
    
    return NextResponse.json(normalizedJobs);
  } catch (error: any) {
    console.error('Failed to fetch jobs from backend:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
