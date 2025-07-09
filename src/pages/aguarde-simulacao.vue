<template>
  <v-container class="d-flex flex-column align-center justify-center" style="height: 100vh;">
    <v-card class="pa-8 text-center" elevation="10">
      <v-icon color="primary" size="64">ri-time-line</v-icon>
      <h2 class="mt-4 mb-2 font-weight-bold">AGUARDE O INÍCIO DA SIMULAÇÃO</h2>
      <p class="mb-0">O avaliador está preparando a estação. Assim que a simulação começar, você será notificado automaticamente.</p>
      <v-btn
        v-if="simulationLink"
        color="primary"
        class="mt-6"
        size="large"
        @click="startSimulation"
      >
        <v-icon left>mdi-play-circle</v-icon>
        Iniciar Simulação
      </v-btn>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { currentUser, waitForAuth } from '@/plugins/auth'
import { connectSocket } from '@/plugins/socket'
import { usePrivateChatStore } from '@/stores/privateChatStore'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const simulationLink = ref('')
const chatStore = usePrivateChatStore()
const route = useRoute()
let socket: any = null

function getSocketParams() {
  return {
    userId: currentUser.value?.uid || '',
    sessionId: route.query.session,
    role: route.query.role,
    stationId: route.params.id,
    displayName: currentUser.value?.displayName || '',
  }
}

function startSimulation() {
  if (simulationLink.value) {
    window.location.href = simulationLink.value
  }
}

onMounted(async () => {
  await waitForAuth()
  const params = getSocketParams()
  console.log('[AguardeSimulacao] Parâmetros do socket:', params)
  if (!params.userId) {
    console.error('[AguardeSimulacao] Usuário não autenticado, não conectando socket.')
    return
  }
  socket = connectSocket(params)
  console.log('[AguardeSimulacao] Socket conectado?', !!socket?.connected, 'userId:', params.userId, 'socketId:', socket?.id)
  socket.on('connect', () => {
    console.log('[AguardeSimulacao] Evento connect! userId:', params.userId, 'socketId:', socket.id)
  })
  socket.on('RECEIVE_SIMULATION_LINK', data => {
    if (data && data.link) {
      simulationLink.value = data.link
    }
  })

  if (localStorage.getItem('forceOpenPrivateChat') === '1') {
    if (chatStore.targetUser) {
      chatStore.openChat(chatStore.targetUser)
    }
    localStorage.removeItem('forceOpenPrivateChat')
  }
})
</script>
