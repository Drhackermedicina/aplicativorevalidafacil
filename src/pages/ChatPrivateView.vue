<template>
  <v-container class="py-6 chat-private-container">
    <v-row>
      <v-col cols="12">
        <v-card elevation="3" class="chat-card d-flex flex-column animate-fade-in">
          <v-card-title class="d-flex align-center gap-2">
            <v-icon icon="ri-user-3-line" color="primary" size="28" />
            <span class="text-h5 font-weight-bold">Chat Privado</span>
            <span v-if="userName" class="ms-2">com <b>{{ userName }}</b></span>
            <v-spacer />
            <v-btn icon @click="$router.back()"><v-icon icon="ri-arrow-left-line" /></v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text class="chat-messages flex-grow-1 pa-4">
            <div v-for="message in messages" :key="message.id" class="message-bubble d-flex mb-4" :class="{ 'justify-end': message.senderId === currentUser?.uid }">
              <v-avatar v-if="message.senderPhotoURL" :image="message.senderPhotoURL" size="32" class="me-2" />
              <div class="message-content pa-3 rounded-lg" :class="message.senderId === currentUser?.uid ? 'bg-primary text-white my-message' : 'bg-grey-lighten-4 other-message'">
                <div class="font-weight-medium text-body-2 mb-1" :class="{ 'text-right': message.senderId === currentUser?.uid }">
                  {{ message.senderName }}
                </div>
                <p class="text-body-1 mb-1">{{ message.text }}</p>
                <div class="text-caption text-right" :class="message.senderId === currentUser?.uid ? 'text-white-50' : 'text-medium-emphasis'">
                  {{ formatTime(message.timestamp) }}
                </div>
              </div>
            </div>
            <div ref="messagesEnd"></div>
          </v-card-text>
          <v-divider />
          <v-card-actions class="pa-4 chat-input-bar">
            <v-text-field
              v-model="newMessage"
              label="Digite sua mensagem..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              class="chat-input"
              @keydown.enter="sendMessage"
            >
              <template #append-inner>
                <v-btn
                  icon
                  variant="text"
                  color="primary"
                  :disabled="!newMessage.trim()"
                  @click="sendMessage"
                >
                  <v-icon icon="ri-send-plane-line" />
                </v-btn>
              </template>
            </v-text-field>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { currentUser } from '@/plugins/auth';
import { db } from '@/plugins/firebase';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const otherUserId = route.params.uid;
const userName = ref('');
const messages = ref([]);
const newMessage = ref('');
const messagesEnd = ref(null);
let unsubscribe = null;

// Busca nome do usuário alvo (corrigido para API v9)
async function fetchUserName() {
  try {
    const userRef = doc(db, 'usuarios', otherUserId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      userName.value = (userData.nome && userData.sobrenome) 
        ? `${userData.nome} ${userData.sobrenome}` 
        : userData.displayName || 'Usuário';
    } else {
      userName.value = 'Usuário não encontrado';
    }
  } catch (error) {
    // Silencioso - removido log para reduzir poluição do console
    userName.value = 'Erro ao carregar usuário';
  }
}

onMounted(() => {
  fetchUserName();
  // Listener de mensagens privadas (coleção: chatPrivado_{uid1}_{uid2})
  const chatId = [currentUser.value?.uid, otherUserId].sort().join('_');
  const messagesCollectionRef = collection(db, `chatPrivado_${chatId}`);
  const mq = query(messagesCollectionRef, orderBy('timestamp', 'asc'));
  unsubscribe = onSnapshot(mq, (snapshot) => {
    messages.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    nextTick(() => {
      scrollToEnd();
    });
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

const sendMessage = async () => {
  if (newMessage.value.trim() === '' || !currentUser.value) return;
  const chatId = [currentUser.value?.uid, otherUserId].sort().join('_');
  await addDoc(collection(db, `chatPrivado_${chatId}`), {
    senderId: currentUser.value.uid,
    senderName: currentUser.value.displayName || 'Anônimo',
    senderPhotoURL: currentUser.value.photoURL || '',
    text: newMessage.value.trim(),
    timestamp: serverTimestamp(),
  });
  newMessage.value = '';
  nextTick(() => {
    scrollToEnd();
  });
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const scrollToEnd = () => {
  if (messagesEnd.value) {
    messagesEnd.value.scrollIntoView({ behavior: 'smooth' });
  }
};
</script>

<style scoped>
.chat-private-container {
  background: #f8f9fb;
}
.chat-card {
  min-height: 480px;
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  box-shadow: 0 4px 24px 0 rgba(123, 31, 162, 0.10), 0 1.5px 4px 0 rgba(0,0,0,0.04);
  background: #fff;
}
.chat-messages {
  min-height: 320px;
  max-height: 420px;
  overflow-y: auto;
  background: linear-gradient(90deg, #fffde7 0%, #ede7f6 100%);
  border-radius: 12px;
}
.message-bubble {
  transition: transform 0.15s;
}
.message-bubble:hover .message-content {
  transform: scale(1.03);
  box-shadow: 0 2px 12px 0 rgba(123, 31, 162, 0.10);
}
.message-content {
  min-width: 120px;
  max-width: 80vw;
  word-break: break-word;
  box-shadow: 0 2px 8px 0 rgba(123, 31, 162, 0.06);
  transition: box-shadow 0.18s, transform 0.18s;
}
.my-message {
  background: linear-gradient(90deg, #7b1fa2 0%, #00bcd4 100%) !important;
  color: #fff !important;
}
.other-message {
  background: #fff !important;
  color: #333 !important;
}
.chat-input-bar {
  background: #f8f9fb;
  border-radius: 0 0 12px 12px;
}
.chat-input {
  border-radius: 8px;
}
.animate-fade-in {
  animation: fadeInUp 0.7s cubic-bezier(.55,0,.1,1);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 900px) {
  .chat-card { border-radius: 8px; }
}
@media (max-width: 600px) {
  .chat-private-container { padding: 0 2px; }
  .chat-card { border-radius: 4px; }
  .chat-messages { min-height: 180px; max-height: 220px; }
}
</style>
