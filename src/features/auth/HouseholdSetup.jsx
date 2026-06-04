import { useState } from 'react'
import { Button } from '../../components/Button'
import { useHousehold } from '../../hooks/useHousehold'
import './HouseholdSetup.css'

export function HouseholdSetup() {
  const { createHousehold, joinHousehold, household } = useHousehold()
  const [mode, setMode] = useState('choose')
  const [name, setName] = useState('Our Kitchen')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createHousehold(name)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await joinHousehold(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (household) {
    return (
      <div className="household-setup card">
        <h2>{household.name}</h2>
        <p className="household-setup__code">
          Invite code: <strong>{household.invite_code}</strong>
        </p>
        <p className="household-setup__hint">Share this code with your partner to sync your pantry.</p>
      </div>
    )
  }

  if (mode === 'create') {
    return (
      <div className="household-setup">
        <form className="card" onSubmit={handleCreate}>
          <h2>Create your kitchen</h2>
          {error && <p className="household-setup__error">{error}</p>}
          <label>
            Household name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <Button type="submit" fullWidth disabled={loading}>
            Create & get invite code
          </Button>
          <button type="button" className="link-btn" onClick={() => setMode('choose')}>
            Back
          </button>
        </form>
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className="household-setup">
        <form className="card" onSubmit={handleJoin}>
          <h2>Join a kitchen</h2>
          {error && <p className="household-setup__error">{error}</p>}
          <label>
            Invite code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC12345"
              required
            />
          </label>
          <Button type="submit" fullWidth disabled={loading}>
            Join
          </Button>
          <button type="button" className="link-btn" onClick={() => setMode('choose')}>
            Back
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="household-setup">
      <div className="card household-setup__choose">
        <h2>Set up your shared kitchen</h2>
        <p>Connect with your partner so you both see the same pantry and recipes.</p>
        <Button fullWidth onClick={() => setMode('create')}>
          Create new household
        </Button>
        <Button variant="secondary" fullWidth onClick={() => setMode('join')}>
          Join with invite code
        </Button>
      </div>
    </div>
  )
}
