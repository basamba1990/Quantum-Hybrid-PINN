'use client'
import { useState, useRef } from 'react'
import { Send, Bot, User, Sparkles, BrainCircuit } from 'lucide-react'
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    // Simulation d'une réponse IA (à connecter à votre API plus tard)
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
        <ScrollArea className="flex-1 p-6">
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
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 items-center text-gray-500 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <Bot size={18} />
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
            />
            <Button type="submit" className="glass-button bg-primary/20 text-primary border-primary/20">
              <Send size={18} />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
