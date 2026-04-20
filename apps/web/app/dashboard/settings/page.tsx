'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { User } from '@supabase/supabase-js'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          setLoading(false)
          return
        }
        setUser(user)
        setFullName(user.user_metadata?.full_name || '')
      } catch (err) {
        console.error('Fetch user error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [supabase])

  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      })

      if (error) {
        toast.error('Erreur lors de la mise à jour')
        return
      }

      toast.success('Profil mis à jour avec succès')
    } catch (err) {
      console.error('Save profile error:', err)
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-gray-400 mt-2">Gérez votre profil et vos préférences</p>
      </div>

      {/* Profile Section */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Mettez à jour vos informations personnelles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="glass-card border-white/10 bg-white/5"
            />
            <p className="text-xs text-gray-500">L'email ne peut pas être modifié</p>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom Complet</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Entrez votre nom complet"
              className="glass-card border-white/10"
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle>Préférences</CardTitle>
          <CardDescription>Personnalisez votre expérience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="theme">Thème</Label>
            <div className="flex gap-4">
              <Button variant="outline" className="glass-card border-white/10">Mode Sombre</Button>
              <Button variant="outline" className="glass-card border-white/10">Mode Clair</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
