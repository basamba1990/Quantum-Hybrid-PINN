import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Génère une URL pour le portail de gestion d'abonnement (Paddle)
 * POST /api/subscriptions/portal
 */
export async function POST(req: Request) {
  try {
    const { userEmail } = await req.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Vérifier si l'utilisateur existe
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Paddle v2 gère le portail client via des liens générés ou le tableau de bord direct.
    // Pour une solution industrielle, nous redirigeons vers le portail Paddle standard.
    // Note: Dans une version avancée, on utiliserait l'API Paddle pour obtenir un lien sécurisé.
    
    return NextResponse.json({
      portalUrl: `https://checkout.paddle.com/subscription-management`,
      provider: 'paddle'
    });
  } catch (error) {
    console.error('Erreur portail abonnement:', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne' },
      { status: 500 }
    );
  }
}
