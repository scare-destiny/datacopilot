import {
	type Message,
	StreamData,
	convertToCoreMessages,
	streamObject,
	streamText,
} from 'ai'
import { z } from 'zod'

import { auth } from '@/app/(auth)/auth'
import { customModel } from '@/lib/ai'
import { models } from '@/lib/ai/models'
import { systemPrompt } from '@/lib/ai/prompts'
import {
	deleteChatById,
	getChatById,
	getDocumentById,
	saveChat,
	saveDocument,
	saveMessages,
	saveSuggestions,
} from '@/lib/db/queries'
import type { Suggestion } from '@/lib/db/schema'
import {
	generateUUID,
	getMostRecentUserMessage,
	sanitizeResponseMessages,
} from '@/lib/utils'
import { loadCsvData } from '@/lib/utils/csv-loader'

import { generateTitleFromUserMessage } from '../../actions'

export const maxDuration = 60

type AllowedTools =
	| 'createDocument'
	| 'updateDocument'
	| 'requestSuggestions'
	| 'getWeather'

const blocksTools: AllowedTools[] = [
	'createDocument',
	'updateDocument',
	'requestSuggestions',
]

const weatherTools: AllowedTools[] = ['getWeather']

const allTools: AllowedTools[] = [...blocksTools, ...weatherTools]

export async function POST(request: Request) {
	const {
		id,
		messages,
		modelId,
	}: { id: string; messages: Array<Message>; modelId: string } =
		await request.json()

	const session = await auth()

	if (!session || !session.user || !session.user.id) {
		return new Response('Unauthorized', { status: 401 })
	}

	const model = models.find((model) => model.id === modelId)

	if (!model) {
		return new Response('Model not found', { status: 404 })
	}

	const coreMessages = convertToCoreMessages(messages)
	const userMessage = getMostRecentUserMessage(coreMessages)

	if (!userMessage) {
		return new Response('No user message found', { status: 400 })
	}

	const chat = await getChatById({ id })

	if (!chat) {
		const title = await generateTitleFromUserMessage({ message: userMessage })
		await saveChat({ id, userId: session.user.id, title })
	}

	await saveMessages({
		messages: [
			{ ...userMessage, id: generateUUID(), createdAt: new Date(), chatId: id },
		],
	})

	const streamingData = new StreamData()

	const csvData = loadCsvData()

	// First, compress the schema into a more compact form
	const compressSchema = async (schema: any) => {
		const compressionPrompt = `Compress the following schema in a way that you (AI assistant) can later reconstruct it perfectly. Use any symbols, abbreviations, or encodings that make sense to you. Make it as compact as possible:
		${JSON.stringify(schema)}`

		// Use your AI model to compress the schema
		const { fullStream } = await streamText({
			model: customModel(model.apiIdentifier),
			prompt: compressionPrompt,
			system: 'You are a schema compression expert. Be as concise as possible.',
		})

		// Collect the compressed result
		let compressedSchema = ''
		for await (const delta of fullStream) {
			if (delta.type === 'text-delta') {
				compressedSchema += delta.textDelta
			}
		}

		return compressedSchema
	}

	// Modify the system prompt to use the compressed schema
	const systemPrompt = `You are a SQL query expert. You'll work with an Operations Manager who needs to know the most accurate SQL query possible. Here's the compressed schema (you know how to read this):
	${await compressSchema(csvData)}

	Guidelines:
	- Use ClickHouse SQL syntax
	- No semicolons at end
	- Match column names exactly
	- Provide brief analysis, query, and explanation
  - Don't use any assumptions, instead use the schema to make the most accurate query possible 
	- If possible and necessary combine Mysql data with Stripe data
	- Instead of dateAdd use subtractMonths and similar functions
	- DON'T USE ANY MADE UP FIELDS OR TABLES!!!!

	Your goal is to look at both the schema and the user's question and come up with the most accurate SQL query possible. You need to be as accurate as possible. 
  `

	const result = await streamText({
		model: customModel(model.apiIdentifier),
		system: systemPrompt,
		messages: coreMessages,
		maxSteps: 5,
		experimental_activeTools: allTools as never[],
		tools: {},
		onFinish: async ({ responseMessages }) => {
			if (session.user?.id) {
				try {
					const responseMessagesWithoutIncompleteToolCalls =
						sanitizeResponseMessages(responseMessages)

					await saveMessages({
						messages: responseMessagesWithoutIncompleteToolCalls.map((message) => {
							const messageId = generateUUID()

							if (message.role === 'assistant') {
								streamingData.appendMessageAnnotation({
									messageIdFromServer: messageId,
								})
							}

							return {
								id: messageId,
								chatId: id,
								role: message.role,
								content: message.content,
								createdAt: new Date(),
							}
						}),
					})
				} catch (error) {
					console.error('Failed to save chat')
				}
			}

			streamingData.close()
		},
		experimental_telemetry: {
			isEnabled: true,
			functionId: 'stream-text',
		},
	})

	return result.toDataStreamResponse({
		data: streamingData,
	})
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url)
	const id = searchParams.get('id')

	if (!id) {
		return new Response('Not Found', { status: 404 })
	}

	const session = await auth()

	if (!session || !session.user) {
		return new Response('Unauthorized', { status: 401 })
	}

	try {
		const chat = await getChatById({ id })

		if (chat.userId !== session.user.id) {
			return new Response('Unauthorized', { status: 401 })
		}

		await deleteChatById({ id })

		return new Response('Chat deleted', { status: 200 })
	} catch (error) {
		return new Response('An error occurred while processing your request', {
			status: 500,
		})
	}
}
