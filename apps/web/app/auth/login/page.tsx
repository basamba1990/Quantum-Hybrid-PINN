'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) setErrorMsg(decodeURIComponent(error))
  }, [searchParams])

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateEmail(email)) {
      setErrorMsg("Veuillez entrer une adresse email valide.")
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      const next = searchParams.get('next') || '/dashboard'
      router.push(next)
      router.refresh()
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateEmail(email)) {
      setErrorMsg("Veuillez entrer une adresse email valide.")
      return
    }
    if (password.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.")
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName }
      },
    })

    if (error) {
      setErrorMsg(error.message)
    } else if (data.user && data.session) {
      setSuccessMsg("Inscription réussie ! Redirection...")
      setTimeout(() => router.push('/dashboard'), 1500)
    } else {
      setSuccessMsg("Un email de confirmation a été envoyé. Veuillez activer votre compte.")
    }
    setLoading(false)
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black">
      {/* Background Image with Animation */}
      <motion.div 
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.6 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute inset-0 z-0"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/images/quantum-bg.png")' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      </motion.div>

      {/* Animated Particles Overlay (CSS only for performance) */}
      <div className="absolute inset-0 z-1 pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full blur-sm animate-pulse" />
        <div className="absolute top-3/4 left-2/3 w-3 h-3 bg-purple-400 rounded-full blur-md animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-emerald-400 rounded-full blur-none animate-ping delay-1000" />
      </div>

      {/* Main Content Container */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
            className="inline-block mb-4"
          >
            <h1 className="text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              Q-Hybrid <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Verify</span>
            </h1>
          </motion.div>
          <p className="text-blue-200/60 text-sm font-medium tracking-widest uppercase">
            Nexus de Validation Scientifique
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 backdrop-blur-md border border-white/10 p-1 rounded-2xl mb-8">
            <TabsTrigger value="login" className="rounded-xl py-2.5 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              Connexion
            </TabsTrigger>
            <TabsTrigger value="signup" className="rounded-xl py-2.5 transition-all data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(5,150,105,0.4)]">
              Inscription
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key="auth-container"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
            >
              {errorMsg && (
                <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/20 text-red-400 backdrop-blur-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              {successMsg && (
                <Alert className="mb-6 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 backdrop-blur-md">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>{successMsg}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login" className="mt-0 outline-none">
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2 text-center mb-6">
                      <h2 className="text-2xl font-bold text-white">Bon retour</h2>
                      <p className="text-gray-400 text-sm">Réactivez votre nexus de recherche.</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email-login" className="text-gray-300 ml-1">Email</Label>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                          <Input 
                            id="email-login"
                            type="email" 
                            placeholder="nom@exemple.com" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-white/5 border-white/10 pl-12 h-12 text-white rounded-xl focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-gray-600"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password-login" className="text-gray-300 ml-1">Mot de passe</Label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                          <Input 
                            id="password-login"
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-white/5 border-white/10 pl-12 h-12 text-white rounded-xl focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-14 rounded-2xl transition-all shadow-lg shadow-blue-900/20 group"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                      Se connecter
                    </Button>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 outline-none">
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
                  <form onSubmit={handleSignUp} className="space-y-6">
                    <div className="space-y-2 text-center mb-6">
                      <h2 className="text-2xl font-bold text-white">Créer un compte</h2>
                      <p className="text-gray-400 text-sm">Rejoignez l'élite scientifique hybride.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name-signup" className="text-gray-300 ml-1">Nom complet</Label>
                        <Input 
                          id="name-signup"
                          placeholder="Jean Dupont" 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="bg-white/5 border-white/10 h-12 text-white rounded-xl focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-gray-600"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email-signup" className="text-gray-300 ml-1">Email</Label>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                          <Input 
                            id="email-signup"
                            type="email" 
                            placeholder="nom@exemple.com" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-white/5 border-white/10 pl-12 h-12 text-white rounded-xl focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-gray-600"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password-signup" className="text-gray-300 ml-1">Mot de passe (min. 6)</Label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                          <Input 
                            id="password-signup"
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-white/5 border-white/10 pl-12 h-12 text-white rounded-xl focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-14 rounded-2xl transition-all shadow-lg shadow-emerald-900/20 group"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />}
                      S'inscrire
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-12 text-center"
        >
          <p className="text-xs text-gray-500 leading-relaxed max-w-[280px] mx-auto">
            En continuant, vous acceptez nos <span className="text-blue-400/60 cursor-pointer hover:text-blue-400 transition-colors">conditions d'utilisation</span> et notre <span className="text-blue-400/60 cursor-pointer hover:text-blue-400 transition-colors">politique de confidentialité</span>.
          </p>
        </motion.div>
      </motion.div>

      {/* Decorative Glows */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[150px] -z-5" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[120px] -z-5" />
    </div>
  )
}
