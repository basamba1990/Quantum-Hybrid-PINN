'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FlaskConical, Cpu, BrainCircuit, ShieldCheck, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animations de fond */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        {/* Hero section */}
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-mono"
          >
            <Cpu className="w-3 h-3" />
            <span>Quantum-Hybrid PINN V8.0 – Production Ready</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter bg-gradient-to-r from-white via-blue-300 to-emerald-300 bg-clip-text text-transparent"
          >
            Q-Hybrid Science Verify
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            Plateforme de simulation et validation scientifique par réseaux de neurones informés par la physique (PINN). 
            Analysez, visualisez et auditez la cohérence physique de vos données.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-4 justify-center pt-4"
          >
            <Link href="/auth/login">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white shadow-lg shadow-blue-900/20">
                Se connecter
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="glass-button border-white/10 bg-white/5 text-white hover:bg-white/10">
                Accéder au Dashboard
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Fonctionnalités */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          <Card className="glass-card border-white/10 bg-white/5 backdrop-blur-sm">
            <CardHeader>
              <FlaskConical className="w-8 h-8 text-blue-400 mb-2" />
              <CardTitle className="text-white">Simulation PINN 3D</CardTitle>
              <CardDescription className="text-gray-400">
                Résolution des équations de Navier-Stokes avec apprentissage profond et EOS quantique.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Modèle hybride combinant physique et données, validation en temps réel.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 bg-white/5 backdrop-blur-sm">
            <CardHeader>
              <BrainCircuit className="w-8 h-8 text-emerald-400 mb-2" />
              <CardTitle className="text-white">Assistant IA Scientifique</CardTitle>
              <CardDescription className="text-gray-400">
                Interrogez vos simulations en langage naturel, obtenez des explications détaillées.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Intégration GPT-4o pour l'analyse de paramètres physiques et la détection d'anomalies.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 bg-white/5 backdrop-blur-sm">
            <CardHeader>
              <ShieldCheck className="w-8 h-8 text-purple-400 mb-2" />
              <CardTitle className="text-white">Audit de Souveraineté</CardTitle>
              <CardDescription className="text-gray-400">
                Évaluation de la sécurité des données et de l'indépendance technologique.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Score de crédibilité, résidus physiques, conformité RGPD et hébergement local.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pied de page */}
        <footer className="mt-32 text-center text-sm text-gray-600 border-t border-white/10 pt-8">
          <p>Quantum-Hybrid PINN V8 – Infrastructure DeepTech pour la recherche et l'industrie</p>
        </footer>
      </div>
    </div>
  )
}
