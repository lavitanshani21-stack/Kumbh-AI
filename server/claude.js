import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.KUMBHAI_MODEL || 'claude-opus-4-8'

// The SDK reads ANTHROPIC_API_KEY from the environment. We only construct the
// client when a key is present so the server can fall back to local heuristics
// in demo/offline mode instead of crashing.
export const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY)
const client = hasApiKey ? new Anthropic() : null

export { MODEL }

/**
 * Call Claude and get back a validated JSON object matching `schema`.
 *
 * Uses structured outputs (output_config.format) so the first text block is
 * guaranteed valid JSON. `thinking` defaults to off for snappy calls; pass
 * `adaptive: true` for tasks that need genuine multi-step reasoning.
 */
export async function runStructured({
  system,
  user,
  schema,
  adaptive = false,
  effort = 'medium',
  maxTokens = 3000,
}) {
  if (!client) throw new Error('NO_API_KEY')

  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: {
      effort,
      format: { type: 'json_schema', schema },
    },
    messages: [{ role: 'user', content: user }],
  }
  if (adaptive) params.thinking = { type: 'adaptive' }

  const response = await client.messages.create(params)

  if (response.stop_reason === 'refusal') {
    throw new Error('REFUSAL')
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('NO_TEXT_BLOCK')

  return {
    data: JSON.parse(textBlock.text),
    usage: response.usage,
    model: response.model,
  }
}
