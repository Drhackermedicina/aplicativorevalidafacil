// ARQUIVO: backend/server.js (VERSÃO REATORADA)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);

// Inicializa o Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(), // ou use sua chave de serviço
});
const db = admin.firestore();

// Configuração do CORS mais permissiva para desenvolvimento local e deploy
const io = new Server(server, {
  cors: {
    origin: "*", // Permite qualquer origem. Para produção, restrinja a URL do seu frontend.
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// --- Gerenciamento de Sessões ---
// Lembrete: Este Map em memória é perdido se o servidor reiniciar.
// Para produção, o ideal é usar um banco de dados como Firestore ou Redis.
const sessions = new Map();

// --- Endpoints HTTP ---

// Endpoint de verificação de saúde
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Endpoint para criar uma nova sessão de simulação
app.post('/api/create-session', (req, res) => {
  const { stationId, communicationMethod } = req.body;
  if (!stationId) {
    return res.status(400).json({ error: 'ID da estação é obrigatório' });
  }
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  // Gerar sala Jitsi se o método for voz
  let jitsiRoom = null;
  if (communicationMethod === 'voice') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const roomId = `revalida-${sessionId.substring(8, 16)}-${random}`;
    
    jitsiRoom = {
      roomId,
      jitsiUrl: `https://meet.jit.si/${roomId}`,
      roomName: `Simulação REVALIDA`
    };
    
    console.log(`[JITSI] Sala criada antecipadamente: ${roomId} para sessão ${sessionId}`);
  }
  
  sessions.set(sessionId, {
    stationId,
    participants: new Map(),
    createdAt: new Date(),
    timer: null,
    communicationMethod: communicationMethod || 'meet',
    jitsiRoom
  });
  
  console.log(`[HTTP] Nova sessão criada via API: ${sessionId} (método: ${communicationMethod || 'meet'})`);
  res.status(201).json({ 
    sessionId,
    jitsiRoom,
    communicationMethod: communicationMethod || 'meet'
  });
});

// Endpoint para atualizar status do usuário
app.post('/api/update-user-status', async (req, res) => {
  const { uid, status } = req.body;
  if (!uid || !status) {
    return res.status(400).json({ error: 'uid e status são obrigatórios' });
  }
  try {
    await db.collection('usuarios').doc(uid).update({
      status,
      lastActive: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Lógica do Socket.IO ---

io.on('connection', (socket) => {
  console.log(`[CONEXÃO] Novo cliente conectado: ${socket.id}`);

  // --- Lógica de Entrada na Sessão ---
  // Unificamos a lógica para usar os dados da query da conexão inicial.
  const { sessionId, userId, role, stationId, displayName } = socket.handshake.query;

  if (!sessionId || !userId || !role || !stationId || !displayName) {
    console.error(`[ERRO DE CONEXÃO] Cliente ${socket.id} tentou conectar com dados incompletos.`);
    socket.emit('SERVER_ERROR', { message: 'Dados de conexão insuficientes (sessionId, userId, role, stationId, displayName são obrigatórios).' });
    socket.disconnect();
    return;
  }

  // Cria a sessão se for o primeiro a entrar OU usa sessão existente
  if (!sessions.has(sessionId)) {
    // ⚠️ FALLBACK: Gerar sala Jitsi apenas se sessão não foi criada via API
    console.log(`[SESSÃO] Criando sessão via WebSocket (fallback): ${sessionId}`);
    
    let jitsiRoom = null;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const roomId = `revalida-${sessionId.substring(8, 16)}-${random}`;
    
    jitsiRoom = {
      roomId,
      jitsiUrl: `https://meet.jit.si/${roomId}`,
      roomName: `Simulação REVALIDA - ${sessionId.substring(0, 8)}`
    };

    sessions.set(sessionId, {
      stationId,
      participants: new Map(),
      createdAt: new Date(),
      timer: null,
      communicationMethod: 'meet', // Default se não especificado
      jitsiRoom
    });
    console.log(`[SESSÃO] Sessão criada via WebSocket: ${sessionId} para a estação ${stationId} com sala Jitsi: ${roomId}`);
  } else {
    console.log(`[SESSÃO] ✅ Usando sessão existente: ${sessionId} (criada via API) - Método: ${sessions.get(sessionId).communicationMethod}`);
    
    // Enviar dados da sessão existente para o cliente recém-conectado
    const existingSession = sessions.get(sessionId);
    if (existingSession.jitsiRoom && existingSession.communicationMethod === 'voice') {
      console.log(`[JITSI] 📤 Enviando dados da sala Jitsi para ${displayName}: ${existingSession.jitsiRoom.roomId}`);
      
      // Enviar dados Jitsi para o novo participante
      socket.emit('SERVER_SESSION_JITSI_DATA', {
        jitsiRoom: existingSession.jitsiRoom,
        communicationMethod: existingSession.communicationMethod,
        message: 'Sessão com comunicação por voz detectada'
      });
    }
  }

  const session = sessions.get(sessionId);

  // Validação para garantir que a sessão não exceda 2 participantes
  if (session.participants.size >= 2 && !session.participants.has(userId)) {
    console.warn(`[SESSÃO CHEIA] Cliente ${socket.id} (userId: ${userId}) tentou entrar na sessão ${sessionId} que já está cheia.`);
    socket.emit('SERVER_ERROR', { message: 'Esta sessão de simulação já está cheia.' });
    socket.disconnect();
    return;
  }

  // Adiciona ou atualiza o participante
  session.participants.set(userId, {
    socketId: socket.id,
    role,
    displayName,
    isReady: false
  });
  socket.join(sessionId);
  console.log(`[JOIN] Usuário ${displayName} (${role}) entrou na sala: ${sessionId}`);

  // Envia a lista atualizada de participantes para todos na sala
  const participantsList = Array.from(session.participants.values());
  io.to(sessionId).emit('SERVER_PARTNER_UPDATE', { participants: participantsList });

  // Informa o status da sala ao novo participante
  if (session.participants.size === 1) {
    socket.emit('SERVER_WAITING_FOR_PARTNER');
  } else if (session.participants.size === 2) {
    io.to(sessionId).emit('SERVER_PARTNER_FOUND');
  }


  // --- Eventos da Simulação ---

  // Cliente se marca como pronto
  socket.on('CLIENT_IM_READY', () => {
    if (session && session.participants.has(userId)) {
      session.participants.get(userId).isReady = true;
      console.log(`[READY] Usuário ${displayName} (${role}) está pronto.`);
      
      const updatedParticipantsList = Array.from(session.participants.values());
      io.to(sessionId).emit('SERVER_PARTNER_UPDATE', { participants: updatedParticipantsList });

      // Verifica se todos estão prontos para habilitar o botão de início
      const allReady = updatedParticipantsList.every(p => p.isReady);
      if (session.participants.size === 2 && allReady) {
        console.log(`[READY] Ambos os participantes da sessão ${sessionId} estão prontos.`);
        io.to(sessionId).emit('SERVER_BOTH_PARTICIPANTS_READY');
      }
    }
  });

  // Ator/Avaliador inicia a simulação
  socket.on('CLIENT_START_SIMULATION', (data) => {
    const { durationMinutes, communicationMethod } = data;
    const durationSeconds = (durationMinutes || 10) * 60;
    
    console.log(`[START] Simulação iniciada na sessão ${sessionId} com duração de ${durationSeconds} segundos.`);
    console.log(`[COMMUNICATION] Método de comunicação: ${communicationMethod || 'meet'}`);
    
    io.to(sessionId).emit('SERVER_START_SIMULATION', { durationSeconds });
    
    // **SINAL PARA INICIAR A CHAMADA DE VOZ**
    if (communicationMethod === 'voice' && session.jitsiRoom) {
      // Jitsi Meet automático
      io.to(sessionId).emit('SERVER_INITIATE_JITSI_CALL', { 
        message: 'Iniciando comunicação por voz via Jitsi Meet',
        roomName: session.jitsiRoom.roomId,
        jitsiUrl: session.jitsiRoom.jitsiUrl,
        roomDisplayName: session.jitsiRoom.roomName
      });
    } else {
      // Google Meet manual (lógica existente mantida)
      io.to(sessionId).emit('SERVER_INITIATE_VOICE_CALL', { 
        message: 'Por favor, inicie a comunicação por voz via Google Meet.'
      });
    }
  });

  // --- Eventos Específicos do Jitsi Meet ---
  
  // Cliente solicita informações da sala Jitsi
  socket.on('CLIENT_REQUEST_JITSI_ROOM', () => {
    if (session && session.jitsiRoom) {
      socket.emit('SERVER_JITSI_ROOM_INFO', {
        roomName: session.jitsiRoom.roomId,
        jitsiUrl: session.jitsiRoom.jitsiUrl,
        roomDisplayName: session.jitsiRoom.roomName
      });
    } else {
      socket.emit('SERVER_ERROR', { message: 'Sala Jitsi não disponível para esta sessão' });
    }
  });

  // Cliente informa que entrou na sala Jitsi
  socket.on('CLIENT_JITSI_JOINED', () => {
    if (session && session.participants.has(userId)) {
      session.participants.get(userId).jitsiConnected = true;
      console.log(`[JITSI] Usuário ${displayName} entrou na sala Jitsi da sessão ${sessionId}`);
      
      const updatedParticipantsList = Array.from(session.participants.values());
      io.to(sessionId).emit('SERVER_JITSI_STATUS_UPDATE', { 
        participants: updatedParticipantsList,
        message: `${displayName} entrou na comunicação por voz`
      });
    }
  });

  // Cliente informa que saiu da sala Jitsi
  socket.on('CLIENT_JITSI_LEFT', () => {
    if (session && session.participants.has(userId)) {
      session.participants.get(userId).jitsiConnected = false;
      console.log(`[JITSI] Usuário ${displayName} saiu da sala Jitsi da sessão ${sessionId}`);
      
      const updatedParticipantsList = Array.from(session.participants.values());
      io.to(sessionId).emit('SERVER_JITSI_STATUS_UPDATE', { 
        participants: updatedParticipantsList,
        message: `${displayName} saiu da comunicação por voz`
      });
    }
  });
  
  // Lógica para liberar dados, avaliar, etc. (mantida da sua versão anterior, pode ser expandida aqui)
  // Ex: socket.on('ACTOR_RELEASE_DATA', ...)


  // --- Lógica de Desconexão ---

  socket.on('disconnect', async (reason) => {
    console.log(`[DESCONEXÃO] Cliente ${socket.id} (userId: ${userId}) desconectado. Razão: ${reason}`);
    if (session && session.participants.has(userId)) {
      session.participants.delete(userId);
      console.log(`[LEAVE] Usuário ${displayName} (${role}) removido da sessão ${sessionId}`);

      // Atualiza status do usuário para offline no Firestore
      try {
        await db.collection('usuarios').doc(userId).update({
          status: 'offline',
          lastActive: new Date().toISOString(),
        });
        console.log(`[FIRESTORE] Status do usuário ${userId} atualizado para OFFLINE após desconexão.`);
      } catch (err) {
        console.error(`[FIRESTORE] Erro ao atualizar status OFFLINE do usuário ${userId}:`, err);
      }

      // Notifica o participante restante
      socket.to(sessionId).emit('SERVER_PARTNER_DISCONNECTED', { 
        message: `Seu parceiro (${displayName}) desconectou.`,
        remainingParticipants: Array.from(session.participants.values())
      });

      // Se a sala ficar vazia, remove a sessão do mapa para liberar memória
      if (session.participants.size === 0) {
        sessions.delete(sessionId);
        console.log(`[SESSÃO VAZIA] Sessão ${sessionId} encerrada e removida.`);
      }
    }
  });
});


// --- Iniciar o Servidor ---

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor backend rodando na porta ${PORT}`);
});
