import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quantum-pinn-api-qef2.onrender.com';
    const response = await fetch(`${API_URL}/jobs`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const jobs = await response.json();
    return NextResponse.json(jobs);
  } catch (error: any) {
    console.error('Failed to fetch jobs from backend:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
