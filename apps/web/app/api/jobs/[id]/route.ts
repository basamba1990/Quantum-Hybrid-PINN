import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    return NextResponse.json(
      { error: error.message || 'Job not found' },
      { status: 404 }
    );
  }
}
