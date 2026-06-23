# Basic Chat Agent Skill

## Goal
Handle ordinary multi-turn chat without file parsing or RAG retrieval.

## Input
- `metadata.message`: latest user message
- `metadata.history`: optional recent message list
- `metadata.systemPrompt`: optional system prompt override

## Behavior
- Treat the request as a normal conversation turn
- Keep the answer natural, tourist-friendly, and easy to understand
- Use configured provider and model binding for this agent

## Output
- `answer`: assistant reply text
- `usedProvider`: provider name
- `usedModel`: model name
- `historyCount`: number of history turns sent to the model
