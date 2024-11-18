import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai'

import { customMiddleware } from './custom-middleware'

export const customModel = (apiIdentifier: string) => {
	// Check if the model is a Claude model
	const isClaudeModel = apiIdentifier.includes('claude')

	return wrapLanguageModel({
		model: isClaudeModel ? anthropic(apiIdentifier) : openai(apiIdentifier),
		middleware: customMiddleware,
	})
}
