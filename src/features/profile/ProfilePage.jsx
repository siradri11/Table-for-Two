import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { useAuth } from '../../hooks/useAuth'
import { useHousehold } from '../../hooks/useHousehold'
import { saveProfileDisplayName } from '../../lib/profiles'
import { supabase } from '../../supabaseClient'
import './ProfilePage.css'

export function ProfilePage() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? '')
        setLoading(false)
      })
  }, [user])

  const save = async (e) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await saveProfileDisplayName(user.id, displayName)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const copyInvite = async () => {
    if (!household?.invite_code) return
    try {
      await navigator.clipboard.writeText(household.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select and copy the code manually.')
    }
  }

  if (loading) return <p className="empty-state">Loading…</p>

  return (
    <div className="profile-page">
      <form className="card profile-page__section" onSubmit={save}>
        <h2>Your username</h2>
        <p className="profile-page__hint">Shown when you cook a recipe and in meal history.</p>
        {error && <p className="profile-page__error">{error}</p>}
        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Adrian"
          />
        </label>
        <Button type="submit" fullWidth disabled={saving}>
          {saving ? 'Saving…' : 'Save username'}
        </Button>
      </form>

      <div className="card profile-page__section">
        <h2>Family invite code</h2>
        <p className="profile-page__hint">Share this so others can join your shared kitchen.</p>
        <div className="profile-page__invite-row">
          <code className="profile-page__code">{household?.invite_code ?? '—'}</code>
          <Button type="button" variant="secondary" onClick={copyInvite}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
    </div>
  )
}
