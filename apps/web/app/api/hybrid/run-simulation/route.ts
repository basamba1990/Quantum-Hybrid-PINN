import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Récupérer l'URL de la fonction Supabase (définie dans .env.local)
const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/hybrid-simulation-orchestrator`
  : '';

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validation basique
    if (!body.job_name || !body.case_path) {
      return NextResponse.json(
        { error: 'Missing required fields: job_name, case_path' },
        { status: 400 }
      );
    }

    // Appel à l'Edge Function Supabase
    const response = await fetch(SUPABASE_FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        projectId: body.project_id || 'legacy',
        userId: body.user_id || 'anonymous',
        jobName: body.job_name,
        casePath: body.case_path,
        nSteps: body.n_steps || 100,
        timeStep: body.time_step || 0.01,
        residualThreshold: body.residual_threshold || 0.01,
        fields: body.fields || ['U', 'p', 'T'],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Edge function error:', data);
      return NextResponse.json(
        { error: data.error || 'Edge function failed' },
        { status: response.status }
      );
    }

    // Retourner le job_id comme attendu par le composant
    return NextResponse.json({
      job_id: data.jobId,
      status: 'created',
      message: data.message,
    });
  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
