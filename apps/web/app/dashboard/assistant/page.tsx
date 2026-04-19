'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, BrainCircuit, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface AssistantContext {
  projectId?: string
  analysisId?: string
  currentSimulation?: {
    status: string
    credibilityScore?: number
    predictions?: any[]
  }
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Bonjour ! Je suis votre assistant Quantum-Hybrid PINN. Comment puis-je vous aider dans vos simulations aujourd'hui ?",
      timestamp: new Date().toISOString()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [context, setContext] = useState<AssistantContext>({})
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [messages])

  /**
   * Process user message and generate AI response
   * Integrates with Supabase Edge Function for real physics verification
   */
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = { 
      role: 'user', 
      content: input,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      // Check if user is asking about simulation analysis
      const isAnalysisRequest = /analys|verif|check|valid|coher|anomal|score|credit/i.test(input)
      
      if (isAnalysisRequest && context.projectId) {
        // Route to physics verification
        await handlePhysicsAnalysis(userMsg.content)
      } else {
        // General scientific Q&A
        await handleGeneralQuery(userMsg.content)
      }
    } catch (error) {
      console.error('Assistant error:', error)
      const errorMsg: Message = {
        role: 'assistant',
        content: "Je suis désolé, une erreur s'est produite. Veuillez réessayer.",
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMsg])
      toast.error('Erreur lors du traitement de votre demande')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle physics analysis requests
   * Calls the verify-physics-logic Edge Function
   */
  const handlePhysicsAnalysis = async (userQuery: string) => {
    try {
      if (!context.projectId) {
        throw new Error('Aucun projet sélectionné')
      }

      // Get current project data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('transcription, status')
        .eq('id', context.projectId)
        .single()

      if (projectError || !projectData?.transcription) {
        throw new Error('Transcription du projet non disponible')
      }

      // Create analysis record
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non authentifié')

      const { data: analysisRecord, error: analysisError } = await supabase
        .from('analyses')
        .insert({
          project_id: context.projectId,
          user_id: user.id,
          title: `Analyse Assistant - ${new Date().toLocaleString()}`,
          status: 'pending',
          analysis_type: 'physics_verification',
          transcription: projectData.transcription
        })
        .select()
        .single()

      if (analysisError || !analysisRecord) {
        throw new Error('Erreur lors de la création de l\'analyse')
      }

      // Call Edge Function with real data
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-physics-logic`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            projectId: context.projectId,
            analysisId: analysisRecord.id,
            transcription: projectData.transcription,
            context: 'hydrogen_storage',
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Vérification échouée: ${errorText}`)
      }

      const result = await response.json()
      const data = result.data

      // Update context with results
      setContext(prev => ({
        ...prev,
        analysisId: analysisRecord.id,
        currentSimulation: {
          status: 'completed',
          credibilityScore: data.credibilityScore,
          predictions: data.predictions3d
        }
      }))

      // Generate response based on analysis
      const assistantResponse = generatePhysicsResponse(data, userQuery)
      const assistantMsg: Message = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMsg])
      toast.success('Analyse physique complétée')

    } catch (error) {
      console.error('Physics analysis error:', error)
      const errorMsg: Message = {
        role: 'assistant',
        content: `Erreur lors de l'analyse physique: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMsg])
    }
  }

  /**
   * Handle general scientific queries
   * Uses OpenAI API for domain-specific Q&A
   */
  const handleGeneralQuery = async (userQuery: string) => {
    try {
      // Build context from current simulation if available
      const contextStr = context.currentSimulation 
        ? `Score de crédibilité actuel: ${context.currentSimulation.credibilityScore}/100. `
        : ''

      const response = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuery,
          context: contextStr,
          projectId: context.projectId,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const result = await response.json()
      const assistantMsg: Message = {
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMsg])

    } catch (error) {
      console.error('Query error:', error)
      
      // Fallback response
      const fallbackMsg: Message = {
        role: 'assistant',
        content: generateFallbackResponse(input),
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, fallbackMsg])
    }
  }

  /**
   * Generate response based on physics analysis results
   */
  const generatePhysicsResponse = (analysisData: any, userQuery: string): string => {
    const { credibilityScore, anomalies, isPhysicallyCoherent, extractedData } = analysisData

    let response = `Analyse physique complétée.\n\n`
    response += `**Score de crédibilité:** ${credibilityScore}/100\n`
    response += `**Cohérence physique:** ${isPhysicallyCoherent ? '✓ Valide' : '✗ Anomalies détectées'}\n\n`

    if (anomalies.length > 0) {
      response += `**Anomalies détectées:**\n`
      anomalies.forEach((anomaly: string) => {
        response += `- ${anomaly}\n`
      })
    } else {
      response += `Aucune anomalie majeure détectée.\n`
    }

    if (extractedData.pressure) {
      response += `\n**Paramètres extraits:**\n`
      response += `- Pression: ${(extractedData.pressure / 1e5).toFixed(1)} bar\n`
    }
    if (extractedData.temperature) {
      response += `- Température: ${extractedData.temperature.toFixed(1)} K\n`
    }

    return response
  }

  /**
   * Generate fallback response for general queries
   */
  const generateFallbackResponse = (query: string): string => {
    const responses: { [key: string]: string } = {
      'pinn': 'Les réseaux de neurones informés par la physique (PINN) combinent les données avec les équations différentielles pour créer des modèles plus précis. Pour l\'hydrogène liquide, nous utilisons l\'équation de Silvera-Goldman pour assurer la cohérence thermodynamique.',
      'hydrogen': 'L\'hydrogène liquide est un excellent vecteur énergétique. À l\'état liquide (14-33 K), sa densité est d\'environ 71 kg/m³. Nos modèles PINN prédisent son comportement sous différentes conditions de pression et température.',
      'simulation': 'Une simulation PINN combine l\'apprentissage profond avec les lois physiques. Le modèle apprend à respecter les équations de Navier-Stokes tout en s\'adaptant aux données observées.',
      'default': 'Je peux vous aider avec des questions sur les simulations PINN, l\'hydrogène liquide, ou l\'analyse physique. Que souhaitez-vous savoir ?'
    }

    for (const [key, response] of Object.entries(responses)) {
      if (query.toLowerCase().includes(key)) {
        return response
      }
    }
    return responses.default
  }

  /**
   * Set project context for analysis
   */
  const setProjectContext = (projectId: string) => {
    setContext(prev => ({ ...prev, projectId }))
  }

  return (
    <div className="p-8 h-[calc(100vh-2rem)] flex flex-col max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <BrainCircuit className="text-primary w-10 h-10" />
          Assistant Scientifique
        </h1>
        <p className="text-gray-400 mt-2">Interrogez l'IA sur vos modèles et résultats de simulation</p>
      </div>

      <Card className="flex-1 glass-card flex flex-col overflow-hidden border-white/10">
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
          <div className="space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === 'assistant' ? 'bg-primary/20 text-primary' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {m.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                  </div>
                  <div className={`p-4 rounded-2xl ${
                    m.role === 'assistant' 
                      ? 'bg-white/5 border border-white/10 rounded-tl-none' 
                      : 'bg-primary/20 border border-primary/20 rounded-tr-none'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    {m.timestamp && (
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 items-center text-gray-500">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                  <span className="text-xs">L'assistant réfléchit...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 bg-white/5">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-3"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez une question sur vos simulations..."
              className="glass-card border-white/10 focus:ring-primary/50"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              className="glass-button bg-primary/20 text-primary border-primary/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
