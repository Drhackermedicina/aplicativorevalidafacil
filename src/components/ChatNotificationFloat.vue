<template>
  <VDialog
    v-model="showNotification"
    max-width="400"
    persistent
    location="top right"
    transition="slide-x-reverse-transition"
  >
    <VCard class="chat-notification-card">
      <VCardTitle class="d-flex align-center gap-2 pa-4">
        <VAvatar size="32">
          <VImg v-if="notification.senderPhotoURL" :src="notification.senderPhotoURL" />
          <VIcon v-else icon="ri-user-line" />
        </VAvatar>
        <div class="flex-grow-1">
          <div class="font-weight-bold">{{ notification.senderName }}</div>
          <div class="text-caption text-medium-emphasis">Nova mensagem privada</div>
        </div>
        <VBtn
          icon
          size="small"
          variant="text"
          @click="closeNotification"
        >
          <VIcon icon="ri-close-line" />
        </VBtn>
      </VCardTitle>
      
      <VCardText class="pa-4 pt-0">
        <div class="message-preview">
          {{ notification.text }}
        </div>
        <div class="text-caption text-medium-emphasis mt-2">
          {{ formatTime(notification.timestamp) }}
        </div>
      </VCardText>
      
      <VCardActions class="pa-4 pt-0">
        <VBtn
          variant="text"
          color="primary"
          @click="openChat"
          class="flex-grow-1"
        >
          <VIcon icon="ri-message-line" class="me-2" />
          Abrir Chat
        </VBtn>
        <VBtn
          variant="outlined"
          @click="closeNotification"
        >
          Fechar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const showNotification = ref(false)
const notification = ref({
  senderId: '',
  senderName: '',
  senderPhotoURL: '',
  text: '',
  timestamp: null,
  otherUserId: ''
})

let notificationTimeout = null

const handlePrivateChatNotification = (event) => {
  console.log('🔔 Notificação de chat recebida:', event.detail)
  notification.value = { ...event.detail }
  showNotification.value = true
  
  // Auto-fechar após 10 segundos se não interagir
  if (notificationTimeout) {
    clearTimeout(notificationTimeout)
  }
  notificationTimeout = setTimeout(() => {
    showNotification.value = false
  }, 10000)
}

const closeNotification = () => {
  showNotification.value = false
  if (notificationTimeout) {
    clearTimeout(notificationTimeout)
    notificationTimeout = null
  }
}

const openChat = () => {
  closeNotification()
  router.push({ 
    name: 'ChatPrivateView', 
    params: { uid: notification.value.otherUserId }
  })
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } catch {
    return ''
  }
}

onMounted(() => {
  window.addEventListener('privateChatNotification', handlePrivateChatNotification)
})

onUnmounted(() => {
  window.removeEventListener('privateChatNotification', handlePrivateChatNotification)
  if (notificationTimeout) {
    clearTimeout(notificationTimeout)
  }
})
</script>

<style scoped>
.chat-notification-card {
  border-left: 4px solid rgb(var(--v-theme-primary));
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.message-preview {
  background-color: rgb(var(--v-theme-surface));
  padding: 12px;
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.4;
  max-height: 80px;
  overflow-y: auto;
  word-break: break-word;
}

/* Animação personalizada para notificação */
.slide-x-reverse-transition-enter-active,
.slide-x-reverse-transition-leave-active {
  transition: all 0.3s ease;
}

.slide-x-reverse-transition-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.slide-x-reverse-transition-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
