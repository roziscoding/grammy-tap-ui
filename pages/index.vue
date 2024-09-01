<script setup lang="ts">
import { useEventSource, useStorage } from '@vueuse/core'

const events = useStorage<Record<string, any>[]>('events', [])
const selectedEvent = ref<Record<string, any> | null>(null)

const { data, error, status, event: eventName } = useEventSource('/api/all', ['handshake', 'request', 'update', 'botError'] as const)

watch(data, (newData) => {
  if (newData && eventName.value && eventName.value !== 'handshake') {
    const { id, ...data } = JSON.parse(newData)
    const event = {
      meta: {
        id,
        eventType: eventName.value,
        timestamp: new Date().toLocaleDateString(undefined, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      data,
    }
    events.value.push(event)
    selectedEvent.value = event
  }
})
</script>

<template>
  <div class="w-full h-full text-text">
    <nav class="navbar fixed top-0 h-10 bg-crust w-full flex items-center p-2">
      <h1>grammY Tap - {{ status }}</h1>
    </nav>
    <div class="content pt-10 w-full h-full">
      <div class="page h-full w-full">
        <template v-if="!error">
          <div class="sidebar overflow-auto bg-mantle w-2/12 flex flex-col h-[calc(100vh-40px)] fixed top-10 z-10">
            <div
              v-for="event in events" :key="event.meta.id"
              class="flex flex-col data-[selected=true]:bg-surface0 p-2"
              :data-selected="event.meta.id === selectedEvent?.meta.id" @click="selectedEvent = event"
            >
              <span class="font-bold">{{ event.meta.eventType }}</span>
              <span class="text-xs text-slate-500">{{ event.meta.timestamp }}</span>
            </div>
          </div>
          <div class="main bg-base w-full fixed top-10 h-[calc(100vh-40px)] pl-[16.666667%] overflow-auto">
            <div v-if="selectedEvent">
              <Shiki class="break-words font-mono" :code="JSON.stringify(selectedEvent.data, null, 2)" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="text-red-500">
            {{ error }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
