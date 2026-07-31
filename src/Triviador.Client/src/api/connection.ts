import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'

let conn: HubConnection | null = null

// Module singleton, not a hook: React 18 StrictMode double-mounts effects in
// dev, which would double-register handlers and double-start the connection.
export function getConnection(): HubConnection {
  if (conn) return conn

  conn = new HubConnectionBuilder()
    .withUrl('/hub/game')
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build()

  return conn
}
