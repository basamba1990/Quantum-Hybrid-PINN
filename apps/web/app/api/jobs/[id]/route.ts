import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';
    const response = await fetch(`${API_URL}/jobs/${id}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      throw new Error(`Backend error: ${response.status}`);
    }

    const job = await response.json();
    return NextResponse.json(job);
  } catch (error: any) {
    console.error(`Failed to fetch job ${id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Job not found' },
      { status: 404 }
    );
  }
}
