<template>
  <!-- O v-app é o container raiz de toda a aplicação Vuetify -->
  <v-app>
    <GlobalLoader />
    <!-- RouterView é onde os componentes das suas rotas (páginas) serão renderizados -->
    <RouterView />

    <!-- Aqui incluímos o componente personalizador. -->
    <!-- Ele será exibido em todas as páginas da sua aplicação. -->
    <ThemeCustomizer />
    
    <!-- Componente de notificação flutuante de chat privado -->
    <ChatNotificationFloat />
    
    <!-- Snackbar global -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.timeout || 4000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-app>
</template>

<script setup>
// Importa o RouterView para gerenciar as rotas da aplicação
import { RouterView } from 'vue-router'

// Importa o componente que acabamos de criar.
// O caminho './components/ThemeCustomizer.vue' assume que App.vue está em 'src'
// e ThemeCustomizer.vue está em 'src/components'.
import { currentUser, waitForAuth } from '@/plugins/auth'
import { db } from '@/plugins/firebase'
import { usePrivateChatNotification } from '@/plugins/privateChatListener'
import { useNotificationStore } from '@/stores/notificationStore'
import { useUserStore } from '@/stores/userStore'
import { doc, updateDoc } from 'firebase/firestore'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import GlobalLoader from './components/GlobalLoader.vue'
import ThemeCustomizer from './components/ThemeCustomizer.vue'
import ChatNotificationFloat from './components/ChatNotificationFloat.vue'

const userStore = useUserStore()
const route = useRoute()
const notificationStore = useNotificationStore()
const snackbar = computed(() => notificationStore.snackbar)

// Inicializar listener de notificações de chat privado
const { startListener } = usePrivateChatNotification()

let statusInterval = null

async function updateUserStatus() {
  if (!currentUser.value?.uid) return;
  let status = 'disponivel';
  if (route.path.startsWith('/app/simulation') || route.path.includes('/simulate')) {
    status = 'treinando';
  }
  
  // Atualiza apenas no Firestore
  try {
    const userRef = doc(db, 'usuarios', currentUser.value.uid);
    await updateDoc(userRef, { status });
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
  }
}

async function setStatusOffline() {
  if (currentUser.value?.uid) {
    try {
      // Atualiza apenas no Firestore
      const userRef = doc(db, 'usuarios', currentUser.value.uid);
      await updateDoc(userRef, { status: 'offline' });
    } catch (err) {
      console.error('Erro ao enviar status OFFLINE:', err);
    }
  }
}

onMounted(async () => {
  await waitForAuth()
  if (currentUser.value) {
    userStore.setUser(currentUser.value)
    // Iniciar listener de chat após autenticação
    startListener()
  }
  updateUserStatus()
  statusInterval = setInterval(() => {
    updateUserStatus()
  }, 30000)
  window.addEventListener('beforeunload', setStatusOffline)
})

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
  window.removeEventListener('beforeunload', setStatusOffline)
})

watch(currentUser, (val) => {
  userStore.setUser(val)
  updateUserStatus()
})

watch(() => route.fullPath, () => {
  updateUserStatus()
})
</script>

<style>
/* Estilos globais podem ser adicionados aqui */
</style>
