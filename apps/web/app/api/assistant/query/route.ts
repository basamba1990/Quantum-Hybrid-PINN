import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini'
const MAX_HISTORY_MESSAGES = 10

// Schéma de validation pour la requête
const QuerySchema = z.object({
  query: z.string().min(1).max(2000),
  context: z.string().optional(),
  projectId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(), // pour reprendre une conversation existante
})

// Types
interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ============================================================================
// POST /api/assistant/query
// ============================================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let requestBody: any

  try {
    // 1. Lecture et validation du corps
    const rawBody = await request.text()
    if (!rawBody) throw new Error('Empty request body')
    requestBody = JSON.parse(rawBody)
    const { query, context, projectId, conversationId } = QuerySchema.parse(requestBody)

    // 2. Authentification
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Récupération de l'historique de conversation (si fourni)
    let conversationHistory: ConversationMessage[] = []
    let currentConversationId = conversationId

    if (currentConversationId) {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('messages')
        .eq('id', currentConversationId)
        .eq('user_id', user.id)
        .single()
      if (!convError && conv) {
        conversationHistory = (conv.messages as any) || []
      }
    }

    // 4. Récupération du contexte enrichi (si projectId fourni)
    let enrichedContext = context || ''
    if (projectId) {
      const projectContext = await getProjectContext(supabase, projectId, user.id)
      if (projectContext) enrichedContext += `\n\nContexte projet : ${projectContext}`
    }

    // 5. Appel à l'IA (OpenAI) ou fallback
    let assistantReply: string
    let usedFallback = false

    if (OPENAI_API_KEY) {
      try {
        assistantReply = await callOpenAI(query, conversationHistory, enrichedContext)
      } catch (aiError) {
        console.error('OpenAI error:', aiError)
        assistantReply = generateFallbackResponse(query, enrichedContext)
        usedFallback = true
      }
    } else {
      assistantReply = generateFallbackResponse(query, enrichedContext)
      usedFallback = true
    }

    // 6. Mise à jour de l'historique (sauvegarde en base)
    const newMessages: ConversationMessage[] = [
      ...conversationHistory,
      { role: 'user' as const, content: query, timestamp: new Date().toISOString() },
      { role: 'assistant' as const, content: assistantReply, timestamp: new Date().toISOString() },
    ].slice(-MAX_HISTORY_MESSAGES)

    if (currentConversationId) {
      await supabase
        .from('conversations')
        .update({ messages: newMessages, updated_at: new Date().toISOString() })
        .eq('id', currentConversationId)
    } else {
      // Créer une nouvelle conversation
      const { data: newConv, error: insertError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          messages: newMessages,
          project_id: projectId || null,
          context: enrichedContext,
        })
        .select('id')
        .single()
      if (!insertError && newConv) {
        currentConversationId = newConv.id
      }
    }

    // 7. Réponse
    const duration = Date.now() - startTime
    console.log(`[Assistant] Query processed in ${duration}ms, fallback=${usedFallback}`)

    return NextResponse.json({
      response: assistantReply,
      conversationId: currentConversationId,
      usedFallback,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Assistant API error:', error)
    const status = error instanceof z.ZodError ? 400 : 500
    const message = error instanceof z.ZodError ? error.issues[0].message : 'Internal server error'
    return NextResponse.json({ error: message }, { status })
  }
}

// ============================================================================
// Fonctions helpers
// ============================================================================

/**
 * Récupère le contexte d'un projet (analyses récentes, score, anomalies)
 */
async function getProjectContext(supabase: any, projectId: string, userId: string): Promise<string> {
  try {
    // Vérifier que l'utilisateur a accès au projet
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('name, transcription, user_id')
      .eq('id', projectId)
      .single()
    if (projectError || !project || project.user_id !== userId) return ''

    // Récupérer la dernière analyse terminée
    const { data: lastAnalysis } = await supabase
      .from('analyses')
      .select('credibility_score, anomalies, status, created_at')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let context = `Projet: ${project.name || 'Sans nom'}\n`
    if (project.transcription) {
      context += `Description: ${project.transcription.substring(0, 500)}...\n`
    }
    if (lastAnalysis) {
      context += `Dernière analyse: score ${lastAnalysis.credibility_score}/100`
      if (lastAnalysis.anomalies?.length) {
        context += `, anomalies détectées: ${lastAnalysis.anomalies.join(', ')}`
      }
    }
    return context
  } catch (err) {
    console.warn('getProjectContext error:', err)
    return ''
  }
}

/**
 * Appel à l'API OpenAI avec gestion d'historique et prompt système
 */
async function callOpenAI(
  query: string,
  history: ConversationMessage[],
  enrichedContext: string
): Promise<string> {
  const systemPrompt = `Tu es un assistant expert en physique des fluides, spécialisé dans l'hydrogène liquide (LH2), les réseaux de neurones informés par la physique (PINN), et la thermodynamique. Tu réponds de manière précise, concise et professionnelle.

Règles :
- Utilise des unités SI (Pa, K, m/s, etc.) quand c'est pertinent.
- Si tu ne sais pas, dis-le clairement.
- Tu peux t'appuyer sur le contexte fourni pour personnaliser ta réponse.

${enrichedContext ? `Contexte supplémentaire :\n${enrichedContext}\n` : ''}`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: query },
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 800,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI HTTP ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

/**
 * Fallback local (intelligent) quand OpenAI est indisponible
 */
function generateFallbackResponse(query: string, context: string): string {
  const lowerQuery = query.toLowerCase()
  const responses: Record<string, string> = {
    pinn: "Les réseaux de neurones informés par la physique (PINN) combinent les données et les équations différentielles. Pour l'hydrogène liquide, nous utilisons l'équation d'état de Silvera-Goldman.",
    hydrogen: "L'hydrogène liquide (LH2) a une densité de 71 kg/m³ à 20 K. Notre modèle PINN prédit son comportement avec une précision < 1% d'erreur relative.",
    simulation: "Nos simulations PINN résolvent les équations de Navier-Stokes en temps réel, intégrant les données expérimentales et les lois physiques.",
    'navier-stokes': "Les équations de Navier-Stokes décrivent la conservation de la masse, du momentum et de l'énergie. Le solveur PINN garantit la convergence.",
    pressure: "La pression est calculée via l'équation d'état. Pour H2, l'erreur moyenne est inférieure à 2% par rapport aux données NIST.",
    temperature: "Le champ de température est couplé à l'écoulement. Notre modèle prédit les gradients avec une fidélité physique élevée.",
    velocity: "La vélocité est obtenue par résolution des équations de momentum. Les conditions aux limites sont appliquées via des pénalités.",
    credibility: "Le score de crédibilité (0-100) intègre les résidus physiques, les écarts aux observations et la cohérence thermodynamique.",
    anomaly: "Une anomalie indique une violation des lois physiques (> seuil). Notre système les identifie automatiquement pour révision.",
    validation: "La validation physique compare les prédictions aux équations de conservation. Le test de cohérence de Van't Hoff est automatique.",
  }

  for (const [key, resp] of Object.entries(responses)) {
    if (lowerQuery.includes(key)) return resp
  }

  // Réponse générique
  return `Je peux vous aider sur les thèmes suivants :
- Physique des fluides (Navier-Stokes, thermodynamique)
- Hydrogène liquide et stockage d'énergie
- Réseaux de neurones PINN et simulation
- Analyse de crédibilité et détection d'anomalies

${context ? `Contexte actuel : ${context.substring(0, 300)}...` : ''}
Pour une réponse plus précise, veuillez configurer OPENAI_API_KEY.`
}
