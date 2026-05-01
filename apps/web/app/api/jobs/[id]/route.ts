import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('hybrid_simulations')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    const job = {
      jobId: data.id,
      name: data.job_name,
      status: data.status,
      createdAt: data.created_at,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      results: data.results,
      errorMessage: data.error_message,
    };

    return NextResponse.json(job);
  } catch (error: any) {
    console.error(`Failed to fetch job ${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Job not found' },
      { status: 404 }
    );
  }
}
