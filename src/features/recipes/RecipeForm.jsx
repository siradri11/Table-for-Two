import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { saveBookmark, saveScrapedRecipe, scanRecipeUrl } from '../../lib/recipes'
import { supabase } from '../../supabaseClient'
import './RecipeForm.css'

export function RecipeForm() {
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [tagIds, setTagIds] = useState([])
  const [tags, setTags] = useState([])
  const [scanMessage, setScanMessage] = useState('')
  const [scrapedContent, setScrapedContent] = useState('')
  const [scanReady, setScanReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!householdId) return
    supabase
      .from('tags')
      .select('*')
      .eq('household_id', householdId)
      .eq('category', 'recipe')
      .then(({ data }) => setTags(data ?? []))
  }, [householdId])

  const toggleTag = (tid) => setTagIds((p) => (p.includes(tid) ? p.filter((t) => t !== tid) : [...p, tid]))

  const handleScan = async () => {
    if (!url.trim()) {
      setError('Enter a recipe URL first.')
      return
    }
    setLoading(true)
    setError('')
    setScanMessage('')
    setScanReady(false)
    setScrapedContent('')
    try {
      const result = await scanRecipeUrl(url.trim())
      if (result.found) {
        setScrapedContent(result.formatted)
        if (result.title && !name.trim()) setName(result.title)
        setScanMessage('Recipe available to save!')
        setScanReady(true)
      } else {
        setScanMessage('No Recipe schema found on this page. You can still bookmark the link.')
        setScanReady(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRecipe = async () => {
    if (!householdId || !name.trim() || !url.trim() || !scrapedContent) return
    setLoading(true)
    setError('')
    try {
      await saveScrapedRecipe(householdId, {
        name,
        sourceUrl: url,
        scrapedContent,
        tagIds,
      })
      navigate('/recipes')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBookmark = async () => {
    if (!householdId || !name.trim() || !url.trim()) return
    setLoading(true)
    setError('')
    try {
      await saveBookmark(householdId, { name, sourceUrl: url, tagIds })
      navigate('/recipes')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="recipe-form">
      <h2>Add recipe</h2>
      {error && <p className="form-error">{error}</p>}
      <div className="card">
        <label>
          Recipe name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Garlic pasta" required />
        </label>
        <label>
          Recipe URL
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setScanReady(false)
              setScanMessage('')
              setScrapedContent('')
            }}
            placeholder="https://…"
            required
          />
        </label>
        <fieldset>
          <legend>Tags (optional)</legend>
          <div className="recipe-form__tags">
            {tags.map((t) => (
              <TagChip key={t.id} tag={t} selected={tagIds.includes(t.id)} onClick={() => toggleTag(t.id)} />
            ))}
          </div>
        </fieldset>
      </div>

      {scanMessage && <p className="recipe-form__scan-msg">{scanMessage}</p>}

      {scrapedContent && (
        <div className="card recipe-form__preview">
          <h3>Preview</h3>
          <pre className="recipe-form__preview-text">{scrapedContent}</pre>
        </div>
      )}

      <Button fullWidth disabled={loading} onClick={handleScan}>
        {loading ? 'Scanning…' : 'Scan for Recipe'}
      </Button>
      {scanReady && (
        <Button fullWidth disabled={loading} onClick={handleSaveRecipe}>
          Save Recipe
        </Button>
      )}
      <Button variant="secondary" fullWidth disabled={loading} onClick={handleBookmark}>
        Bookmark Link
      </Button>
      <Button variant="ghost" fullWidth onClick={() => navigate('/recipes')}>
        Cancel
      </Button>
    </div>
  )
}
