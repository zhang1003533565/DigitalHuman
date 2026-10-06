import { useState, type FormEvent } from 'react'

import { apiClient, getApiProblem } from '../api/client'
import type { TripPlanRequest, TripPlanResponse } from '../api/contracts'
import { createTripPlanCache } from '../pages/navigationContext'

type TripPlannerProps = {
  onPlanned: (routeId: string) => void
}

const INITIAL_PLAN: Required<TripPlanRequest> = {
  interest: '文化祈福',
  durationHours: 5,
  intensity: '轻松少走',
  groupType: 'family',
}

export function TripPlanner({ onPlanned }: TripPlannerProps) {
  const [plan, setPlan] = useState(INITIAL_PLAN)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const { data } = await apiClient.post<TripPlanResponse>('/user/scenic/trip-plan', plan)
      if (!data.route?.id) {
        throw new Error(data.reminders[0] || '暂时没有匹配的路线')
      }
      sessionStorage.setItem('digitalhuman.tripPlan', createTripPlanCache(data))
      onPlanned(data.route.id)
    } catch (requestError) {
      setError(getApiProblem(requestError).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="hp-trip-planner" onSubmit={submitPlan} aria-label="快捷行程规划">
      <div className="hp-trip-planner__heading">
        <strong>快捷行程规划</strong>
        <span>选择游览方式，开启你的大境门之行</span>
      </div>
      <div className="hp-trip-planner__fields">
        <label>
          游览兴趣
          <select value={plan.interest} onChange={(event) => setPlan({ ...plan, interest: event.target.value })}>
            <option value="长城文化">长城文化</option>
            <option value="非遗手作">非遗手作</option>
            <option value="农家美食">农家美食</option>
            <option value="民俗风情">民俗风情</option>
          </select>
        </label>
        <label>
          游玩时长
          <select value={plan.durationHours} onChange={(event) => setPlan({ ...plan, durationHours: Number(event.target.value) })}>
            <option value={2}>2 小时</option>
            <option value={3}>3 小时</option>
            <option value={5}>半天</option>
            <option value={8}>一整天</option>
          </select>
        </label>
        <label>
          游览强度
          <select value={plan.intensity} onChange={(event) => setPlan({ ...plan, intensity: event.target.value })}>
            <option value="城门漫游">城门漫游</option>
            <option value="古道寻踪">古道寻踪</option>
            <option value="长城登临">长城登临</option>
          </select>
        </label>
        <label>
          同行人
          <select value={plan.groupType} onChange={(event) => setPlan({ ...plan, groupType: event.target.value })}>
            <option value="family">家庭亲子</option>
            <option value="friends">朋友同行</option>
            <option value="couple">情侣</option>
            <option value="solo">独自游览</option>
          </select>
        </label>
      </div>
      <button className="hp-button hp-button--primary hp-trip-planner__submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '正在规划…' : error ? '重新规划' : '让 AI 规划行程'}
      </button>
      {error && <p className="hp-trip-planner__error" role="alert">{error}</p>}
    </form>
  )
}
