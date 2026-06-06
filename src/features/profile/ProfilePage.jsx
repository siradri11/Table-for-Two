import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useHousehold } from '../../hooks/useHousehold'
import { saveProfileDisplayName } from '../../lib/profiles'
import { supabase } from '../../supabaseClient'
import './ProfilePage.css'

export function ProfilePage() {
  const { user } = useAuth()
  const { household, householdId, joinHouseholdWithMerge } = useHousehold()
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSoloMember, setIsSoloMember] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)

  useEffect(() => {
    if (!user || !householdId) return
    Promise.all([
      supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('household_members').select('user_id').eq('household_id', householdId),
    ]).then(([profileRes, membersRes]) => {
      setDisplayName(profileRes.data?.display_name ?? '')
      const members = membersRes.data ?? []
      setIsSoloMember(members.length === 1 && members[0].user_id === user.id)
      setLoading(false)
    })
  }, [user, householdId])

  const save = async (e) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await saveProfileDisplayName(user.id, displayName)
      setSuccess('Username saved.')
      setTimeout(() => setSuccess(''), 2000)
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

  const startJoin = (e) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setShowMergeModal(true)
  }

  const confirmJoin = async (merge) => {
    setJoinLoading(true)
    setError('')
    try {
      await joinHouseholdWithMerge(joinCode.trim(), merge)
      setShowMergeModal(false)
      setJoinCode('')
      setSuccess(merge ? 'Joined and merged your kitchen data!' : 'Joined the shared kitchen!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      setShowMergeModal(false)
    } finally {
      setJoinLoading(false)
    }
  }

  if (loading) return <p className="empty-state">Loading…</p>

  return (
    <div className="profile-page">
      {success && <p className="profile-page__success">{success}</p>}

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

      {isSoloMember ? (
        <form className="card profile-page__section" onSubmit={startJoin}>
          <h2>Join another kitchen</h2>
          <p className="profile-page__hint">
            Enter a partner&apos;s invite code if you created a solo kitchen by mistake.
          </p>
          <label>
            Invite code
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="ABC12345"
            />
          </label>
          <Button type="submit" fullWidth disabled={!joinCode.trim()}>
            Join with code
          </Button>
        </form>
      ) : (
        <div className="card profile-page__section">
          <h2>Shared kitchen</h2>
          <p className="profile-page__hint">
            You&apos;re already in a kitchen with others. Coordinate with your partner if you need to switch households.
          </p>
        </div>
      )}

      <Modal open={showMergeModal} onClose={() => setShowMergeModal(false)} title="Join this kitchen?">
        <p>Merge your pantry and recipes into the shared kitchen, or start fresh and delete your solo data?</p>
        <Button fullWidth disabled={joinLoading} onClick={() => confirmJoin(true)}>
          {joinLoading ? 'Joining…' : 'Yes, merge my data'}
        </Button>
        <Button variant="secondary" fullWidth disabled={joinLoading} onClick={() => confirmJoin(false)}>
          No, start fresh
        </Button>
        <Button variant="ghost" fullWidth onClick={() => setShowMergeModal(false)}>
          Cancel
        </Button>
      </Modal>
    </div>
  )
}
