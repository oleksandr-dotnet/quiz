import { useTranslation } from 'react-i18next'

export interface ConnectionBadgeProps {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'
  closedReason: string | null
}

// Nothing rendered `status`/`closedReason` before this - a dropped connection or a room closure
// was completely invisible. Renders nothing for the normal connected state.
export function ConnectionBadge({ status, closedReason }: ConnectionBadgeProps) {
  const { t } = useTranslation()
  if (status === 'closed') {
    return (
      <div className="connection-badge closed" role="alert" data-testid="connection-badge">
        {closedReason ? t('connection.roomClosedWithReason', { reason: closedReason }) : t('connection.roomClosed')}
      </div>
    )
  }
  if (status === 'reconnecting') {
    return (
      <div className="connection-badge reconnecting" role="status" data-testid="connection-badge">
        {t('connection.reconnecting')}
      </div>
    )
  }
  return null
}
