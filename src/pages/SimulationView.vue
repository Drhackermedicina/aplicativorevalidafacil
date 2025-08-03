<script setup>
// Imports
import { currentUser } from '@/plugins/auth.js';
import { db } from '@/plugins/firebase.js';
import { registrarConclusaoEstacao } from '@/services/stationEvaluationService.js';
import { backendUrl } from '@/utils/backendUrl.js';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { io } from 'socket.io-client';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// Configuração do editor removida - TinyMCE não essencial

// Função para processar linhas do roteiro
const processRoteiro = computed(() => {
  return (text) => {
    if (!text) return '';
    return formatActorText(text);
  }
});

// Função para processar roteiro especificamente para ator (removendo aspas simples)
const processRoteiroActor = computed(() => {
  return (text) => {
    if (!text) return '';
    if (isActorOrEvaluator.value) {
      return formatActorText(text);
    }
    return formatActorText(text);
  }
});

// Função para formatar texto do roteiro do ator
function formatActorText(text) {
  if (!text) return '';
  
  // Remove tags HTML existentes mantendo o texto
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = text;
  let plainText = tempDiv.innerText;
  
  // Remove aspas simples apenas para ator/avaliador
  if (isActorOrEvaluator.value) {
    plainText = plainText.replace(/'/g, '');
  }
  
  // Separa o texto em linhas, considerando múltiplos tipos de quebras
  const lines = plainText
    .split(/[\n\r]+/)
    .map(line => line.trim())
    .filter(line => line);
  
  // Formata cada linha e seus subitens
  const formattedLines = lines.map(line => {
    // Verifica se é um caso de "HISTÓRIA DA DOENÇA ATUAL - X"
    const hdaTracoRegex = /HISTÓRIA\s+DA\s+DOENÇA\s+ATUAL\s*-\s*(.+)/i;
    const hdaTracoMatch = line.match(hdaTracoRegex);
    if (hdaTracoMatch) {
      // Substitui "HISTÓRIA DA DOENÇA ATUAL - X" por "X"
      line = hdaTracoMatch[1].trim();
    }
    
    // Verifica se é um caso de "HISTÓRIA DA DOENÇA ATUAL (HDA)"
    const hdaParentesisRegex = /(HISTÓRIA\s+DA\s+DOENÇA\s+ATUAL)\s*\([^)]*\)/i;
    const hdaParentesisMatch = line.match(hdaParentesisRegex);
    if (hdaParentesisMatch) {
      // Substitui "HISTÓRIA DA DOENÇA ATUAL (HDA)" por "HISTÓRIA DA DOENÇA ATUAL"
      line = hdaParentesisMatch[1].trim();
    }
    
    // Verifica se é todo em maiúsculo (pelo menos 3 caracteres consecutivos)
    const isAllCaps = /[A-ZÀ-Ú]{3,}/.test(line);
    
    // Primeiro, procura por ":"
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const label = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Só formata se tivermos texto antes e depois dos dois pontos
      if (label && value) {
        // Remove tags HTML que possam estar presentes
        const cleanLabel = label.replace(/(<([^>]+)>)/gi, '');
        
        // Se houver pontos finais no valor, trata como subitens
        if (value.includes('. ')) {
          const subitems = value
            .split(/\.\s+/)
            .filter(item => item.trim())
            .map((item, index, array) => {
              const cleanItem = item.replace(/(<([^>]+)>)/gi, '');
              // Adiciona ponto final de volta em todos exceto o último
              return index < array.length - 1 ? cleanItem + '.' : cleanItem;
            });

          // Formata cada subitem em itálico
          const formattedSubitems = subitems.map(item => `<em>${item}</em>`);
          
          // Aplica classe CSS específica se for todo em maiúsculo
          if (isAllCaps) {
            return `<p class="uppercase-item"><strong>${cleanLabel}</strong>: ${formattedSubitems.join(' ')}</p>`;
          } else {
            return `<p><strong>${cleanLabel}</strong>: ${formattedSubitems.join(' ')}</p>`;
          }
        } else {
          // Sem subitens, formata normalmente
          const cleanValue = value.replace(/(<([^>]+)>)/gi, '');
          
          // Aplica classe CSS específica se for todo em maiúsculo
          if (isAllCaps) {
            return `<p class="uppercase-item"><strong>${cleanLabel}</strong>: <em>${cleanValue}</em></p>`;
          } else {
            return `<p><strong>${cleanLabel}</strong>: <em>${cleanValue}</em></p>`;
          }
        }
      }
    }
    
    // Para linhas sem ":", verifica se é todo em maiúsculo
    if (isAllCaps) {
      return `<p class="uppercase-item">${line}</p>`;
    }
    
    return `<p>${line}</p>`;
  });
  
  return formattedLines.join('');
}

// Adiciona função para edição
function editStationData(field, value) {
  if (stationData.value) {
    stationData.value[field] = value;  // Atualiza o campo
    // Reaplica formatação se necessário
    if (field === 'descricaoCasoCompleta' || field.includes('informacoesVerbaisSimulado')) {
      stationData.value[field] = formatActorText(value);  // Mantém formatação
    }
  }
}

// Refs para dados da estação e checklist
const stationData = ref(null);
const checklistData = ref(null);
// Refs para controle de UI e estado
const isLoading = ref(true);
const errorMessage = ref('');
// Socket removido - dependência não essencial
const socket = ref(null);
const connectionStatus = ref('Desconectado');

// Refs para dados da simulação
const releasedData = ref({});
const evaluationScores = ref({});
const isChecklistVisibleForCandidate = ref(false);
const pepReleasedToCandidate = ref(false);

const actorVisibleImpressoContent = ref({});
const candidateReceivedScores = ref({});
const candidateReceivedTotalScore = ref(0);
const actorReleasedImpressoIds = ref({});

// Refs para controlar carregamento de imagens
const imageLoadAttempts = ref({});
const imageLoadSources = ref({});

// Refs para controlar itens marcados do roteiro
const markedScriptContexts = ref({});
const markedScriptSentences = ref({});

// Refs para armazenar marcações
const markedParagraphs = ref({});

// Variável para controlar o debounce dos cliques
const lastClickTime = ref({});

// Função para separar texto em sentenças
function splitIntoSentences(text) {
  // Divide o texto em sentenças considerando ponto final seguido de espaço
  return text.split('. ').map(sentence => sentence.trim()).filter(sentence => sentence.length > 0);
}

// Refs para informações do parceiro e da sessão
const partner = ref(null);
const route = useRoute();
const router = useRouter();

const stationId = ref(null);
const sessionId = ref(null);
const userRole = ref(null);

// Propriedades computadas para papéis
const isActorOrEvaluator = computed(() => userRole.value === 'actor' || userRole.value === 'evaluator');
const isCandidate = computed(() => userRole.value === 'candidate');

const inviteLinkToShow = ref('');
const copySuccess = ref(false);

// Candidato selecionado para simulação
const selectedCandidateForSimulation = ref(null);

// Chat integration refs
const sendingChat = ref(false);
const chatSentSuccess = ref(false);

const isAdmin = computed(() => {
  return currentUser.value && (
    currentUser.value.uid === 'KiSITAxXMAY5uU3bOPW5JMQPent2' ||
    currentUser.value.uid === 'RtfNENOqMUdw7pvgeeaBVSuin662' ||
    currentUser.value.uid === 'UD7S8aiyR8TJXHyxdw29BHNfjEf1' ||
    currentUser.value.uid === 'lNwhdYgMwLhS1ZyufRzw9xLD10y1'
  );
});

// Refs para estado de prontidão e controle da simulação
const myReadyState = ref(false);
const partnerReadyState = ref(false);
const simulationStarted = ref(false);
const simulationEnded = ref(false);
const simulationWasManuallyEndedEarly = ref(false);
// Ref para controlar delay do botão "Estou pronto" do candidato
const candidateReadyButtonEnabled = ref(false);
// Refs para o timer e seleção de duração
const simulationTimeSeconds = ref(10 * 60);
const timerDisplay = ref(formatTime(simulationTimeSeconds.value));
const selectedDurationMinutes = ref(10);

// --- Função Helper para Formatar Tempo ---
function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- Função para Tocar Som (Início/Fim) ---
function playSoundEffect() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (!audioContext) { console.warn("Web Audio API não suportada."); return; }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    setTimeout(() => { if (audioContext.state !== 'closed') { audioContext.close(); } }, 700);
  } catch (e) { console.warn("Não foi possível tocar o som:", e);
  }
}



// --- NOVO: Função para Formatar a Descrição do Item do PEP para Exibição ---
function formatItemDescriptionForDisplay(descriptionText, itemTitle = '') {
  if (!descriptionText || typeof descriptionText !== 'string') {
    return descriptionText || '';
  }
  let desc = descriptionText.trim();

  // Remove o nome do item do início da descrição (ex: "Apresentação: ...")
  if (itemTitle) {
    const regex = new RegExp('^' + itemTitle.replace(/[.*+?^${}()|[\\]/g, '\\$&') + '\s*:', 'i');
    desc = desc.replace(regex, '').trim();
  } else {
    // Se não tiver título específico, remove qualquer coisa antes dos dois pontos
    desc = desc.replace(/^([^:]+):/, '').trim();
  }

  // Se a descrição ficou vazia após remover o título, retorna vazio
  if (!desc) {
    return '';
  }

  // Remove 'e,' e 'e' desnecessários
  desc = desc.replace(/\s+e,?\s+/g, ', ');
  desc = desc.replace(/,\s*,/g, ','); // remove vírgulas duplas
  desc = desc.replace(/,\s*\./g, '.'); // remove vírgula antes de ponto final
  desc = desc.replace(/,\s*$/g, ''); // remove vírgula no final

  // NOVO: Remove vírgula imediatamente antes de parênteses
  desc = desc.replace(/,\s*\(/g, ' (');

  // Substitui '\n' e ';' por <br>
  desc = desc.replace(/\n/g, '<br>').replace(/;/g, '<br>');
  
  // Corrige parágrafos duplos (remove <br> duplicados)
  desc = desc.replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br>');

  // Coloca em negrito apenas o que vem antes dos dois pontos, exceto se estiver entre parênteses
  desc = desc.replace(/(^|<br>)([^<>()\n:]+?):/g, '$1<strong>$2:</strong>');

  return desc;
}

// REMOVIDO: A computed property `parsedDescriptions` e a função `parseItemDescription` original
// foram removidas pois não são mais necessárias para o formato de exibição desejado.


// --- Função para Buscar Dados da Estação e Checklist ---
async function fetchSimulationData(currentStationId) {
  if (!currentStationId) { errorMessage.value = 'ID da estação inválido.';
    isLoading.value = false; return; }
  isLoading.value = true; errorMessage.value = '';
  console.log(`FETCH: Buscando Estação ID: ${currentStationId} em 'estacoes_clinicas'`);
  try {
    const stationDocRef = doc(db, 'estacoes_clinicas', currentStationId);
    const stationSnap = await getDoc(stationDocRef);
    if (!stationSnap.exists()) { throw new Error(`Estação ${currentStationId} não encontrada.`); }
    stationData.value = { id: stationSnap.id, ...stationSnap.data() };
    console.log("FETCH: Estação Carregada:", stationData.value?.tituloEstacao);

    const durationFromQuery = route.query.duration ? parseInt(route.query.duration) : null;
    const validOptions = [5, 6, 7, 8, 9, 10];

    if (!durationFromQuery || !validOptions.includes(durationFromQuery)) {
      const stationDefaultMinutes = stationData.value?.tempoDuracaoMinutos;
      if (stationDefaultMinutes && validOptions.includes(stationDefaultMinutes)) {
        selectedDurationMinutes.value = stationDefaultMinutes;
      } else {
        if (!validOptions.includes(selectedDurationMinutes.value)) {
          selectedDurationMinutes.value = 10;
        }
      }
    }
    simulationTimeSeconds.value = selectedDurationMinutes.value * 60;
    timerDisplay.value = formatTime(simulationTimeSeconds.value);

    if (stationData.value?.padraoEsperadoProcedimento) {
      checklistData.value = stationData.value.padraoEsperadoProcedimento;
      
      // Verifica feedbackEstacao em diferentes locais (estação raiz ou dentro do PEP)
      console.log("FEEDBACK: Verificando feedbackEstacao...");
      console.log("FEEDBACK: stationData.feedbackEstacao existe?", !!stationData.value.feedbackEstacao);
      console.log("FEEDBACK: checklistData.feedbackEstacao existe?", !!checklistData.value.feedbackEstacao);
      console.log("FEEDBACK: checklistData.feedbackEstacao conteúdo:", checklistData.value.feedbackEstacao);
      
      if (stationData.value.feedbackEstacao && !checklistData.value.feedbackEstacao) {
        checklistData.value.feedbackEstacao = stationData.value.feedbackEstacao;
        console.log("FEEDBACK: feedbackEstacao carregado da raiz da estação");
      } else if (checklistData.value.feedbackEstacao) {
        console.log("FEEDBACK: feedbackEstacao já presente no PEP - OK!");
      } else {
        console.log("FEEDBACK: Nenhum feedbackEstacao encontrado para esta estação");
      }
      
      if (!checklistData.value.itensAvaliacao || !Array.isArray(checklistData.value.itensAvaliacao) || checklistData.value.itensAvaliacao.length === 0) {
        console.warn("FETCH: PEP não contém 'itensAvaliacao' válidos.");
      }
    } else {
      console.warn(`FETCH: 'padraoEsperadoProcedimento' não encontrado na estação. PEP (checklistData) será nulo.`);
      checklistData.value = null;
    }
  } catch (error) { console.error("FETCH: Erro ao buscar dados:", error);
    errorMessage.value = `Falha ao carregar dados da estação: ${error.message}`; stationData.value = null;
    checklistData.value = null;}
  finally {
    isLoading.value = false; console.log("FETCH: Finalizado. isLoading:", isLoading.value, "stationData:", !!stationData.value, "checklistData:", !!checklistData.value);
    if (stationData.value && !errorMessage.value && sessionId.value && userRole.value && stationId.value && currentUser.value?.uid) {
      if (!socket.value || !socket.value.connected) { connectWebSocket();
      }
    } else { console.warn("FETCH: Dados faltando para conectar ao WebSocket ou erro no fetch.");
    }
  }
}

// --- Função para limpar candidato selecionado ---
function clearSelectedCandidate() {
  try {
    sessionStorage.removeItem('selectedCandidate');
    console.log('🧹 Candidato selecionado limpo - simulação finalizada');
  } catch (error) {
    console.warn('Erro ao limpar candidato selecionado:', error);
  }
}

// --- Função para enviar link via chat privado ---
async function sendLinkViaPrivateChat() {
  if (!selectedCandidateForSimulation.value || !inviteLinkToShow.value) {
    console.error('Candidato ou link não disponível');
    return;
  }

  sendingChat.value = true;
  chatSentSuccess.value = false;

  try {
    const candidateUid = selectedCandidateForSimulation.value.uid;
    const linkToSend = inviteLinkToShow.value;
    
    if (!candidateUid || !linkToSend || !currentUser.value?.uid) {
      throw new Error('Dados insuficientes para enviar mensagem');
    }
    
    const chatId = [currentUser.value.uid, candidateUid].sort().join('_');
    const messageData = {
      senderId: currentUser.value.uid,
      senderName: currentUser.value.displayName || 'Avaliador',
      senderPhotoURL: currentUser.value.photoURL || '',
      text: `🎯 **Link da Simulação**\n\n${selectedCandidateForSimulation.value.name}, você foi convidado(a) para participar da simulação da estação **${stationData.value?.tituloEstacao || 'Estação'}**.\n\nClique no link abaixo para acessar:\n${linkToSend}`,
      timestamp: serverTimestamp(),
    };
    
    await addDoc(collection(db, `chatPrivado_${chatId}`), messageData);
    console.log('Link enviado via chat privado para:', candidateUid);
    
    chatSentSuccess.value = true;
    setTimeout(() => {
      chatSentSuccess.value = false;
    }, 3000);
    
  } catch (error) {
    console.error('Erro ao enviar link via chat privado:', error);
    // Aqui você pode adicionar uma notificação de erro para o usuário
  } finally {
    sendingChat.value = false;
  }
}

// --- Lógica do WebSocket ---
function connectWebSocket() {
  if (!sessionId.value || !userRole.value || !stationId.value || !currentUser.value?.uid) { console.error("SOCKET: Dados essenciais faltando para conexão.");
    return; }
  // const backendUrl = 'http://localhost:3000'; // Removido, agora usa import
  console.log(`SOCKET: Conectando a ${backendUrl} para Sessão: ${sessionId.value}, Usuário: ${currentUser.value.uid}, Papel: ${userRole.value}`);
  connectionStatus.value = 'Conectando';
  if (socket.value && socket.value.connected) { socket.value.disconnect(); }
  socket.value = io(backendUrl, {
    transports: ['websocket'],
    query: {
      sessionId: sessionId.value,
      userId: currentUser.value?.uid,
      role: userRole.value,
      stationId: stationId.value,
      displayName: currentUser.value?.displayName
    }
  });
  socket.value.on('connect', () => { 
    connectionStatus.value = 'Conectado'; 
    console.log('SOCKET: Conectado! ID do Socket:', socket.value.id); 
    
    // Delay de 1 segundo para habilitar o botão "Estou pronto" do candidato
    if (userRole.value === 'candidate') {
      candidateReadyButtonEnabled.value = false;
      setTimeout(() => {
        candidateReadyButtonEnabled.value = true;
      }, 1000);
    }
  });
  socket.value.on('disconnect', (reason) => {
    connectionStatus.value = 'Desconectado';
    
    // Desabilitar o botão do candidato na desconexão
    if (userRole.value === 'candidate') {
      candidateReadyButtonEnabled.value = false;
    }
    
    const wasPartnerConnected = !!partner.value;
    partner.value = null;

    const isCandidateReviewing = userRole.value === 'candidate' && stationData.value && simulationStarted.value;

    if (!isCandidateReviewing) {
      myReadyState.value = false;
      partnerReadyState.value = false;
      if (!simulationStarted.value) {
        timerDisplay.value = formatTime(selectedDurationMinutes.value * 60);
      }
    }

    if (isCandidateReviewing) {
      if (!errorMessage.value && reason !== 'io client disconnect' && reason !== 'io client disconnect forced close by client') {
        errorMessage.value = "Conexão perdida. Você pode continuar revisando os dados da estação.";
      }
    } else {
      if (!errorMessage.value && reason !== 'io client disconnect' && reason !== 'io client disconnect forced close by client') {
        errorMessage.value = "Conexão com o servidor de simulação perdida.";
      }
    }
      console.log(`SOCKET: Desconectado. Razão: ${reason}`);
  });
  socket.value.on('connect_error', (err) => { connectionStatus.value = 'Erro de Conexão'; if(!errorMessage.value) errorMessage.value = `Falha ao conectar: ${err.message}`; console.error('SOCKET: Erro de conexão', err);});
  socket.value.on('SERVER_ERROR', (data) => { console.error('SOCKET: Erro do Servidor:', data.message); errorMessage.value = `Erro do servidor: ${data.message}`; });
  socket.value.on('SERVER_JOIN_CONFIRMED', (data) => { console.log('>>> EVENTO RECEBIDO: SERVER_JOIN_CONFIRMED <<<', data); });
  socket.value.on('SERVER_PARTNER_JOINED', (participantInfo) => { console.log('>>> EVENTO RECEBIDO: SERVER_PARTNER_JOINED <<<', participantInfo); if (participantInfo && participantInfo.userId !== currentUser.value?.uid) { partner.value = participantInfo; partnerReadyState.value = participantInfo.isReady || false; errorMessage.value = ''; } });
  socket.value.on('SERVER_EXISTING_PARTNERS', (participantsList) => { console.log('>>> EVENTO RECEBIDO: SERVER_EXISTING_PARTNERS <<<', participantsList); updatePartnerInfo(participantsList); });
  function updatePartnerInfo(participants) { const currentUserId = currentUser.value?.uid;
  if (participants && Array.isArray(participants) && currentUserId) { const otherParticipant = participants.find(p => p.userId !== currentUserId); if(otherParticipant) { partner.value = otherParticipant;
  partnerReadyState.value = partner.value.isReady || false; errorMessage.value = ''; } else { partner.value = null;
  partnerReadyState.value = false;} } else { partner.value = null; partnerReadyState.value = false;} }

  socket.value.on('SERVER_PARTNER_LEFT', (data) => {
    console.log('>>> EVENTO RECEBIDO: SERVER_PARTNER_LEFT <<<', data);
    if (partner.value && partner.value.userId === data.userId) {
      partner.value = null;
      partnerReadyState.value = false;

      const isCandidateReviewing = userRole.value === 'candidate' && stationData.value && simulationStarted.value;

      if (!isCandidateReviewing) {
        myReadyState.value = false;
      }

      if (isCandidateReviewing) {
        if (!errorMessage.value) {
            errorMessage.value = "O parceiro desconectou. Você pode continuar revisando os dados da estação.";
        }
      } else {
        if (!errorMessage.value) {
          errorMessage.value = "Simulação interrompida: o parceiro desconectou.";
        }
      }
    }
  });
  socket.value.on('CANDIDATE_RECEIVE_DATA', (payload) => { console.log('>>> EVENTO RECEBIDO: CANDIDATE_RECEIVE_DATA <<<', payload); const { dataItemId } = payload; if (userRole.value === 'candidate' && stationData.value?.materiaisDisponiveis?.impressos) { const impressoParaLiberar = stationData.value.materiaisDisponiveis.impressos.find(item => item.idImpresso === dataItemId); if (impressoParaLiberar) { releasedData.value[dataItemId] = { ...impressoParaLiberar }; releasedData.value = {...releasedData.value}; } } });
  socket.value.on('SERVER_PARTNER_READY', (data) => { console.log('>>> EVENTO RECEBIDO: SERVER_PARTNER_READY <<<', data); if (data && data.userId !== currentUser.value?.uid) { if (partner.value && partner.value.userId === data.userId) { partner.value.isReady = data.isReady; } partnerReadyState.value = data.isReady; } });
  socket.value.on('SERVER_START_SIMULATION', (data) => {
    console.log('>>> EVENTO RECEBIDO: SERVER_START_SIMULATION <<<', data);
    if (data && typeof data.durationSeconds === 'number') {
        simulationTimeSeconds.value = data.durationSeconds;
        timerDisplay.value = formatTime(data.durationSeconds);
        console.log(`[CLIENT] SERVER_START_SIMULATION recebido. Timer configurado para ${data.durationSeconds}s pelo servidor.`);
    } else {
        console.warn('[CLIENT] SERVER_START_SIMULATION não continha durationSeconds. Timer pode estar dessincronizado com o cliente inicial.');
        timerDisplay.value = formatTime(simulationTimeSeconds.value);
    }
    simulationStarted.value = true;
    simulationEnded.value = false;
    simulationWasManuallyEndedEarly.value = false;
    errorMessage.value = '';
    playSoundEffect();
  });
  socket.value.on('TIMER_UPDATE', (data) => {
    if (typeof data.remainingSeconds === 'number') {
      timerDisplay.value = formatTime(data.remainingSeconds);
      if (data.remainingSeconds <= 0 && !simulationEnded.value) {
        simulationEnded.value = true;
      }
    }
  });
  socket.value.on('TIMER_END', () => {
    console.log('>>> EVENTO RECEBIDO: TIMER_END <<<');
    timerDisplay.value = "00:00";
    if (!simulationEnded.value) {
      playSoundEffect(); // Som do final da estação
      simulationEnded.value = true; // Marca como encerrada ANTES para evitar som duplicado
    }
    simulationWasManuallyEndedEarly.value = false; // Garante que é false se terminou por tempo
    
    // Limpar candidato selecionado quando simulação termina
    clearSelectedCandidate();
    
    // Notificação para o candidato
    if (userRole.value === 'candidate') {
      showNotification('Tempo finalizado! Aguardando avaliação do examinador...', 'info');
      console.log('CANDIDATO: Tempo finalizado. Aguardando avaliação...');
    }
  });
  socket.value.on('TIMER_STOPPED', (data) => {
    console.log('>>> EVENTO RECEBIDO: TIMER_STOPPED <<<', data);
    const previousTimerDisplay = timerDisplay.value;

    if (!simulationEnded.value) {
        playSoundEffect(); // Som do final da estação
        simulationEnded.value = true; // Marca como encerrada ANTES para evitar som duplicado
    }

    // Limpar candidato selecionado quando simulação para
    clearSelectedCandidate();

    // A lógica para `simulationWasManuallyEndedEarly` permanece aqui,
    // pois ela é usada para desabilitar a 'Submissão de Avaliação'.
    if (data?.reason === 'manual_end') { // Verificando se a razão é 'manual_end'
      simulationWasManuallyEndedEarly.value = true;
      console.log("Simulação encerrada manualmente ANTES do tempo.");
    } else {
      simulationWasManuallyEndedEarly.value = false; // Garante que é false para outras razões
    }


    if (data?.reason === 'participante desconectou' && !errorMessage.value) {
      errorMessage.value = "Simulação interrompida: parceiro desconectou.";
    } else if (data?.reason === 'manual_end' && !errorMessage.value && simulationWasManuallyEndedEarly.value) { // Esta condição será TRUE se for 'manual_end'
      errorMessage.value = "Simulação encerrada manually pelo ator/avaliador antes do tempo.";
    } else if (data?.reason === 'tempo esgotado' && !errorMessage.value) { // Adicionado para clarity
      errorMessage.value = "Simulação encerrada: tempo esgotado.";
    } else if (!errorMessage.value) {
      errorMessage.value = "Simulação encerrada.";
    // Fallback para outras razões ou manual_end que já não era antes
    }
  });
  socket.value.on('CANDIDATE_RECEIVE_PEP_VISIBILITY', (payload) => {
    console.log('>>> EVENTO RECEBIDO: CANDIDATE_RECEIVE_PEP_VISIBILITY <<<', payload);
    if (userRole.value === 'candidate' && payload && typeof payload.shouldBeVisible === 'boolean') {
      isChecklistVisibleForCandidate.value = payload.shouldBeVisible;
      
      // Notificar o candidato quando o PEP é liberado
      if (payload.shouldBeVisible) {
        showNotification('O PEP (checklist de avaliação) foi liberado pelo examinador!', 'success');
      }
    }
  });
  socket.value.on('CANDIDATE_RECEIVE_UPDATED_SCORES', (data) => {
    console.log('CANDIDATO: Recebeu atualização de scores:', data); // ADICIONE ESTE LOG
    if (userRole.value === 'candidate' && data && data.scores) {
      // Converta para number
      const numericScores = {};
      Object.keys(data.scores).forEach(key => {
        numericScores[key] = typeof data.scores[key] === 'string'
          ? parseFloat(data.scores[key])
          : data.scores[key];
      });
      candidateReceivedScores.value = { ...numericScores };
      if (typeof data.totalScore === 'number') {
        candidateReceivedTotalScore.value = data.totalScore;
      }
      
      // Log para debug (notificação removida - feedback visual já disponível no PEP)
      if (simulationEnded.value && data.totalScore > 0) {
        console.log('CANDIDATO: Avaliação recebida com nota final:', data.totalScore);
      }
    }
  });
  socket.value.on('SERVER_BOTH_PARTICIPANTS_READY', () => {
    myReadyState.value = true;
    partnerReadyState.value = true;
    // Se partner.value estiver vazio, tenta preencher com papel oposto
    if (!partner.value) {
      partner.value = { role: userRole.value === 'actor' ? 'candidate' : 'actor', isReady: true };
    } else {
      partner.value.isReady = true;
    }
    errorMessage.value = '';
  });
}

// --- Função para carregar candidato selecionado ---
function loadSelectedCandidate() {
  try {
    const candidateData = JSON.parse(sessionStorage.getItem('selectedCandidate') || '{}');
    if (candidateData.uid) {
      selectedCandidateForSimulation.value = candidateData;
      console.log('Candidato carregado para simulação:', candidateData.name);
    } else {
      selectedCandidateForSimulation.value = null;
    }
  } catch (error) {
    console.warn('Erro ao carregar candidato selecionado:', error);
    selectedCandidateForSimulation.value = null;
  }
}

// --- Função Setup Session ---
function setupSession() {
  console.log("SETUP_SESSION: Iniciando...");
  errorMessage.value = '';
  isLoading.value = true;
  if (socket.value && socket.value.connected) { socket.value.disconnect(); }
  socket.value = null;
  stationData.value = null;
  checklistData.value = null;
  stationId.value = route.params.id;
  sessionId.value = route.query.sessionId; // CORREÇÃO: de route.query.session para route.query.sessionId
  userRole.value = route.query.role;

  inviteLinkToShow.value = '';

  myReadyState.value = false;
  partnerReadyState.value = false;
  simulationStarted.value = false;
  simulationEnded.value = false;
  simulationWasManuallyEndedEarly.value = false;
  partner.value = null;
  releasedData.value = {};
  evaluationScores.value = {};
  isChecklistVisibleForCandidate.value = false;
  pepReleasedToCandidate.value = false;
  actorVisibleImpressoContent.value = {};
  candidateReceivedScores.value = {};
  candidateReceivedTotalScore.value = 0;
  actorReleasedImpressoIds.value = {};

  // Carregar candidato selecionado se for ator/avaliador
  if (userRole.value === 'actor' || userRole.value === 'evaluator') {
    loadSelectedCandidate();
  }

  const durationFromQuery = route.query.duration ? parseInt(route.query.duration) : null;
  const validOptions = [5, 6, 7, 8, 9, 10];
  if (durationFromQuery && validOptions.includes(durationFromQuery)) {
      selectedDurationMinutes.value = durationFromQuery;
      console.log(`Duração definida pela URL: ${selectedDurationMinutes.value} min`);
  } else {
      selectedDurationMinutes.value = 10;
      if(durationFromQuery) console.warn(`Duração inválida (${durationFromQuery}) na URL, usando padrão ${selectedDurationMinutes.value} min.`);
  }
  timerDisplay.value = formatTime(simulationTimeSeconds.value * 60);
  console.log("SETUP_SESSION: Dados da Rota:", { params: route.params, query: route.query });
  if (!sessionId.value) { errorMessage.value = "Link inválido: ID Sessão não encontrado."; isLoading.value = false; return;
  }
  if (!stationId.value) { errorMessage.value = "Link inválido: ID Estação não encontrado."; isLoading.value = false; return;
  }
  if (!userRole.value || !['actor', 'candidate', 'evaluator'].includes(userRole.value)) { errorMessage.value = "Link inválido: Papel não definido/incorreto."; isLoading.value = false; return;
  }
  console.log("SETUP_SESSION: Refs atualizados:", { stationId: stationId.value, sessionId: sessionId.value, userRole: userRole.value });

  fetchSimulationData(stationId.value);
}

// --- Computed Property para Soma Automática das Notas ---
const totalScore = computed(() => {
  return Object.values(evaluationScores.value).reduce((sum, score) => {
    const numScore = parseFloat(score);
    return sum + (isNaN(numScore) ? 0 : numScore);
  }, 0);
});
// --- Computed Property e Watch para 'bothParticipantsReady' ---
const bothParticipantsReady = computed(() => myReadyState.value && partnerReadyState.value && !!partner.value);
watch(bothParticipantsReady, (newValue) => {
  if (newValue &&
      (userRole.value === 'actor' || userRole.value === 'evaluator') &&
      socket.value?.connected &&
      !simulationStarted.value &&
      !simulationEnded.value &&
      inviteLinkToShow.value // Garante que o link já foi gerado (simulando que a sessão foi iniciada no backend)
      ) {
    const durationToSend = selectedDurationMinutes.value;
    console.log(`[CLIENT - WATCHER] Preparando para emitir CLIENT_START_SIMULATION (ambos prontos). Duração selecionada:`, durationToSend, 'Tipo:', typeof durationToSend);
    socket.value.emit('CLIENT_START_SIMULATION', {
      sessionId: sessionId.value,
      durationMinutes: durationToSend // Usando a variável durationToSend
    });
  } else if (newValue && userRole.value === 'candidate' && !simulationStarted.value) {
    console.log("CANDIDATO: Ambos prontos, aguardando início...");
  }
});
// --- Hooks Ciclo de Vida ---
onMounted(() => { console.log("SimulationView Montado. Configurando sessão inicial..."); setupSession(); });
watch(() => route.fullPath, (newPath, oldPath) => { if (newPath !== oldPath && route.name === 'SimulationView') { console.log("MUDANÇA DE ROTA (SimulationView fullPath):", newPath, "Reconfigurando sessão..."); setupSession(); }});
onUnmounted(() => { 
  if (socket.value) { 
    console.log("Componente SimulationView DESMONTADO. Desconectando socket."); 
    socket.value.disconnect(); 
    socket.value = null; 
  }
  
  // Limpar candidato selecionado ao sair da simulação
  try {
    sessionStorage.removeItem('selectedCandidate');
    console.log('Candidato selecionado limpo ao sair da simulação');
  } catch (error) {
    console.warn('Erro ao limpar candidato selecionado:', error);
  }
});
function toggleActorImpressoVisibility(impressoId) {
  actorVisibleImpressoContent.value[impressoId] = !actorVisibleImpressoContent.value[impressoId];
  actorVisibleImpressoContent.value = {...actorVisibleImpressoContent.value};
}

function updateTimerDisplayFromSelection() {
  if (selectedDurationMinutes.value) {
    const newTimeInSeconds = parseInt(selectedDurationMinutes.value) * 60;
    if (!simulationStarted.value && !inviteLinkToShow.value) {
          if (simulationTimeSeconds.value !== newTimeInSeconds) {
            simulationTimeSeconds.value = newTimeInSeconds;
            timerDisplay.value = formatTime(simulationTimeSeconds.value);
            console.log(`Duração da estação alterada para: ${selectedDurationMinutes.value} minutos via dropdown.`);
          }
    } else if (simulationStarted.value) {
          console.warn("Não é possível alterar a duração após o início da simulação.");
    } else if (inviteLinkToShow.value) {
      // Se o link já foi gerado, a duração está "travada" com a duração do link.
      // Resetar o dropdown para o valor correto caso o usuário mude e tente iniciar de novo.
      // O `selectedDurationMinutes` deve ser o que foi usado para gerar o link (que é o que está no timerDisplay)
      const currentDurationInMinutes = Math.round(simulationTimeSeconds.value / 60);
      const validOptions = [5,6,7,8,9,10];
      if (selectedDurationMinutes.value !== currentDurationInMinutes && validOptions.includes(currentDurationInMinutes) ) {
          selectedDurationMinutes.value = currentDurationInMinutes;
      }
      console.warn("Duração travada após geração do link. Use o valor previamente selecionado.");
    }
  }
}

function generateInviteLinkWithDuration() {
  if (isLoading.value) {
    errorMessage.value = "Aguarde o carregamento dos dados da estação.";
    return;
  }
  if (!stationData.value) {
    errorMessage.value = "Dados da estação ainda não carregados. Tente novamente em instantes.";
    return;
  }
  if ((userRole.value === 'actor' || userRole.value === 'evaluator') && stationId.value && sessionId.value) {
    if (communicationMethod.value === 'meet') {
      if (!meetLink.value) {
        errorMessage.value = "Cole o link da sala do Google Meet antes de gerar o convite.";
        return;
      }
      // Validação simples do link do Meet
      const trimmedLink = meetLink.value.trim();
      if (!/^https:\/\/meet\.google\.com\//.test(trimmedLink)) {
        errorMessage.value = "O link do Meet deve começar com https://meet.google.com/";
        return;
      }
    }
    const partnerRoleToInvite = userRole.value === 'actor' ?
      'candidate' : (userRole.value === 'evaluator' ? 'actor' : null);
    if (partnerRoleToInvite) {
      try {
        const inviteQuery = {
          sessionId: sessionId.value,
          role: partnerRoleToInvite,
          duration: selectedDurationMinutes.value
        };
        
        // Adicionar dados do candidato selecionado se disponível
        const selectedCandidate = JSON.parse(sessionStorage.getItem('selectedCandidate') || '{}');
        if (selectedCandidate.uid) {
          inviteQuery.candidateUid = selectedCandidate.uid;
          inviteQuery.candidateName = selectedCandidate.name;
          console.log('Link personalizado criado para candidato:', selectedCandidate.name);
        }
        
        if (communicationMethod.value === 'meet') {
          inviteQuery.meet = meetLink.value.trim();
        }
        // Busca recursiva da rota protegida
        const routeDef = findRouteByName(router.options.routes, 'station-simulation');
        if (!routeDef) {
          errorMessage.value = "Rota 'station-simulation' não encontrada. Verifique a configuração do roteador.";
          return;
        }
        const inviteRoute = router.resolve({
          name: 'station-simulation',
          params: { id: stationId.value },
          query: inviteQuery
        });
        if (!inviteRoute || !inviteRoute.href) {
          errorMessage.value = "Falha ao resolver a rota de convite. Verifique as configurações.";
          return;
        }
        inviteLinkToShow.value = window.location.origin + inviteRoute.href;
        errorMessage.value = '';
      } catch (e) {
        errorMessage.value = `Erro ao gerar link de convite: ${e.message}`;
      }
    }
  } else {
    errorMessage.value = "Não foi possível gerar link de convite neste momento.";
  }
}

// --- CONTROLE DE LINK DO MEET PARA O CANDIDATO ---
const candidateMeetLink = ref('');
const candidateOpenedMeet = ref(false);

function checkCandidateMeetLink() {
  if (userRole.value === 'candidate' && route.query.meet && typeof route.query.meet === 'string') {
    candidateMeetLink.value = route.query.meet;
  } else {
    candidateMeetLink.value = '';
  }
  candidateOpenedMeet.value = false; // Sempre reinicia ao entrar
}

function openCandidateMeet() {
  if (candidateMeetLink.value) {
    window.open(candidateMeetLink.value, '_blank');
    candidateOpenedMeet.value = true;
  }
}

// Atualiza ao montar e ao mudar rota
onMounted(() => {
  console.log("SimulationView Montado. Configurando sessão inicial...");
  setupSession();
  checkCandidateMeetLink();
  
  // Inicializa o sidebar como fechado por padrão
  setTimeout(() => {
    const wrapper = document.querySelector('.layout-wrapper');
    if (wrapper && !wrapper.classList.contains('layout-vertical-nav-collapsed')) {
      wrapper.classList.add('layout-vertical-nav-collapsed');
    }
  }, 100); // Pequeno delay para garantir que o DOM foi renderizado
});
watch(() => route.fullPath, (newPath, oldPath) => {
  if (newPath !== oldPath && route.name === 'SimulationView') {
    console.log("MUDANÇA DE ROTA (SimulationView fullPath):", newPath, "Reconfigurando sessão...");
    setupSession();
    checkCandidateMeetLink();
  }
});
// --- Funções de Interação ---
function releaseData(dataItemId) {
  // Lógica no frontend para verificar se o item já foi liberado, ou se a simulação terminou/começou
  // A validação final de estado (ativa/encerrada) é feita no backend
  if (!socket.value?.connected) { alert("Erro: Não conectado.");
    return; }
  if (userRole.value !== 'actor') { alert("Apenas o ator pode liberar dados."); return; }
  if (!sessionId.value) return;
  // A validação de `simulationStarted` ou `simulationEnded` será feita no backend.
  // No frontend, apenas verificamos se já foi liberado para evitar spam de botão.
  if (actorReleasedImpressoIds.value[dataItemId]) {
    console.log(`ATOR: ${dataItemId} já foi liberado.`);
    return;
  }

  console.log(`ATOR: Tentando liberar ${dataItemId}`);
  socket.value.emit('ACTOR_RELEASE_DATA', { sessionId: sessionId.value, dataItemId });
  actorReleasedImpressoIds.value = {...actorReleasedImpressoIds.value, [dataItemId]: true}; // Atualiza localmente
  console.log("actorReleasedImpressoIds atualizado:", actorReleasedImpressoIds.value);
}

async function copyInviteLink() { if(!inviteLinkToShow.value) return; try {await navigator.clipboard.writeText(inviteLinkToShow.value); copySuccess.value=true; setTimeout(()=>copySuccess.value=false,2000);
  } catch(e){alert('Falha ao copiar.')} }
function sendReady() { if (socket.value?.connected && sessionId.value && !myReadyState.value) { console.log(`SOCKET: (${userRole.value}) Enviando CLIENT_IM_READY...`);
  socket.value.emit('CLIENT_IM_READY', { sessionId: sessionId.value }); myReadyState.value = true; } else { let rsn=""; if(myReadyState.value) rsn="Já pronto."; else if(!socket.value?.connected) rsn="Não conectado.";
  else rsn="Erro."; alert(rsn); } }

// MODIFICAÇÃO 2: Nova função para lidar com o clique do botão "Iniciar Simulação"
function handleStartSimulationClick() {
  if (socket.value?.connected && sessionId.value && (userRole.value === 'actor' || userRole.value === 'evaluator') && bothParticipantsReady.value && !simulationStarted.value) {
    const durationToSend = selectedDurationMinutes.value;
    console.log('[CLIENT - BUTTON CLICK] Preparando para emitir CLIENT_START_SIMULATION. Duração selecionada:', durationToSend, 'Tipo:', typeof durationToSend);
    socket.value.emit('CLIENT_START_SIMULATION', {
      sessionId: sessionId.value,
      durationMinutes: durationToSend
    });
  } else {
    console.error("[CLIENT - BUTTON CLICK] Não foi possível emitir CLIENT_START_SIMULATION. Condições não atendidas:", {
      connected: socket.value?.connected,
      sessionId: sessionId.value,
      userRole: userRole.value,
      bothReady: bothParticipantsReady.value,
      simStarted: simulationStarted.value
    });
    alert("Não é possível iniciar a simulação neste momento. Verifique se todos estão prontos e a conexão está ativa.");
  }
}

async function submitEvaluation() {
  if (userRole.value !== 'actor' && userRole.value !== 'evaluator') {
    alert("Apenas o Ator/Avaliador pode submeter avaliação.");
    return;
  }
  if (!socket.value?.connected || !sessionId.value) {
    alert("Não conectado a uma sessão válida.");
    return;
  }
  if (Object.keys(evaluationScores.value).length === 0) {
    alert("Nenhuma pontuação foi registrada.");
    return;
  }

  console.log(`ATOR/AVALIADOR: Submetendo:`, evaluationScores.value, "Total:", totalScore.value.toFixed(2));
  socket.value.emit('EVALUATOR_SUBMIT_EVALUATION', { 
    sessionId: sessionId.value, 
    stationId: stationId.value, 
    evaluatorId: currentUser.value?.uid, 
    scores: evaluationScores.value, 
    totalScore: totalScore.value 
  });
  
  if (pepReleasedToCandidate.value && socket.value?.connected) {
    console.log('ATOR/AVALIADOR: Re-enviando scores para candidato após submissão final:', evaluationScores.value);
    socket.value.emit('EVALUATOR_SCORES_UPDATED_FOR_CANDIDATE', {
      sessionId: sessionId.value,
      scores: evaluationScores.value,
      totalScore: totalScore.value
    });
  }

  // --- Integração Firestore: registrar avaliação NO CANDIDATO ---
  // Estratégia: tentar todas as fontes possíveis para garantir o UID do candidato
  let candidateUid = null;
  // 1. partner (websocket)
  if (partner.value?.userId) candidateUid = partner.value.userId;
  // 2. sessionStorage
  if (!candidateUid) {
    try {
      const selectedCandidate = JSON.parse(sessionStorage.getItem('selectedCandidate') || '{}');
      if (selectedCandidate && selectedCandidate.uid) {
        candidateUid = selectedCandidate.uid;
        console.log('[AVALIAÇÃO] UID do candidato via sessionStorage:', candidateUid, selectedCandidate);
      }
    } catch (err) {
      console.warn('[AVALIAÇÃO] Erro ao ler candidato do sessionStorage:', err);
    }
  }
  // 3. selectedCandidateForSimulation ref
  if (!candidateUid && selectedCandidateForSimulation.value?.uid) {
    candidateUid = selectedCandidateForSimulation.value.uid;
    console.log('[AVALIAÇÃO] UID do candidato via ref:', candidateUid, selectedCandidateForSimulation.value);
  }
  // 4. route.query (caso venha por URL)
  if (!candidateUid && route.query.candidateUid) {
    candidateUid = route.query.candidateUid;
    console.log('[AVALIAÇÃO] UID do candidato via route.query:', candidateUid);
  }

  // Validação final
  if (!candidateUid) {
    alert('Não foi possível identificar o candidato para registrar a avaliação. Por favor, selecione o candidato corretamente antes de iniciar a simulação.');
    console.error('[AVALIAÇÃO] Falha crítica: UID do candidato não encontrado!');
    return;
  }

  // Registro da avaliação
  if (stationId.value && typeof totalScore.value === 'number') {
    try {
      const avaliacaoData = {
        uid: candidateUid,
        idEstacao: stationId.value,
        nota: totalScore.value,
        data: new Date(),
        nomeEstacao: stationData.value?.tituloEstacao || 'Estação Clínica',
        especialidade: stationData.value?.especialidade || 'Geral',
        origem: stationData.value?.origem || 'SIMULACAO'
      };
      console.log('[AVALIAÇÃO] Registrando avaliação:', avaliacaoData);
      await registrarConclusaoEstacao(avaliacaoData);
      console.log('[AVALIAÇÃO] Sucesso! Avaliação registrada no histórico do candidato:', candidateUid);
    } catch (err) {
      alert('Erro ao registrar avaliação do candidato. Veja o console para detalhes.');
      console.error('[AVALIAÇÃO] Erro ao registrar avaliação no Firestore:', err);
    }
  } else {
    alert('Dados insuficientes para registrar avaliação.');
    console.warn('[AVALIAÇÃO] Dados insuficientes para registrar avaliação:', {
      candidateUid,
      stationId: stationId.value,
      totalScore: totalScore.value
    });
  }
}

function releasePepToCandidate() {
  if (!socket.value?.connected || !sessionId.value) { alert("Erro: Não conectado."); return; }
  if (pepReleasedToCandidate.value) { console.log("PEP já foi liberado anteriormente."); return; }
  if(userRole.value !== 'actor' && userRole.value !== 'evaluator') {alert("Não autorizado."); return;}

  // Permite liberar o PEP a qualquer momento
  const payload = { sessionId: sessionId.value };
  console.log(`SOCKET: (${userRole.value}) Emitindo ACTOR_RELEASE_PEP:`, payload);
  socket.value.emit('ACTOR_RELEASE_PEP', payload);
  pepReleasedToCandidate.value = true;
}

// --- Funções para controle de carregamento de imagens ---
function getImageId(impressoId, context) {
  return `${impressoId}-${context}`;
}

function getImageSource(imagePath, imageId) {
  // Se ainda não foi registrada, inicia com a URL original
  if (!imageLoadSources.value[imageId]) {
    imageLoadSources.value = {
      ...imageLoadSources.value,
      [imageId]: imagePath
    };
  }
  return imageLoadSources.value[imageId];
}

function handleImageError(imagePath, imageId) {
  console.log(`[DEBUG] Erro ao carregar imagem: ${imagePath} (ID: ${imageId})`);
  
  // Incrementa tentativas
  const attempts = (imageLoadAttempts.value[imageId] || 0) + 1;
  imageLoadAttempts.value = {
    ...imageLoadAttempts.value,
    [imageId]: attempts
  };
  
  // Máximo de 3 tentativas
  if (attempts <= 3) {
    console.log(`[DEBUG] Tentativa ${attempts}/3 de recarregar imagem: ${imagePath}`);
    
    // Força recarregamento adicionando timestamp
    const separator = imagePath.includes('?') ? '&' : '?';
    const newUrl = `${imagePath}${separator}reload=${Date.now()}&attempt=${attempts}`;
    
    // Atualiza a fonte da imagem
    imageLoadSources.value = {
      ...imageLoadSources.value,
      [imageId]: newUrl
    };
    
    console.log(`[DEBUG] Nova URL da imagem: ${newUrl}`);
  } else {
    console.error(`[DEBUG] Falha definitiva ao carregar imagem após 3 tentativas: ${imagePath}`);
  }
}

function handleImageLoad(imageId) {
  console.log(`[DEBUG] Imagem carregada com sucesso: ${imageId}`);
  // Reset tentativas quando carrega com sucesso
  if (imageLoadAttempts.value[imageId]) {
    delete imageLoadAttempts.value[imageId];
  }
}

// Função para manter os callbacks de avaliação
function sendEvaluationScores() {
  // Envia os scores iniciais ao liberar o PEP (se já houver algum)
  if (socket.value?.connected) {
      console.log('ATOR/AVALIADOR: Enviando scores iniciais ao liberar PEP:', evaluationScores.value);
      socket.value.emit('EVALUATOR_SCORES_UPDATED_FOR_CANDIDATE', {
        sessionId: sessionId.value,
        scores: evaluationScores.value,
        totalScore: totalScore.value
      });
  }
}
function manuallyEndSimulation() {
    if (!simulationStarted.value || simulationEnded.value) { return;
    }
    if (!socket.value?.connected || !sessionId.value) { alert("Erro: Não conectado para encerrar."); return;
    }
    if (userRole.value !== 'actor' && userRole.value !== 'evaluator') { alert("Não autorizado."); return;
    }
    console.log(`SOCKET: (${userRole.value}) Emitindo CLIENT_MANUAL_END_SIMULATION para ${sessionId.value}`);
    socket.value.emit('CLIENT_MANUAL_END_SIMULATION', { sessionId: sessionId.value });
}

watch(evaluationScores, (newScores) => {
  if (
    socket.value?.connected &&
    (userRole.value === 'actor' || userRole.value === 'evaluator') &&
    pepReleasedToCandidate.value
  ) {
    // Converta todos os valores para number
    const numericScores = {};
    Object.keys(newScores).forEach(key => {
      numericScores[key] = typeof newScores[key] === 'string'
        ? parseFloat(newScores[key])
        : newScores[key];
    });

    console.log('ATOR/AVALIADOR: Emitindo EVALUATOR_SCORES_UPDATED_FOR_CANDIDATE', numericScores);

    socket.value.emit('EVALUATOR_SCORES_UPDATED_FOR_CANDIDATE', {
      sessionId: sessionId.value,
      scores: numericScores,
      totalScore: Object.values(numericScores).reduce((sum, v) => sum + (isNaN(v) ? 0 : v), 0)
    });
  }
}, { deep: true });

// Funções para marcar/desmarcar partes do roteiro
function toggleScriptContext(idx, event) {
  // Impedir a propagação do evento para evitar múltiplos cliques
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  if (userRole.value === 'actor' || userRole.value === 'evaluator') {
    const clickKey = `c-${idx}`;
    
    // Verificar se houve um clique recente para evitar duplicação
    const now = Date.now();
    if (lastClickTime.value[clickKey] && now - lastClickTime.value[clickKey] < 500) {
      console.log("Ignorando clique rápido subsequente em contexto");
      return;
    }
    
    // Registrar o tempo do clique
    lastClickTime.value[clickKey] = now;
    
    // Use um timeout mínimo para evitar problemas de renderização
    setTimeout(() => {
      // Toggle o valor (invertendo o estado atual)
      markedScriptContexts.value[idx] = !markedScriptContexts.value[idx];
      
      // Criar uma cópia do objeto ref para garantir que a atualização da UI seja acionada
      markedScriptContexts.value = { ...markedScriptContexts.value };
      
      // Força a atualização do DOM após a alteração
      nextTick(() => {
        // Atualiza o atributo data-marked explicitamente
        const elements = document.querySelectorAll(`[data-marked]`);
        elements.forEach(el => {
          // Garante que a classe CSS permaneça aplicada
          if (el.getAttribute('data-marked') === 'true') {
            if (el.classList.contains('marked-context-primary') || el.classList.contains('marked-context-warning')) {
              el.style.backgroundColor = el.classList.contains('marked-context-primary') 
                ? 'rgba(var(--v-theme-primary), 0.15)' 
                : 'rgba(var(--v-theme-warning), 0.2)';
            }
          }
        });
      });
      
      console.log(`Contexto ${idx} marcado:`, markedScriptContexts.value[idx]);
    }, 10);
  }
}

function toggleScriptSentence(idx, sentenceIdx) {
  if (userRole.value === 'actor' || userRole.value === 'evaluator') {
    const key = `${idx}-${sentenceIdx}`;
    markedScriptSentences.value[key] = !markedScriptSentences.value[key];
    // Criar uma cópia do objeto ref para garantir que a atualização da UI seja acionada
    markedScriptSentences.value = { ...markedScriptSentences.value };
  }
}

// --- Adiciona os refs ausentes para marcação de itens do roteiro ---
const markedMainItems = ref({});
const markedSubItems = ref({});

// Funções para marcar/desmarcar itens do roteiro
function toggleMainItem(itemId) {
  markedMainItems.value[itemId] = !markedMainItems.value[itemId];
}

function toggleSubItem(itemId) {
  markedSubItems.value[itemId] = !markedSubItems.value[itemId];
}

// Função que retorna a classe CSS baseada no estado do item
function getItemClasses(itemType, itemId) {
  if (itemType === 'main') {
    return {
      'marked': markedMainItems.value[itemId]
    };
  } else if (itemType === 'sub') {
    return {
      'marked': markedSubItems.value[itemId]
    };
  }
  return {};
}

// Função para lidar com cliques nos itens do roteiro
function handleClick(event) {
  // Identifica qual elemento foi clicado
  const mainItem = event.target.closest('.main-item');
  const subItem = event.target.closest('.subitem');
  
  if (mainItem) {
    // Se clicou em um item principal
    const itemId = mainItem.getAttribute('data-main-item-id');
    if (itemId) {
      toggleMainItem(itemId);
      event.stopPropagation(); // Evita a propagação do evento
    }
  } else if (subItem) {
    // Se clicou em um subitem
    const itemId = subItem.getAttribute('data-subitem-id');
    if (itemId) {
      toggleSubItem(itemId);
      event.stopPropagation(); // Evita a propagação do evento
    }
  }
}

// Setup do listener de eventos para marcação
onMounted(() => {
  document.addEventListener('toggleMark', (e) => toggleMark(e.detail));
});

onUnmounted(() => {
  document.removeEventListener('toggleMark', (e) => toggleMark(e.detail));
});

// --- NOVO: Comunicação Google Meet ---
const communicationMethod = ref(''); // 'voice' ou 'meet'
const meetLink = ref('');
const meetLinkCopied = ref(false);

function openGoogleMeet() {
  // Abre uma nova sala do Meet
  window.open('https://meet.google.com/new', '_blank');
}

function copyMeetLink() {
  if (meetLink.value) {
    navigator.clipboard.writeText(meetLink.value);
    meetLinkCopied.value = true;
    setTimeout(() => { meetLinkCopied.value = false; }, 2000);
  }
}

// --- CONTROLE DE USUÁRIOS ONLINE E CONVITE INTERNO ---
const onlineCandidates = ref([]); // Lista de candidatos online
const isSendingInternalInvite = ref(false);
const internalInviteSentTo = ref(null);

// Recebe lista de usuários online do backend
function handleOnlineUsersList(users) {
  // Filtra apenas candidatos
  onlineCandidates.value = Array.isArray(users)
    ? users.filter(u => u.role === 'candidate' && u.userId !== currentUser.value?.uid)
    : [];
}

// Envia convite interno para um candidato online
function sendInternalInvite(candidate) {
  if (!socket.value?.connected || !candidate?.userId) return;
  isSendingInternalInvite.value = true;
  internalInviteSentTo.value = candidate.userId;
  socket.value.emit('SERVER_SEND_INTERNAL_INVITE', {
    toUserId: candidate.userId,
    sessionId: sessionId.value,
    stationId: stationId.value,
    meetLink: communicationMethod.value === 'meet' ? meetLink.value.trim() : '',
    duration: selectedDurationMinutes.value
  });
}

// Atualiza lista de usuários online ao receber do backend
if (socket.value) {
  socket.value.on('SERVER_ONLINE_USERS', handleOnlineUsersList);
}

// Solicita lista de usuários online ao conectar
watch(connectionStatus, (status) => {
  if (status === 'Conectado' && socket.value?.connected) {
    socket.value.emit('CLIENT_REQUEST_ONLINE_USERS', { role: 'candidate' });
  }
});

// --- CONTROLE DE CONVITE INTERNO (CANDIDATO ONLINE) ---
const internalInviteDialog = ref(false);
const internalInviteData = ref({ from: '', link: '', stationId: '', sessionId: '', role: '', meet: '' });

// Recebe convite interno via socket
function handleInternalInviteReceived(payload) {
  // payload: { from, link, stationTitle, sessionId, role, meet }
  if (!payload || !payload.link) return;
  internalInviteData.value = { ...payload };
  internalInviteDialog.value = true;
}

function acceptInternalInvite() {
  if (internalInviteData.value.link) {
    // Redireciona para o link da estação (abre na mesma aba)
    window.location.href = internalInviteData.value.link;
    internalInviteDialog.value = false;
  }
}

function declineInternalInvite() {
  internalInviteDialog.value = false;
}

// Adiciona listener do socket para convite interno
onMounted(() => {
  // ...existing code...
  if (socket.value) {
    socket.value.on('INTERNAL_INVITE_RECEIVED', handleInternalInviteReceived);
  }
});
onUnmounted(() => {
  // ...existing code...
  if (socket.value) {
    socket.value.off('INTERNAL_INVITE_RECEIVED', handleInternalInviteReceived);
  }
});

// Função utilitária para buscar rota aninhada por nome
function findRouteByName(routes, name) {
  for (const route of routes) {
    if (route.name === name) return route;
    if (route.children) {
      const found = findRouteByName(route.children, name);
      if (found) return found;
    }
  }
  return null;
}

// Função para colapsar/expandir sidebar
function toggleCollapse() {
  const wrapper = document.querySelector('.layout-wrapper');
  if (wrapper) {
      wrapper.classList.toggle('layout-vertical-nav-collapsed');
  }
}

// Função para determinar o rótulo da avaliação com base na pontuação
function getEvaluationLabel(item, score) {
  if (score === undefined) return 'Não avaliado';
  
  // Verifica qual pontuação corresponde ao score recebido
  if (item.pontuacoes?.adequado && item.pontuacoes.adequado.pontos === score) {
    return 'Adequado';
  } else if (item.pontuacoes?.parcialmenteAdequado && item.pontuacoes.parcialmenteAdequado.pontos === score) {
    return 'Parcialmente Adequado';
  } else if (item.pontuacoes?.inadequado && item.pontuacoes.inadequado.pontos === score) {
    return 'Inadequado';
  }
  
  return 'Pontuação: ' + score.toFixed(2);
}

// Função para determinar a cor da avaliação com base na pontuação
function getEvaluationColor(item, score) {
  if (score === undefined) return 'grey-lighten-1';
  
  // Verifica qual pontuação corresponde ao score recebido
  if (item.pontuacoes?.adequado && item.pontuacoes.adequado.pontos === score) {
    return 'success';
  } else if (item.pontuacoes?.parcialmenteAdequado && item.pontuacoes.parcialmenteAdequado.pontos === score) {
    return 'warning';
  } else if (item.pontuacoes?.inadequado && item.pontuacoes.inadequado.pontos === score) {
    return 'error';
  }
  
  return 'primary';
}

// Função expandida para determinar o ícone apropriado para cada item de infraestrutura
function getInfrastructureIcon(infraItem) {
  // Remove o prefixo "- " dos sub-itens
  const cleanItem = infraItem.startsWith('- ') ? infraItem.substring(2) : infraItem;
  const text = cleanItem.toLowerCase();
  
  // Verifica se é um sub-item para usar um ícone de sub-item
  if (infraItem.startsWith('- ')) {
    return 'ri-arrow-right-s-line';
  }
  
  // Mapeamento expandido e mais específico de palavras-chave para ícones
  const iconMapping = [
    // Leitos e camas (expandido)
    { keywords: ['leito de observação', 'leito observação'], icon: 'ri-empathize-line' },
    { keywords: ['leito hospitalar', 'leito hospital'], icon: 'ri-hospital-bed-line' },
    { keywords: ['leito uti', 'leito de uti'], icon: 'ri-heart-pulse-fill' },
    { keywords: ['leito', 'cama', 'maca'], icon: 'ri-hospital-bed-line' },
    
    // Equipamentos de monitoramento
    { keywords: ['monitor multiparâmetro', 'monitor multi'], icon: 'ri-heart-pulse-line' },
    { keywords: ['monitor', 'monitorização', 'monitoramento', 'aparelho'], icon: 'ri-heart-pulse-line' },
    { keywords: ['eletrocardiograma', 'ecg', 'ekg', 'eletrocardiógrafo'], icon: 'ri-heart-line' },
    { keywords: ['monitorização', 'uti', 'terapia intensiva', 'intensiva'], icon: 'ri-shield-star-line' },
    { keywords: ['pressão', 'esfigmomanômetro', 'pa', 'pressão arterial', 'tensiometro'], icon: 'ri-pulse-line' },
    { keywords: ['hemodinâmica', 'saturação', 'oximetria'], icon: 'ri-heart-add-line' },
    { keywords: ['frequência', 'fc', 'fr', 'pulso'], icon: 'ri-heart-2-line' },
    { keywords: ['temperatura', 'termômetro', 'febre'], icon: 'ri-temp-hot-line' },
    
    // Equipamentos respiratórios
    { keywords: ['ventilador mecânico', 'vm'], icon: 'ri-lungs-fill' },
    { keywords: ['ventilador', 'respirador', 'intubação', 'tubo', 'ventilação mecânica'], icon: 'ri-lungs-line' },
    { keywords: ['oxigênio', 'o2', 'cateter de o2', 'máscara', 'máscara de o2'], icon: 'ri-bubble-chart-line' },
    { keywords: ['máscara de venturi', 'venturi'], icon: 'ri-gas-station-line' },
    { keywords: ['vias aéreas', 'via aérea', 'aspirador', 'aspiração'], icon: 'ri-surgical-mask-line' },
    { keywords: ['inalação', 'nebulização', 'aerossol'], icon: 'ri-haze-2-line' },
    { keywords: ['ambu', 'ressuscitador', 'bolsa-válvula-máscara'], icon: 'ri-tornado-line' },
    { keywords: ['laringoscópio', 'laringoscopia'], icon: 'ri-flashlight-line' },
    { keywords: ['cânula nasal', 'cateter nasal'], icon: 'ri-nose-line' },
    { keywords: ['cpap', 'bipap', 'pressão positiva'], icon: 'ri-character-recognition-line' },
    
    // Medicamentos e insumos
    { keywords: ['medicação', 'medicamentos', 'remédio', 'medicamento', 'fármaco'], icon: 'ri-medicine-bottle-line' },
    { keywords: ['acesso venoso', 'acesso periférico', 'cateter', 'jelco', 'abocath'], icon: 'ri-syringe-line' },
    { keywords: ['soro', 'fluidoterapia', 'hidratação'], icon: 'ri-drop-line' },
    { keywords: ['infusão', 'bomba', 'bomba de infusão'], icon: 'ri-device-line' },
    { keywords: ['equipo', 'material', 'insumo', 'materiais', 'suprimentos'], icon: 'ri-capsule-line' },
    { keywords: ['curativo', 'bandagem', 'atadura', 'gaze'], icon: 'ri-medical-mask-line' },
    { keywords: ['estéril', 'estéril', 'esterilização', 'luva'], icon: 'ri-hand-sanitizer-line' },
    { keywords: ['ampola', 'frasco', 'seringa'], icon: 'ri-test-tube-fill' },
    { keywords: ['scalp', 'butterfly', 'borboleta'], icon: 'ri-leaf-line' },
    
    // Exames e diagnóstico
    { keywords: ['laboratório', 'exame', 'análise', 'amostra'], icon: 'ri-test-tube-line' },
    { keywords: ['radiografia', 'raio-x', 'radiológico', 'tomografia'], icon: 'ri-scan-2-line' },
    { keywords: ['ultrassom', 'ultrassonografia', 'usg', 'eco'], icon: 'ri-wifi-line' },
    { keywords: ['ressonância', 'ressonância magnética', 'rmn'], icon: 'ri-planet-line' },
    { keywords: ['microscópio', 'lâmina', 'bactéria'], icon: 'ri-microscope-line' },
    { keywords: ['endoscopia', 'broncoscopia', 'colonoscopia', 'endoscópio'], icon: 'ri-eye-2-line' },
    { keywords: ['biópsia', 'punção'], icon: 'ri-scissors-2-line' },
    { keywords: ['coleta', 'sangue', 'tubo', 'amostra'], icon: 'ri-flask-line' },
    { keywords: ['glicemia', 'glicosímetro', 'dextro'], icon: 'ri-drop-fill' },
    { keywords: ['eletroencefalograma', 'eeg'], icon: 'ri-brain-line' },
    { keywords: ['holter', 'mapa'], icon: 'ri-rhythm-line' },
    
    // Ambientes hospitalares
    { keywords: ['consultório', 'sala', 'exame físico'], icon: 'ri-door-open-line' },
    { keywords: ['pronto', 'urgência', 'emergência', 'ps'], icon: 'ri-first-aid-kit-line' },
    { keywords: ['enfermaria', 'internação'], icon: 'ri-building-2-line' },
    { keywords: ['ambulatório', 'consulta', 'ambulatorial'], icon: 'ri-building-line' },
    { keywords: ['centro cirúrgico', 'sala cirúrgica', 'cirurgia'], icon: 'ri-scissors-line' },
    { keywords: ['isolamento', 'precaução', 'quarto privativo'], icon: 'ri-lock-2-line' },
    { keywords: ['uti', 'cti', 'terapia intensiva'], icon: 'ri-community-line' },
    { keywords: ['sala de parto', 'centro obstétrico'], icon: 'ri-parent-fill' },
    { keywords: ['posto de enfermagem', 'posto'], icon: 'ri-nurse-fill' },
    { keywords: ['farmácia', 'dispensação'], icon: 'ri-medicine-bottle-fill' },
    { keywords: ['triagem', 'classificação de risco'], icon: 'ri-team-fill' },
    
    // Profissionais e equipe
    { keywords: ['enfermagem', 'enfermeiro', 'técnico', 'auxiliar'], icon: 'ri-nurse-line' },
    { keywords: ['médico', 'especialista', 'profissional'], icon: 'ri-user-2-line' },
    { keywords: ['fisioterapeuta', 'fisioterapia', 'respiratória'], icon: 'ri-psychotherapy-line' },
    { keywords: ['equipe', 'multiprofissional', 'time'], icon: 'ri-team-line' },
    { keywords: ['nutricionista', 'nutrição', 'dieta'], icon: 'ri-restaurant-line' },
    { keywords: ['terapeuta', 'terapia ocupacional'], icon: 'ri-mental-health-line' },
    { keywords: ['psicólogo', 'psicóloga', 'saúde mental'], icon: 'ri-psychology-line' },
    { keywords: ['assistente social', 'serviço social'], icon: 'ri-emotion-happy-line' },
   
    
    // Mobiliário e estrutura
    { keywords: ['banco', 'cadeira', 'poltrona', 'mobiliário'], icon: 'ri-chair-line' },
    { keywords: ['escada', 'escadinha', 'degrau'], icon: 'ri-scales-3-line' },
    { keywords: ['lavatório', 'pia', 'lavabo', 'lavar mãos'], icon: 'ri-water-flash-line' },
    { keywords: ['iluminação', 'lâmpada', 'luz', 'refletor'], icon: 'ri-lightbulb-line' },
    { keywords: ['foco', 'luz de exame', 'lâmpada de exame'], icon: 'ri-flashlight-line' },
    { keywords: ['maca', 'prancha', 'lona', 'transporte'], icon: 'ri-stretching-line' },
    { keywords: ['barreira', 'biombo', 'divisória'], icon: 'ri-layout-column-line' },
    { keywords: ['mesa', 'bancada', 'escritório'], icon: 'ri-table-line' },
    { keywords: ['negatoscópio', 'visualizador'], icon: 'ri-image-line' },
    { keywords: ['armário', 'gaveta', 'guarda-roupa'], icon: 'ri-archive-drawer-line' },
    
    // Instrumentos clínicos
    { keywords: ['estetoscópio', 'auscultação', 'ausculta'], icon: 'ri-stethoscope-line' },
    { keywords: ['otoscópio', 'otoscopia', 'orelha'], icon: 'ri-ear-2-line' },
    { keywords: ['oftalmoscópio', 'fundoscopia', 'olho'], icon: 'ri-eye-line' },
    { keywords: ['lanterna', 'pupila', 'reflexo'], icon: 'ri-flashlight-fill' },
    { keywords: ['martelo', 'reflexo', 'neurológico'], icon: 'ri-hammer-line' },
    { keywords: ['diapasão', 'vibração', 'sensitivo'], icon: 'ri-sound-module-line' },
    { keywords: ['balança', 'peso', 'medida'], icon: 'ri-scales-line' },
    { keywords: ['desfibrilador', 'cardioversão', 'dea'], icon: 'ri-heart-add-fill' },
    { keywords: ['bisturi', 'lâmina', 'corte'], icon: 'ri-knife-line' },
    { keywords: ['sutura', 'fio', 'agulha'], icon: 'ri-thread-line' },
    { keywords: ['régua', 'fita métrica', 'antropometria'], icon: 'ri-ruler-line' },
    { keywords: ['termômetro', 'temperatura', 'celsius'], icon: 'ri-temp-cold-line' },
    { keywords: ['espéculo', 'vaginal', 'nasal'], icon: 'ri-loop-right-line' },
    
    // Logística e transporte
    { keywords: ['ambulância', 'transporte', 'remoção'], icon: 'ri-ambulance-line' },
    { keywords: ['cadeira de rodas', 'cadeirante'], icon: 'ri-wheelchair-line' },
    { keywords: ['maca', 'maqueiro', 'transporte paciente'], icon: 'ri-luggage-cart-line' },
    { keywords: ['elevador', 'acesso', 'rampa'], icon: 'ri-arrow-up-down-line' },
    { keywords: ['helicóptero', 'aeromédico', 'transporte aéreo'], icon: 'ri-flight-takeoff-line' },
    { keywords: ['cardiomóvel', 'uti móvel'], icon: 'ri-car-washing-line' },
    
    // Tecnologia e comunicação
    { keywords: ['computador', 'sistema', 'prontuário'], icon: 'ri-computer-line' },
    { keywords: ['telefone', 'comunicação', 'chamada'], icon: 'ri-phone-line' },
    { keywords: ['interconsulta', 'telemedicina', 'teleconsulta'], icon: 'ri-video-chat-line' },
    { keywords: ['alarme', 'chamada', 'campainha'], icon: 'ri-alarm-warning-line' },
    { keywords: ['tablet', 'dispositivo', 'móvel'], icon: 'ri-tablet-line' },
    { keywords: ['prontuário eletrônico', 'registro eletrônico'], icon: 'ri-file-list-3-line' },
    { keywords: ['interface', 'painel', 'dashboard'], icon: 'ri-dashboard-line' },
    { keywords: ['inteligência artificial', 'ia', 'machine learning'], icon: 'ri-brain-line' },
    
    // Higiene e segurança
    { keywords: ['epi', 'proteção', 'individual'], icon: 'ri-hand-sanitizer-line' },
    { keywords: ['máscara', 'face shield', 'protetor facial'], icon: 'ri-surgical-mask-line' },
    { keywords: ['luva', 'luvas', 'procedimento'], icon: 'ri-hand-heart-line' },
    { keywords: ['avental', 'capote', 'proteção'], icon: 'ri-t-shirt-air-line' },
    { keywords: ['descarte', 'lixo', 'resíduo'], icon: 'ri-delete-bin-line' },
    { keywords: ['álcool', 'desinfecção', 'assepsia'], icon: 'ri-hand-sanitizer-fill' },
    { keywords: ['óculos de proteção', 'óculos', 'protetor ocular'], icon: 'ri-glasses-line' },
    { keywords: ['touca', 'gorro', 'propé'], icon: 'ri-shirt-line' },
    { keywords: ['sabão', 'sabonete', 'detergente'], icon: 'ri-blaze-line' },
    
    // Especialidades específicas
    { keywords: ['obstétrico', 'parto', 'gestante'], icon: 'ri-women-line' },
    { keywords: ['ginecológico', 'ginecologia', 'pélvico'], icon: 'ri-parent-line' },
    { keywords: ['pediátrico', 'infantil', 'criança'], icon: 'ri-bear-smile-line' },
    { keywords: ['ortopédico', 'imobilização', 'tala', 'gesso'], icon: 'ri-bone-line' },
    { keywords: ['oftalmológico', 'ocular', 'visual'], icon: 'ri-eye-close-line' },
    { keywords: ['odontológico', 'dental', 'bucal'], icon: 'ri-tooth-line' },
    { keywords: ['neurológico', 'neurologia', 'cérebro'], icon: 'ri-brain-line' },
    { keywords: ['cardiológico', 'cardíaco', 'coração'], icon: 'ri-heart-3-line' },
    { keywords: ['dermatológico', 'pele', 'cutâneo'], icon: 'ri-scan-line' },
    { keywords: ['urológico', 'urologia', 'urinário'], icon: 'ri-drop-line' },
    { keywords: ['gastroenterológico', 'digestivo', 'estômago'], icon: 'ri-belly-line' },
    { keywords: ['psiquiátrico', 'mental', 'comportamental'], icon: 'ri-mental-health-line' },
    
    // Equipamentos e recursos diversos
    { keywords: ['incubadora', 'neonatal', 'berço'], icon: 'ri-shield-user-line' },
    { keywords: ['autoclave', 'esterilizador', 'esterilização'], icon: 'ri-temp-cold-line' },
    { keywords: ['refrigeração', 'geladeira', 'vacina'], icon: 'ri-fridge-line' },
    { keywords: ['hemoderivado', 'sangue', 'transfusão'], icon: 'ri-hearts-line' },
    { keywords: ['suporte', 'intravenoso', 'iv'], icon: 'ri-plant-line' },
    { keywords: ['oxímetro', 'oximetria', 'saturação'], icon: 'ri-pulse-fill' },
    { keywords: ['aspirador', 'secreção', 'vácuo'], icon: 'ri-layout-masonry-line' },
    { keywords: ['macronebulizador', 'nebulizador', 'vaporização'], icon: 'ri-cloud-windy-line' },
    { keywords: ['paramentação', 'vestimenta', 'uniforme'], icon: 'ri-t-shirt-2-line' },
    { keywords: ['cilindro', 'torpedo', 'gás'], icon: 'ri-battery-2-charge-line' },
    { keywords: ['cateter', 'cânula', 'tubo'], icon: 'ri-tube-line' },
    { keywords: ['material de escritório', 'caneta', 'papel'], icon: 'ri-pencil-ruler-2-line' },
    { keywords: ['coletor', 'recipiente', 'frasco'], icon: 'ri-cup-line' },
    { keywords: ['protocolo', 'fluxograma', 'algoritmo'], icon: 'ri-flow-chart' },
    { keywords: ['carro de emergência', 'carro de parada'], icon: 'ri-caravan-line' },
    { keywords: ['observação', 'repouso', 'internação breve'], icon: 'ri-empathize-line' }
  ];
  
  // Procura por palavras-chave no texto de forma mais específica primeiro
  // Tenta encontrar correspondências exatas ou mais específicas primeiro
  for (const mapping of iconMapping) {
    if (mapping.keywords.some(keyword => text.includes(keyword))) {
      return mapping.icon;
    }
  }
  
  // Ícone padrão se nenhum dos mapeamentos corresponder
  return 'ri-hospital-line';
}

// Função para determinar a cor do ícone com base no item
function getInfrastructureColor(infraItem) {
  // Se for um sub-item, use uma cor diferente para o ícone
  if (infraItem.startsWith('- ')) {
    return 'grey-darken-1';
  }
  
  // Remove o prefixo "- " dos sub-itens se houver
  const cleanItem = infraItem.startsWith('- ') ? infraItem.substring(2) : infraItem;
  const text = cleanItem.toLowerCase();
  
  // Mapeamento de palavras-chave para cores
  const colorMapping = [
    { keywords: ['emergência', 'urgência', 'urgente'], color: 'error' },
    { keywords: ['monitorização', 'uti', 'intensiva'], color: 'warning' },
    { keywords: ['medicação', 'medicamento', 'remédio'], color: 'success' },
    { keywords: ['oxigênio', 'ventilador', 'respirador'], color: 'info' },
    { keywords: ['laboratório', 'exame'], color: 'purple' },
    { keywords: ['radiografia', 'tomografia', 'ressonância'], color: 'blue-darken-1' },
    { keywords: ['consultório', 'ambulatório'], color: 'teal' },
    { keywords: ['enfermagem', 'enfermeiro', 'técnico'], color: 'cyan' },
    { keywords: ['esfigmomanômetro', 'pressão', 'pa'], color: 'red-lighten-1' },
    { keywords: ['estetoscópio', 'auscultação'], color: 'green' },
  ];
  
  // Procura por palavras-chave no texto
  for (const mapping of colorMapping) {
    if (mapping.keywords.some(keyword => text.includes(keyword))) {
      return mapping.icon;
    }
  }
  
  // Cores aleatórias para outros itens (para diversificar a aparência)
  const defaultColors = ['primary', 'secondary', 'blue', 'indigo', 'green', 'deep-purple', 'cyan', 'teal', 'brown'];
  const hash = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return defaultColors[hash % defaultColors.length];
}

// Função Adicionada: divide o texto em parágrafos para exibição
function splitIntoParagraphs(text) {
  if (!text) return [];
  
  // Garante que o texto seja uma string antes de usar split
  const textAsString = String(text);

  // Divide por <br>, quebras de linha ou parágrafos HTML
  const paragraphs = textAsString
    .split(/<br\s*\/?>/gi)
    .flatMap(p => p.split(/\n/))
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  return paragraphs.length > 0 ? paragraphs : [textAsString];
}

// Função para verificar se um texto está em maiúsculo (pelo menos 3 caracteres consecutivos)
function isUpperCase(text) {
  // Adicionado para evitar erros com valores indefinidos
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Remove tags HTML para fazer a verificação apenas no texto puro
  const plainText = text.replace(/<[^>]*>/g, '');
  
  // Extrai apenas o título antes dos dois pontos, se existir
  const colonIndex = plainText.indexOf(':');
  const textToCheck = colonIndex > 0 ? plainText.substring(0, colonIndex).trim() : plainText.trim();
  
  // Verifica se há pelo menos 3 caracteres consecutivos em maiúsculo (excluindo espaços e pontuação)
  // ou se uma grande parte do texto (mais de 60%) é maiúscula
  const upperCaseChars = textToCheck.replace(/[^A-ZÀ-Ú]/g, '').length;
  const totalChars = textToCheck.replace(/[^A-ZalgebraÀ-ÚÀ-ú]/g, '').length;
  const upperCaseRatio = totalChars > 0 ? upperCaseChars / totalChars : 0;
  
   
  // Match direto para sequências de 3+ caracteres maiúsculos
  const matches = textToCheck.match(/[A-ZÀ-Ú]{3,}/);
  
  // Retorna true se houver uma sequência de 3+ maiúsculos OU mais de 60% do texto for maiúsculo
  return (matches && matches.length > 0) || (upperCaseRatio > 0.6 && totalChars >= 3);
}

// Variáveis para o snackbar de notificação
const showNotificationSnackbar = ref(false);
const notificationMessage = ref('');
const notificationColor = ref('info');

// Função para mostrar uma notificação temporária
function showNotification(message, color = 'info') {
  notificationMessage.value = message;
  notificationColor.value = color;
  showNotificationSnackbar.value = true;
  setTimeout(() => {
    showNotificationSnackbar.value = false;
  }, 5000); // Fechará automaticamente após 5 segundos
}

// Funções para verificar e alternar marcações de parágrafos
function isParagraphMarked(contextIdx, paragraphIdx) {
  if (!markedParagraphs.value) return false;
  const key = `${contextIdx}-${paragraphIdx}`;
  return markedParagraphs.value[key] === true;
}

function toggleParagraphMark(contextIdx, paragraphIdx, event) {
  // Impedir a propagação do evento para evitar múltiplos cliques
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  if (userRole.value === 'actor' || userRole.value === 'evaluator') {
    const key = `${contextIdx}-${paragraphIdx}`;
    const clickKey = `p-${key}`;
    
    // Verificar se houve um clique recente para evitar duplicação
    const now = Date.now();
    if (lastClickTime.value[clickKey] && now - lastClickTime.value[clickKey] < 500) {
      console.log("Ignorando clique rápido subsequente");
      return;
    }
    
    // Registrar o tempo do clique
    lastClickTime.value[clickKey] = now;
    
    // Use um timeout mínimo para evitar problemas de renderização
    setTimeout(() => {
      // Toggle o estado de marcação
      markedParagraphs.value[key] = !markedParagraphs.value[key];
      
      // Forçar reatividade criando um novo objeto
      markedParagraphs.value = { ...markedParagraphs.value };
      
      console.log(`Parágrafo ${contextIdx}-${paragraphIdx} marcado:`, markedParagraphs.value[key]);
    }, 10);
  }
}

// --- NOVO: Função para processar e padronizar os itens de infraestrutura ---
function processInfrastructureItems(items) {
  if (!items || !Array.isArray(items)) return [];
  
  const processedItems = [];
  
  // Para cada item de infraestrutura
  items.forEach(item => {
    if (!item || !item.trim()) return; // Ignora itens vazios
    
    const trimmedItem = item.trim();
    
    // Verifica se o item contém delimitadores
    if (trimmedItem.includes(',') || trimmedItem.includes(';') || trimmedItem.includes(':')) {
      // Primeiro, substitui pontos e vírgulas por vírgulas para tratamento uniforme
      let normalizedText = trimmedItem.replace(/;/g, ',').replace(/:/g, ',');
      
      // Divide o texto pelos delimitadores
      const segments = normalizedText.split(',');
      
      // Adiciona o primeiro segmento sem modificações (contém o título/categoria principal)
      if (segments[0].trim()) {
        processedItems.push(segments[0].trim());
      }
      
      // Adiciona os segmentos subsequentes com recuo para indicar que são sub-itens
      for (let i = 1; i < segments.length; i++) {
        const subItem = segments[i].trim();
        if (subItem) {
          processedItems.push(`- ${subItem}`);
        }
      }
    } else {
      // Se não tem delimitadores, adiciona o item inteiro
      processedItems.push(trimmedItem);
    }
  });
  
  // Remove itens vazios e retorna
  return processedItems.filter(item => item.length > 0);
}
</script>

<template>
  <div class="simulation-page-container">
    <!-- Snackbar para notificações -->
    <VSnackbar
      v-model="showNotificationSnackbar"
      :color="notificationColor"
      :timeout="5000"
      location="top"
    >
      {{ notificationMessage }}
      <template v-slot:actions>
        <VBtn
          variant="text"
          @click="showNotificationSnackbar = false"
        >
          Fechar
        </VBtn>
      </template>
    </VSnackbar>
    
    <!-- Conteúdo principal -->
    <div v-if="isLoading" class="d-flex justify-center align-center" style="height: 80vh;">
      <VProgressCircular indeterminate size="64" />
    </div>

    <VAlert v-else-if="errorMessage && !stationData" type="error" prominent class="mb-4">
      {{ errorMessage }}
    </VAlert>

    <div v-else-if="!stationData" class="text-center">
      <VAlert type="error" prominent class="mb-4">
        Falha ao carregar os dados da estação. Verifique o ID e tente novamente.
      </VAlert>
    </div>

    <!-- Conteúdo Principal da Simulação -->
    <div v-else-if="stationData && sessionId">
      <!-- CABEÇALHO E CONTROLES PRINCIPAIS -->
      <VCard class="mb-6">
        <VCardText>
          <!-- Selected Candidate Info -->
          <div v-if="selectedCandidateForSimulation" class="mb-4">
            <VCard 
              color="primary" 
              variant="tonal"
            >
              <VCardText>
                <div class="d-flex align-center">
                  <VAvatar size="40" class="me-3">
                    <VImg 
                      :src="selectedCandidateForSimulation.photoURL || '/images/avatars/avatar-1.png'"
                      :alt="selectedCandidateForSimulation.name"
                    />
                  </VAvatar>
                  <div class="flex-grow-1">
                    <div class="text-subtitle-1 font-weight-medium">
                      Candidato Selecionado: {{ selectedCandidateForSimulation.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ selectedCandidateForSimulation.email }}
                    </div>
                  </div>
                  <VBtn
                    size="small"
                    variant="text"
                    color="error"
                    @click="clearSelectedCandidate"
                    prepend-icon="mdi-close"
                  >
                    Limpar Seleção
                  </VBtn>
                </div>
              </VCardText>
            </VCard>
          </div>

          <div class="d-flex flex-wrap justify-space-between align-center gap-4">
            <!-- Título -->
            <div class="d-flex align-center gap-3">
                <VBtn icon variant="text" @click="toggleCollapse">
                    <VIcon icon="ri-menu-line" />
                </VBtn>
                <div>
                    <h2 class="text-h5">{{ 
                      isCandidate 
                        ? stationData.especialidade 
                        : `${stationData.especialidade} - ${stationData.tituloEstacao}` 
                    }}</h2>
                </div>
            </div>

            <!-- Timer -->
            <div class="d-flex align-center gap-3">
              <div v-if="isActorOrEvaluator && !simulationStarted && !simulationEnded" style="width: 150px;">
                <VSelect
                  v-model="selectedDurationMinutes"
                  label="Duração"
                  :items="[5, 6, 7, 8, 9, 10].map(n => ({ title: `${n} min`, value: n }))"
                  :disabled="!!inviteLinkToShow"
                  density="compact"
                  hide-details
                  @update:model-value="updateTimerDisplayFromSelection"
                />
              </div>
              <div class="timer-display" :class="{ 'ended': simulationEnded }">
                <VIcon icon="ri-time-line" class="me-1" />
                {{ timerDisplay }}
              </div>
              <VBtn
                v-if="isActorOrEvaluator && simulationStarted && !simulationEnded"
                color="error"
                variant="tonal"
                @click="manuallyEndSimulation"
              >
                Encerrar
              </VBtn>
            </div>
          </div>

           <VAlert v-if="errorMessage && stationData" type="warning" density="compact" class="mt-4">
              {{ errorMessage }}
            </VAlert>
        </VCardText>
      </VCard>

      <!-- SEÇÃO DE PREPARAÇÃO (ANTES DE INICIAR) -->
      <VCard v-if="isActorOrEvaluator && !simulationStarted && !simulationEnded" class="mb-6">
        <VCardTitle>Preparação da Simulação</VCardTitle>
        <VCardText>
            <VRadioGroup v-model="communicationMethod" inline label="Método de Comunicação:">
              <VRadio label="Voz (Beta)" value="voice" />
              <VRadio label="Google Meet" value="meet" />
              <VRadio label="Nenhum" value="none" />
            </VRadioGroup>

            <div v-if="communicationMethod === 'meet'" class="d-flex flex-column gap-3 mb-4">
              <VBtn prepend-icon="ri-vidicon-line" @click="openGoogleMeet">Criar Sala no Google Meet</VBtn>
              <VTextField v-model="meetLink" label="Cole o link do Meet aqui" density="compact" />
            </div>

            <VBtn v-if="!inviteLinkToShow" block @click="generateInviteLinkWithDuration">
              Gerar Link de Convite
            </VBtn>

            <div v-if="inviteLinkToShow" class="mt-4 text-center">
                <p class="font-weight-bold text-body-2 mb-2">Link de Convite Gerado!</p>
                <div class="d-flex gap-2 justify-center">
                  <VBtn
                      prepend-icon="ri-clipboard-line"
                      @click="copyInviteLink"
                      :color="copySuccess ? 'success' : 'primary'"
                  >
                      {{ copySuccess ? 'Copiado!' : 'Copiar Link' }}
                  </VBtn>
                  <VBtn
                      v-if="selectedCandidateForSimulation"
                      prepend-icon="ri-chat-3-line"
                      @click="sendLinkViaPrivateChat"
                      color="secondary"
                      :loading="sendingChat"
                  >
                      {{ chatSentSuccess ? 'Enviado!' : 'Enviar via Chat' }}
                  </VBtn>
                </div>
            </div>

          <div v-if="inviteLinkToShow || isCandidate" class="text-center mt-4 pt-4 border-t">
            <VBtn
              v-if="!myReadyState"
              size="large"
              :color="myReadyState ? 'default' : 'success'"
              :disabled="isCandidate && !candidateReadyButtonEnabled"
              @click="sendReady"
            >
              <VIcon :icon="myReadyState ? 'ri-checkbox-circle-line' : 'ri-checkbox-blank-circle-line'" class="me-2"/>
              {{ myReadyState ? 'Pronto!' : 'Estou Pronto!' }}
            </VBtn>
            <VChip v-else color="success" size="large">
              <VIcon icon="ri-checkbox-circle-line" class="me-2"/>
              Pronto! Aguardando parceiro...
            </VChip>
            <p v-if="bothParticipantsReady" class="text-success font-weight-bold mt-3">
              Ambos prontos! Você pode iniciar a simulação.
            </p>
          </div>

          <VBtn
            v-if="isActorOrEvaluator && bothParticipantsReady && !simulationStarted"
            block size="large" color="success" prepend-icon="ri-play-line" class="mt-4"
            @click="handleStartSimulationClick"
          >
            Iniciar Simulação
          </VBtn>
        </VCardText>
      </VCard>

      <!-- Banners de Status da Simulação -->
      <VAlert v-if="simulationStarted && !simulationEnded" type="success" variant="tonal" class="mb-6" prominent>
        <VIcon icon="ri-play-circle-line" class="me-2" /> Simulação em progresso!
      </VAlert>
      <VAlert v-if="simulationEnded" type="info" variant="tonal" class="mb-6" prominent>
        <VIcon icon="ri-stop-circle-line" class="me-2" /> Simulação encerrada.
      </VAlert>

      <!-- LAYOUT PRINCIPAL: CONTEÚDO + SIDEBAR (CANDIDATO) OU CONTEÚDO (ATOR) -->
      <VRow>
        <!-- Coluna Principal de Conteúdo -->
        <VCol :cols="isCandidate ? 12 : 12" :md="isCandidate ? 8 : 12">
          <!-- VISÃO DO ATOR/AVALIADOR -->
          <div v-if="isActorOrEvaluator">
            <!-- Card para Cenário -->
            <VCard class="mb-6" v-if="stationData.instrucoesParticipante?.cenarioAtendimento">
                <VCardItem>
                    <template #prepend>
                        <VIcon icon="ri-hospital-line" color="info" />
                    </template>
                    <VCardTitle>Cenário do Atendimento</VCardTitle>
                </VCardItem>
                <VCardText v-if="stationData.instrucoesParticipante" class="text-body-1">
                    <p><strong>Nível de Atenção:</strong> {{ stationData.instrucoesParticipante.cenarioAtendimento?.nivelAtencao }}</p>
                    <p><strong>Tipo de Atendimento:</strong> {{ stationData.instrucoesParticipante.cenarioAtendimento?.tipoAtendimento }}</p>
                    <div v-if="stationData.instrucoesParticipante.cenarioAtendimento?.infraestruturaUnidade?.length">
                        <p class="font-weight-bold text-h6 mb-2 d-flex align-center">
                            <VIcon icon="ri-building-2-line" color="primary" class="me-2" size="24" />
                            Infraestrutura:
                        </p>
                        <VCard flat class="bg-primary-lighten-5 pa-2 mb-4">
                            <ul class="tasks-list infra-icons-list pl-2">
                                <li v-for="(item, index) in processInfrastructureItems(stationData.instrucoesParticipante.cenarioAtendimento.infraestruturaUnidade)" 
                                    :key="`infra-actor-${index}`"
                                    :class="{'sub-item': item.startsWith('- ')}">
                                    <VIcon 
                                      :icon="getInfrastructureIcon(item)" 
                                      :color="getInfrastructureColor(item)" 
                                      class="me-2" 
                                      size="20"
                                      :title="item.startsWith('- ') ? item.substring(2) : item"
                                    />
                                    <span :data-sub-item="item.startsWith('- ') ? 'true' : 'false'">
                                      {{ item.startsWith('- ') ? item.substring(2) : item }}
                                    </span>
                                </li>
                            </ul>
                        </VCard>
                    </div>
                </VCardText>
            </VCard>

            <!-- Card para Descrição do Caso -->
            <VCard class="mb-6" v-if="stationData.instrucoesParticipante?.descricaoCasoCompleta">
                <VCardItem>
                    <template #prepend>
                        <VIcon icon="ri-file-text-line" color="primary" />
                    </template>
                    <VCardTitle>Descrição do Caso</VCardTitle>
                </VCardItem>
                <VCardText class="text-body-1" v-html="stationData.instrucoesParticipante.descricaoCasoCompleta" />
            </VCard>

            <!-- Card para Tarefas -->
            <VCard class="mb-6" v-if="stationData.instrucoesParticipante?.tarefasPrincipais?.length">
                <VCardItem>
                    <template #prepend>
                        <VIcon icon="ri-task-line" color="success" />
                    </template>
                    <VCardTitle>Tarefas do Candidato</VCardTitle>
                </VCardItem>
                <VCardText class="text-body-1">
                    <ul class="tasks-list pl-5">
                        <li v-for="(tarefa, i) in stationData.instrucoesParticipante.tarefasPrincipais" :key="`actor-task-${i}`" v-html="tarefa"></li>
                    </ul>
                </VCardText>
            </VCard>

            <!-- Card para Roteiro / Informações Verbais do Ator -->
            <VCard class="mb-6" v-if="stationData?.materiaisDisponiveis?.informacoesVerbaisSimulado && stationData.materiaisDisponiveis.informacoesVerbaisSimulado.length > 0">
                <VCardItem>
                    <template #prepend>
                        <VIcon icon="ri-chat-quote-line" color="warning" />
                    </template>
                    <VCardTitle class="d-flex align-center">
                        Roteiro / Informações a Fornecer
                        <VChip size="small" color="warning" variant="outlined" class="ms-2">
                            Se perguntado pelo candidato
                        </VChip>
                    </VCardTitle>
                </VCardItem>
                <VCardText class="text-body-1">
                    <ul class="roteiro-list pa-0" style="list-style: none;">
                        <li v-for="(info, idx) in stationData.materiaisDisponiveis.informacoesVerbaisSimulado" 
                            :key="'script-' + idx" 
                            class="mb-2 pa-1">
                          <!-- Título/Contexto (com marcação para todo o bloco) -->
                          <div class="font-weight-bold pa-1 rounded cursor-pointer">
                            <span
                              :data-marked="markedScriptContexts[idx] ? 'true' : 'false'"
                              :class="{ 
                                'marked-context-warning': markedScriptContexts[idx] && !isUpperCase(info.contextoOuPerguntaChave),
                                'marked-context-primary': markedScriptContexts[idx] && isUpperCase(info.contextoOuPerguntaChave),
                                'uppercase-title': isUpperCase(info.contextoOuPerguntaChave) && !markedScriptContexts[idx]
                              }"
                              @click="(e) => toggleScriptContext(idx, e)"
                              v-html="processRoteiroActor(info.contextoOuPerguntaChave)">
                            </span>
                          </div>
                          
                          <!-- Cada parágrafo do conteúdo com marcação independente -->
                          <div class="mt-2 pa-1 border-s-2" style="border-left: 3px solid #eee;">
                                 <div v-for="(paragraph, pIdx) in splitIntoParagraphs(info.informacao)" 
                                 :key="`paragraph-${idx}-${pIdx}`"
                                 class="paragraph-item cursor-pointer">
                                 <span
                                   :class="{ 
                                     'marked-warning': isParagraphMarked(idx, pIdx) && !isUpperCase(paragraph),
                                     'marked-primary': isParagraphMarked(idx, pIdx) && isUpperCase(paragraph),
                                     'uppercase-content': isUpperCase(paragraph) && !isParagraphMarked(idx, pIdx)
                                   }"
                                   @click="(e) => toggleParagraphMark(idx, pIdx, e)"
                                   v-html="processRoteiroActor(paragraph)">
                                 </span>
                              </div>
                          </div>
                        </li>
                    </ul>
                </VCardText>
            </VCard>

            <VCard class="mb-6" v-if="isActorOrEvaluator && stationData?.materiaisDisponiveis?.impressos?.length > 0">
              <VCardTitle>Liberar "Impressos" para Candidato</VCardTitle>
              <VCardText>
                <div v-for="impresso in stationData.materiaisDisponiveis.impressos" :key="impresso.idImpresso" class="impresso-control-item">
                  <div class="d-flex align-center gap-2 flex-wrap">
                    <VBtn
                      @click="toggleActorImpressoVisibility(impresso.idImpresso)"
                      :color="actorVisibleImpressoContent[impresso.idImpresso] ? 'primary' : 'info'"
                      :prepend-icon="actorVisibleImpressoContent[impresso.idImpresso] ? 'ri-eye-off-line' : 'ri-eye-line'"
                      class="impresso-btn"
                    >
                      {{ impresso.tituloImpresso }}
                    </VBtn>
                    <VBtn icon variant="tonal" size="small" @click="releaseData(impresso.idImpresso)" :disabled="!!actorReleasedImpressoIds[impresso.idImpresso]">
                      <VIcon :icon="!!actorReleasedImpressoIds[impresso.idImpresso] ? 'ri-lock-unlock-line' : 'ri-lock-line'" />
                    </VBtn>
                  </div>
                  <VExpandTransition>
                    <div v-if="actorVisibleImpressoContent[impresso.idImpresso]" class="mt-2 pa-3 border rounded bg-grey-lighten-4">
                      <h5 class="text-h6 mb-2">{{ impresso.tituloImpresso }}</h5>
                      <div v-if="impresso.tipoConteudo === 'texto_simples'" v-html="impresso.conteudo.texto" />
                      <div v-else-if="impresso.tipoConteudo === 'imagem_com_texto'">
                        <p v-if="impresso.conteudo.textoDescritivo" v-html="impresso.conteudo.textoDescritivo"></p>
                        <img 
                          v-if="impresso.conteudo.caminhoImagem" 
                          :src="getImageSource(impresso.conteudo.caminhoImagem, getImageId(impresso.idImpresso, 'actor-img-texto'))" 
                          :alt="impresso.tituloImpresso" 
                          class="impresso-imagem"
                          @error="handleImageError(impresso.conteudo.caminhoImagem, getImageId(impresso.idImpresso, 'actor-img-texto'))"
                          @load="handleImageLoad(getImageId(impresso.idImpresso, 'actor-img-texto'))"
                        />
                        <p v-if="impresso.conteudo.legendaImagem"><em>{{ impresso.conteudo.legendaImagem }}</em></p>
                        <div v-if="impresso.conteudo.laudo" class="laudo-impresso"><pre>{{ impresso.conteudo.laudo }}</pre></div>
                      </div>
                      <div v-else-if="impresso.tipoConteudo === 'lista_chave_valor_secoes'">
                          <div v-for="(secao, idxS) in impresso.conteudo.secoes" :key="`actor-prev-sec-${impresso.idImpresso}-${idxS}`">
                            <h6 class="text-subtitle-1 font-weight-bold mt-2" v-if="secao.tituloSecao">{{ secao.tituloSecao }}</h6>
                            <VTable density="compact">
                                <tbody>
                                    <tr v-for="(itemSec, idxI) in secao.itens" :key="`actor-prev-item-${impresso.idImpresso}-${idxS}-${idxI}`">
                                        <td><strong>{{ itemSec.chave }}</strong></td>
                                        <td v-html="itemSec.valor"></td>
                                    </tr>
                                </tbody>
                            </VTable>
                          </div>
                      </div>
                      <div v-else-if="impresso.tipoConteudo === 'tabela_objetos'">
                          <VTable>
                              <thead>
                                  <tr><th v-for="cab in impresso.conteudo.cabecalhos" :key="`actor-prev-th-${cab.key}`">{{ cab.label }}</th></tr>
                              </thead>
                              <tbody>
                                  <tr v-for="(linha, idxL) in impresso.conteudo.linhas" :key="`actor-prev-lin-${impresso.idImpresso}-${idxL}`">
                                      <td v-for="cab in impresso.conteudo.cabecalhos" :key="`actor-prev-cel-${impresso.idImpresso}-${idxL}-${cab.key}`" v-html="linha[cab.key]"></td>
                                  </tr>
                              </tbody>
                          </VTable>
                      </div>
                      <div v-else-if="impresso.tipoConteudo === 'imagem_descritiva'">
                          <p v-if="impresso.conteudo.descricao" v-html="impresso.conteudo.descricao"></p>
                          <img 
                            v-if="impresso.conteudo.caminhoImagem" 
                            :src="getImageSource(impresso.conteudo.caminhoImagem, getImageId(impresso.idImpresso, 'actor-img-desc'))" 
                            :alt="impresso.tituloImpresso" 
                            class="impresso-imagem"
                            @error="handleImageError(impresso.conteudo.caminhoImagem, getImageId(impresso.idImpresso, 'actor-img-desc'))"
                            @load="handleImageLoad(getImageId(impresso.idImpresso, 'actor-img-desc'))"
                          />
                      </div>
                      <pre v-else>{{ impresso.conteudo }}</pre>
                    </div>
                  </VExpandTransition>
                </div>
              </VCardText>
            </VCard>

            <!-- Card do Checklist de Avaliação (PEP) - ATOR/AVALIADOR -->
            <VCard v-if="checklistData?.itensAvaliacao?.length > 0">
              <VCardItem>
                <VCardTitle class="d-flex align-center">
                  <VIcon color="black" icon="ri-file-list-3-fill" size="large" class="me-2" />
                  Checklist de Avaliação (PEP)
                </VCardTitle>
                <!-- Botão centralizado e grande -->
                <div class="pep-liberado-btn-wrapper">
                  <VBtn
                    color="info"
                    @click="releasePepToCandidate"
                    :disabled="pepReleasedToCandidate"
                    variant="tonal"
                    size="large"
                    class="pep-liberado-btn"
                  >
                    {{ pepReleasedToCandidate ? 'PEP Liberado' : 'Liberar PEP' }}
                  </VBtn>
                </div>
              </VCardItem>
              <VTable class="pep-table">
                <thead>
                  <tr>
                    <th class="text-left">Item</th>
                    <th class="text-center" style="width: 20%;">Avaliação</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in checklistData.itensAvaliacao" :key="item.idItem || `pep-item-${index}`">
                    <td>
                      <!-- Conteúdo do Item -->
                      <p class="font-weight-bold">
                        <span v-if="item.itemNumeroOficial">{{ item.itemNumeroOficial }}. </span>
                        {{ item.descricaoItem ? item.descricaoItem.split(':')[0].trim() : 'Item' }}
                      </p>
                      <!-- Apenas a descrição formatada, sem duplicar o título -->
                      <div class="text-body-2" v-if="item.descricaoItem && item.descricaoItem.includes(':')" v-html="formatItemDescriptionForDisplay(item.descricaoItem, item.descricaoItem.split(':')[0].trim())" />
                      
                      <!-- Critérios de Avaliação Integrados -->
                      <div class="criterios-integrados mt-2 border-l-2 pl-4">
                        <div v-if="item.pontuacoes?.adequado" class="criterio-item success--text mb-2">
                          <div class="d-flex align-start">
                            <VIcon icon="ri-checkbox-circle-fill" color="success" size="small" class="me-2 mt-1" />
                            <div>
                              <div class="font-weight-medium">Adequado ({{ item.pontuacoes.adequado.pontos.toFixed(2) }} pts)</div>
                              <div class="text-caption">{{ item.pontuacoes.adequado.criterio }}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div v-if="item.pontuacoes?.parcialmenteAdequado && item.pontuacoes.parcialmenteAdequado.criterio && item.pontuacoes.parcialmenteAdequado.criterio.trim() !== '' && item.pontuacoes.parcialmenteAdequado.pontos > 0" class="criterio-item warning--text mb-2">
                          <div class="d-flex align-start">
                            <VIcon icon="ri-checkbox-indeterminate-fill" color="warning" size="small" class="me-2 mt-1" />
                            <div>
                              <div class="font-weight-medium">Parcialmente Adequado ({{ item.pontuacoes.parcialmenteAdequado.pontos.toFixed(2) }} pts)</div>
                              <div class="text-caption">{{ item.pontuacoes.parcialmenteAdequado.criterio }}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div v-if="item.pontuacoes?.inadequado" class="criterio-item error--text">
                          <div class="d-flex align-start">
                            <VIcon icon="ri-close-circle-fill" color="error" size="small" class="me-2 mt-1" />
                            <div>
                              <div class="font-weight-medium">Inadequado ({{ item.pontuacoes.inadequado.pontos.toFixed(2) }} pts)</div>
                              <div class="text-caption">{{ item.pontuacoes.inadequado.criterio }}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="text-center">
                      <VRadioGroup v-model="evaluationScores[item.idItem]" :disabled="!simulationStarted" :inline="false">
                        <VRadio v-if="item.pontuacoes?.adequado" :label="`Adequado`" :value="item.pontuacoes.adequado.pontos" density="compact" color="success" />
                        <VRadio v-if="item.pontuacoes?.parcialmenteAdequado && item.pontuacoes.parcialmenteAdequado.criterio && item.pontuacoes.parcialmenteAdequado.criterio.trim() !== '' && item.pontuacoes.parcialmenteAdequado.pontos > 0" :label="`Parc. Adequado`" :value="item.pontuacoes.parcialmenteAdequado.pontos" density="compact" color="warning" />
                        <VRadio v-if="item.pontuacoes?.inadequado" :label="`Inadequado`" :value="item.pontuacoes.inadequado.pontos" density="compact" color="error" />
                      </VRadioGroup>
                    </td>
                  </tr>
                </tbody>
              </VTable>
              <VCardActions class="pa-4">
                <VSpacer />
                <VChip color="primary" size="large" label class="me-2">
                  <strong>Nota Total: {{ totalScore.toFixed(2) }}</strong>
                </VChip>
                <VBtn
                  v-if="simulationEnded"
                  color="primary"
                  @click="submitEvaluation"
                  :disabled="simulationWasManuallyEndedEarly"
                >
                  Submeter Avaliação Final
                </VBtn>
              </VCardActions>
              <VAlert v-if="simulationEnded && simulationWasManuallyEndedEarly" type="warning" density="compact" class="ma-2">
                A estação foi encerrada manualmente. A submissão de nota ainda é permitida, mas o ato fica registrado.
              </VAlert>
              
              <!-- Feedback da Estação (para ator/avaliador - sempre visível) -->
              <VCardText v-if="checklistData?.feedbackEstacao">
                <VExpansionPanels variant="accordion" class="mt-2">
                  <VExpansionPanel>
                    <VExpansionPanelTitle>
                      <div class="d-flex align-center">
                        <VIcon icon="ri-information-line" color="info" class="me-2" />
                        Feedback Técnico da Estação
                      </div>
                    </VExpansionPanelTitle>
                    <VExpansionPanelText>
                      <div v-if="checklistData.feedbackEstacao.resumoTecnico" class="mb-4">
                        <h5 class="text-subtitle-1 font-weight-bold mb-2">Resumo Técnico:</h5>
                        <p class="text-body-2" v-html="checklistData.feedbackEstacao.resumoTecnico"></p>
                      </div>
                      <div v-if="checklistData.feedbackEstacao.fontes">
                        <h5 class="text-subtitle-1 font-weight-bold mb-2">Fontes:</h5>
                        <ul v-if="Array.isArray(checklistData.feedbackEstacao.fontes)" class="text-caption">
                          <li v-for="(fonte, index) in checklistData.feedbackEstacao.fontes" :key="index" class="mb-1">
                            {{ fonte }}
                          </li>
                        </ul>
                        <p v-else class="text-caption" v-html="checklistData.feedbackEstacao.fontes"></p>
                      </div>
                    </VExpansionPanelText>
                  </VExpansionPanel>
                </VExpansionPanels>
              </VCardText>
            </VCard>
          </div>

          <!-- VISÃO DO CANDIDATO -->
          <div v-if="isCandidate">
             <div v-if="!simulationStarted && !simulationEnded">
                <VCard class="mb-6">
                    <VCardTitle>Preparação da Simulação</VCardTitle>
                    <VCardText class="text-center">
                        <div v-if="candidateMeetLink" class="d-flex flex-column gap-3">
                            <VAlert type="info" variant="tonal" title="Comunicação via Google Meet">
                                O avaliador iniciou uma chamada. Por favor, abra o link para participar.
                            </VAlert>
                            <VBtn
                                prepend-icon="ri-vidicon-line"
                                color="primary"
                                @click="openCandidateMeet"
                                :disabled="candidateOpenedMeet"
                            >
                                {{ candidateOpenedMeet ? 'Meet Aberto' : 'Abrir Google Meet' }}
                            </VBtn>
                        </div>

                        <div class="mt-4 pt-4 border-t">
                            <VBtn
                                v-if="!myReadyState"
                                size="large"
                                :color="myReadyState ? 'default' : 'success'"
                                @click="sendReady"
                                :disabled="(!!candidateMeetLink && !candidateOpenedMeet) || !candidateReadyButtonEnabled"
                                >
                                <VIcon :icon="myReadyState ? 'ri-checkbox-circle-line' : 'ri-checkbox-blank-circle-line'" class="me-2"/>
                                {{ myReadyState ? 'Pronto!' : 'Estou Pronto!' }}
                            </VBtn>
                            <VChip v-else color="success" size="large">
                                <VIcon icon="ri-checkbox-circle-line" class="me-2"/>
                                Pronto! Aguardando início...
                            </VChip>
                            <p v-if="!!candidateMeetLink && !candidateOpenedMeet" class="text-caption text-error mt-2">
                                Você precisa abrir o Google Meet antes de ficar pronto.
                            </p>
                        </div>
                    </VCardText>
                </VCard>
            </div>

            <div v-if="simulationStarted">
                <!-- Card para Cenário (CANDIDATO) -->
                <VCard class="mb-6" v-if="stationData.instrucoesParticipante?.cenarioAtendimento">
                    <VCardItem>
                        <template #prepend>
                            <VIcon icon="ri-hospital-line" color="info" />
                        </template>
                        <VCardTitle>Cenário do Atendimento</VCardTitle>
                    </VCardItem>
                    <VCardText class="text-body-1">
                        <p><strong>Nível de Atenção:</strong> {{ stationData.instrucoesParticipante.cenarioAtendimento?.nivelAtencao }}</p>
                        <p><strong>Tipo de Atendimento:</strong> {{ stationData.instrucoesParticipante.cenarioAtendimento?.tipoAtendimento }}</p>
                        <div v-if="stationData.instrucoesParticipante.cenarioAtendimento?.infraestruturaUnidade?.length">
                            <p class="font-weight-bold text-h6 mb-2 d-flex align-center">
                                <VIcon icon="ri-building-2-line" color="primary" class="me-2" size="24" />
                                Infraestrutura:
                            </p>
                            <VCard flat class="bg-primary-lighten-5 pa-2 mb-4">
                                <ul class="tasks-list infra-icons-list pl-2">
                                    <li v-for="(item, index) in processInfrastructureItems(stationData.instrucoesParticipante.cenarioAtendimento.infraestruturaUnidade)" 
                                        :key="`infra-cand-${index}`"
                                        :class="{'sub-item': item.startsWith('- ')}">
                                        <VIcon 
                                          :icon="getInfrastructureIcon(item)" 
                                          :color="getInfrastructureColor(item)" 
                                          class="me-2" 
                                          size="20"
                                          :title="item.startsWith('- ') ? item.substring(2) : item"
                                        />
                                        <span :data-sub-item="item.startsWith('- ') ? 'true' : 'false'">
                                          {{ item.startsWith('- ') ? item.substring(2) : item }}
                                        </span>
                                    </li>
                                </ul>
                            </VCard>
                        </div>
                    </VCardText>
                </VCard>

                <!-- Card para Descrição do Caso (CANDIDATO) -->
                <VCard class="mb-6" v-if="stationData.instrucoesParticipante?.descricaoCasoCompleta">
                    <VCardItem>
                        <template #prepend>
                            <VIcon icon="ri-file-text-line" color="primary" />
                        </template>
                        <VCardTitle>Descrição do Caso</VCardTitle>
                    </VCardItem>
                    <VCardText class="text-body-1" v-if="stationData.instrucoesParticipante" v-html="stationData.instrucoesParticipante.descricaoCasoCompleta" />
                </VCard>

                <!-- Card para Tarefas (CANDIDATO - CORPO PRINCIPAL) -->
                <VCard class="mb-6" v-if="simulationStarted && stationData.instrucoesParticipante?.tarefasPrincipais?.length">
                    <VCardItem>
                        <template #prepend>
                            <VIcon icon="ri-task-line" color="success" />
                        </template>
                        <VCardTitle>Suas Tarefas</VCardTitle>
                    </VCardItem>
                    <VCardText class="text-body-1">
                        <ul class="tasks-list pl-5">
                            <li v-for="(tarefa, i) in stationData.instrucoesParticipante.tarefasPrincipais" :key="`cand-task-main-${i}`" v-html="tarefa"></li>
                        </ul>
                    </VCardText>
                </VCard>

                <VCard class="mb-6">
                    <VCardTitle>Dados Recebidos ("Impressos")</VCardTitle>
                    <VCardText>
                        <VAlert v-if="Object.keys(releasedData).length === 0" type="info" variant="tonal">
                        Nenhum "impresso" recebido ainda.
                        </VAlert>
                        <VExpansionPanels v-else variant="inset" class="mt-4">
                        <VExpansionPanel v-for="impresso in releasedData" :key="'released-'+impresso.idImpresso">
                            <VExpansionPanelTitle>{{ impresso.tituloImpresso }}</VExpansionPanelTitle>
                            <VExpansionPanelText class="text-body-1">
                            <div v-if="impresso.tipoConteudo === 'texto_simples'" v-html="impresso.conteudo.texto" />
                            <div v-else-if="impresso.tipoConteudo === 'imagem_com_texto'">
                                <p v-if="impresso.conteudo.textoDescritivo" v-html="impresso.conteudo.textoDescritivo"></p>
                                <img 
                                  v-if="impresso.conteudo.caminhoImagem" 
                                  :src="getImageSource(impresso.conteudo.caminhoImagem, getImageId(impresso.idImpresso, 'candidate-img-texto'))" 
                                  :alt="impresso.tituloImpresso" 
                                  class="impresso-imagem"
                                  @error="handleImageError(impresso.conteudo.caminhoImagem, getImageId(impresso.idImpresso, 'candidate-img-texto'))"
                                  @load="handleImageLoad(getImageId(impresso.idImpresso, 'candidate-img-texto'))"
                                />
                                <p v-if="impresso.conteudo.legendaImagem"><em>{{ impresso.conteudo.legendaImagem }}</em></p>
                                <div v-if="impresso.conteudo.laudo" class="laudo-impresso"><pre>{{ impresso.conteudo.laudo }}</pre></div>
                            </div>
                            <div v-else-if="impresso.tipoConteudo === 'lista_chave_valor_secoes'">
                                <div v-for="(secao, idxS) in impresso.conteudo.secoes" :key="`cand-sec-${impresso.idImpresso}-${idxS}`">
                                    <h6 class="text-subtitle-1 font-weight-bold mt-2" v-if="secao.tituloSecao">{{ secao.tituloSecao }}</h6>
                                    <VTable density="compact">
                                        <tbody>
                                            <tr v-for="(itemSec, idxI) in secao.itens" :key="`cand-item-${impresso.idImpresso}-${idxS}-${idxI}`">
                                                <td><strong>{{ itemSec.chave }}</strong></td>
                                                <td v-html="itemSec.valor"></td>
                                            </tr>
                                        </tbody>
                                    </VTable>
                                </div>
                            </div>
                            <div v-else-if="impresso.tipoConteudo === 'tabela_objetos'">
                                <VTable>
                                    <thead>
                                        <tr><th v-for="cab in impresso.conteudo.cabecalhos" :key="`cand-th-${cab.key}`">{{ cab.label }}</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(linha, idxL) in impresso.conteudo.linhas" :key="`cand-lin-${impresso.idImpresso}-${idxL}`">
                                            <td v-for="cab in impresso.conteudo.cabecalhos" :key="`cand-cel-${impresso.idImpresso}-${idxL}-${cab.key}`" v-html="linha[cab.key]"></td>
                                        </tr>
                                    </tbody>
                                </VTable>
                            </div>
                            <div v-else-if="impresso.tipoConteudo === 'imagem_descritiva'">
                                <p v-if="impresso.conteudo.descricao" v-html="impresso.conteudo.descricao"></p>
                                <img 
                                  v-if="impresso.conteudo.caminhoImagem" 
                                  :src="getImageSource(impresso.conteudo.caminhoImagem, getImageId(impresso.idImpresso, 'candidate-img-desc'))" 
                                  :alt="impresso.tituloImpresso" 
                                  class="impresso-imagem"
                                  @error="handleImageError(impresso.conteudo.caminhoImagem, getImageId(impresso.idImpresso, 'candidate-img-desc'))"
                                  @load="handleImageLoad(getImageId(impresso.idImpresso, 'candidate-img-desc'))"
                                />
                            </div>
                            <pre v-else>{{ impresso.conteudo }}</pre>
                            </VExpansionPanelText>
                        </VExpansionPanel>
                        </VExpansionPanels>
                    </VCardText>
                </VCard>

                <!-- Card do Checklist de Avaliação (PEP) -->
                <VCard v-if="checklistData?.itensAvaliacao?.length > 0 && isChecklistVisibleForCandidate" class="mb-6">
                  <VCardItem>
                    <VCardTitle class="d-flex align-center">
                      <!-- Mesmo ícone colorido para o PEP na visão do candidato -->
                      <VIcon color="black" icon="ri-file-list-3-fill" size="large" class="me-2" />
                      Checklist de Avaliação (PEP)
                    </VCardTitle>
                  </VCardItem>
                  
                  <VTable class="pep-table">
                      <thead>
                          <tr>
                              <th class="text-left">Item</th>
                              <th class="text-center" style="width: 20%;">Sua Pontuação</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr v-for="(item, index) in checklistData.itensAvaliacao" :key="'cand-chk-' + item.idItem">
                              <td>
                                <!-- Conteúdo do Item -->
                                <p class="font-weight-bold">
                                  <span v-if="item.itemNumeroOficial">{{ item.itemNumeroOficial }}. </span>
                                  {{ item.descricaoItem ? item.descricaoItem.split(':')[0].trim() : 'Item' }}
                                </p>
                                <!-- Apenas a descrição formatada, sem duplicar o título -->
                                <div class="text-body-2" v-if="item.descricaoItem && item.descricaoItem.includes(':')" v-html="formatItemDescriptionForDisplay(item.descricaoItem, item.descricaoItem.split(':')[0].trim())" />
                                
                                <!-- Critérios de Avaliação Integrados para o Candidato -->
                                <div class="criterios-integrados mt-2 border-l-2 pl-4">
                                  <div v-if="item.pontuacoes?.adequado" 
                                    :class="{'criterio-item': true, 'criterio-selecionado': candidateReceivedScores[item.idItem] === item.pontuacoes.adequado.pontos, 'mb-2': true}">
                                    <div class="d-flex align-start">
                                      <VIcon 
                                        :icon="candidateReceivedScores[item.idItem] === item.pontuacoes.adequado.pontos ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'" 
                                        color="success" 
                                        size="small" 
                                        class="me-2 mt-1"
                                      />
                                      <div>
                                        <div class="font-weight-medium">Adequado ({{ item.pontuacoes.adequado.pontos.toFixed(2) }} pts)</div>
                                        <div class="text-caption">{{ item.pontuacoes.adequado.criterio }}</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div v-if="item.pontuacoes?.parcialmenteAdequado && item.pontuacoes.parcialmenteAdequado.criterio && item.pontuacoes.parcialmenteAdequado.criterio.trim() !== '' && item.pontuacoes.parcialmenteAdequado.pontos > 0" 
                                    :class="{'criterio-item': true, 'criterio-selecionado': candidateReceivedScores[item.idItem] === item.pontuacoes.parcialmenteAdequado.pontos, 'mb-2': true}">
                                    <div class="d-flex align-start">
                                      <VIcon 
                                        :icon="candidateReceivedScores[item.idItem] === item.pontuacoes.parcialmenteAdequado.pontos ? 'ri-checkbox-indeterminate-fill' : 'ri-checkbox-blank-circle-line'" 
                                        color="warning" 
                                        size="small" 
                                        class="me-2 mt-1"
                                      />
                                      <div>
                                        <div class="font-weight-medium">Parcialmente Adequado ({{ item.pontuacoes.parcialmenteAdequado.pontos.toFixed(2) }} pts)</div>
                                        <div class="text-caption">{{ item.pontuacoes.parcialmenteAdequado.criterio }}</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div v-if="item.pontuacoes?.inadequado" 
                                    :class="{'criterio-item': true, 'criterio-selecionado': candidateReceivedScores[item.idItem] === item.pontuacoes.inadequado.pontos}">
                                    <div class="d-flex align-start">
                                      <VIcon 
                                        :icon="candidateReceivedScores[item.idItem] === item.pontuacoes.inadequado.pontos ? 'ri-close-circle-fill' : 'ri-checkbox-blank-circle-line'" 
                                        color="error" 
                                        size="small" 
                                        class="me-2 mt-1"
                                      />
                                      <div>
                                        <div class="font-weight-medium">Inadequado ({{ item.pontuacoes.inadequado.pontos.toFixed(2) }} pts)</div>
                                        <div class="text-caption">{{ item.pontuacoes.inadequado.criterio }}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td class="text-center">
                                <!-- Visualização da pontuação do candidato -->
                                <div v-if="candidateReceivedScores[item.idItem] !== undefined">
                                  <VChip 
                                    :color="getEvaluationColor(item, candidateReceivedScores[item.idItem])" 
                                    variant="tonal"
                                    class="mb-1"
                                  >
                                    {{ getEvaluationLabel(item, candidateReceivedScores[item.idItem]) }}
                                  </VChip>
                                  <div class="text-caption mt-1">{{ parseFloat(candidateReceivedScores[item.idItem]).toFixed(2) }} pts</div>
                                </div>
                                <VChip v-else color="grey-lighten-1" variant="tonal">Não avaliado</VChip>
                              </td>
                          </tr>
                      </tbody>
                  </VTable>
                  
                  <!-- Resumo da nota total - movido para o final -->
                  <VCardText v-if="candidateReceivedTotalScore > 0" class="pt-4">
                    <VAlert
                      variant="tonal"
                      :color="candidateReceivedTotalScore >= 7 ? 'success' : candidateReceivedTotalScore >= 5 ? 'warning' : 'error'"
                      class="mb-4"
                    >
                      <div class="d-flex justify-space-between align-center">
                        <div>
                          <div class="text-h6 mb-1">Sua nota final</div>
                          <div class="text-body-2">
                            {{ candidateReceivedTotalScore >= 7 ? 'Parabéns!' : candidateReceivedTotalScore >= 5 ? 'Satisfatório' : 'Precisa melhorar' }}
                          </div>
                        </div>
                        <div class="text-h4 font-weight-bold">
                          {{ candidateReceivedTotalScore.toFixed(2) }}
                        </div>
                      </div>
                    </VAlert>
                  </VCardText>
                  
                  <!-- Feedback da Estação (para o candidato - só após término) -->
                  <VCardText v-if="checklistData?.feedbackEstacao && simulationEnded">
                    <VExpansionPanels variant="accordion" class="mt-2">
                      <VExpansionPanel>
                        <VExpansionPanelTitle>
                          <div class="d-flex align-center">
                            <VIcon icon="ri-information-line" color="info" class="me-2" />
                            Feedback Técnico da Estação
                          </div>
                        </VExpansionPanelTitle>
                        <VExpansionPanelText>
                          <div v-if="checklistData.feedbackEstacao.resumoTecnico" class="mb-4">
                            <h5 class="text-subtitle-1 font-weight-bold mb-2">Resumo Técnico:</h5>
                            <p class="text-body-2" v-html="checklistData.feedbackEstacao.resumoTecnico"></p>
                          </div>
                          <div v-if="checklistData.feedbackEstacao.fontes">
                            <h5 class="text-subtitle-1 font-weight-bold mb-2">Fontes:</h5>
                            <ul v-if="Array.isArray(checklistData.feedbackEstacao.fontes)" class="text-caption">
                              <li v-for="(fonte, index) in checklistData.feedbackEstacao.fontes" :key="index" class="mb-1">
                                {{ fonte }}
                              </li>
                            </ul>
                            <p v-else class="text-caption" v-html="checklistData.feedbackEstacao.fontes"></p>
                          </div>
                        </VExpansionPanelText>
                      </VExpansionPanel>
                    </VExpansionPanels>
                  </VCardText>
                </VCard>

                <!-- Card separado para mostrar a nota mesmo sem o checklist visível -->
                <VCard v-if="simulationEnded && candidateReceivedTotalScore > 0 && !isChecklistVisibleForCandidate" class="mb-6">
                  <VCardItem>
                    <VCardTitle class="d-flex align-center">
                      <VIcon color="primary" icon="ri-star-fill" size="large" class="me-2" />
                      Resultado da Avaliação
                    </VCardTitle>
                  </VCardItem>
                  <VCardText>
                    <VAlert
                      variant="tonal"
                      :color="candidateReceivedTotalScore >= 7 ? 'success' : candidateReceivedTotalScore >= 5 ? 'warning' : 'error'"
                      class="mb-2"
                    >
                      <div class="d-flex justify-space-between align-center">
                        <div>
                          <div class="text-h6 mb-1">Sua nota final</div>
                          <div class="text-body-2">
                            {{ candidateReceivedTotalScore >= 7 ? 'Parabéns!' : candidateReceivedTotalScore >= 5 ? 'Satisfatório' : 'Precisa melhorar' }}
                          </div>
                        </div>
                        <div class="text-h4 font-weight-bold">
                          {{ candidateReceivedTotalScore.toFixed(2) }}
                        </div>
                      </div>
                    </VAlert>
                    <p class="text-body-2 mt-2">
                      O avaliador ainda não liberou o PEP detalhado da sua avaliação. Você receberá mais detalhes em breve.
                    </p>
                  </VCardText>
                </VCard>
            </div>
          </div>
        </VCol>

        <!-- Coluna Direita Fixa (Sidebar do Candidato) -->
        <VCol v-if="isCandidate" cols="12" md="4">
            <div class="candidate-sidebar">
                <VCard class="mb-6">
                    <VCardTitle class="text-center">Tempo Restante</VCardTitle>
                    <VCardText>
                        <div class="timer-display-candidate" :class="{ 'ended': simulationEnded }">
                            <VIcon icon="ri-time-line" class="me-1" />
                            {{ timerDisplay }}
                        </div>
                    </VCardText>
                </VCard>
                <VCard v-if="simulationStarted && stationData?.instrucoesParticipante?.tarefasPrincipais?.length">
                    <VCardItem>
                        <template #prepend>
                            <VIcon icon="ri-task-line" color="success" />
                        </template>
                        <VCardTitle>Suas Tarefas</VCardTitle>
                    </VCardItem>
                    <VCardText class="text-body-1">
                        <ul class="tasks-list pl-5">
                            <li v-for="(tarefa, i) in stationData.instrucoesParticipante.tarefasPrincipais" :key="`cand-task-sidebar-${i}`" v-html="tarefa"></li>
                        </ul>
                    </VCardText>
                </VCard>

                <!-- Orientações do Candidato na Sidebar -->
                <VCard v-if="stationData?.roteiroCandidato || stationData?.orientacoesCandidato" class="mb-6">
                    <VCardItem>
                        <template #prepend>
                            <VIcon icon="ri-user-line" color="primary" />
                        </template>
                        <VCardTitle>Orientações</VCardTitle>
                    </VCardItem>
                    <VCardText class="text-body-1">
                        <div v-if="stationData.roteiroCandidato" class="mb-4">
                            <h6 class="text-subtitle-1 font-weight-bold mb-2">Instruções:</h6>
                            <div v-html="processRoteiro(stationData.roteiroCandidato)"></div>
                        </div>
                        <div v-if="stationData.orientacoesCandidato">
                            <h6 class="text-subtitle-1 font-weight-bold mb-2">Orientações Adicionais:</h6>
                            <div v-html="stationData.orientacoesCandidato"></div>
                        </div>
                    </VCardText>
                </VCard>
            </div>
        </VCol>
      </VRow>
    </div>

    <!-- Diálogo de Convite Interno -->
    <VDialog v-model="internalInviteDialog" max-width="500">
      <VCard>
        <VCardTitle>Convite para Simulação</VCardTitle>
        <VCardText>
          <p><strong>De:</strong> {{ internalInviteData.from }}</p>
          <p><strong>Estação:</strong> {{ internalInviteData.stationTitle }}</p>
          <p><strong>Duração:</strong> {{ selectedDurationMinutes }} min</p>
          <a v-if="internalInviteData.meet" :href="internalInviteData.meet" target="_blank">Link do Google Meet</a>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn text @click="declineInternalInvite">Recusar</VBtn>
          <VBtn color="primary" @click="acceptInternalInvite">Aceitar</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Snackbar de Notificação -->
    <VSnackbar v-model="showNotificationSnackbar" :color="notificationColor" timeout="5000">
      {{ notificationMessage }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.simulation-page-container {
    font-size: 1.1rem; /* Aumenta a fonte base */
}

.text-body-1, .text-body-2, .text-caption, .v-list-item-title, .v-list-item-subtitle {
    font-size: inherit !important; /* Garante que os componentes filhos herdem a fonte aumentada */
}

.timer-display {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 1.25rem;
  font-weight: 500;
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  display: inline-flex;
  align-items: center;
}

.timer-display.ended {
  border-color: rgb(var(--v-theme-error));
  background-color: rgba(var(--v-theme-error), 0.1);
  color: rgb(var(--v-theme-error));
}

.timer-display-candidate {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    padding: 16px;
    font-size: 2rem; /* Fonte maior para o timer do candidato */
    font-weight: 500;
    text-align: center;
    background-color: rgba(var(--v-theme-on-surface), 0.04);
    display: inline-flex;
    align-items: center;
}

.timer-display-candidate.ended {
    border-color: rgb(var(--v-theme-error));
    background-color: rgba(var(--v-theme-error), 0.1);
    color: rgb(var(--v-theme-error));
}

.cursor-pointer {
  cursor: pointer;
}

.impresso-imagem {
  width: 650px;
  height: 480px;
  max-width: 100%;
  object-fit: contain;
  border: 1px solid #eee;
  margin: 10px 0;
  background-color: #f9f9f9;
}

/* Responsividade para telas menores */
@media (max-width: 768px) {
  .impresso-imagem {
    width: 100%;
    height: auto;
    max-width: 650px;
    max-height: 480px;
  }
}

/* Para tablets */
@media (max-width: 1024px) and (min-width: 769px) {
  .impresso-imagem {
    width: 100%;
    height: auto;
    max-width: 650px;
    max-height: 480px;
  }
}

.laudo-impresso pre {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.9rem;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 4px;
}

/* Ajuste para modo escuro - remove sombras e melhora legibilidade */
.v-theme--dark .laudo-impresso pre {
  background-color: rgba(var(--v-theme-surface), 0.2);
  color: rgb(var(--v-theme-on-surface));
  text-shadow: none !important;
  box-shadow: none !important;
}

/* Removido o hover que causava sombra 
/* Remova completamente qualquer efeito de hover nos itens da lista */
.roteiro-list li:hover {
  background-color: transparent !important;
}

/* Estilização da sidebar do candidato */
.candidate-sidebar {
    position: sticky;
    top: 80px; /* Ajuste conforme a altura do seu header/app-bar */
}

/* NOVO: Estilização específica para o texto das tarefas na sidebar */
.candidate-sidebar .tasks-list {
    padding-left: 20px;
    line-height: 1.6;
    font-size: 0.85rem; /* Reduzido 1-2 números menores */
    color: #FF4444; /* Vermelho para destaque do candidato */
    font-weight: 600; /* Bold para melhor legibilidade com fonte menor */
}

/* Estilos melhorados para marcação de parágrafos */
.paragraph-item {
  transition: background-color 0.2s ease;
  margin-bottom: 0;
  border-radius: 4px;
}

/* Removido o hover que causava sombra 
.paragraph-item:hover {
  background-color: rgba(var(--v-theme-warning), 0.08);
}
*/

/* Novos estilos de marcação - aplicados apenas ao texto */
span.marked-warning {
  display: inline-block;
  background-color: rgba(var(--v-theme-warning), 0.2);
  border-radius: 3px;
  padding: 0 2px;
  pointer-events: auto;
}

span.marked-warning p {
  background-color: rgba(var(--v-theme-warning), 0.2);
  pointer-events: auto;
}

.paragraph-item.marked-warning div * {
  background-color: transparent;
}

.paragraph-item.marked-primary div {
  display: inline-block;
  background-color: rgba(var(--v-theme-primary), 0.15);
  border-radius: 3px;
  color: rgb(var(--v-theme-primary));
  padding: 0 2px;
}

span.marked-primary {
  display: inline-block;
  background-color: rgba(var(--v-theme-primary), 0.15);
  border-radius: 3px;
  color: rgb(var(--v-theme-primary));
  padding: 0 2px;
  pointer-events: auto;
}

span.marked-primary p {
  background-color: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
  pointer-events: auto;
}

.paragraph-item.marked-primary div * {
  background-color: transparent;
  color: rgb(var(--v-theme-primary));
}

/* Novos estilos para marcação de contexto - aplicados apenas ao texto */
/* Estilos de marcação para contextos com !important para máxima prioridade */
.marked-context-warning {
  display: inline-block !important;
  background-color: rgba(var(--v-theme-warning), 0.2) !important;
  padding: 0 2px !important;
  border-radius: 3px !important;
  box-shadow: none !important;
  position: relative !important;
  z-index: 10 !important; /* Valor alto para garantir que fique acima de outros elementos */
  cursor: pointer !important;
}

.marked-context-warning * {
  background-color: transparent !important;
}

.marked-context-warning:hover,
.marked-context-warning:active,
.marked-context-warning:focus {
  background-color: rgba(var(--v-theme-warning), 0.2) !important;
}

.marked-context-warning * {
  background-color: transparent !important;
}

.marked-context-primary {
  display: inline-block !important;
  background-color: rgba(var(--v-theme-primary), 0.15) !important;
  color: rgb(var(--v-theme-primary)) !important;
  padding: 0 2px !important;
  border-radius: 3px !important;
  box-shadow: none !important;
  position: relative !important;
  z-index: 10 !important; /* Valor alto para garantir que fique acima de outros elementos */
  cursor: pointer !important;
}

.marked-context-primary * {
  background-color: transparent !important;
  color: rgb(var(--v-theme-primary)) !important;
}

.marked-context-primary:hover,
.marked-context-primary:active,
.marked-context-primary:focus {
  background-color: rgba(var(--v-theme-primary), 0.15) !important;
  color: rgb(var(--v-theme-primary)) !important;
}

.marked-context-primary * {
  background-color: transparent !important;
  color: rgb(var(--v-theme-primary)) !important;
}

/* Garante que não haverá sombra ou hover em nenhum elemento */
.roteiro-list li,
.roteiro-list .font-weight-bold,
.roteiro-list .paragraph-item,
.roteiro-list span,
.marked-context-warning,
.marked-context-primary,
.marked-warning,
.marked-primary {
  box-shadow: none !important;
  outline: none !important;
  text-shadow: none !important;
}

/* Desativa qualquer efeito de hover, mas preserva as marcações */
.roteiro-list *:hover {
  box-shadow: none !important;
}

/* Regra específica para garantir que o hover não afete elementos marcados */
.roteiro-list li:hover span[data-marked="true"].marked-context-warning {
  background-color: rgba(var(--v-theme-warning), 0.2) !important;
}

.roteiro-list li:hover span[data-marked="true"].marked-context-primary {
  background-color: rgba(var(--v-theme-primary), 0.15) !important;
}

/* Garante que a área clicável seja suficiente */
.roteiro-list li .font-weight-bold {
  margin-bottom: 0 !important; 
  padding: 2px 4px !important;
  border-radius: 4px;
}

.roteiro-list li .mt-2 {
  margin-top: 2px !important;
}

/* Redução ainda mais agressiva do espaçamento entre linhas */
.roteiro-list p {
  margin-bottom: 0 !important;
  margin-top: 0 !important;
  line-height: 1.1 !important;
}

/* Ajuste específico para o conteúdo da informação */
.roteiro-list .border-s-2 {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  margin-top: 1px !important;
  margin-bottom: 0 !important;
}

/* Melhoria nos botões de impressos */
.impresso-btn {
  margin-bottom: 4px;
  border-radius: 6px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.impresso-btn:hover {
  background-color: rgb(var(--v-theme-success)) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0,0,0,0.15);
}

.impresso-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.impresso-control-item {
  margin-bottom: 8px;
}

/* Estilos para textos em maiúsculo */
.uppercase-title {
  color: rgb(var(--v-theme-primary));
}

.uppercase-content {
  color: rgb(var(--v-theme-primary));
}

.bg-primary-lighten-4 {
  background-color: rgba(var(--v-theme-primary), 0.15) !important;
}

/* Aplicar a marcação de cores apenas no texto, não em áreas vazias - Estilos não utilizados removidos */

/* Estilo para itens em maiúsculo detectados no processamento do roteiro */
.uppercase-item strong {
  color: rgb(var(--v-theme-primary));
}

.uppercase-item {
  color: rgb(var(--v-theme-primary));
}

/* Melhorias na manipulação de eventos para evitar problemas de reatividade */
.roteiro-list .paragraph-item,
.roteiro-list .font-weight-bold {
  isolation: isolate;
  position: relative;
  z-index: 1;
}

/* Garante que o evento click seja corretamente capturado */
.roteiro-list span {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

/* Estilos para a lista de infraestrutura */
.infra-icons-list {
  list-style-type: none;
  padding-left: 0.5rem;
}

.infra-icons-list li {
  margin-bottom: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

/* Estilo para sub-itens de infraestrutura */
.infra-icons-list li:has(span:first-child:contains('- ')) {
  margin-left: 1.5rem;
  margin-top: -4px;
  margin-bottom: 4px;
  padding-left: 0;
  color: rgba(var(--v-theme-on-surface), 0.85);
  font-size: 0.95rem;
}

/* Aplica estilo quando o item começa com '- ' */
.infra-icons-list li span[data-sub-item="true"] {
  opacity: 0.85;
}

/* Estilos para o PEP (Checklist de Avaliação) */
.criterios-list {
  background-color: transparent !important;
  padding: 0 !important;
}

.criterios-list .v-list-item {
  min-height: auto !important;
  padding: 4px 8px !important;
  margin-bottom: 4px !important;
  border-radius: 4px;
}

.criterios-list .v-list-item-title {
  font-size: 0.85rem !important;
  line-height: 1.2 !important;
}

.criterios-list .v-list-item-subtitle {
  font-size: 0.75rem !important;
  line-height: 1.3 !important;
  opacity: 0.85;
  white-space: normal !important;
}

.criterio-selecionado {
  background-color: rgba(var(--v-theme-surface-variant), 0.5) !important;
  margin-left: 1.5rem;
  margin-top: -4px;
  margin-bottom: 4px;
  padding-left: 0;
  color: rgba(var(--v-theme-on-surface), 0.85);
  font-size: 0.95rem;
}

/* Aplica estilo quando o item começa com '- ' */
.infra-icons-list li span[data-sub-item="true"] {
  opacity: 0.85;
}
</style>
