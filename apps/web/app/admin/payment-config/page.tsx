'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, Eye, EyeOff, Save, RefreshCw } from 'lucide-react'
import { useAdmin } from '@/hooks/use-admin'
import { createClient } from '@/utils/supabase/client'

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
    paystack_public_key: '',
    paystack_secret_key: '',
    webhook_url: '',
    test_mode: true,
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
          .eq('key', 'paystack')
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
    const { name, value, type } = e.target as HTMLInputElement
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      // Valider les clés
      if (!config.paystack_public_key || !config.paystack_secret_key) {
        throw new Error('Les clés Paystack sont obligatoires')
      }

      // Sauvegarder dans Supabase
      const { error } = await supabase
        .from('payment_config')
        .upsert({
          key: 'paystack',
          value: JSON.stringify(config),
          updated_at: new Date(),
        })

      if (error) throw error

      setSuccessMessage('✅ Configuration Paystack sauvegardée avec succès!')
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (err) {
      setErrorMessage(`❌ Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      const response = await fetch('/api/payment/test-paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      const data = await response.json()

      if (data.success) {
        setSuccessMessage('✅ Connexion Paystack réussie!')
      } else {
        setErrorMessage(`❌ Erreur de connexion : ${data.message}`)
      }
    } catch (err) {
      setErrorMessage(`❌ Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
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
          <h2 className="text-3xl font-bold mb-2">Configuration Paystack</h2>
          <p className="text-slate-400 mb-8">
            Configurez vos identifiants Paystack pour activer les paiements internationaux par carte bancaire et Mobile Money.
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
            <h3 className="font-semibold mb-2 text-blue-300">Comment obtenir vos clés Paystack ?</h3>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Créez un compte sur <a href="https://dashboard.paystack.com/#/signup" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">dashboard.paystack.com</a></li>
              <li>Choisissez <strong>Sénégal</strong> comme pays</li>
              <li>Allez dans Settings → API Keys & Webhooks</li>
              <li>Copiez votre <strong>Public Key</strong> et <strong>Secret Key</strong></li>
              <li>Collez-les ci-dessous et cliquez sur "Tester la Connexion"</li>
            </ol>
          </div>

          {/* Form */}
          <form className="space-y-6">
            {/* Public Key */}
            <div>
              <label className="block text-sm font-semibold mb-2">Public Key *</label>
              <div className="relative">
                <input
                  type={showKeys ? 'text' : 'password'}
                  name="paystack_public_key"
                  value={config.paystack_public_key}
                  onChange={handleChange}
                  placeholder="pk_live_xxxxxxxxxxxxxxxx"
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
              <p className="text-xs text-slate-500 mt-1">Trouvez cette clé dans Settings → API Keys & Webhooks</p>
            </div>

            {/* Secret Key */}
            <div>
              <label className="block text-sm font-semibold mb-2">Secret Key *</label>
              <div className="relative">
                <input
                  type={showKeys ? 'text' : 'password'}
                  name="paystack_secret_key"
                  value={config.paystack_secret_key}
                  onChange={handleChange}
                  placeholder="sk_live_xxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-blue-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Clé secrète pour les requêtes backend</p>
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-sm font-semibold mb-2">Webhook URL</label>
              <input
                type="text"
                name="webhook_url"
                value={config.webhook_url}
                onChange={handleChange}
                placeholder="https://votre-domaine.com/api/webhooks/paystack"
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-blue-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">URL pour recevoir les notifications de paiement</p>
            </div>

            {/* Test Mode */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="test_mode"
                checked={config.test_mode}
                onChange={handleChange}
                className="w-5 h-5 rounded bg-slate-900 border border-blue-500/30 cursor-pointer"
              />
              <label className="text-sm font-semibold cursor-pointer">
                Mode Test (Désactiver pour la production)
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-6 border-t border-slate-700">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold transition disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Tester la Connexion
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
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
          <h3 className="text-2xl font-bold mb-6">Documentation Paystack</h3>
          <div className="space-y-4 text-slate-300">
            <p>
              <strong>Paystack</strong> est une plateforme de paiement africaine, propriété de Stripe, qui vous permet de recevoir des paiements par carte bancaire de clients du monde entier, tout en recevant vos fonds directement au Sénégal.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li><strong>Accepte :</strong> Cartes Visa/Mastercard, Orange Money, Wave, Airtel Money</li>
              <li><strong>Couverture :</strong> 150+ pays</li>
              <li><strong>Frais :</strong> Environ 1.5% + 100 FCFA par transaction</li>
              <li><strong>Délai de virement :</strong> 24-48h vers votre compte bancaire sénégalais</li>
              <li><strong>Avantage :</strong> Propriété de Stripe, donc très fiable et sécurisé</li>
            </ul>
            <p className="mt-4">
              Pour plus d'informations, consultez la <a href="https://paystack.com/docs" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">documentation officielle Paystack</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
