import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/assistant/query
 * Traite les requêtes générales de l'assistant IA
 * 
 * Body:
 * {
 *   query: string
 *   context?: string
 *   projectId?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, context, projectId } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Générer une réponse basée sur le contexte
    const response = generateResponse(query, context, projectId)

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      userId: user.id,
    })
  } catch (error) {
    console.error('Assistant query error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Génère une réponse basée sur la requête de l'utilisateur
 */
function generateResponse(query: string, context?: string, projectId?: string): string {
  const lowerQuery = query.toLowerCase()

  // Réponses spécialisées pour les domaines scientifiques
  const responses: { [key: string]: string } = {
    'pinn': 'Les réseaux de neurones informés par la physique (PINN) combinent les données avec les équations différentielles pour créer des modèles plus précis. Pour l\'hydrogène liquide, nous utilisons l\'équation de Silvera-Goldman pour assurer la cohérence thermodynamique.',
    
    'hydrogen': 'L\'hydrogène liquide est un excellent vecteur énergétique. À l\'état liquide (14-33 K), sa densité est d\'environ 71 kg/m³. Nos modèles PINN prédisent son comportement sous différentes conditions de pression et température.',
    
    'simulation': 'Une simulation PINN combine l\'apprentissage profond avec les lois physiques. Le modèle apprend à respecter les équations de Navier-Stokes tout en s\'adaptant aux données observées.',
    
    'navier-stokes': 'Les équations de Navier-Stokes décrivent le mouvement des fluides. Elles combinent la conservation de la masse, du momentum et de l\'énergie. Notre implémentation PINN les résout en temps réel avec haute précision.',
    
    'pressure': 'La pression est calculée via l\'équation d\'état (EOS). Pour l\'hydrogène, nous utilisons Silvera-Goldman qui tient compte des interactions moléculaires complexes.',
    
    'temperature': 'La température affecte directement les propriétés du fluide. Notre modèle PINN prédit les champs de température en résolvant l\'équation de la chaleur couplée aux équations de Navier-Stokes.',
    
    'velocity': 'Le champ de vélocité représente le mouvement du fluide. Il est calculé en résolvant les équations de momentum avec les conditions aux limites appropriées.',
    
    'credibility': 'Le score de crédibilité mesure la confiance dans les prédictions du modèle. Il est basé sur les résidus physiques, les déviations par rapport aux données observées, et la cohérence thermodynamique.',
    
    'anomaly': 'Une anomalie est une déviation significative par rapport au comportement physique attendu. Notre système les détecte automatiquement et les signale pour investigation.',
    
    'validation': 'La validation physique vérifie que les résultats respectent les lois de la physique. Cela inclut la conservation de l\'énergie, du momentum et de la masse.',
  }

  // Chercher une correspondance
  for (const [key, response] of Object.entries(responses)) {
    if (lowerQuery.includes(key)) {
      return response
    }
  }

  // Réponse par défaut
  return `Je peux vous aider avec des questions sur :
- Les réseaux de neurones informés par la physique (PINN)
- L'hydrogène liquide et ses propriétés
- Les simulations et analyses
- Les équations de Navier-Stokes
- Les scores de crédibilité et validation

Que souhaitez-vous savoir ? ${context ? `\n\nContexte actuel: ${context}` : ''}`
}
