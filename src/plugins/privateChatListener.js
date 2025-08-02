import { currentUser } from '@/plugins/auth'
import { db } from '@/plugins/firebase'
import { collection, onSnapshot, orderBy, query, getDocs } from 'firebase/firestore'
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

let unsubscribeList = []

export function usePrivateChatNotification() {
  const route = useRoute()

  function startListener() {
    if (!currentUser.value?.uid) return
    
    console.log('🚀 Iniciando listener de chat privado para usuário:', currentUser.value.uid)
    
    // Limpar listeners anteriores
    unsubscribeList.forEach(unsub => unsub())
    unsubscribeList = []
    
    const userUid = currentUser.value.uid
    
    // Buscar todos os usuários para monitorar chats privados
    getDocs(collection(db, 'usuarios')).then(snapshot => {
      snapshot.forEach(doc => {
        const otherUid = doc.id
        if (otherUid !== userUid) {
          const chatId = [userUid, otherUid].sort().join('_')
          const col = collection(db, `chatPrivado_${chatId}`)
          const q = query(col, orderBy('timestamp', 'desc'))
          
          let lastMessageId = null
          let isFirstLoad = true
          
          const unsubscribe = onSnapshot(q, (snap) => {
            const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            if (messages.length === 0) return
            
            const lastMsg = messages[0] // Mais recente primeiro
            
            // Na primeira carga, apenas salva o ID da última mensagem
            if (isFirstLoad) {
              lastMessageId = lastMsg.id
              isFirstLoad = false
              return
            }
            
            // Verifica se é uma nova mensagem
            if (lastMessageId && lastMessageId !== lastMsg.id && lastMsg.senderId !== userUid) {
              // Só notifica se não estiver na rota do chat privado com esse usuário
              if (route.name !== 'ChatPrivateView' || route.params.uid !== otherUid) {
                console.log('📨 Disparando evento de notificação para:', {
                  senderName: lastMsg.senderName,
                  text: lastMsg.text,
                  otherUserId: otherUid
                })
                // Emitir evento personalizado para mostrar notificação flutuante
                window.dispatchEvent(new CustomEvent('privateChatNotification', {
                  detail: {
                    senderId: lastMsg.senderId,
                    senderName: lastMsg.senderName || 'Usuário',
                    senderPhotoURL: lastMsg.senderPhotoURL || null,
                    text: lastMsg.text,
                    timestamp: lastMsg.timestamp,
                    otherUserId: otherUid
                  }
                }))
              }
            }
            
            if (messages.length > 0) {
              lastMessageId = messages[0].id
            }
          }, (error) => {
            // Silencioso - não logar erros de permissão para reduzir poluição do console
          })
          
          unsubscribeList.push(unsubscribe)
        }
      })
    }).catch(error => {
      // Silencioso - não logar erros de permissão para reduzir poluição do console
    })
  }

  function stopListener() {
    unsubscribeList.forEach(unsub => unsub())
    unsubscribeList = []
  }

  onMounted(() => {
    if (currentUser.value?.uid) {
      startListener()
    }
  })

  onUnmounted(() => {
    stopListener()
  })

  return {
    startListener,
    stopListener
  }
}
