import './TagChip.css'

export function TagChip({ tag, selected, onClick, small }) {
  const style = {
    backgroundColor: selected ? tag.color : `${tag.color}55`,
    borderColor: tag.color,
  }
  return (
    <button
      type="button"
      className={`tag-chip ${selected ? 'tag-chip--selected' : ''} ${small ? 'tag-chip--small' : ''}`}
      style={style}
      onClick={onClick}
    >
      {tag.name}
    </button>
  )
}
