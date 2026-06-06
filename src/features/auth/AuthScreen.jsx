import { useState } from 'react'
import { Button } from '../../components/Button'
import './AuthScreen.css'

export function AuthScreen({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') await onSignIn(email, password)
      else await onSignUp(email, password)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__hero">
        <img src="/logo.png" alt="Table for Two" className="auth-screen__logo" />
        <p>Your cozy kitchen companion</p>
      </div>
      <form className="auth-screen__form card" onSubmit={submit}>
        <h2>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h2>
        {error && <p className="auth-screen__error">{error}</p>}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </Button>
        <button
          type="button"
          className="auth-screen__toggle"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
