import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('payment_config')
      .select('value')
      .eq('key', 'paddle')
      .single()

    if (error || !data) {
      return NextResponse.json({ paddle_client_token: null })
    }

    const config = JSON.parse(data.value)
    // Ne renvoyer QUE le client token (clé publique)
    return NextResponse.json({ 
      paddle_client_token: config.paddle_client_token 
    })
  } catch (err) {
    return NextResponse.json({ paddle_client_token: null }, { status: 500 })
  }
}
