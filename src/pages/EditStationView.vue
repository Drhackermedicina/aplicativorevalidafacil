<script setup>
// Vamos verificar se este composable existe ou criar um básico
// Altere de:
// import { useSnackbar } from '@/composables/useSnackbar';

// Para uma versão local temporária:
const showSnackbar = (message, color = 'primary') => {
  console.log(`Snackbar: ${message} (${color})`);
  // Aqui podemos usar a API de snackbar do Vuetify diretamente
  // ou implementar uma versão simples
};

import TiptapEditor from '@/components/TiptapEditor.vue';
import { currentUser } from '@/plugins/auth.js';
import { db } from '@/plugins/firebase.js';
import { pepStandardLibrary } from '@/utils/pepCorrector.js';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const stationId = ref(null); // Será definido pelo parâmetro da rota
const stationData = ref(null); // Cópia editável dos dados da estação
const originalStationData = ref(null); // Cópia original para comparação/reversão

const isLoading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');

// Variáveis para estatísticas PEP
const pepStats = ref({
  totalScore: 0,
  itemCount: 0,
  isValid: false,
  maxPossible: 0,
  items: []
});

// Função para importar dinamicamente as funções do corretor PEP
async function importPEPCorrector() {
  try {
    const module = await import('@/utils/pepCorrector.js');
    return {
      validateAndCorrectPEP: module.validateAndCorrectPEP,
      getPEPStats: module.getPEPStats,
      adaptarRoteiroAtor: module.adaptarRoteiroAtor,
      adaptarItensPEP: module.adaptarItensPEP,
      normalizarPontuacaoTotal: module.normalizarPontuacaoTotal
    };
  } catch (error) {
    console.error('Erro ao importar corretor PEP:', error);
    return null;
  }
}

// Função para atualizar estatísticas PEP
async function updatePEPStats() {
  if (!stationData.value) return;
  
  const corrector = await importPEPCorrector();
  if (!corrector) return;
  
  const stats = corrector.getPEPStats(stationData.value);
  pepStats.value = stats;
}

// Função para corrigir pontuação PEP automaticamente
async function correctPEPScoring() {
  if (!stationData.value) return;
  
  const corrector = await importPEPCorrector();
  if (!corrector) {
    errorMessage.value = 'Erro ao carregar corretor PEP';
    return;
  }
  
  try {
    const correctedStation = corrector.validateAndCorrectPEP(stationData.value);
    
    // Atualiza os dados reativos
    Object.assign(stationData.value, correctedStation);
    
    // Atualiza estatísticas
    await updatePEPStats();
    
    successMessage.value = `Pontuação PEP corrigida automaticamente! ${correctedStation.correctionLog || ''}`;
    setTimeout(() => { successMessage.value = ''; }, 5000);
    
  } catch (error) {
    console.error('Erro ao corrigir PEP:', error);
    errorMessage.value = `Erro na correção PEP: ${error.message}`;
  }
}

// Função para correção em lote de todas as estações (apenas para super-admin)
async function correctAllStationsPEP() {
  if (!isAdmin.value) {
    errorMessage.value = 'Apenas administradores podem executar correção em lote';
    return;
  }
  
  const confirmBatch = confirm(
    'ATENÇÃO: Esta ação irá corrigir a pontuação PEP de TODAS as estações no banco de dados. ' +
    'Isso pode levar alguns minutos e não pode ser desfeito. Deseja continuar?'
  );
  
  if (!confirmBatch) return;
  
  const corrector = await importPEPCorrector();
  if (!corrector) {
    errorMessage.value = 'Erro ao carregar corretor PEP';
    return;
  }
  
  isLoading.value = true;
  errorMessage.value = '';
  
  try {
    // Importa Firestore functions
    const { collection, getDocs, updateDoc, doc } = await import('firebase/firestore');
    
    // Busca todas as estações
    const stationsRef = collection(db, 'estacoes_clinicas');
    const querySnapshot = await getDocs(stationsRef);
    
    let correctedCount = 0;
    let errorCount = 0;
    const results = [];
    
    for (const docSnapshot of querySnapshot.docs) {
      try {
        const stationData = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Aplica correção PEP
        const correctedStation = corrector.validateAndCorrectPEP(stationData);
        
        // Prepara dados para salvar
        const dataToSave = { ...correctedStation };
        delete dataToSave.id;
        delete dataToSave.correctionLog;
        
        // Salva no Firebase
        await updateDoc(docSnapshot.ref, dataToSave);
        
        correctedCount++;
        results.push({
          id: stationData.id,
          title: stationData.tituloEstacao || 'Sem título',
          status: 'corrigido',
          log: correctedStation.correctionLog || ''
        });
        
      } catch (error) {
        errorCount++;
        results.push({
          id: docSnapshot.id,
          title: 'Erro ao processar',
          status: 'erro',
          log: error.message
        });
      }
    }
    
    successMessage.value = `Correção em lote concluída! ${correctedCount} estações corrigidas, ${errorCount} erros.`;
    console.log('Resultados da correção em lote:', results);
    
  } catch (error) {
    console.error('Erro na correção em lote:', error);
    errorMessage.value = `Erro na correção em lote: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
}

// Verifica se o usuário atual é o admin definido
const isAdmin = computed(() => {
  return currentUser.value && (
    currentUser.value.uid === 'KiSITAxXMAY5uU3bOPW5JMQPent2' ||
    currentUser.value.uid === 'RtfNENOqMUdw7pvgeeaBVSuin662' ||
    currentUser.value.uid === 'UD7S8aiyR8TJXHyxdw29BHNfjEf1' // Novo admin adicionado
  );
});

async function fetchStationToEdit() {
  if (!stationId.value) {
    errorMessage.value = "Nenhum ID de estação fornecido para edição.";
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const docRef = doc(db, "estacoes_clinicas", stationId.value);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const loadedData = { id: docSnap.id, ...docSnap.data() };
      
      // Normaliza o PEP, verificando se os itens estão em sinteseEstacao
      const pep = loadedData.padraoEsperadoProcedimento;
      if (pep && pep.sinteseEstacao && Array.isArray(pep.sinteseEstacao.itensAvaliacao) && pep.sinteseEstacao.itensAvaliacao.length > 0) {
        pep.itensAvaliacao = [...pep.sinteseEstacao.itensAvaliacao];
      }

      // Inicializa estruturas aninhadas se não existirem para evitar erros no template
      loadedData.instrucoesParticipante = loadedData.instrucoesParticipante || { cenarioAtendimento: { infraestruturaUnidade: [] }, tarefasPrincipais: [], avisosImportantes: [] };
      loadedData.instrucoesParticipante.cenarioAtendimento = loadedData.instrucoesParticipante.cenarioAtendimento || { infraestruturaUnidade: [] };
      loadedData.instrucoesParticipante.cenarioAtendimento.infraestruturaUnidade = loadedData.instrucoesParticipante.cenarioAtendimento.infraestruturaUnidade || [];
      loadedData.instrucoesParticipante.tarefasPrincipais = loadedData.instrucoesParticipante.tarefasPrincipais || [];
      loadedData.instrucoesParticipante.avisosImportantes = loadedData.instrucoesParticipante.avisosImportantes || [];
      
      loadedData.materiaisDisponiveis = loadedData.materiaisDisponiveis || { informacoesVerbaisSimulado: [], impressos: [] };
      loadedData.materiaisDisponiveis.informacoesVerbaisSimulado = loadedData.materiaisDisponiveis.informacoesVerbaisSimulado || [];
      loadedData.materiaisDisponiveis.impressos = loadedData.materiaisDisponiveis.impressos || [];
      
      loadedData.padraoEsperadoProcedimento = loadedData.padraoEsperadoProcedimento || { itensAvaliacao: [] };
      loadedData.padraoEsperadoProcedimento.itensAvaliacao = loadedData.padraoEsperadoProcedimento.itensAvaliacao || [];

      // Adapta para padrão Clínica Médica se aplicável
      await adaptarParaClinicaMedicaPadrao(loadedData);

      stationData.value = reactive(JSON.parse(JSON.stringify(loadedData)));
      originalStationData.value = JSON.parse(JSON.stringify(loadedData));
      
      // Aplica correção automática PEP ao carregar
      await correctPEPScoring();
      await updatePEPStats();
    } else {
      errorMessage.value = "Estação não encontrada para edição.";
      stationData.value = null;
    }
  } catch (error) {
    console.error("Erro ao buscar estação para edição:", error);
    errorMessage.value = `Falha ao carregar estação: ${error.message}`;
    stationData.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function saveStationChanges() {
  if (!stationData.value || !stationData.value.id) {
    errorMessage.value = "Nenhum dado da estação para salvar.";
    alert("Nenhum dado da estação para salvar.");
    return;
  }
  if (!isAdmin.value) {
    errorMessage.value = "Apenas administradores podem salvar alterações.";
    alert("Apenas administradores podem salvar alterações.");
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    // Aplica correção automática PEP antes de salvar
    await correctPEPScoring();
    
    // Adapta para padrão Clínica Médica antes de salvar
    await adaptarParaClinicaMedicaPadrao(stationData.value);
    
    const stationDocRef = doc(db, 'estacoes_clinicas', stationData.value.id);
    
    // O objeto stationData.value já está reativo e com os dados corretos.
    // Apenas removemos o ID antes de salvar.
    const dataToSave = JSON.parse(JSON.stringify(stationData.value));
    delete dataToSave.id; 

    await updateDoc(stationDocRef, dataToSave);
    successMessage.value = "Estação atualizada com sucesso! (Pontuação PEP corrigida automaticamente)";
    originalStationData.value = JSON.parse(JSON.stringify(stationData.value)); 
    setTimeout(() => { successMessage.value = ''; }, 3000);

  } catch (error) {
    console.error("Erro ao salvar alterações da estação:", error);
    errorMessage.value = `Falha ao salvar: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
}

// Função para excluir a estação
async function deleteStation() {
  if (!stationId.value || !stationData.value) {
    errorMessage.value = "Nenhuma estação para excluir.";
    return;
  }
  
  if (!isAdmin.value) {
    errorMessage.value = "Apenas administradores podem excluir estações.";
    alert("Apenas administradores podem excluir estações.");
    return;
  }
  
  // Confirmação antes de excluir
  const confirmDelete = confirm(`ATENÇÃO: Você está prestes a EXCLUIR permanentemente a estação "${stationData.value.tituloEstacao}". Esta ação NÃO pode ser desfeita. Deseja continuar?`);
  
  if (!confirmDelete) {
    return; // Usuário cancelou a exclusão
  }
  
  isLoading.value = true;
  errorMessage.value = '';
  
  try {
    const stationDocRef = doc(db, 'estacoes_clinicas', stationId.value);
    await deleteDoc(stationDocRef);
    
    successMessage.value = "Estação excluída com sucesso!";
    
    // Redirecionar para a lista de estações após um breve atraso
    setTimeout(() => {
      router.push('/app/station-list');
    }, 1500);
    
  } catch (error) {
    console.error("Erro ao excluir estação:", error);
    errorMessage.value = `Falha ao excluir: ${error.message}`;
    isLoading.value = false;
  }
}

function addToArray(targetArray, newItemTemplate = {}) {
  if (Array.isArray(targetArray)) {
    targetArray.push(reactive(JSON.parse(JSON.stringify(newItemTemplate))));
  } else {
    console.error("Tentativa de adicionar a um não-array:", targetArray, "Template:", newItemTemplate);
  }
}

function removeFromArray(targetArray, index) {
  if (Array.isArray(targetArray)) {
    targetArray.splice(index, 1);
  }
}

function addActorScriptItem() {
  if (stationData.value?.materiaisDisponiveis?.informacoesVerbaisSimulado) {
    addToArray(stationData.value.materiaisDisponiveis.informacoesVerbaisSimulado, { contextoOuPerguntaChave: 'Novo Contexto', informacao: 'Nova Informação' });
  }
}

// Templates de conteúdo para cada tipo de impresso
const impressoTemplates = {
  lista_chave_valor_secoes: {
    secoes: [
      {
        tituloSecao: "Nova Seção",
        itens: [
          {
            chave: "Nova Chave",
            valor: "Novo Valor"
          }
        ]
      }
    ]
  },
  tabela_objetos: {
    cabecalhos: [
      { key: "col1", label: "Coluna 1" },
      { key: "col2", label: "Coluna 2" }
    ],
    linhas: [
      { col1: "Valor 1", col2: "Valor 2" }
    ]
  },
  imagem_descritiva: {
    descricao: "Descrição da imagem aqui",
    caminhoImagem: "https://caminho/para/imagem.jpg"
  },
  imagem_com_texto: {
    textoDescritivo: "Texto descritivo/interpretação aqui",
    caminhoImagem: "https://caminho/para/imagem.jpg",
    legendaImagem: "Legenda da imagem",
    laudo: "Laudo ou informações adicionais aqui"
  }
};

// Função atualizada para adicionar novo impresso
function addImpressoItem() {
  if (stationData.value?.materiaisDisponiveis?.impressos) {
    const tipoConteudoPadrao = 'lista_chave_valor_secoes';
    const newImpresso = {
      idImpresso: `est${stationData.value.numeroDaEstacao || 'X'}_novo_impresso_${Date.now()}`,
      tituloImpresso: 'Novo Impresso (Título)',
      tipoConteudo: tipoConteudoPadrao,
      conteudo: JSON.parse(JSON.stringify(impressoTemplates[tipoConteudoPadrao])), // Usa o template padrão
    };
    addToArray(stationData.value.materiaisDisponiveis.impressos, newImpresso);
  }
}

// Função para atualizar o template do conteúdo quando o tipo de impresso muda
function atualizarTemplateImpresso(impresso) {
  const tipoConteudo = impresso.tipoConteudo;
  if (impressoTemplates[tipoConteudo]) {
    // Cria uma cópia profunda para evitar reatividade cruzada entre impressos
    impresso.conteudo = JSON.parse(JSON.stringify(impressoTemplates[tipoConteudo]));
  }
}

function updatePEPItemNumbers() {
  if (stationData.value?.padraoEsperadoProcedimento?.itensAvaliacao) {
    stationData.value.padraoEsperadoProcedimento.itensAvaliacao.forEach((item, index) => {
      item.itemNumeroOficial = (index + 1).toString();
    });
  }
}

function reorderPEPItems(index) {
  const items = stationData.value.padraoEsperadoProcedimento.itensAvaliacao;
  if (!items) return;

  const itemToMove = items[index];
  let newPosition = parseInt(itemToMove.itemNumeroOficial, 10);

  // Valida e limita a nova posição para estar dentro dos limites do array
  if (isNaN(newPosition)) {
    updatePEPItemNumbers(); // Restaura o número se a entrada for inválida
    return;
  }
  newPosition = Math.max(1, Math.min(newPosition, items.length));

  // Remove o item da posição antiga e insere na nova
  items.splice(index, 1);
  items.splice(newPosition - 1, 0, itemToMove);

  // Atualiza a numeração de todos os itens
  updatePEPItemNumbers();
}

function addPEPItem() {
  if (stationData.value?.padraoEsperadoProcedimento?.itensAvaliacao) {
    const newItem = {
      idItem: `pep_est${stationData.value.numeroDaEstacao || 'X'}_novo_item_${Date.now()}`,
      itemNumeroOficial: (stationData.value.padraoEsperadoProcedimento.itensAvaliacao.length + 1).toString(),
      descricaoItem: 'Nova descrição do item PEP...',
      pontuacoes: {
        adequado: { criterio: 'Critério para adequado', pontos: 0.0 },
        parcialmenteAdequado: { criterio: 'Critério para parcialmente adequado', pontos: 0.0 },
        inadequado: { criterio: 'Critério para inadequado', pontos: 0.0 }
      }
    };
    addToArray(stationData.value.padraoEsperadoProcedimento.itensAvaliacao, newItem);
    updatePEPItemNumbers(); // Garante que a numeração está correta
  }
}

function removePEPItem(index) {
  if (stationData.value?.padraoEsperadoProcedimento?.itensAvaliacao) {
    removeFromArray(stationData.value.padraoEsperadoProcedimento.itensAvaliacao, index);
    updatePEPItemNumbers();
  }
}

function movePEPItem(index, direction) {
  const items = stationData.value.padraoEsperadoProcedimento.itensAvaliacao;
  if (!items) return;

  if (direction === 'up' && index > 0) {
    [items[index], items[index - 1]] = [items[index - 1], items[index]];
  } else if (direction === 'down' && index < items.length - 1) {
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
  }
  updatePEPItemNumbers();
}


function addStandardPEPItems(category) {
  const itemsToAdd = pepStandardLibrary[category];
  if (!itemsToAdd || !stationData.value?.padraoEsperadoProcedimento?.itensAvaliacao) return;

  itemsToAdd.forEach(itemTemplate => {
    const newItem = JSON.parse(JSON.stringify(itemTemplate)); // Deep copy
    const currentItems = stationData.value.padraoEsperadoProcedimento.itensAvaliacao;
    
    newItem.idItem = `pep_est${stationData.value.numeroDaEstacao || 'X'}_item_${Date.now()}_${Math.random()}`;
    newItem.itemNumeroOficial = (currentItems.length + 1).toString();
    
    addToArray(currentItems, newItem);
  });
  
  updatePEPItemNumbers(); // Atualiza a numeração de todos os itens

  successMessage.value = `Itens de '${category}' adicionados com sucesso!`;
  setTimeout(() => { successMessage.value = ''; }, 3000);
}


// Função para limpar texto removendo caracteres desnecessários
function cleanText(text) {
  if (!text || typeof text !== 'string') return text;
  
  return text
    // Remove "e," no final de frases
    .replace(/\s*e,\s*$/gim, '')
    .replace(/\s*e,\s*(\\.|;|!|\\?)/g, '$1')
    // Remove "ITEM AVALIAÇÃO" (pode aparecer em diferentes formatos)
    .replace(/\s*ITEM\s+AVALIA[ÇC][ÃA]O\s*/gi, '')
    .replace(/\s*ITEM\s+DE\s+AVALIA[ÇC][ÃA]O\s*/gi, '')
    // Remove vírgulas duplas
    .replace(/,,+/g, ',')
    // Remove espaços extras antes de pontuação
    .replace(/\s+([,.;:!?])/g, '$1')
    // Remove espaços extras no meio do texto
    .replace(/\s{2,}/g, ' ')
    // Remove espaços no início e fim
    .trim();
}

// Função para limpar todos os campos de texto da estação
function cleanAllTextFields() {
  if (!stationData.value) return;
  
  // Função auxiliar para limpar campos
  function cleanField(field) {
    if (field && typeof field === 'string') {
      return field.includes('<') && field.includes('>') ? 
        cleanRichText(field) : cleanText(field);
    }
    return field;
  }
  
  // Limpar título da estação
  if (stationData.value.tituloEstacao) {
    stationData.value.tituloEstacao = cleanField(stationData.value.tituloEstacao);
  }
  
  // Limpar especialidade
  if (stationData.value.especialidade) {
    stationData.value.especialidade = cleanField(stationData.value.especialidade);
  }
  
  // Limpar instruções do participante
  if (stationData.value.instrucoesParticipante) {
    if (stationData.value.instrucoesParticipante.descricaoCasoCompleta) {
      stationData.value.instrucoesParticipante.descricaoCasoCompleta = 
        cleanField(stationData.value.instrucoesParticipante.descricaoCasoCompleta);
    }
    
    // Limpar tarefas principais
    if (stationData.value.instrucoesParticipante.tarefasPrincipais) {
      stationData.value.instrucoesParticipante.tarefasPrincipais = 
        stationData.value.instrucoesParticipante.tarefasPrincipais.map(cleanField);
    }
    
    // Limpar avisos importantes
    if (stationData.value.instrucoesParticipante.avisosImportantes) {
      stationData.value.instrucoesParticipante.avisosImportantes = 
        stationData.value.instrucoesParticipante.avisosImportantes.map(cleanField);
    }
  }
  
  // Limpar informações verbais do simulado
  if (stationData.value.materiaisDisponiveis?.informacoesVerbaisSimulado) {
    stationData.value.materiaisDisponiveis.informacoesVerbaisSimulado = 
      stationData.value.materiaisDisponiveis.informacoesVerbaisSimulado.map(info => ({
        ...info,
        informacao: cleanField(info.informacao)
      }));
  }
  
  // Limpar itens de avaliação PEP
  if (stationData.value.padraoEsperadoProcedimento?.itensAvaliacao) {
    stationData.value.padraoEsperadoProcedimento.itensAvaliacao = 
      stationData.value.padraoEsperadoProcedimento.itensAvaliacao.map(item => ({
        ...item,
        descricaoItem: cleanField(item.descricaoItem),
        pontuacoes: {
          adequado: {
            ...item.pontuacoes.adequado,
            criterio: cleanField(item.pontuacoes.adequado.criterio)
          },
          parcialmenteAdequado: {
            ...item.pontuacoes.parcialmenteAdequado,
            criterio: cleanField(item.pontuacoes.parcialmenteAdequado.criterio)
          },
          inadequado: {
            ...item.pontuacoes.inadequado,
            criterio: cleanField(item.pontuacoes.inadequado.criterio)
          }
        }
      }));
  }
  
  successMessage.value = "Texto limpo com sucesso! Caracteres desnecessários foram removidos mantendo a formatação.";
  setTimeout(() => { successMessage.value = ''; }, 3000);
}

// Função para limpar um campo de texto específico
function cleanSingleField(fieldPath) {
  const pathParts = fieldPath.split('.');
  let current = stationData.value;
  
  // Navegar até o campo correto
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (current[pathParts[i]]) {
      current = current[pathParts[i]];
    } else {
      return; // Campo não existe
    }
  }
  
  const fieldName = pathParts[pathParts.length - 1];
  if (current[fieldName]) {
    // Verifica se o campo contém tags HTML
    if (current[fieldName].includes('<') && current[fieldName].includes('>')) {
      current[fieldName] = cleanRichText(current[fieldName]);
    } else {
      current[fieldName] = cleanText(current[fieldName]);
    }
  }
}

// Função para limpar texto rico mantendo formatação HTML
function cleanRichText(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') return htmlText;
  
  return htmlText
    // Remove "e," e "e;" desnecessários
    .replace(/\s*e,\s*<\/p>/gim, '<\/p>')
    .replace(/\s*e;\s*<\/p>/gim, '<\/p>')
    // Remove "ITEM AVALIAÇÃO" mantendo as tags
    .replace(/(<[^>]+>)*\s*ITEM\s+AVALIA[ÇC][ÃA]O\s*(<\/[^>]+>)*/gi, '')
    .replace(/(<[^>]+>)*\s*ITEM\s+DE\s+AVALIA[ÇC][ÃA]O\s*(<\/[^>]+>)*/gi, '')
    // Remove espaços múltiplos entre tags
    .replace(/>\s{2,}</g, '> <')
    // Normaliza espaços antes de pontuação
    .replace(/\s+([,.;:!?])/g, '$1')
    // Remove linhas em branco consecutivas
    .replace(/(<p>&nbsp;<\/p>){2,}/g, '<p>&nbsp;<\/p>');
}

// Prompt da IA para auto-adaptação
const promptIA = `Você é um especialista em educação médica e na prova Revalida. Sua tarefa é usar este modelo JSON como um gabarito para converter um caso clínico bruto em uma estação estruturada. Siga TODAS as regras rigorosamente:
1. Preencha todos os campos marcados com [ ].
2. No campo tituloEstacao, SEMPRE comece com o prefixo 'REVALIDA FACIL - ' seguido pelo tema central do caso.
3. Na seção informacoesVerbaisSimulado, detalhe cada item da anamnese de forma granular. Para cada sintoma, antecedente ou hábito, forneça uma resposta específica ou use 'Nega' ou 'Não se aplica'. Separe cada tipo de antecedente (Pessoal, Ginecológico, Familiar, Epidemiológico, etc.) em seu próprio contextoOuPerguntaChave.
4. Na seção itensAvaliacao, a pontuação 'parcialmenteAdequado' só deve ser aplicada quando o item de avaliação contiver 3 ou mais subtarefas. Para itens mais simples e diretos, use apenas 'adequado' e 'inadequado'.
5. Adapte os pontos para que a pontuacaoTotalEstacao seja sempre 10.0.
6. Ao final, adicione a seção feedbackEstacao. Crie um resumoTecnico conciso (máximo 15 linhas) sobre a patologia, focando em pontos-chave de diagnóstico e manejo conforme as diretrizes mais atuais (Ministério da Saúde, sociedades médicas, manuais de referência como Cecil/Harrison). É mandatório citar as fontes utilizadas.
7. IMPORTANTE: Ao gerar o JSON final da estação, este campo 'promptIA' deve ser completamente removido.`;

// Função para auto-adaptação do roteiro usando IA
async function autoAdaptActorScript() {
  const corrector = await importPEPCorrector();
  if (!corrector) {
    errorMessage.value = 'Erro ao carregar corretor PEP para auto-adaptação.';
    return;
  }

  // Template completo que será usado como base para a adaptação
  const template = [
    {
      contextoOuPerguntaChave: "INSTRUÇÕES DE ATUAÇÃO",
      informacao: "Comportamento: [Instrução geral de atuação do ator].\nAções Específicas: [Ações físicas a serem realizadas pelo ator]."
    },
    {
      contextoOuPerguntaChave: "IDENTIFICAÇÃO",
      informacao: "Nome: [Nome]\nIdade: [Idade]\nGênero: [Gênero]\nOcupação: [Ocupação]\nEstado Civil: [Estado Civil]\nNaturalidade: [Naturalidade]\nProcedência: [Procedência]"
    },
    {
      contextoOuPerguntaChave: "QUEIXA PRINCIPAL",
      informacao: "[Queixa principal em primeira pessoa, com duração]."
    },
    {
      contextoOuPerguntaChave: "HISTÓRIA DA DOENÇA ATUAL (HDA)",
      informacao: "Sintoma Principal (Ex: DOR):\nInício: [Detalhes]\nLocalização: [Detalhes]\nIrradiação: [Detalhes ou 'Nega']\nCaráter/Tipo: [Detalhes]\nIntensidade: [Detalhes]\nFatores de Melhora/Piora: [Detalhes ou 'Nega']\n\nSintoma Associado (Ex: NÁUSEAS/VÔMITOS):\nInício: [Detalhes]\nFrequência: [Detalhes]\nConteúdo: [Detalhes]"
    },
    {
      contextoOuPerguntaChave: "INTERROGATÓRIO SISTEMÁTICO",
      informacao: "Geral: [Astenia, Anorexia, Perda Ponderal - Nega/Presente]\nPele/Fâneros: [Nega/Presente]\nCabeça/Pescoço: [Nega/Presente]\nCardiovascular: [Nega/Presente]\nRespiratório: [Nega/Presente]\nGastrointestinal: [Nega/Presente]\nUrinário: [Nega/Presente]\nMúsculo-esquelético: [Nega/Presente]\nNeurológico: [Nega/Presente]"
    }
  ];

  if (confirm("Esta ação vai tentar adaptar o conteúdo atual do roteiro para o formato padrão do Revalida. Deseja continuar?")) {
    // Aqui você implementaria a lógica de integração com a IA usando o template e o promptIA
    // Por enquanto, apenas mostra a estrutura que será usada
    console.log("Adaptando conteúdo usando o template:", template);
    alert("Funcionalidade de auto-adaptação com IA será implementada em breve!");
  }
}

// --- Função utilitária para adaptar estação ao padrão de Clínica Médica ---
async function adaptarParaClinicaMedicaPadrao(station) {
  const corrector = await importPEPCorrector();
  if (!corrector) {
    console.error('Erro ao carregar corretor PEP para adaptação de Clínica Médica.');
    return station;
  }

  // 1. Verifica se é Clínica Médica
  if (station.especialidade !== 'Clínica Médica') return station;

  // 2. Adapta informacoesVerbaisSimulado
  station.materiaisDisponiveis = station.materiaisDisponiveis || {};
  station.materiaisDisponiveis.informacoesVerbaisSimulado = corrector.adaptarRoteiroAtor(station.materiaisDisponiveis.informacoesVerbaisSimulado);

  // 3. Adapta itens do PEP
  station.padraoEsperadoProcedimento = station.padraoEsperadoProcedimento || {};
  station.padraoEsperadoProcedimento.itensAvaliacao = corrector.adaptarItensPEP(station.padraoEsperadoProcedimento.itensAvaliacao);

  // 4. Normaliza pontuação total
  corrector.normalizarPontuacaoTotal(station);

  return station;
}

// Função para adaptação manual dos itens do PEP ao padrão Clínica Médica
async function adaptarPEPManual() {
  if (!stationData.value || stationData.value.especialidade !== 'Clínica Médica') return;
  
  const corrector = await importPEPCorrector();
  if (!corrector) {
    errorMessage.value = 'Erro ao carregar corretor PEP para adaptação manual.';
    return;
  }

  stationData.value.padraoEsperadoProcedimento.itensAvaliacao = corrector.adaptarItensPEP(stationData.value.padraoEsperadoProcedimento.itensAvaliacao);
  corrector.normalizarPontuacaoTotal(stationData.value);
  successMessage.value = 'Itens do PEP adaptados ao padrão Clínica Médica!';
  setTimeout(() => { successMessage.value = ''; }, 3000);
}

onMounted(() => {
  // O watch com immediate: true já chama fetchStationToEdit na montagem se route.params.id estiver presente
});

watch(() => route.params.id, (newId) => {
  if (newId) { // Verifica se newId existe antes de atribuir e buscar
    stationId.value = newId;
    fetchStationToEdit();
  }
}, { immediate: true }); // immediate: true para rodar na montagem inicial

// Watch para atualizar estatísticas PEP quando itens mudam
watch(() => stationData.value?.padraoEsperadoProcedimento?.itensAvaliacao, () => {
  if (stationData.value) {
    // Debounce para evitar muitas chamadas durante edição
    setTimeout(() => {
      updatePEPStats();
    }, 500);
  }
}, { deep: true });

function goToEditStation(stationId) {
  router.push(`/app/station-edit/${stationId || ''}`);
}
</script>

<template>
  <VContainer fluid>
    <VRow>
      <VCol cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <VBtn @click="router.push('/app/station-list')" prepend-icon="ri-arrow-left-line">
            Voltar para Lista
          </VBtn>
          <h2 class="text-h4">Editar Estação</h2>
          <VBtn 
            v-if="stationId && isAdmin" 
            @click="deleteStation" 
            :disabled="isLoading"
            color="error" 
            variant="tonal"
            prepend-icon="ri-delete-bin-line"
          >
            Apagar Estação
          </VBtn>
        </div>
      </VCol>
    </VRow>

    <VRow justify="center">
      <VCol cols="12">
        <VProgressCircular v-if="isLoading" indeterminate size="64" class="d-block mx-auto" />
        <VAlert v-if="errorMessage" type="error" prominent class="mb-4">{{ errorMessage }}</VAlert>
        <VAlert v-if="successMessage" type="success" prominent class="mb-4">{{ successMessage }}</VAlert>
      </VCol>
    </VRow>

    <form v-if="stationData && !isLoading && isAdmin" @submit.prevent="saveStationChanges">
      <VChip color="primary" class="d-block mx-auto mb-6">
        Editando Estação ID: <strong>{{ stationData.id }}</strong>
      </VChip>

      <!-- Informações Gerais -->
      <VCard class="mb-6">
        <VCardTitle>Informações Gerais da Estação</VCardTitle>
        <VCardText>
          <VRow>
            <VCol cols="12" md="8">
              <VTextField label="Título da Estação" v-model="stationData.tituloEstacao" required />
            </VCol>
            <VCol cols="12" md="4">
              <VTextField label="Número da Estação" v-model.number="stationData.numeroDaEstacao" type="number" required />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField label="Especialidade" v-model="stationData.especialidade" required />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField label="Tempo de Duração (minutos)" v-model.number="stationData.tempoDuracaoMinutos" type="number" required />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField label="Palavras-Chave (separadas por vírgula)" v-model="stationData.palavrasChave" />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField label="Nível de Dificuldade" v-model="stationData.nivelDificuldade" />
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <!-- Instruções para o Participante -->
      <VCard class="mb-6" v-if="stationData.instrucoesParticipante">
        <VCardTitle>Instruções para o Participante</VCardTitle>
        <VCardText>
          <VCard variant="tonal" class="mb-4" v-if="stationData.instrucoesParticipante.cenarioAtendimento">
            <VCardTitle class="text-subtitle-1">Cenário de Atendimento</VCardTitle>
            <VCardText>
              <VRow>
                <VCol cols="12" md="6">
                  <VTextField label="Nível de Atenção" v-model="stationData.instrucoesParticipante.cenarioAtendimento.nivelAtencao" />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField label="Tipo de Atendimento" v-model="stationData.instrucoesParticipante.cenarioAtendimento.tipoAtendimento" />
                </VCol>
              </VRow>
              <div>
                <label class="v-label">Infraestrutura da Unidade</label>
                <div v-for="(infra, index) in stationData.instrucoesParticipante.cenarioAtendimento.infraestruturaUnidade" :key="'infra-' + index" class="d-flex align-center my-2">
                  <VTextField v-model="stationData.instrucoesParticipante.cenarioAtendimento.infraestruturaUnidade[index]" dense hide-details />
                  <VBtn icon="ri-delete-bin-line" size="small" variant="text" color="error" @click="removeFromArray(stationData.instrucoesParticipante.cenarioAtendimento.infraestruturaUnidade, index)" />
                </div>
                <VBtn size="small" color="primary" @click="addToArray(stationData.instrucoesParticipante.cenarioAtendimento.infraestruturaUnidade, '')">Adicionar Infraestrutura</VBtn>
              </div>
            </VCardText>
          </VCard>
          
          <div class="mb-4">
            <div class="d-flex justify-space-between align-center mb-2">
              <label class="v-label">Descrição do Caso Completa</label>
              <VBtn icon="ri-broom-line" size="small" variant="text" color="info" @click="cleanSingleField('instrucoesParticipante.descricaoCasoCompleta')" title="Limpar este campo" />
            </div>
            <TiptapEditor v-model="stationData.instrucoesParticipante.descricaoCasoCompleta" />
          </div>

          <div class="mb-4">
            <label class="v-label">Tarefas Principais</label>
            <div v-for="(tarefa, index) in stationData.instrucoesParticipante.tarefasPrincipais" :key="'tarefa-' + index" class="d-flex align-start my-2">
              <TiptapEditor v-model="stationData.instrucoesParticipante.tarefasPrincipais[index]" class="flex-grow-1" />
              <VBtn icon="ri-delete-bin-line" size="small" variant="text" color="error" @click="removeFromArray(stationData.instrucoesParticipante.tarefasPrincipais, index)" />
            </div>
            <VBtn size="small" color="primary" @click="addToArray(stationData.instrucoesParticipante.tarefasPrincipais, '')">Adicionar Tarefa</VBtn>
          </div>

          <div>
            <label class="v-label">Avisos Importantes</label>
            <div v-for="(aviso, index) in stationData.instrucoesParticipante.avisosImportantes" :key="'aviso-' + index" class="d-flex align-start my-2">
              <TiptapEditor v-model="stationData.instrucoesParticipante.avisosImportantes[index]" class="flex-grow-1" />
              <VBtn icon="ri-delete-bin-line" size="small" variant="text" color="error" @click="removeFromArray(stationData.instrucoesParticipante.avisosImportantes, index)" />
            </div>
            <VBtn size="small" color="primary" @click="addToArray(stationData.instrucoesParticipante.avisosImportantes, '')">Adicionar Aviso</VBtn>
          </div>
        </VCardText>
      </VCard>

      <!-- Roteiro do Ator -->
      <VCard class="mb-6" v-if="stationData.materiaisDisponiveis && stationData.materiaisDisponiveis.informacoesVerbaisSimulado">
        <VCardTitle>Roteiro do Ator (Informações Verbais)</VCardTitle>
        <VCardText>
          <VBtn color="teal" @click="autoAdaptActorScript()" prepend-icon="ri-robot-line" class="mb-4">Auto-Adaptar Roteiro (IA)</VBtn>
          <VCard v-for="(info, index) in stationData.materiaisDisponiveis.informacoesVerbaisSimulado" :key="'infoRoteiro-' + index" variant="outlined" class="mb-4 pa-4">
            <VTextField label="Contexto/Pergunta Chave" v-model="info.contextoOuPerguntaChave" class="mb-2" />
            <label class="v-label">Informação (em 1ª pessoa)</label>
            <TiptapEditor v-model="info.informacao" />
            <VCardActions>
              <VSpacer />
              <VBtn color="error" variant="text" @click="removeFromArray(stationData.materiaisDisponiveis.informacoesVerbaisSimulado, index)">Remover Item</VBtn>
            </VCardActions>
          </VCard>
          <VBtn color="primary" @click="addActorScriptItem()">Adicionar Item ao Roteiro</VBtn>
        </VCardText>
      </VCard>

      <!-- Impressos para o Candidato -->
      <VCard class="mb-6" v-if="stationData.materiaisDisponiveis && stationData.materiaisDisponiveis.impressos">
        <VCardTitle>Impressos para o Candidato</VCardTitle>
        <VCardText>
          <VCard v-for="(impresso, impIndex) in stationData.materiaisDisponiveis.impressos" :key="impresso.idImpresso || 'impresso-' + impIndex" variant="outlined" class="mb-4 pa-4">
            <div class="d-flex justify-space-between align-center mb-4">
              <h4 class="text-h6">Impresso {{ impIndex + 1 }}</h4>
              <VBtn color="error" variant="text" @click="removeFromArray(stationData.materiaisDisponiveis.impressos, impIndex)">Remover Impresso</VBtn>
            </div>
            <VRow>
              <VCol cols="12" md="6">
                <VTextField label="ID do Impresso (único)" v-model="impresso.idImpresso" required />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField label="Título do Impresso" v-model="impresso.tituloImpresso" required />
              </VCol>
              <VCol cols="12">
                <VSelect
                  label="Tipo de Conteúdo"
                  v-model="impresso.tipoConteudo"
                  :items="[
                    { title: 'Lista com chave-valor em seções', value: 'lista_chave_valor_secoes' },
                    { title: 'Tabela de objetos', value: 'tabela_objetos' },
                    { title: 'Imagem descritiva', value: 'imagem_descritiva' },
                    { title: 'Imagem com texto', value: 'imagem_com_texto' }
                  ]"
                  required
                  @update:modelValue="atualizarTemplateImpresso(impresso)"
                />
              </VCol>
            </VRow>

            <!-- Editor Dinâmico Baseado no Tipo de Conteúdo -->
            <div class="mt-4 pt-4 border-t">
              <!-- Editor para: lista_chave_valor_secoes -->
              <div v-if="impresso.tipoConteudo === 'lista_chave_valor_secoes'">
                <VCard v-for="(secao, secIndex) in impresso.conteudo.secoes" :key="secIndex" variant="tonal" class="mb-3">
                  <VCardText>
                    <div class="d-flex justify-space-between align-center">
                      <VTextField label="Título da Seção" v-model="secao.tituloSecao" />
                      <VBtn icon="ri-delete-bin-line" size="small" variant="text" color="error" @click="removeFromArray(impresso.conteudo.secoes, secIndex)" />
                    </div>
                    <div v-for="(item, itemIndex) in secao.itens" :key="itemIndex" class="d-flex align-center gap-2 my-2">
                      <VTextField label="Chave" v-model="item.chave" />
                      <VTextField label="Valor" v-model="item.valor" />
                      <VBtn icon="ri-delete-bin-line" size="x-small" variant="text" color="error" @click="removeFromArray(secao.itens, itemIndex)" />
                    </div>
                    <VBtn size="small" color="primary" @click="addToArray(secao.itens, { chave: 'Nova Chave', valor: 'Novo Valor' })">Adicionar Item</VBtn>
                  </VCardText>
                </VCard>
                <VBtn color="secondary" @click="addToArray(impresso.conteudo.secoes, { tituloSecao: 'Nova Seção', itens: [{ chave: 'Chave', valor: 'Valor' }] })">Adicionar Seção</VBtn>
              </div>

              <!-- Editor para: tabela_objetos -->
              <div v-if="impresso.tipoConteudo === 'tabela_objetos'">
                <p class="v-label">Cabeçalhos da Tabela</p>
                <div v-for="(cab, cabIndex) in impresso.conteudo.cabecalhos" :key="cabIndex" class="d-flex align-center gap-2 my-2">
                  <VTextField label="Key (identificador)" v-model="cab.key" />
                  <VTextField label="Label (título)" v-model="cab.label" />
                  <VBtn icon="ri-delete-bin-line" size="x-small" variant="text" color="error" @click="removeFromArray(impresso.conteudo.cabecalhos, cabIndex)" />
                </div>
                <VBtn size="small" color="primary" @click="addToArray(impresso.conteudo.cabecalhos, { key: 'novaKey', label: 'Novo Cabeçalho' })">Adicionar Cabeçalho</VBtn>
                <VDivider class="my-4" />
                <p class="v-label">Linhas da Tabela</p>
                <VTable>
                  <thead>
                    <tr>
                      <th v-for="cab in impresso.conteudo.cabecalhos" :key="cab.key">{{ cab.label }}</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(linha, linhaIndex) in impresso.conteudo.linhas" :key="linhaIndex">
                      <td v-for="cab in impresso.conteudo.cabecalhos" :key="cab.key">
                        <VTextField v-model="linha[cab.key]" dense hide-details />
                      </td>
                      <td>
                        <VBtn icon="ri-delete-bin-line" size="x-small" variant="text" color="error" @click="removeFromArray(impresso.conteudo.linhas, linhaIndex)" />
                      </td>
                    </tr>
                  </tbody>
                </VTable>
                <VBtn size="small" color="primary" class="mt-2" @click="addToArray(impresso.conteudo.linhas, {})">Adicionar Linha</VBtn>
              </div>

              <!-- Editor para: imagem_descritiva -->
              <div v-if="impresso.tipoConteudo === 'imagem_descritiva'">
                <VTextarea label="Descrição da Imagem" v-model="impresso.conteudo.descricao" rows="3" />
                <VTextField label="Caminho da Imagem (URL)" v-model="impresso.conteudo.caminhoImagem" />
              </div>

              <!-- Editor para: imagem_com_texto -->
              <div v-if="impresso.tipoConteudo === 'imagem_com_texto'">
                <VTextarea label="Texto Descritivo / Interpretação" v-model="impresso.conteudo.textoDescritivo" rows="3" />
                <VTextField label="Caminho da Imagem (URL)" v-model="impresso.conteudo.caminhoImagem" />
                <VTextField label="Legenda da Imagem" v-model="impresso.conteudo.legendaImagem" class="mt-2"/>
                <VTextarea label="Laudo" v-model="impresso.conteudo.laudo" rows="4" class="mt-2"/>
              </div>
            </div>
          </VCard>
          <VBtn color="primary" @click="addImpressoItem()">Adicionar Impresso</VBtn>
        </VCardText>
      </VCard>

      <!-- PEP - Itens de Avaliação -->
      <VCard class="mb-6" v-if="stationData.padraoEsperadoProcedimento">
        <VCardTitle>PEP - Itens de Avaliação</VCardTitle>
        <VCardSubtitle>Use os botões para adicionar blocos de avaliação padronizados.</VCardSubtitle>
        <VCardText>
          <!-- Botão de adaptação manual para Clínica Médica -->
          <div v-if="stationData.especialidade === 'Clínica Médica'" class="mb-4">
            <VBtn color="teal-darken-2" @click="adaptarPEPManual" prepend-icon="ri-magic-line">
              Adaptar para Padrão Clínica Médica
            </VBtn>
          </div>
          <!-- Indicador de Pontuação PEP -->
          <VCard variant="tonal" :color="pepStats.isValid ? 'success' : 'warning'" class="mb-4">
            <VCardText>
              <div class="d-flex justify-space-between align-center">
                <div>
                  <h4 class="text-h6 mb-2">📊 Status da Pontuação PEP</h4>
                  <div class="d-flex gap-4">
                    <VChip 
                      :color="pepStats.isValid ? 'success' : 'error'" 
                      variant="flat"
                      size="large"
                    >
                      Total: {{ pepStats.totalScore }}/10.0 pontos
                    </VChip>
                    <VChip variant="outlined">
                      {{ pepStats.itemCount }} itens
                    </VChip>
                    <VChip 
                      :color="pepStats.isValid ? 'success' : 'warning'" 
                      variant="outlined"
                    >
                      {{ pepStats.isValid ? '✅ Pontuação Correta' : '⚠️ Necessita Correção' }}
                    </VChip>
                  </div>
                </div>
                <div class="text-right">
                  <VBtn 
                    color="primary" 
                    @click="correctPEPScoring" 
                    :loading="isLoading"
                    prepend-icon="ri-calculator-line"
                    class="mb-2"
                  >
                    Corrigir Pontuação
                  </VBtn>
                  <br>
                  <VBtn 
                    size="small" 
                    variant="text" 
                    @click="updatePEPStats"
                    prepend-icon="ri-refresh-line"
                  >
                    Atualizar Stats
                  </VBtn>
                </div>
              </div>
              
              <!-- Detalhes dos itens -->
              <VExpansionPanels v-if="pepStats.items.length > 0" class="mt-4">
                <VExpansionPanel title="📋 Detalhes dos Itens PEP">
                  <VExpansionPanelText>
                    <VTable density="compact">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Categoria</th>
                          <th>Adequado</th>
                          <th>Parcial</th>
                          <th>Inadequado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(item, index) in pepStats.items" :key="item.id">
                          <td>{{ index + 1 }}</td>
                          <td>{{ item.category }}</td>
                          <td>{{ item.adequado.toFixed(2) }}</td>
                          <td>{{ item.parcial.toFixed(2) }}</td>
                          <td>{{ item.inadequado.toFixed(2) }}</td>
                        </tr>
                      </tbody>
                    </VTable>
                  </VExpansionPanelText>
                </VExpansionPanel>
              </VExpansionPanels>
            </VCardText>
          </VCard>
          
          <div class="d-flex flex-wrap gap-2 mb-4">
            <VBtn color="indigo-lighten-1" size="small" @click="addStandardPEPItems('apresentacao')">+ Apresentação</VBtn>
            <VBtn color="blue-lighten-1" size="small" @click="addStandardPEPItems('anamnese')">+ Anamnese</VBtn>
            <VBtn color="green-lighten-1" size="small" @click="addStandardPEPItems('exameFisico')">+ Exame Físico</VBtn>
            <VBtn color="purple-lighten-1" size="small" @click="addStandardPEPItems('diagnostico')">+ Diagnóstico e Tratamento</VBtn>
            <VBtn color="orange-lighten-1" size="small" @click="addStandardPEPItems('diagnosticosDiferenciais')">+ Diagnósticos Diferenciais</VBtn>
            <VBtn color="cyan-lighten-1" size="small" @click="addStandardPEPItems('examesImagem')">+ Exames de Imagem</VBtn>
            <VBtn color="pink-lighten-1" size="small" @click="addStandardPEPItems('examesLaboratoriais')">+ Exames Laboratoriais</VBtn>
          </div>

          <VCard v-for="(itemPEP, pepIndex) in stationData.padraoEsperadoProcedimento.itensAvaliacao" :key="itemPEP.idItem || 'pep-' + pepIndex" variant="outlined" class="mb-4 pa-4">
            <div class="d-flex justify-space-between align-center mb-4">
              <h4 class="text-h6">Item do PEP {{ itemPEP.itemNumeroOficial }}</h4>
              <div>
                <VBtn icon="ri-arrow-up-line" size="small" variant="text" @click="movePEPItem(pepIndex, 'up')" :disabled="pepIndex === 0" />
                <VBtn icon="ri-arrow-down-line" size="small" variant="text" @click="movePEPItem(pepIndex, 'down')" :disabled="pepIndex === stationData.padraoEsperadoProcedimento.itensAvaliacao.length - 1" />
                <VBtn color="error" variant="text" @click="removePEPItem(pepIndex)">Remover</VBtn>
              </div>
            </div>
            <VRow>
              <VCol cols="12" md="8">
                <VTextField label="ID do Item (único)" v-model="itemPEP.idItem" required />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField 
                  label="Nº Oficial"
                  v-model="itemPEP.itemNumeroOficial"
                  type="number"
                  @change="reorderPEPItems(pepIndex)"
                  hint="Mude o número para reordenar"
                  persistent-hint
                />
              </VCol>
              <VCol cols="12">
                <VTextarea label="Descrição do Item" v-model="itemPEP.descricaoItem" rows="3" />
              </VCol>
            </VRow>
            <VCard variant="tonal" class="mt-4" v-if="itemPEP.pontuacoes">
              <VCardTitle class="text-subtitle-1">Critérios de Pontuação</VCardTitle>
              <VCardText>
                <div v-if="itemPEP.pontuacoes.adequado" class="mb-4">
                  <label class="v-label">Adequado</label>
                  <TiptapEditor v-model="itemPEP.pontuacoes.adequado.criterio" />
                  <VTextField label="Pontos" v-model.number="itemPEP.pontuacoes.adequado.pontos" type="number" step="0.01" class="mt-2" />
                </div>
                <div v-if="itemPEP.pontuacoes.parcialmenteAdequado" class="mb-4">
                  <label class="v-label">Parcialmente Adequado</label>
                  <TiptapEditor v-model="itemPEP.pontuacoes.parcialmenteAdequado.criterio" />
                  <VTextField label="Pontos" v-model.number="itemPEP.pontuacoes.parcialmenteAdequado.pontos" type="number" step="0.01" class="mt-2" />
                </div>
                <div v-if="itemPEP.pontuacoes.inadequado">
                  <label class="v-label">Inadequado</label>
                  <TiptapEditor v-model="itemPEP.pontuacoes.inadequado.criterio" />
                  <VTextField label="Pontos" v-model.number="itemPEP.pontuacoes.inadequado.pontos" type="number" step="0.01" class="mt-2" />
                </div>
              </VCardText>
            </VCard>
          </VCard>
          <VBtn color="primary" @click="addPEPItem()">Adicionar Item Manualmente</VBtn>
        </VCardText>
      </VCard>

      <!-- Ações Finais -->
      <VCard>
        <VCardActions class="pa-4">
          <VBtn @click="cleanAllTextFields()" color="info" variant="tonal" prepend-icon="ri-broom-line">
            Limpar Texto
          </VBtn>
          <VBtn 
            @click="correctAllStationsPEP" 
            color="warning" 
            variant="tonal" 
            prepend-icon="ri-database-2-line"
            :loading="isLoading"
            class="ml-2"
            title="Corrige a pontuação PEP de todas as estações no banco de dados"
          >
            Corrigir Todas as Estações
          </VBtn>
          <VSpacer />
          <VBtn type="submit" color="success" size="large" :loading="isLoading" prepend-icon="ri-save-line">
            Salvar Alterações
          </VBtn>
        </VCardActions>
      </VCard>
    </form>

    <VAlert v-else-if="!isAdmin && !isLoading" type="warning" prominent>
      Você não tem permissão para editar esta estação.
    </VAlert>
    <VAlert v-else-if="!isLoading && !errorMessage && !stationData" type="info" prominent>
      Nenhuma estação carregada ou ID inválido.
    </VAlert>
  </VContainer>
</template>

<style scoped>
.v-label {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  display: block;
}

.array-item-editor-simple {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.array-item-editor-simple .v-text-field {
  flex-grow: 1;
}

/* Estilos para o editor Tiptap */
:deep(.tiptap-editor) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  padding: 8px;
}

:deep(.toolbar) {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  margin-bottom: 8px;
  padding-bottom: 8px;
}

:deep(.editor-content) {
  min-height: 120px;
}

:deep(.editor-content p) {
  margin-bottom: 0.5em;
}

.flex-grow-1 {
  flex-grow: 1;
}
</style>
