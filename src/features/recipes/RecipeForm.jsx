import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { RecipeContent } from '../../components/RecipeContent'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import {
  fetchRecipe,
  saveBookmark,
  saveScrapedRecipe,
  scanRecipeUrl,
  updateRecipe,
} from '../../lib/recipes'
import { getPublicUrl, uploadImage } from '../../lib/storage'
import { supabase } from '../../supabaseClient'
import './RecipeForm.css'

export function RecipeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const cameraInputRef = useRef(null)
  const albumInputRef = useRef(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [tagIds, setTagIds] = useState([])
  const [tags, setTags] = useState([])
  const [scanMessage, setScanMessage] = useState('')
  const [scrapedContent, setScrapedContent] = useState('')
  const [scanReady, setScanReady] = useState(false)
  const [isBookmark, setIsBookmark] = useState(false)
  const [coverImagePath, setCoverImagePath] = useState(null)
  const [coverImageUrl, setCoverImageUrl] = useState(null)
  const [imageFile, setImageFile] = useState(null)
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

    if (isEdit) {
      fetchRecipe(id)
        .then((recipe) => {
          setName(recipe.name)
          setUrl(recipe.source_url || '')
          setScrapedContent(recipe.scraped_content || '')
          setIsBookmark(recipe.is_bookmark || !recipe.scraped_content)
          setScanReady(Boolean(recipe.scraped_content))
          setCoverImagePath(recipe.cover_image_path)
          setCoverImageUrl(recipe.cover_image_url)
          setTagIds(recipe.recipe_tags?.map((t) => t.tag_id) ?? [])
        })
        .catch((err) => setError(err.message))
    }
  }, [householdId, id, isEdit])

  const toggleTag = (tid) => setTagIds((p) => (p.includes(tid) ? p.filter((t) => t !== tid) : [...p, tid]))

  const handleImageSelect = (file) => {
    if (file) setImageFile(file)
  }

  const handleScan = async () => {
    if (!url.trim()) {
      setError('Enter a recipe URL first.')
      return
    }
    setLoading(true)
    setError('')
    setScanMessage('')
    setScanReady(false)
    try {
      const result = await scanRecipeUrl(url.trim())
      if (result.found) {
        setScrapedContent(result.formatted)
        if (result.title && !name.trim()) setName(result.title)
        if (result.imageUrl && !imageFile) setCoverImageUrl(result.imageUrl)
        setIsBookmark(false)
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

  const resolveCoverFields = async () => {
    let path = coverImagePath
    let externalUrl = coverImageUrl
    if (imageFile) {
      path = await uploadImage(householdId, imageFile, 'covers')
      externalUrl = null
    }
    return { coverImagePath: path, coverImageUrl: externalUrl }
  }

  const handleSaveRecipe = async () => {
    if (!householdId || !name.trim() || !url.trim() || !scrapedContent) return
    setLoading(true)
    setError('')
    try {
      const cover = await resolveCoverFields()
      if (isEdit) {
        await updateRecipe(id, {
          name,
          sourceUrl: url,
          scrapedContent,
          isBookmark: false,
          tagIds,
          ...cover,
        })
        navigate(`/recipes/${id}`)
      } else {
        await saveScrapedRecipe(householdId, {
          name,
          sourceUrl: url,
          scrapedContent,
          tagIds,
          ...cover,
        })
        navigate('/recipes')
      }
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
      const cover = await resolveCoverFields()
      if (isEdit) {
        await updateRecipe(id, {
          name,
          sourceUrl: url,
          scrapedContent: null,
          isBookmark: true,
          tagIds,
          ...cover,
        })
        navigate(`/recipes/${id}`)
      } else {
        await saveBookmark(householdId, { name, sourceUrl: url, tagIds, ...cover })
        navigate('/recipes')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!householdId || !name.trim()) return
    setLoading(true)
    setError('')
    try {
      const cover = await resolveCoverFields()
      if (isBookmark || !scrapedContent) {
        await updateRecipe(id, {
          name,
          sourceUrl: url,
          scrapedContent: null,
          isBookmark: true,
          tagIds,
          ...cover,
        })
      } else {
        await updateRecipe(id, {
          name,
          sourceUrl: url,
          scrapedContent,
          isBookmark: false,
          tagIds,
          ...cover,
        })
      }
      navigate(`/recipes/${id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const coverPreview = imageFile
    ? URL.createObjectURL(imageFile)
    : getPublicUrl(coverImagePath) || coverImageUrl

  return (
    <div className="recipe-form">
      <h2>{isEdit ? 'Edit recipe' : 'Add recipe'}</h2>
      {error && <p className="form-error">{error}</p>}
      <div className="card">
        <fieldset className="recipe-form__photo">
          <legend>Cover photo (optional)</legend>
          <div className="recipe-form__photo-btns">
            <Button type="button" variant="secondary" onClick={() => cameraInputRef.current?.click()}>
              Take photo
            </Button>
            <Button type="button" variant="ghost" onClick={() => albumInputRef.current?.click()}>
              Choose from album
            </Button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
          />
          <input
            ref={albumInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
          />
        </fieldset>
        {coverPreview && <img src={coverPreview} alt="" className="recipe-form__preview" />}
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
              if (!isEdit) {
                setScanReady(false)
                setScanMessage('')
                setScrapedContent('')
              }
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

      {scrapedContent && !isBookmark && (
        <div className="card recipe-form__preview-card">
          <h3>Preview</h3>
          <RecipeContent content={scrapedContent} />
        </div>
      )}

      {isEdit && !isBookmark && scrapedContent && (
        <div className="card">
          <label>
            Recipe text
            <textarea
              value={scrapedContent}
              onChange={(e) => setScrapedContent(e.target.value)}
              rows={8}
              className="recipe-form__content-edit"
            />
          </label>
        </div>
      )}

      {url.trim() && (
        <Button fullWidth disabled={loading} onClick={handleScan}>
          {loading ? 'Scanning…' : isEdit ? 'Re-scan URL' : 'Scan for Recipe'}
        </Button>
      )}
      {!isEdit && scanReady && (
        <Button fullWidth disabled={loading} onClick={handleSaveRecipe}>
          {loading ? 'Saving…' : 'Save Recipe'}
        </Button>
      )}
      <Button variant="secondary" fullWidth disabled={loading} onClick={handleBookmark}>
        {isEdit && isBookmark ? 'Save as bookmark' : 'Bookmark Link'}
      </Button>
      {isEdit && (
        <Button fullWidth disabled={loading} onClick={handleSaveEdit}>
          {loading ? 'Saving…' : 'Save changes'}
        </Button>
      )}
      <Button variant="ghost" fullWidth onClick={() => navigate(isEdit ? `/recipes/${id}` : '/recipes')}>
        Cancel
      </Button>
    </div>
  )
}
