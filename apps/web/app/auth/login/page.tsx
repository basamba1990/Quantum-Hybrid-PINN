'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react'

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
  
  // Récupérer les erreurs potentielles passées en URL
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) setErrorMsg(decodeURIComponent(error))
  }, [searchParams])

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      )
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
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

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
        data: {
          full_name: fullName,
        }
      },
    })

    if (error) {
      setErrorMsg(error.message)
    } else if (data.user && data.session) {
      setSuccessMsg("Inscription réussie ! Redirection...")
      setTimeout(() => router.push('/dashboard'), 1500)
    } else {
      setSuccessMsg("Un email de confirmation a été envoyé à votre adresse. Veuillez le consulter pour activer votre compte.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-600/10 rounded-full blur-[100px] -z-10" />

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2">
            Q-Hybrid <span className="text-blue-500">Verify</span>
          </h1>
          <p className="text-gray-400 text-sm">Plateforme de Validation Scientifique Quantique</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 p-1 rounded-xl">
            <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Connexion
            </TabsTrigger>
            <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Inscription
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            {errorMsg && (
              <Alert variant="destructive" className="mb-4 bg-red-500/10 border-red-500/20 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {successMsg && (
              <Alert className="mb-4 bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{successMsg}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="login">
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden">
                <form onSubmit={handleLogin}>
                  <CardHeader>
                    <CardTitle className="text-white">Bon retour</CardTitle>
                    <CardDescription className="text-gray-500">Connectez-vous à votre nexus scientifique.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-login" className="text-gray-400">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input 
                          id="email-login"
                          type="email" 
                          placeholder="nom@exemple.com" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-white/5 border-white/10 pl-10 text-white focus:ring-blue-500/50"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password-login" className="text-gray-400">Mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input 
                          id="password-login"
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-white/5 border-white/10 pl-10 text-white focus:ring-blue-500/50"
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl transition-all"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                      Se connecter
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden">
                <form onSubmit={handleSignUp}>
                  <CardHeader>
                    <CardTitle className="text-white">Créer un compte</CardTitle>
                    <CardDescription className="text-gray-500">Rejoignez la plateforme Quantum-Hybrid.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name-signup" className="text-gray-400">Nom complet</Label>
                      <Input 
                        id="name-signup"
                        placeholder="Jean Dupont" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-white/5 border-white/10 text-white focus:ring-emerald-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-signup" className="text-gray-400">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input 
                          id="email-signup"
                          type="email" 
                          placeholder="nom@exemple.com" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-white/5 border-white/10 pl-10 text-white focus:ring-emerald-500/50"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password-signup" className="text-gray-400">Mot de passe (min. 6 caractères)</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input 
                          id="password-signup"
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-white/5 border-white/10 pl-10 text-white focus:ring-emerald-500/50"
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 rounded-xl transition-all"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                      S'inscrire
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <p className="text-center text-xs text-gray-600">
          En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
        </p>
      </div>
    </div>
  )
}
