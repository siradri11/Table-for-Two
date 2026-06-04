import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [testItem, setTestItem] = useState('Checking pantry...')

  useEffect(() => {
    // This function reaches out to Supabase when the app loads
    async function pingDatabase() {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .limit(1)

      if (error) {
        console.error("Error connecting:", error)
        setTestItem('Connection failed! Check the console.')
      } else if (data && data.length > 0) {
        setTestItem(`Success! We found: ${data[0].item_name}`)
      } else {
        setTestItem('Connected, but the pantry is empty!')
      }
    }

    pingDatabase()
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Table for Two 🍽️</h1>
      <h2>Database Test Status:</h2>
      <p style={{ fontSize: '20px', color: 'green', fontWeight: 'bold' }}>
        {testItem}
      </p>
    </div>
  )
}

export default App