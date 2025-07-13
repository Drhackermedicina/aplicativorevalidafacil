<template>
  <v-container class="py-6 chat-group-container">
    <v-row>
      <!-- Usuários Online -->
      <v-col cols="12" md="4">
        <v-card elevation="3" class="users-card animate-fade-in">
          <v-card-title class="d-flex align-center gap-2">
            <v-icon icon="ri-group-line" color="primary" size="24" />
            <span class="text-h6 font-weight-bold">Usuários Online</span>
          </v-card-title>
          <v-divider />
          <v-card-text class="pa-0">
            <template v-if="loadingUsers">
              <div class="d-flex justify-center align-center py-6">
                <v-progress-circular indeterminate color="primary" size="32" />
                <span class="ms-3">Carregando...</span>
              </div>
            </template>
            <template v-else-if="errorUsers">
              <div class="d-flex justify-center align-center py-6">
                <v-icon icon="ri-error-warning-line" color="error" size="28" class="me-2" />
                <span class="text-error">{{ errorUsers }}</span>
              </div>
            </template>
            <template v-else-if="users.length === 0">
              <div class="d-flex justify-center align-center py-6">
                <v-icon icon="ri-user-off-line" color="grey" size="28" class="me-2" />
                <span class="text-medium-emphasis">Nenhum usuário online.</span>
              </div>
            </template>
            <v-list class="py-0" v-else>
              <v-list-item v-for="user in users" :key="user.uid" class="py-2 user-list-item">
                <template #prepend>
                  <v-avatar :image="getUserAvatar(user)" size="40" class="user-avatar elevation-2" />
                </template>
                <v-list-item-title class="font-weight-medium">
                  <span class="user-name-link" @click="openPrivateChat(user)" style="cursor:pointer; color:#7b1fa2; text-decoration:underline;">
                    {{ (user.nome && user.sobrenome) ? user.nome + ' ' + user.sobrenome : user.displayName || 'Usuário sem nome' }}
                  </span>
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption text-medium-emphasis">{{ user.status }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
      <!-- Chat em Grupo -->
      <v-col cols="12" md="8">
        <v-card elevation="3" class="chat-card d-flex flex-column animate-fade-in">
          <v-card-title class="d-flex align-center gap-2">
            <v-icon icon="ri-wechat-line" color="primary" size="28" />
            <span class="text-h5 font-weight-bold">Chat em Grupo</span>
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
    <!-- Snackbar para nova mensagem -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{ snackbar.text }}</v-snackbar>
  </v-container>
</template>

<script setup>
import { currentUser } from '@/plugins/auth';
import { db } from '@/plugins/firebase';
import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const users = ref([]);
const loadingUsers = ref(true);
const errorUsers = ref('');
const messages = ref([]);
const newMessage = ref('');
const messagesEnd = ref(null);
const router = useRouter();
const snackbar = ref({ show: false, text: '', color: 'primary' });

// Listener de usuários online
let unsubscribeUsers = null;
let unsubscribeMessages = null;

function getUserAvatar(user) {
  // Se for o usuário logado, prioriza o photoURL do auth
  if (user.uid === currentUser.value?.uid && currentUser.value?.photoURL) {
    return currentUser.value.photoURL;
  }
  return user.photoURL || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome || user.displayName || 'User')}`;
}

function openPrivateChat(user) {
  if (!user.uid || user.uid === currentUser.value?.uid) return;
  // Exemplo: navega para rota de chat privado (ajuste conforme sua estrutura de rotas)
  router.push({ name: 'ChatPrivateView', params: { uid: user.uid } });
}

// Listener de usuários online
onMounted(() => {
  const usersCollectionRef = collection(db, 'usuarios');
  const q = query(usersCollectionRef);
  unsubscribeUsers = onSnapshot(q, (snapshot) => {
    users.value = snapshot.docs
      .map(doc => ({ uid: doc.id, ...doc.data() }))
      .filter(user => user.status === 'disponivel' || user.status === 'treinando');
    loadingUsers.value = false;
  }, (error) => {
    errorUsers.value = 'Erro ao buscar usuários: ' + error.message;
    loadingUsers.value = false;
  });

  // Listener de mensagens do grupo
  const messagesCollectionRef = collection(db, 'chatMessages');
  const mq = query(messagesCollectionRef, orderBy('timestamp', 'asc'));
  let lastMessageId = null;
  unsubscribeMessages = onSnapshot(mq, (snapshot) => {
    const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Detecta nova mensagem recebida (não enviada pelo usuário atual)
    if (messages.value.length > 0 && newMessages.length > messages.value.length) {
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg.senderId !== currentUser.value?.uid) {
        snackbar.value = {
          show: true,
          text: `Nova mensagem de ${lastMsg.senderName || 'Usuário'}`,
          color: 'primary',
        };
      }
    }
    messages.value = newMessages;
    nextTick(() => {
      scrollToEnd();
    });
  });

  // Atualiza status para 'disponivel' ao entrar
  if (currentUser.value?.uid) {
    const userRef = doc(db, 'usuarios', currentUser.value.uid);
    updateDoc(userRef, { status: 'disponivel' });
  }
});

onUnmounted(() => {
  if (unsubscribeUsers) unsubscribeUsers();
  if (unsubscribeMessages) unsubscribeMessages();
  if (currentUser.value?.uid) {
    const userRef = doc(db, 'usuarios', currentUser.value.uid);
    updateDoc(userRef, { status: 'offline' });
  }
});

const sendMessage = async () => {
  if (newMessage.value.trim() === '' || !currentUser.value) return;
  await addDoc(collection(db, 'chatMessages'), {
    senderId: currentUser.value.uid,
    senderName: currentUser.value.displayName || 'Anônimo',
    senderPhotoURL: currentUser.value.photoURL || '',
    text: newMessage.value.trim(),
    timestamp: new Date(),
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
.chat-group-container {
  background: #f8f9fb;
}
.users-card, .chat-card {
  border-radius: 18px;
  box-shadow: 0 4px 24px 0 rgba(123, 31, 162, 0.10), 0 1.5px 4px 0 rgba(0,0,0,0.04);
  background: #fff;
}
.user-list-item {
  border-radius: 8px;
  margin-bottom: 2px;
  transition: background 0.18s;
}
.user-list-item:hover {
  background: #ede7f6;
}
.user-avatar {
  border: 2px solid #7b1fa2;
  box-shadow: 0 2px 8px #7b1fa233;
}
.chat-card {
  min-height: 480px;
  display: flex;
  flex-direction: column;
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
  .users-card, .chat-card { border-radius: 8px; }
}
@media (max-width: 600px) {
  .chat-group-container { padding: 0 2px; }
  .users-card, .chat-card { border-radius: 4px; }
  .chat-messages { min-height: 180px; max-height: 220px; }
}
.user-name-link:hover {
  text-decoration: underline;
  color: #00bcd4;
}
</style>
