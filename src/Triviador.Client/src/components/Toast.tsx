export interface ToastProps {
  message: string
  tone?: 'error' | 'info'
}

// Replaces the bare red <p className="landing-error"> used for rejections and room-closed
// messages across every screen.
export function Toast({ message, tone = 'error' }: ToastProps) {
  return (
    <p className={`toast toast-${tone}`} role="alert">
      {message}
    </p>
  )
}
