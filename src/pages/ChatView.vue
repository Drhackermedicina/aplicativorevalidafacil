<template>
  <VContainer class="py-6">
    <VCard elevation="4" class="mx-auto" max-width="600">
      <VCardTitle class="d-flex align-center gap-2">
        <VIcon icon="ri-wechat-line" color="primary" size="28" />
        <span class="text-h5 font-weight-bold">Chat & Usuários Online</span>
      </VCardTitle>
      <VDivider />
      <VCardText>
        <VList>
          <VListItem
            v-for="user in sortedUsers"
            :key="user.uid"
            class="py-2"
          >
            <template #prepend>
              <VBadge
                :color="getStatusColor(user.status)"
                dot
                offset-x="2"
                offset-y="2"
                bordered
              >
                <VAvatar :image="user.photoURL" size="40" />
              </VBadge>
            </template>
            <VListItemTitle class="font-weight-medium">{{ user.displayName }}</VListItemTitle>
            <VListItemSubtitle class="text-caption">{{ user.email }}</VListItemSubtitle>
            <template #append>
              <VChip
                :color="getStatusColor(user.status)"
                size="small"
                class="me-2 text-capitalize"
                variant="tonal"
              >
                <VIcon :icon="user.status === 'disponivel' ? 'ri-checkbox-circle-line' : 'ri-timer-line'" size="18" class="me-1" />
                {{ getStatusLabel(user.status) }}
              </VChip>
              <VBtn
                v-if="user.uid === currentUser?.uid"
                color="secondary"
                size="small"
                variant="outlined"
                disabled
              >
                <VIcon icon="ri-user-line" size="18" class="me-1" />
                Você
              </VBtn>
              <VBtn
                v-else
                color="grey"
                size="small"
                variant="outlined"
                disabled
              >
                <VIcon icon="ri-user-forbid-line" size="18" class="me-1" />
                Indisponível
              </VBtn>
            </template>
          </VListItem>
        </VList>
      </VCardText>
    </VCard>
  </VContainer>
</template>

<script setup lang="ts">
import { currentUser } from '@/plugins/auth'
import { db } from '@/plugins/firebase'
import { connectSocket } from '@/plugins/socket'
import { useUserStore } from '@/stores/userStore'
import { doc, updateDoc } from 'firebase/firestore'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const userStore = useUserStore()
const socket = ref(null)

// Atualiza status para 'disponivel' a cada 30s enquanto na página do chat
let statusInterval: number | undefined

watch(currentUser, (user) => {
  if (user && !socket.value) {
    socket.value = connectSocket({
      userId: user.uid,
      displayName: user.displayName,
      email: user.email
    })
  }
})

onMounted(() => {
  userStore.fetchUsers()
  if (currentUser.value?.uid) {
    if (!socket.value) {
      socket.value = connectSocket({
        userId: currentUser.value.uid,
        displayName: currentUser.value.displayName,
        email: currentUser.value.email
      })
    }
    const ref = doc(db, 'usuarios', currentUser.value.uid)
    updateDoc(ref, { status: 'disponivel' })
    statusInterval = window.setInterval(() => {
      updateDoc(ref, { status: 'disponivel' })
    }, 30000)
  }
})

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
  if (currentUser.value?.uid) {
    const ref = doc(db, 'usuarios', currentUser.value.uid)
    updateDoc(ref, { status: 'offline' })
  }
  if (socket.value) {
    socket.value.disconnect()
    socket.value = null
  }
})

const sortedUsers = computed(() => {
  return userStore.users.slice().sort((a, b) => {
    if (!a?.displayName) return 1
    if (!b?.displayName) return -1
    return a.displayName.localeCompare(b.displayName)
  })
})

const getStatusColor = (status: string) => {
  return status === 'disponivel' ? 'success' : 'warning'
}

const getStatusLabel = (status: string) => {
  return status === 'disponivel' ? 'Disponível' : 'Treinando'
}

// Função inviteUser arquivada temporariamente
// function inviteUser(user) {
//   // Lógica de convite desativada
// }
</script>

<style scoped>
/* Responsividade e integração com tema Materio */
@media (max-width: 600px) {
  .mx-auto {
    margin-inline: 0 !important;
    max-width: 100% !important;
  }
}
</style>
