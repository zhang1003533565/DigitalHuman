import { useNavigate } from 'react-router-dom'
import type { GuideChatResult } from '../api/contracts'

type GuideResultCardsProps = {
  result: GuideChatResult
  onSuggestion: (suggestion: string) => void
  messageId?: number
}

export function GuideResultCards({ result, onSuggestion, messageId }: GuideResultCardsProps) {
  const navigate = useNavigate()
  const hasActions = result.relatedSpots.length || result.recommendedRoutes.length || result.suggestions.length

  if (!hasActions && !result.sources.length) return null

  const withContext = (params: URLSearchParams) => {
    if (result.sessionId) params.set('sessionId', result.sessionId)
    if (result.traceId) params.set('traceId', result.traceId)
    if (messageId !== undefined) params.set('messageId', String(messageId))
    return params.toString()
  }

  return (
    <div className="guide-result-cards">
      {result.relatedSpots.length ? (
        <section className="guide-result-card" aria-label="相关景点">
          <strong>相关景点</strong>
          <div className="guide-result-card__actions">
            {result.relatedSpots.map((spot) => (
              <button key={spot} type="button" onClick={() => navigate(`/map?${withContext(new URLSearchParams({ spotName: spot, spot }))}`)}>
                {spot}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {result.recommendedRoutes.length ? (
        <section className="guide-result-card" aria-label="推荐路线">
          <strong>推荐路线</strong>
          <div className="guide-result-card__actions">
            {result.recommendedRoutes.map((route) => (
              <button key={route} type="button" onClick={() => navigate(`/routes?${withContext(new URLSearchParams({ routeId: route, route }))}`)}>
                {route}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {result.suggestions.length ? (
        <section className="guide-result-card" aria-label="快捷追问">
          <strong>继续问</strong>
          <div className="guide-result-card__actions guide-result-card__actions--suggestions">
            {result.suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
