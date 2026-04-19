'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, BrainCircuit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Bonjour ! Je suis votre assistant Quantum-Hybrid PINN. Comment puis-je vous aider dans vos simulations aujourd'hui ?" }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Défilement automatique vers le bas quand un message arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    setTimeout(() => {
      const assistantMsg: Message = { 
        role: 'assistant', 
        content: `J'ai analysé votre demande concernant "${userMsg.content}". Pour les modèles PINN, je recommande de vérifier la distribution de pression à T=0.5s en utilisant le solveur hybride.` 
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsLoading(false)
    }, 1500)
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
            {/* ... le reste du JSX identique ... */}
          </div>
        </ScrollArea>
        {/* ... formulaire identique ... */}
      </Card>
    </div>
  )
}
