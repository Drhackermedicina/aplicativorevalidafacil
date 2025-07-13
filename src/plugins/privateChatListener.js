// Listener global de mensagens privadas para notificação
import { currentUser } from '@/plugins/auth'
import { db } from '@/plugins/firebase'
import { useNotificationStore } from '@/stores/notificationStore'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

let unsubscribe = null

export function usePrivateChatNotification() {
  const notificationStore = useNotificationStore()
  const route = useRoute()

  function startListener() {
    if (!currentUser.value?.uid) return
    // Escuta todas as coleções de chat privado do usuário
    const userUid = currentUser.value.uid
    const chats = [`chatPrivado_${userUid}_`, `chatPrivado_${userUid}`]
    // Busca todas as coleções que começam com chatPrivado_{uid}_
    // (Atenção: Firestore não permite listar coleções dinamicamente no client, então é necessário saber os possíveis uids de outros usuários)
    // Para solução simples, escute todos os chats privados do usuário
    // Aqui, exemplo para até 1000 usuários (ajuste conforme necessário)
    const otherUids = [] // Preencha com uids conhecidos ou busque da coleção usuarios
    // Exemplo: buscar todos usuários e montar listeners
    db.collection('usuarios').get().then(snapshot => {
      snapshot.forEach(doc => {
        const otherUid = doc.id
        if (otherUid !== userUid) {
          const chatId = [userUid, otherUid].sort().join('_')
          const col = collection(db, `chatPrivado_${chatId}`)
          const q = query(col, orderBy('timestamp', 'asc'))
          onSnapshot(q, (snap) => {
            const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            if (messages.length === 0) return
            const lastMsg = messages[messages.length - 1]
            // Só notifica se não estiver na rota do chat privado com esse usuário e a mensagem não for do próprio usuário
            if (
              route.name !== 'ChatPrivateView' ||
              route.params.uid !== otherUid
            ) {
              if (lastMsg.senderId !== userUid) {
                notificationStore.notify({
                  text: `Nova mensagem privada de ${lastMsg.senderName || 'Usuário'}`,
                  color: 'deep-purple-accent-4',
                })
              }
            }
          })
        }
      })
    })
  }

  onMounted(() => {
    startListener()
  })
  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })
}
