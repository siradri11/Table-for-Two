export function ConfigErrorScreen({ details }) {
  return (
    <div
      style={{
        minHeight: '100svh',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        background: '#faf7f2',
        color: '#3d3632',
      }}
    >
      <h1 style={{ fontSize: '1.4rem' }}>Table for Two — setup needed</h1>
      <p>The app could not start because Supabase environment variables are missing or invalid.</p>
      <pre
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 12,
          overflow: 'auto',
          fontSize: '0.85rem',
          border: '1px solid #ebe6df',
        }}
      >
        {details}
      </pre>
      <p style={{ marginTop: 16, lineHeight: 1.5 }}>
        <strong>Vercel:</strong> Project → Settings → Environment Variables → add{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then <strong>Redeploy</strong>.
      </p>
    </div>
  )
}
