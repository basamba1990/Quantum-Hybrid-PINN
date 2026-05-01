import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('hybrid_simulations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transformer pour correspondre à l'interface JobStatus
    const jobs = data.map((job: any) => ({
      jobId: job.id,
      name: job.job_name,
      status: job.status,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      results: job.results,
      errorMessage: job.error_message,
    }));

    return NextResponse.json(jobs);
  } catch (error: any) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
