import { type H3Event, createEventStream } from 'h3'

interface IdentifiedEventStream {
  id: string
  stream: ReturnType<typeof createEventStream>
  isConsumed: boolean
}

const streams = new Map<string, IdentifiedEventStream>()

type EventType = 'botError' | 'update' | 'request'

function isValidEventType(
  eventType: string,
): eventType is EventType {
  return ['botError', 'update', 'request'].includes(eventType)
}

async function getOrCreateStream(event: H3Event, sessionId: string, recreate = true) {
  const existingStream = streams.get(sessionId)

  if (existingStream && (!existingStream.isConsumed || !recreate)) {
    return existingStream
  }

  if (existingStream) {
    await existingStream.stream.close()
    streams.delete(sessionId)
  }

  const eventStream = createEventStream(event)
  eventStream.onClosed(() => {
    streams.delete(sessionId)
  })

  const stream = { id: sessionId, stream: eventStream, isConsumed: false }

  streams.set(sessionId, stream)
  return stream
}

export default defineEventHandler(async (event) => {
  if (event.path.endsWith('/stats') && event.method === 'GET') {
    return {
      streams: streams.size,
    }
  }

  const eventType = getRouterParam(event, 'eventType') ?? ''
  const sessionId = getHeader(event, 'x-session-id') ?? getQuery(event).sessionId?.toString()

  if (!sessionId) {
    setResponseStatus(event, 401, 'Unauthorized')
    return {
      error: 'Missing x-session-id header',
    }
  }

  if (event.method === 'GET') {
    const stream = await getOrCreateStream(event, sessionId)

    if (stream.isConsumed) {
      setResponseStatus(event, 409, 'Conflict')
      return {
        error: 'Stream already consumed',
      }
    }

    stream.isConsumed = true
    return stream.stream.send()
  }

  if (event.method === 'POST') {
    if (!isValidEventType(eventType)) {
      setResponseStatus(event, 422, 'Unprocessable Content')
      return {
        error:
          'Invalid event type. Must be one of: botError, update, request',
      }
    }

    const stream = await getOrCreateStream(event, sessionId, false)
    const body = JSON.parse(await readBody(event))

    stream.stream.push({
      event: eventType,
      data: JSON.stringify({ id: crypto.randomUUID(), ...body }),
    })
  }

  return sendNoContent(event)
})
