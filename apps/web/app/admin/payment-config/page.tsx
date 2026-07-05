'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, Eye, EyeOff, Save, RefreshCw, ExternalLink, Database } from 'lucide-react'
import { useAdmin } from '@/hooks/use-admin'
import { createClient } from '@/lib/supabase/client'

export default function PaymentConfigPage() {
  const router = useRouter()
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [config, setConfig] = useState({
    paddle_vendor_id: '',
    paddle_client_token: '',
    paddle_webhook_secret: '',
    webhook_url: '',
  })

  // Vérifier l'accès admin
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/dashboard')
    }
  }, [isAdmin, adminLoading, router])

  // Charger la configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('payment_config')
          .select('*')
          .eq('key', 'paddle')
          .single()

        if (data) {
          setConfig(JSON.parse(data.value))
        }
      } catch (err) {
        console.error('Error loading config:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (isAdmin) {
      loadConfig()
    }
  }, [isAdmin, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setConfig(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      // Valider les clés
      if (!config.paddle_vendor_id || !config.paddle_client_token) {
        throw new Error('Les identifiants Paddle sont obligatoires')
      }

      // Sauvegarder dans Supabase
      console.log('Tentative de sauvegarde dans payment_config:', config)
      
      const { error } = await supabase
        .from('payment_config')
        .upsert({
          key: 'paddle',
          value: JSON.stringify(config),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key'
        })

      if (error) {
        console.error('Erreur Supabase détaillée:', error)
        throw new Error(`Supabase Error: ${error.message} (${error.code})`)
      }

      setSuccessMessage('✅ Configuration Paddle sauvegardée avec succès!')
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (err) {
      setErrorMessage(`❌ Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (adminLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">
          <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-blue-500/20 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-400">Admin Dashboard</h1>
          <span className="text-sm bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
            Admin Access
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-slate-800/50 border border-blue-500/20 rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-2">Configuration Paddle</h2>
          <p className="text-slate-400 mb-8">
            Configurez vos identifiants Paddle pour activer les paiements internationaux par carte bancaire, PayPal et Apple Pay.
          </p>

          {/* Messages */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300">{errorMessage}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="mb-8 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <h3 className="font-semibold mb-2 text-blue-300">Comment obtenir vos identifiants Paddle ?</h3>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Créez un compte sur <a href="https://www.paddle.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 inline-flex">paddle.com <ExternalLink className="w-3 h-3" /></a></li>
              <li>Choisissez <strong>Sénégal</strong> comme pays</li>
              <li>Allez dans Developer Tools → Authentication</li>
              <li>Copiez votre <strong>Vendor ID</strong> et <strong>Client Token</strong></li>
              <li>Allez dans Webhooks et enregistrez : <code className="bg-slate-900 px-2 py-1 rounded text-xs">https://quantum-hybrid-pinn-web.vercel.app/api/webhooks/paddle</code></li>
              <li>Copiez le <strong>Webhook Secret</strong> généré</li>
            </ol>
          </div>

          {/* Form */}
          <form className="space-y-6">
            {/* Vendor ID */}
            <div>
              <label className="block text-sm font-semibold mb-2">Vendor ID *</label>
              <input
                type="text"
                name="paddle_vendor_id"
                value={config.paddle_vendor_id}
                onChange={handleChange}
                placeholder="123456"
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-blue-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Trouvez cet ID dans Developer Tools → Authentication</p>
            </div>

            {/* Client Token */}
            <div>
              <label className="block text-sm font-semibold mb-2">Client Token *</label>
              <div className="relative">
                <input
                  type={showKeys ? 'text' : 'password'}
                  name="paddle_client_token"
                  value={config.paddle_client_token}
                  onChange={handleChange}
                  placeholder="ctk_live_xxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-blue-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(!showKeys)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showKeys ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Clé publique pour le frontend Paddle Checkout</p>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-sm font-semibold mb-2">Webhook Secret *</label>
              <div className="relative">
                <input
                  type={showKeys ? 'text' : 'password'}
                  name="paddle_webhook_secret"
                  value={config.paddle_webhook_secret}
                  onChange={handleChange}
                  placeholder="whk_live_xxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-blue-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Clé secrète pour vérifier les webhooks</p>
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-sm font-semibold mb-2">Webhook URL</label>
              <input
                type="text"
                name="webhook_url"
                value={config.webhook_url}
                onChange={handleChange}
                placeholder="https://quantum-hybrid-pinn-web.vercel.app/api/webhooks/paddle"
                disabled
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-blue-500/30 text-slate-400 placeholder-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">URL automatique pour recevoir les notifications</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-6 border-t border-slate-700">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/admin/inject-demo', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) alert('Projet démo industriel injecté !');
                    else alert('Erreur: ' + data.error);
                  } catch (e) { alert('Erreur réseau'); }
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold transition"
              >
                <Database className="w-4 h-4" />
                Injecter Projet Démo
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm text-amber-300">
              ⚠️ <strong>Sécurité :</strong> Ne partagez jamais vos clés secrètes. Ces informations sont stockées de manière sécurisée et ne sont jamais affichées publiquement.
            </p>
          </div>
        </div>

        {/* Documentation */}
        <div className="mt-12 bg-slate-800/50 border border-blue-500/20 rounded-lg p-8">
          <h3 className="text-2xl font-bold mb-6">Pourquoi Paddle ?</h3>
          <div className="space-y-4 text-slate-300">
            <p>
              <strong>Paddle</strong> est la solution idéale pour les entrepreneurs au Sénégal qui veulent vendre un SaaS à l'international. Contrairement à Stripe ou Paystack, Paddle agit comme "Merchant of Record".
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li><strong>Accepte :</strong> Cartes Visa/Mastercard, PayPal, Apple Pay, Google Pay</li>
              <li><strong>Couverture :</strong> 200+ pays</li>
              <li><strong>Frais :</strong> 5% + frais de paiement (transparents)</li>
              <li><strong>Délai de virement :</strong> Flexible (hebdomadaire, mensuel)</li>
              <li><strong>Avantage :</strong> Gère les taxes, la conformité et les paiements pour vous</li>
              <li><strong>Disponibilité :</strong> ✅ Accessible depuis le Sénégal</li>
            </ul>
            <p className="mt-4">
              Pour plus d'informations, consultez la <a href="https://developer.paddle.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">documentation officielle Paddle</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
