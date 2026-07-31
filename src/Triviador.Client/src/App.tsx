import { useEffect, useState } from 'react'
import { getConnection } from './api/connection'

type Status = 'connecting' | 'connected' | 'failed'

function App() {
  const [status, setStatus] = useState<Status>('connecting')
  const [pong, setPong] = useState<string | null>(null)

  useEffect(() => {
    const conn = getConnection()
    if (conn.state === 'Disconnected') {
      conn
        .start()
        .then(() => setStatus('connected'))
        .catch(() => setStatus('failed'))
    } else if (conn.state === 'Connected') {
      setStatus('connected')
    }
  }, [])

  async function ping() {
    const conn = getConnection()
    const result = await conn.invoke<string>('Ping')
    setPong(result)
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Triviador</h1>
      <p>Hub status: {status}</p>
      <button onClick={ping} disabled={status !== 'connected'}>
        Ping the server
      </button>
      {pong && <p>Server replied: {pong}</p>}
    </main>
  )
}

export default App
