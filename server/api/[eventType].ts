import { createEventStream } from 'h3'

interface IdentifiedEventStream {
  id: string
  stream: ReturnType<typeof createEventStream>
}

const streams = {
  botError: [] as IdentifiedEventStream[],
  update: [] as IdentifiedEventStream[],
  request: [] as IdentifiedEventStream[],
  all: [] as IdentifiedEventStream[],
}

function isValidEventType(
  eventType: string,
): eventType is keyof typeof streams {
  return Object.keys(streams).includes(eventType)
}

export default defineEventHandler(async (event) => {
  const eventType = getRouterParam(event, 'eventType') ?? ''

  if (event.path.endsWith('/stats') && event.method === 'GET') {
    return {
      streams: Object.fromEntries(
        Object.entries(streams).map(([key, value]) => [key, value.length]),
      ),
    }
  }

  if (!isValidEventType(eventType)) {
    setResponseStatus(event, 422, 'Unprocessable Content')
    return {
      error: 'Invalid event type. Must be one of: botError, update, request, all',
    }
  }

  if (event.method === 'GET') {
    const eventStream = createEventStream(event)
    const streamId = crypto.randomUUID()
    eventStream.push([{
      event: 'handshake',
      data: JSON.stringify({ id: streamId }),
    }])
    streams[eventType].push({ id: streamId, stream: eventStream })
    eventStream.onClosed(() => {
      streams[eventType] = streams[eventType].filter(stream =>
        stream.id !== streamId,
      )
    })
    return eventStream.send()
  }

  if (event.method === 'POST') {
    if (eventType === 'all') {
      setResponseStatus(event, 422, 'Unprocessable Content')
      return {
        error:
          'Cannot emit event of type "all". Must be one of: botError, update, request',
      }
    }

    const body = JSON.parse(await readBody(event))

    const streamsToEmitTo = [...streams[eventType], ...streams.all]

    streamsToEmitTo.forEach(({ stream }) =>
      stream.push({
        event: eventType,
        data: JSON.stringify({ id: crypto.randomUUID(), ...body }),
      }),
    )
    return sendNoContent(event)
  }

  return sendNoContent(event)
})
