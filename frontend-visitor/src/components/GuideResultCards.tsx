import { useNavigate } from 'react-router-dom'
import { buildGuideNavigationSearchParams, type GuideChatResult } from '../api/contracts'

type GuideResultCardsProps = {
  result: GuideChatResult
  onSuggestion: (suggestion: string) => void
  messageId?: number
}

export function GuideResultCards({ result, onSuggestion, messageId }: GuideResultCardsProps) {
  const navigate = useNavigate()
  const hasActions = result.relatedSpots.length || result.recommendedRoutes.length || result.suggestions.length
  const linkedResult = messageId === undefined ? result : { ...result, messageId }
  const hasFeedbackContext = Boolean(linkedResult.sessionId || linkedResult.traceId || linkedResult.messageId !== undefined)

  if (!hasActions && !result.sources.length && !hasFeedbackContext) return null

  const feedbackSearch = buildGuideNavigationSearchParams(linkedResult, {
    routeId: result.recommendedRoutes[0],
    spotName: result.relatedSpots[0],
  })

  return (
    <div className="guide-result-cards">
      {result.relatedSpots.length ? (
        <section className="guide-result-card" aria-label="相关景点">
          <strong>相关景点</strong>
          <div className="guide-result-card__actions">
            {result.relatedSpots.map((spot) => (
              <button key={spot} type="button" onClick={() => navigate(`/map?${buildGuideNavigationSearchParams(linkedResult, { spotName: spot })}`)}>
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
              <button key={route} type="button" onClick={() => navigate(`/routes?${buildGuideNavigationSearchParams(linkedResult, { routeId: route })}`)}>
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

      {hasFeedbackContext ? (
        <a className="guide-result-card__feedback" href={`/feedback?${feedbackSearch}`}>
          评价本次回答
        </a>
      ) : null}
    </div>
  )
}
