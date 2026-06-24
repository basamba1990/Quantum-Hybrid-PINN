import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySubscriptionAccess, incrementSimulationCount } from '@/lib/subscription-middleware';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { simulationConfig, userEmail } = await req.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email required' },
        { status: 400 }
      );
    }

    // Verify subscription access
    const hasAccess = await verifySubscriptionAccess(userEmail, 'starter');

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Subscription required',
          message: 'You need an active subscription to run simulations',
        },
        { status: 403 }
      );
    }

    // Increment simulation count
    await incrementSimulationCount(userEmail);

    // Call the actual simulation backend (FastAPI)
    const simulationResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com'}/api/simulations/run`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulationConfig),
      }
    );

    if (!simulationResponse.ok) {
      return NextResponse.json(
        { error: 'Simulation failed' },
        { status: 500 }
      );
    }

    const simulationData = await simulationResponse.json();

    return NextResponse.json({
      success: true,
      simulationId: simulationData.id,
      results: simulationData,
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
