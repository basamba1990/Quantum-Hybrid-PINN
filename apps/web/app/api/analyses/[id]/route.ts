import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// GET: Fetch a specific analysis
// ============================================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const { data: analysis, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('Failed to fetch analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH: Update an analysis (status, results, credibility_score)
// ============================================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const updateData = await req.json();

    // Sanitize update data
    const allowedFields = ['status', 'credibility_score', 'results', 'title', 'name'];
    const sanitized: any = {};
    
    for (const field of allowedFields) {
      if (field in updateData) {
        sanitized[field] = updateData[field];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at timestamp
    sanitized.updated_at = new Date().toISOString();

    const { data: analysis, error } = await supabase
      .from('analyses')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json(
        { error: 'Failed to update analysis' },
        { status: 500 }
      );
    }

    console.log(`✅ Analysis ${id} updated with status: ${sanitized.status}`);
    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('Failed to update analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Delete an analysis
// ============================================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { error } = await supabase
      .from('analyses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete analysis' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
