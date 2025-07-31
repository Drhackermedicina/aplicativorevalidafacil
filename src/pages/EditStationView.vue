<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db } from '@/plugins/firebase.js';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { currentUser } from '@/plugins/auth.js';

const route = useRoute();
const router = useRouter();

const stationId = ref(null);
const isLoading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const isSaving = ref(false);

// Função para obter o estado inicial do formulário
function getInitialFormData() {
  return {
    idEstacao: '',
    tituloEstacao: '',
    numeroDaEstacao: null,
    especialidade: '',
    tempoDuracaoMinutos: 10,
    palavrasChave: '',
    nivelDificuldade: 'Médio',
    cenarioAtendimento_nivelAtencao: 'atenção primária à saúde',
    cenarioAtendimento_tipoAtendimento: 'ambulatorial',
    cenarioAtendimento_infraestruturaUnidade: '',
    descricaoCasoCompleta: '',
    tarefasPrincipais: '',
    avisosImportantes: '',
    informacoesVerbaisSimulado: [{ contextoOuPerguntaChave: '', informacao: '' }],
    impressos: [{ idImpresso: `imp_${Date.now()}_1`, tituloImpresso: '', tipoConteudo: 'texto_simples', conteudo: { texto: ''} }],
    padraoEsperadoProcedimento: {
      idChecklistAssociado: '',
      sinteseEstacao: { resumoCasoPEP: '', focoPrincipalDetalhado: [''] },
      itensAvaliacao: [{
          idItem: `itempep_${Date.now()}_1`,
          itemNumeroOficial: '',
          descricaoItem: '',
          pontuacoes: {
              adequado: { criterio: 'Realizou corretamente e completamente.', pontos: 0 },
              parcialmenteAdequado: { criterio: 'Realizou parcialmente ou com pequenas falhas.', pontos: 0 },
              inadequado: { criterio: 'Não realizou ou realizou incorretamente.', pontos: 0 }
          }
      }],
      pontuacaoTotalEstacao: 0
    }
  };
}

const formData = ref(getInitialFormData());

// Verifica se o usuário atual é admin
const isAdmin = computed(() => {
  return currentUser.value && (
    currentUser.value.uid === 'KiSITAxXMAY5uU3bOPW5JMQPent2' ||
    currentUser.value.uid === 'RtfNENOqMUdw7pvgeeaBVSuin662' ||
    currentUser.value.uid === 'lNwhdYgMwLhS1ZyufRzw9xLD10y1'
  );
});

// Computed para calcular pontuação total do PEP
const calcularPontuacaoTotalPEP = computed(() => {
  if (!formData.value.padraoEsperadoProcedimento?.itensAvaliacao?.length) return 0;
  
  const total = formData.value.padraoEsperadoProcedimento.itensAvaliacao.reduce((acc, item) => {
    const pontosAdequado = parseFloat(item.pontuacoes?.adequado?.pontos) || 0;
    return acc + pontosAdequado;
  }, 0);
  
  return total;
});

// Watch para atualizar pontuação total automaticamente
watch(calcularPontuacaoTotalPEP, (novaTotal) => {
  if (formData.value.padraoEsperadoProcedimento) {
    formData.value.padraoEsperadoProcedimento.pontuacaoTotalEstacao = novaTotal;
  }
}, { immediate: true });

// Função para carregar estação do Firestore
async function fetchStationData() {
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
      const stationData = { id: docSnap.id, ...docSnap.data() };
      loadStationIntoForm(stationData);
      successMessage.value = `Estação "${stationData.tituloEstacao}" carregada com sucesso!`;
      setTimeout(() => { successMessage.value = ''; }, 3000);
    } else {
      errorMessage.value = "Estação não encontrada.";
    }
  } catch (error) {
    console.error("Erro ao buscar estação:", error);
    errorMessage.value = `Falha ao carregar estação: ${error.message}`;
  } finally {
    isLoading.value = false;
  }
}

// Função para carregar dados da estação no formulário
function loadStationIntoForm(stationData) {
  const form = formData.value;
  
  // Dados gerais
  form.idEstacao = stationData.idEstacao || '';
  form.tituloEstacao = stationData.tituloEstacao || '';
  form.numeroDaEstacao = stationData.numeroDaEstacao || null;
  form.especialidade = stationData.especialidade || '';
  form.tempoDuracaoMinutos = stationData.tempoDuracaoMinutos || 10;
  form.nivelDificuldade = stationData.nivelDificuldade || 'Médio';
  
  // Palavras-chave
  if (Array.isArray(stationData.palavrasChave)) {
    form.palavrasChave = stationData.palavrasChave.join(', ');
  } else if (typeof stationData.palavrasChave === 'string') {
    form.palavrasChave = stationData.palavrasChave;
  } else {
    form.palavrasChave = '';
  }
  
  // Instruções para participante
  const ip = stationData.instrucoesParticipante || {};
  form.descricaoCasoCompleta = ip.descricaoCasoCompleta || '';
  
  const tarefas = ip.tarefasPrincipais || [];
  form.tarefasPrincipais = Array.isArray(tarefas) ? tarefas.join('\n') : (tarefas || '');
  
  const avisos = ip.avisosImportantes || [];
  form.avisosImportantes = Array.isArray(avisos) ? avisos.join('\n') : (avisos || '');
  
  // Cenário de atendimento
  const ca = ip.cenarioAtendimento || {};
  form.cenarioAtendimento_nivelAtencao = ca.nivelAtencao || 'atenção primária à saúde';
  form.cenarioAtendimento_tipoAtendimento = ca.tipoAtendimento || 'ambulatorial';
  const infra = ca.infraestruturaUnidade || [];
  form.cenarioAtendimento_infraestruturaUnidade = Array.isArray(infra) ? infra.join('; ') : (infra || '');
  
  // Materiais disponíveis
  const md = stationData.materiaisDisponiveis || {};
  
  // Informações verbais simulado
  const informacoesVerbaisExistentes = md.informacoesVerbaisSimulado || [];
  if (Array.isArray(informacoesVerbaisExistentes) && informacoesVerbaisExistentes.length > 0) {
    form.informacoesVerbaisSimulado = informacoesVerbaisExistentes.map(info => ({
      contextoOuPerguntaChave: info.contextoOuPerguntaChave || '',
      informacao: info.informacao || ''
    }));
  } else {
    form.informacoesVerbaisSimulado = [{ contextoOuPerguntaChave: '', informacao: '' }];
  }
  
  // Impressos
  if (Array.isArray(md.impressos) && md.impressos.length > 0) {
    form.impressos = md.impressos.map((imp, idx) => {
      const defaultConteudo = (type) => {
        if (type === 'texto_simples') return { texto: '' };
        if (type === 'imagem_com_texto') return { textoDescritivo: '', caminhoImagem: '', laudo: '' };
        if (type === 'lista_chave_valor_secoes') return { secoes: [{ tituloSecao: '', itens: [{ chave: '', valor: '' }] }] };
        return {};
      };
      
      const tipo = imp.tipoConteudo || 'texto_simples';
      let conteudo = defaultConteudo(tipo);
      
      if (imp.conteudo) {
        if (tipo === 'texto_simples') {
          conteudo.texto = typeof imp.conteudo.texto === 'string' ? imp.conteudo.texto : '';
        } else if (tipo === 'imagem_com_texto') {
          conteudo.textoDescritivo = typeof imp.conteudo.textoDescritivo === 'string' ? imp.conteudo.textoDescritivo : '';
          conteudo.caminhoImagem = typeof imp.conteudo.caminhoImagem === 'string' ? imp.conteudo.caminhoImagem : '';
          conteudo.laudo = typeof imp.conteudo.laudo === 'string' ? imp.conteudo.laudo : '';
        } else if (tipo === 'lista_chave_valor_secoes') {
          conteudo.secoes = (Array.isArray(imp.conteudo.secoes) ? imp.conteudo.secoes : []).map(s => ({
            tituloSecao: typeof s.tituloSecao === 'string' ? s.tituloSecao : '',
            itens: (Array.isArray(s.itens) ? s.itens : []).map(i => ({ 
              chave: typeof i.chave === 'string' ? i.chave : '',
              valor: typeof i.valor === 'string' ? i.valor : '' 
            })).filter(i => i.chave || i.valor)
          })).filter(s => s.tituloSecao || s.itens.length > 0);
          
          if (conteudo.secoes.length === 0) { 
            conteudo.secoes = [{ tituloSecao: '', itens: [{chave: '', valor: ''}] }];
          }
        } else { 
          conteudo = JSON.parse(JSON.stringify(imp.conteudo)); 
        }
      }
      
      return {
        idImpresso: imp.idImpresso || `imp_loaded_${Date.now()}_${idx}`,
        tituloImpresso: imp.tituloImpresso || '',
        tipoConteudo: tipo,
        conteudo: conteudo
      };
    });
  } else {
    form.impressos = [{ idImpresso: `imp_${Date.now()}_1`, tituloImpresso: '', tipoConteudo: 'texto_simples', conteudo: { texto: ''} }];
  }
  
  // PEP
  const jsonPep = stationData.padraoEsperadoProcedimento || {};
  
  form.padraoEsperadoProcedimento.idChecklistAssociado = jsonPep.idChecklistAssociado || '';
  
  const sintese = jsonPep.sinteseEstacao || {};
  form.padraoEsperadoProcedimento.sinteseEstacao.resumoCasoPEP = sintese.resumoCasoPEP || '';
  
  const focos = sintese.focoPrincipalDetalhado || [];
  form.padraoEsperadoProcedimento.sinteseEstacao.focoPrincipalDetalhado = Array.isArray(focos) && focos.length > 0 ? focos : [''];
  
  // Itens de avaliação
  const itensExistentes = jsonPep.itensAvaliacao || [];
  if (Array.isArray(itensExistentes) && itensExistentes.length > 0) {
    form.padraoEsperadoProcedimento.itensAvaliacao = itensExistentes.map(item => ({
      idItem: item.idItem || '',
      itemNumeroOficial: item.itemNumeroOficial || '',
      descricaoItem: item.descricaoItem || '',
      pontuacoes: {
        adequado: { 
          criterio: item.pontuacoes?.adequado?.criterio || 'Realizou corretamente e completamente.', 
          pontos: parseFloat(item.pontuacoes?.adequado?.pontos) || 0 
        },
        parcialmenteAdequado: { 
          criterio: item.pontuacoes?.parcialmenteAdequado?.criterio || 'Realizou parcialmente ou com pequenas falhas.', 
          pontos: parseFloat(item.pontuacoes?.parcialmenteAdequado?.pontos) || 0 
        },
        inadequado: { 
          criterio: item.pontuacoes?.inadequado?.criterio || 'Não realizou ou realizou incorretamente.', 
          pontos: parseFloat(item.pontuacoes?.inadequado?.pontos) || 0 
        }
      }
    }));
  } else {
    form.padraoEsperadoProcedimento.itensAvaliacao = [{
      idItem: `itempep_${Date.now()}_1`,
      itemNumeroOficial: '',
      descricaoItem: '',
      pontuacoes: {
        adequado: { criterio: 'Realizou corretamente e completamente.', pontos: 0 },
        parcialmenteAdequado: { criterio: 'Realizou parcialmente ou com pequenas falhas.', pontos: 0 },
        inadequado: { criterio: 'Não realizou ou realizou incorretamente.', pontos: 0 }
      }
    }];
  }
  
  form.padraoEsperadoProcedimento.pontuacaoTotalEstacao = parseFloat(jsonPep.pontuacaoTotalEstacao) || 0;
  
  // Atualiza números oficiais dos itens após carregar
  setTimeout(() => {
    atualizarNumerosOficiaisItens();
  }, 100);
}

// Função para construir objeto da estação
function construirObjetoEstacao() {
  const pepForm = formData.value.padraoEsperadoProcedimento;
  const idEstacaoBase = formData.value.idEstacao.trim();

  const estacaoAtualizada = {
    idEstacao: idEstacaoBase,
    tituloEstacao: formData.value.tituloEstacao.trim(),
    numeroDaEstacao: parseInt(formData.value.numeroDaEstacao, 10) || 0,
    especialidade: formData.value.especialidade.trim(),
    tempoDuracaoMinutos: parseInt(formData.value.tempoDuracaoMinutos, 10) || 10,
    palavrasChave: formData.value.palavrasChave.split(',').map(kw => kw.trim()).filter(kw => kw),
    nivelDificuldade: formData.value.nivelDificuldade,
    origem: 'REVALIDA_FACIL',

    instrucoesParticipante: {
      cenarioAtendimento: {
        nivelAtencao: formData.value.cenarioAtendimento_nivelAtencao.trim(),
        tipoAtendimento: formData.value.cenarioAtendimento_tipoAtendimento.trim(),
        infraestruturaUnidade: formData.value.cenarioAtendimento_infraestruturaUnidade.split(';').map(inf => inf.trim()).filter(inf => inf),
      },
      descricaoCasoCompleta: formData.value.descricaoCasoCompleta.trim(),
      tarefasPrincipais: formData.value.tarefasPrincipais.split('\n').map(t => t.trim()).filter(t => t),
      avisosImportantes: formData.value.avisosImportantes.split('\n').map(a => a.trim()).filter(a => a),
    },

    materiaisDisponiveis: {
      impressos: formData.value.impressos.filter(
        imp => imp.idImpresso.trim() !== '' && imp.tituloImpresso.trim() !== ''
      ).map(imp => {
          let finalConteudo = {};
          const currentConteudo = imp.conteudo || {};
          if (imp.tipoConteudo === 'texto_simples') {
              finalConteudo = { texto: currentConteudo.texto?.trim() || '' };
          } else if (imp.tipoConteudo === 'imagem_com_texto') {
              finalConteudo = {
                  textoDescritivo: currentConteudo.textoDescritivo?.trim() || '',
                  caminhoImagem: currentConteudo.caminhoImagem?.trim() || '',
                  laudo: currentConteudo.laudo?.trim() || ''
              };
          } else if (imp.tipoConteudo === 'lista_chave_valor_secoes') {
              const secoesTratadas = (Array.isArray(currentConteudo.secoes) ? currentConteudo.secoes : []).map(sec => ({
                  tituloSecao: sec.tituloSecao?.trim() || '',
                  itens: (Array.isArray(sec.itens) ? sec.itens : []).map(it => ({
                      chave: it.chave?.trim() || '',
                      valor: it.valor?.trim() || ''
                  })).filter(it => it.chave || it.valor)
              })).filter(sec => sec.tituloSecao || sec.itens.length > 0);
              finalConteudo = { secoes: secoesTratadas.length > 0 ? secoesTratadas : [{ tituloSecao: '', itens: [{ chave: '', valor: ''}] }] };
          } else {
              finalConteudo = typeof currentConteudo === 'object' && currentConteudo !== null ? JSON.parse(JSON.stringify(currentConteudo)) : {};
          }
          return {
              idImpresso: imp.idImpresso.trim(),
              tituloImpresso: imp.tituloImpresso.trim(),
              tipoConteudo: imp.tipoConteudo,
              conteudo: finalConteudo
          };
      }),
      informacoesVerbaisSimulado: formData.value.informacoesVerbaisSimulado.filter(
        info => info.contextoOuPerguntaChave.trim() !== '' || info.informacao.trim() !== ''
      ).map(info => ({
          contextoOuPerguntaChave: info.contextoOuPerguntaChave.trim(),
          informacao: info.informacao.trim()
      })),
      perguntasAtorSimulado: []
    },

    padraoEsperadoProcedimento: {
      idChecklistAssociado: pepForm.idChecklistAssociado.trim() || `pep_${idEstacaoBase || Date.now()}`,
      sinteseEstacao: {
        resumoCasoPEP: pepForm.sinteseEstacao.resumoCasoPEP.trim(),
        focoPrincipalDetalhado: pepForm.sinteseEstacao.focoPrincipalDetalhado.map(f => f.trim()).filter(f => f)
      },
      itensAvaliacao: pepForm.itensAvaliacao.filter(
        item => item.idItem.trim() !== '' && item.descricaoItem.trim() !== ''
      ).map(item => ({
          idItem: item.idItem.trim(),
          itemNumeroOficial: item.itemNumeroOficial.trim(),
          descricaoItem: item.descricaoItem.trim(),
          pontuacoes: {
              adequado: { criterio: item.pontuacoes.adequado.criterio.trim(), pontos: parseFloat(item.pontuacoes.adequado.pontos) || 0 },
              parcialmenteAdequado: { criterio: item.pontuacoes.parcialmenteAdequado.criterio.trim(), pontos: parseFloat(item.pontuacoes.parcialmenteAdequado.pontos) || 0 },
              inadequado: { criterio: item.pontuacoes.inadequado.criterio.trim(), pontos: parseFloat(item.pontuacoes.inadequado.pontos) || 0 },
          }
      })),
      pontuacaoTotalEstacao: calcularPontuacaoTotalPEP.value
    }
  };

  if (estacaoAtualizada.instrucoesParticipante.avisosImportantes && estacaoAtualizada.instrucoesParticipante.avisosImportantes.length === 0) {
      delete estacaoAtualizada.instrucoesParticipante.avisosImportantes;
  }
  if (estacaoAtualizada.materiaisDisponiveis.perguntasAtorSimulado && estacaoAtualizada.materiaisDisponiveis.perguntasAtorSimulado.length === 0) {
      delete estacaoAtualizada.materiaisDisponiveis.perguntasAtorSimulado;
  }

  return estacaoAtualizada;
}

// Função para validar estrutura da estação
function validarEstruturaEstacao(estacao) {
  return estacao && 
         estacao.idEstacao && 
         estacao.idEstacao.trim() !== '' && 
         estacao.tituloEstacao && 
         estacao.tituloEstacao.trim() !== '';
}

// Função para salvar alterações
async function saveStationChanges() {
  if (!stationId.value) {
    errorMessage.value = "Nenhum ID de estação para salvar.";
    return;
  }
  
  if (!isAdmin.value) {
    errorMessage.value = "Apenas administradores podem salvar alterações.";
    return;
  }

  isSaving.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const estacaoAtualizada = construirObjetoEstacao();
    
    if (!validarEstruturaEstacao(estacaoAtualizada)) {
      errorMessage.value = "Falha na validação da estrutura da estação. Verifique 'ID da Estação' e 'Título da Estação'.";
      isSaving.value = false;
      return;
    }
    
    if (typeof estacaoAtualizada.numeroDaEstacao !== 'number' || isNaN(estacaoAtualizada.numeroDaEstacao) || estacaoAtualizada.numeroDaEstacao <= 0) {
      errorMessage.value = "Erro de validação: O campo 'Número da Estação' deve ser um número válido e maior que zero.";
      isSaving.value = false;
      return;
    }

    if (!estacaoAtualizada.padraoEsperadoProcedimento?.itensAvaliacao?.length || estacaoAtualizada.padraoEsperadoProcedimento.itensAvaliacao.some(item => !item.idItem || !item.descricaoItem)) {
        errorMessage.value = "Erro de validação: O PEP (Checklist) deve conter pelo menos um item de avaliação com ID e Descrição preenchidos.";
        isSaving.value = false;
        return;
    }
    
    const stationDocRef = doc(db, 'estacoes_clinicas', stationId.value);
    
    const dataToSave = {
      ...estacaoAtualizada,
      atualizadoEmTimestamp: serverTimestamp(),
      // Manter campos de integração se existirem, senão adicionar padrões
      mediaNotas: 0,
      totalAvaliacoes: 0,
      usuariosQueConcluíram: []
    };

    await updateDoc(stationDocRef, dataToSave);
    
    successMessage.value = `Estação "${estacaoAtualizada.tituloEstacao}" atualizada com sucesso!`;
    setTimeout(() => { successMessage.value = ''; }, 5000);

  } catch (error) {
    console.error("Erro ao salvar alterações da estação:", error);
    let detalheErro = error.message;
    if (error.code === 'permission-denied') {
      detalheErro += " (ERRO DE PERMISSÃO DO FIRESTORE - Verifique as regras de segurança e o UID do admin)";
    }
    errorMessage.value = `Falha ao salvar: ${detalheErro}`;
  } finally {
    isSaving.value = false;
  }
}

// Função para excluir a estação
async function deleteStation() {
  if (!stationId.value) {
    errorMessage.value = "Nenhuma estação para excluir.";
    return;
  }
  
  if (!isAdmin.value) {
    errorMessage.value = "Apenas administradores podem excluir estações.";
    return;
  }
  
  const confirmDelete = confirm(`ATENÇÃO: Você está prestes a EXCLUIR permanentemente a estação "${formData.value.tituloEstacao}". Esta ação NÃO pode ser desfeita. Deseja continuar?`);
  
  if (!confirmDelete) {
    return;
  }
  
  isSaving.value = true;
  errorMessage.value = '';
  
  try {
    const stationDocRef = doc(db, 'estacoes_clinicas', stationId.value);
    await deleteDoc(stationDocRef);
    
    successMessage.value = "Estação excluída com sucesso!";
    
    setTimeout(() => {
      router.push('/app/station-list');
    }, 1500);
    
  } catch (error) {
    console.error("Erro ao excluir estação:", error);
    errorMessage.value = `Falha ao excluir: ${error.message}`;
    isSaving.value = false;
  }
}

// Funções auxiliares para manipular arrays dinâmicos
function adicionarInfoVerbal() {
  formData.value.informacoesVerbaisSimulado.push({ contextoOuPerguntaChave: '', informacao: '' });
}

function removerInfoVerbal(index) {
  if (formData.value.informacoesVerbaisSimulado.length > 1) {
    formData.value.informacoesVerbaisSimulado.splice(index, 1);
  }
}

function adicionarImpresso() {
  const novoImpresso = {
    idImpresso: `imp_${Date.now()}_${formData.value.impressos.length + 1}`,
    tituloImpresso: '',
    tipoConteudo: 'texto_simples',
    conteudo: { texto: '' }
  };
  formData.value.impressos.push(novoImpresso);
}

function removerImpresso(index) {
  if (formData.value.impressos.length > 1) {
    formData.value.impressos.splice(index, 1);
  }
}

function adicionarFocoPrincipalPEP() {
  formData.value.padraoEsperadoProcedimento.sinteseEstacao.focoPrincipalDetalhado.push('');
}

function removerFocoPrincipalPEP(index) {
  if (formData.value.padraoEsperadoProcedimento.sinteseEstacao.focoPrincipalDetalhado.length > 1) {
    formData.value.padraoEsperadoProcedimento.sinteseEstacao.focoPrincipalDetalhado.splice(index, 1);
  }
}

// Refs para controle de posição ao adicionar item
const showPositionDialog = ref(false);
const newItemPosition = ref(null);

function adicionarItemAvaliacaoPEP() {
  const proximaPos = formData.value.padraoEsperadoProcedimento.itensAvaliacao.length + 1;
  const novoItem = {
    idItem: `itempep_${Date.now()}_${proximaPos}`,
    itemNumeroOficial: proximaPos.toString(),
    descricaoItem: '',
    pontuacoes: {
      adequado: { criterio: 'Realizou corretamente e completamente.', pontos: 0 },
      parcialmenteAdequado: { criterio: 'Realizou parcialmente ou com pequenas falhas.', pontos: 0 },
      inadequado: { criterio: 'Não realizou ou realizou incorretamente.', pontos: 0 }
    }
  };
  
  // Se há mais de um item, perguntar onde inserir
  if (formData.value.padraoEsperadoProcedimento.itensAvaliacao.length > 0) {
    newItemPosition.value = novoItem;
    showPositionDialog.value = true;
  } else {
    formData.value.padraoEsperadoProcedimento.itensAvaliacao.push(novoItem);
    // Atualiza números oficiais após adicionar
    atualizarNumerosOficiaisItens();
  }
}

function adicionarItemNaPosicao(posicao) {
  if (newItemPosition.value) {
    if (posicao === 'fim') {
      formData.value.padraoEsperadoProcedimento.itensAvaliacao.push(newItemPosition.value);
    } else {
      const index = parseInt(posicao) - 1; // Converte posição 1-based para index 0-based
      formData.value.padraoEsperadoProcedimento.itensAvaliacao.splice(index, 0, newItemPosition.value);
    }
    
    // Atualiza números oficiais após adicionar
    atualizarNumerosOficiaisItens();
    
    // Reset dialog
    newItemPosition.value = null;
    showPositionDialog.value = false;
  }
}

function cancelarAdicaoItem() {
  newItemPosition.value = null;
  showPositionDialog.value = false;
}

function removerItemAvaliacaoPEP(index) {
  if (formData.value.padraoEsperadoProcedimento.itensAvaliacao.length > 1) {
    formData.value.padraoEsperadoProcedimento.itensAvaliacao.splice(index, 1);
    // Atualiza números oficiais após remover
    atualizarNumerosOficiaisItens();
  }
}

// Funções de reordenação
function moverItemPEPParaCima(index) {
  if (index > 0) {
    const itens = formData.value.padraoEsperadoProcedimento.itensAvaliacao;
    const item = itens[index];
    itens.splice(index, 1);
    itens.splice(index - 1, 0, item);
    // Atualiza números oficiais após mover
    atualizarNumerosOficiaisItens();
  }
}

function moverItemPEPParaBaixo(index) {
  const itens = formData.value.padraoEsperadoProcedimento.itensAvaliacao;
  if (index < itens.length - 1) {
    const item = itens[index];
    itens.splice(index, 1);
    itens.splice(index + 1, 0, item);
    // Atualiza números oficiais após mover
    atualizarNumerosOficiaisItens();
  }
}

function moverItemPEPParaPosicao(index, novaPosicao) {
  const itens = formData.value.padraoEsperadoProcedimento.itensAvaliacao;
  const novoIndex = parseInt(novaPosicao) - 1; // Converte posição 1-based para index 0-based
  
  if (novoIndex >= 0 && novoIndex < itens.length && novoIndex !== index) {
    const item = itens[index];
    itens.splice(index, 1);
    itens.splice(novoIndex, 0, item);
    // Atualiza números oficiais após mover
    atualizarNumerosOficiaisItens();
  }
}

// Função para atualizar números oficiais dos itens com base na posição
function atualizarNumerosOficiaisItens() {
  if (formData.value.padraoEsperadoProcedimento?.itensAvaliacao) {
    formData.value.padraoEsperadoProcedimento.itensAvaliacao.forEach((item, index) => {
      item.itemNumeroOficial = (index + 1).toString();
    });
  }
}

// Watch para monitorar mudanças na ordem dos itens e atualizar números oficiais
watch(
  () => formData.value.padraoEsperadoProcedimento?.itensAvaliacao?.map(item => item.idItem).join(','),
  () => {
    atualizarNumerosOficiaisItens();
  }
);

// Lifecycle
onMounted(() => {
  // O watch com immediate: true já chama fetchStationData na montagem se route.params.id estiver presente
});

watch(() => route.params.id, (newId) => {
  if (newId) {
    stationId.value = newId;
    fetchStationData();
  }
}, { immediate: true });
</script>

<template>
  <div class="edit-station-container">
    <div class="admin-upload-page">
    <div class="d-flex justify-space-between align-center mb-4">
      <button @click="router.push('/app/station-list')" class="back-button">
        ← Voltar para Lista
      </button>
      <h2>Editar Estação Clínica</h2>
      <button 
        v-if="stationId && isAdmin" 
        @click="deleteStation" 
        :disabled="isSaving"
        class="delete-button"
      >
        🗑️ Apagar Estação
      </button>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Carregando estação...</p>
    </div>

    <div v-if="errorMessage" class="status-message-internal erro">{{ errorMessage }}</div>
    <div v-if="successMessage" class="status-message-internal sucesso">{{ successMessage }}</div>

    <div v-if="!isLoading && !isAdmin" class="status-message-internal erro">
      Você não tem permissão para editar esta estação.
    </div>

    <div v-if="!isLoading && isAdmin && stationId" class="tab-content">
      <div class="card">
        <h3>Editando Estação ID: {{ stationId }}</h3>
        <form @submit.prevent="saveStationChanges" class="manual-form">
          <h4>Dados Gerais da Estação</h4>
          <div class="form-group">
            <label for="manualIdEstacao">ID da Estação (identificador único para o conteúdo, ex: cardio_iam_001):</label>
            <input type="text" id="manualIdEstacao" v-model="formData.idEstacao" required placeholder="Ex: cardio_iam_001">
          </div>
          <div class="form-group">
            <label for="manualTituloEstacao">Título da Estação (como aparecerá na lista):</label>
            <input type="text" id="manualTituloEstacao" v-model="formData.tituloEstacao" required placeholder="Ex: Atendimento ao Paciente com Dor Torácica Aguda">
          </div>
          
          <div class="form-group">
            <label for="manualNumeroDaEstacao">Número da Estação (para ordenação numérica):</label>
            <input type="number" id="manualNumeroDaEstacao" v-model.number="formData.numeroDaEstacao" required min="1" placeholder="Ex: 1, 2, 10">
          </div>

          <div class="form-group">
            <label for="manualEspecialidade">Especialidade (Área):</label>
            <input type="text" id="manualEspecialidade" v-model="formData.especialidade" required placeholder="Ex: Cardiologia, Clínica Médica">
          </div>
          <div class="form-group">
            <label for="manualTempoDuracaoMinutos">Tempo de Duração (minutos):</label>
            <input type="number" id="manualTempoDuracaoMinutos" v-model.number="formData.tempoDuracaoMinutos" min="1" required>
          </div>
          <div class="form-group">
            <label for="manualPalavrasChave">Palavras-Chave (separadas por vírgula):</label>
            <input type="text" id="manualPalavrasChave" v-model="formData.palavrasChave" placeholder="Ex: infarto, ECG, anamnese, dor precordial">
          </div>
          <div class="form-group">
            <label for="manualNivelDificuldade">Nível de Dificuldade:</label>
            <select id="manualNivelDificuldade" v-model="formData.nivelDificuldade">
              <option>Fácil</option>
              <option>Médio</option>
              <option>Difícil</option>
            </select>
          </div>

          <h4>Instruções para o Participante (Candidato)</h4>
          <div class="form-group">
            <label for="manualDescricaoCaso">Descrição Completa do Caso para o Candidato:</label>
            <textarea id="manualDescricaoCaso" v-model="formData.descricaoCasoCompleta" rows="5" required placeholder="Descreva o cenário clínico que o candidato encontrará..."></textarea>
          </div>
          <div class="form-group">
            <label for="manualTarefasPrincipais">Tarefas Principais do Candidato (uma por linha):</label>
            <textarea id="manualTarefasPrincipais" v-model="formData.tarefasPrincipais" rows="4" required placeholder="Ex: Realizar anamnese completa.&#10;Interpretar o ECG.&#10;Propor conduta inicial."></textarea>
          </div>
          <div class="form-group">
            <label for="manualAvisosImportantes">Avisos Importantes para o Candidato (um por linha, opcional):</label>
            <textarea id="manualAvisosImportantes" v-model="formData.avisosImportantes" rows="3" placeholder="Ex: O paciente simulado pode apresentar instabilidade.&#10;Comunique-se de forma clara e objetiva com o paciente e/ou acompanhante."></textarea>
          </div>

          <h4>Cenário de Atendimento (Visível para o Candidato)</h4>
          <div class="form-group">
            <label for="manualNivelAtencao">Nível de Atenção:</label>
            <input type="text" id="manualNivelAtencao" v-model="formData.cenarioAtendimento_nivelAtencao" placeholder="Ex: atenção primária, secundária, terciária">
          </div>
          <div class="form-group">
            <label for="manualTipoAtendimento">Tipo de Atendimento:</label>
            <input type="text" id="manualTipoAtendimento" v-model="formData.cenarioAtendimento_tipoAtendimento" placeholder="Ex: ambulatorial, emergência, enfermaria">
          </div>
          <div class="form-group">
            <label for="manualInfraestrutura">Infraestrutura da Unidade Disponível (separar por ponto e vírgula ";"):</label>
            <textarea id="manualInfraestrutura" v-model="formData.cenarioAtendimento_infraestruturaUnidade" rows="3" placeholder="Ex: maca; monitor cardíaco; acesso venoso periférico; materiais para intubação"></textarea>
          </div>

          <h4>Roteiro do Ator / Informações Verbais (para o Ator/Avaliador)</h4>
          <div v-for="(info, index) in formData.informacoesVerbaisSimulado" :key="'infoVerbal-'+index" class="dynamic-item-group">
            <h5>Informação Verbal {{ index + 1 }}</h5>
            <div class="form-group">
              <label :for="'infoVerbalContexto' + index">Contexto ou Pergunta-Chave do Candidato:</label>
              <input type="text" :id="'infoVerbalContexto' + index" v-model="info.contextoOuPerguntaChave" placeholder="Ex: Se o candidato perguntar sobre alergias...">
            </div>
            <div class="form-group">
              <label :for="'infoVerbalInformacao' + index">Informação a ser Fornecida pelo Ator:</label>
              <textarea :id="'infoVerbalInformacao' + index" v-model="info.informacao" rows="2" placeholder="Ex: Diga que o paciente é alérgico à penicilina."></textarea>
            </div>
            <button type="button" @click="removerInfoVerbal(index)" class="remove-item-button">Remover Informação Verbal</button>
          </div>
          <button type="button" @click="adicionarInfoVerbal" class="add-item-button">+ Adicionar Informação Verbal</button>

          <h4>Materiais Disponíveis (Impressos a serem liberados pelo Ator/Avaliador)</h4>
          <div v-for="(impresso, index) in formData.impressos" :key="impresso.idImpresso" class="dynamic-item-group">
            <h5>Impresso {{ index + 1 }}</h5>
            <div class="form-group" style="display: none;">
              <label :for="'impressoId' + index">ID do Impresso (único, ex: ecg_inicial):</label>
              <input type="text" :id="'impressoId' + index" v-model="impresso.idImpresso" required>
            </div>
            <div class="form-group">
              <label :for="'impressoTitulo' + index">Título do Impresso (Ex: ECG de 12 Derivações):</label>
              <input type="text" :id="'impressoTitulo' + index" v-model="impresso.tituloImpresso" required>
            </div>
            <div class="form-group">
              <label :for="'impressoTipoConteudo' + index">Tipo de Conteúdo do Impresso:</label>
              <select :id="'impressoTipoConteudo' + index" v-model="impresso.tipoConteudo">
                <option value="texto_simples">Texto Simples</option>
                <option value="imagem_com_texto">Imagem com Texto/Laudo</option>
                <option value="lista_chave_valor_secoes">Lista Chave-Valor (Exames)</option>
              </select>
            </div>

            <div v-if="impresso.tipoConteudo === 'texto_simples'" class="form-group">
              <label :for="'impressoConteudoTexto' + index">Conteúdo (texto):</label>
              <textarea :id="'impressoConteudoTexto' + index" v-model="impresso.conteudo.texto" rows="3" placeholder="Insira o texto do impresso aqui..."></textarea>
            </div>
            <div v-if="impresso.tipoConteudo === 'imagem_com_texto'">
              <div class="form-group">
                <label :for="'impressoConteudoImgDesc' + index">Texto Descritivo (opcional):</label>
                <textarea :id="'impressoConteudoImgDesc' + index" v-model="impresso.conteudo.textoDescritivo" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label :for="'impressoConteudoImgPath' + index">Caminho/URL da Imagem:</label>
                <input type="text" :id="'impressoConteudoImgPath' + index" v-model="impresso.conteudo.caminhoImagem" placeholder="https://exemplo.com/imagem.jpg">
              </div>
              <div class="form-group">
                <label :for="'impressoConteudoImgLaudo' + index">Laudo da Imagem (opcional):</label>
                <textarea :id="'impressoConteudoImgLaudo' + index" v-model="impresso.conteudo.laudo" rows="3"></textarea>
              </div>
            </div>
            <div v-if="impresso.tipoConteudo === 'lista_chave_valor_secoes'">
              <div v-for="(secao, secaoIndex) in impresso.conteudo.secoes" :key="secaoIndex" class="dynamic-item-group-nested">
                <div class="secao-header">
                  <h5>Seção {{ secaoIndex + 1 }}</h5>
                  <button type="button" @click="impresso.conteudo.secoes.splice(secaoIndex, 1)" class="remove-item-button-header">Remover Seção</button>
                </div>
                <div class="form-group">
                  <label :for="'secaoTitulo' + index + '_' + secaoIndex">Título da Seção:</label>
                  <input type="text" :id="'secaoTitulo' + index + '_' + secaoIndex" v-model="secao.tituloSecao" placeholder="Ex: Hemograma">
                </div>
                <div v-for="(itemSecao, itemSecaoIndex) in secao.itens" :key="itemSecaoIndex" class="dynamic-item-group-very-nested">
                  <input type="text" v-model="itemSecao.chave" placeholder="Chave (Ex: Hb)" style="flex-basis: 40%;">
                  <input type="text" v-model="itemSecao.valor" placeholder="Valor (Ex: 12.5 g/dL)" style="flex-basis: 40%;">
                  <button type="button" @click="secao.itens.splice(itemSecaoIndex, 1)" class="remove-item-button-small" style="flex-basis: auto;">X</button>
                </div>
                <button type="button" @click="secao.itens.push({chave: '', valor: ''})" class="add-item-button-small">+ Item na Seção</button>
              </div>
              <button type="button" @click="impresso.conteudo.secoes.push({tituloSecao: '', itens: [{chave:'', valor:''}]})" class="add-item-button">+ Seção no Impresso</button>
            </div>
            <button type="button" @click="removerImpresso(index)" class="remove-item-button">Remover Impresso</button>
          </div>
          <button type="button" @click="adicionarImpresso" class="add-item-button">+ Adicionar Impresso</button>

          <h4>Padrão Esperado de Procedimento (PEP / Checklist para Avaliador)</h4>
          <div class="form-group" style="display: none;">
            <label for="pepIdChecklist">ID do Checklist (Identificador único para este PEP):</label>
            <input type="text" id="pepIdChecklist" v-model="formData.padraoEsperadoProcedimento.idChecklistAssociado" placeholder="Ex: pep_cardio_iam_001">
          </div>
          
          <div class="form-group" style="display: none;">
            <label for="pepResumoCaso">Síntese da Estação - Resumo do Caso Clínico para o PEP:</label>
            <textarea id="pepResumoCaso" v-model="formData.padraoEsperadoProcedimento.sinteseEstacao.resumoCasoPEP" rows="3" placeholder="Breve resumo do caso para orientar o avaliador..."></textarea>
          </div>
          
          <div class="form-group" style="display: none;">
            <label>Síntese da Estação - Foco Principal Detalhado do PEP (um por linha):</label>
            <div v-for="(foco, index) in formData.padraoEsperadoProcedimento.sinteseEstacao.focoPrincipalDetalhado" :key="'focoPep-' + index" class="foco-pep-item">
              <input type="text" v-model="formData.padraoEsperadoProcedimento.sinteseEstacao.focoPrincipalDetalhado[index]" :placeholder="'Foco principal ' + (index + 1) + ' da avaliação...'">
              <button type="button" @click="removerFocoPrincipalPEP(index)" class="remove-item-button-small" title="Remover Foco">X</button>
            </div>
            <button type="button" @click="adicionarFocoPrincipalPEP" class="add-item-button-small">+ Adicionar Foco Principal</button>
          </div>

          <h5>Itens de Avaliação do PEP</h5>
          <div v-for="(item, index) in formData.padraoEsperadoProcedimento.itensAvaliacao" :key="item.idItem" class="dynamic-item-group pep-item">
            <div class="pep-item-header">
              <h6>Item de Avaliação {{ index + 1 }}</h6>
              <div class="pep-controls">
                <div class="position-controls">
                  <label for="'posicaoItem' + index" class="position-label">Posição:</label>
                  <select 
                    :id="'posicaoItem' + index" 
                    :value="index + 1" 
                    @change="moverItemPEPParaPosicao(index, $event.target.value)"
                    class="position-select"
                  >
                    <option v-for="pos in formData.padraoEsperadoProcedimento.itensAvaliacao.length" :key="pos" :value="pos">{{ pos }}</option>
                  </select>
                </div>
                <div class="move-buttons">
                  <button 
                    type="button" 
                    @click="moverItemPEPParaCima(index)" 
                    :disabled="index === 0"
                    class="move-button move-up"
                    title="Mover para cima"
                  >
                    ↑
                  </button>
                  <button 
                    type="button" 
                    @click="moverItemPEPParaBaixo(index)" 
                    :disabled="index === formData.padraoEsperadoProcedimento.itensAvaliacao.length - 1"
                    class="move-button move-down"
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                </div>
                <button type="button" @click="removerItemAvaliacaoPEP(index)" class="remove-item-button-header">Remover Item</button>
              </div>
            </div>
            <div class="form-group" style="display: none;">
              <label :for="'pepItemId' + index">ID do Item (único no checklist, ex: anamnese_dor):</label>
              <input type="text" :id="'pepItemId' + index" v-model="item.idItem" required>
            </div>
            <div class="form-group" style="display: none;">
              <label :for="'pepItemNumero' + index">Número Oficial do Item (Automático - baseado na posição):</label>
              <input type="text" :id="'pepItemNumero' + index" v-model="item.itemNumeroOficial" readonly title="Este valor é atualizado automaticamente com base na posição do item">
            </div>
            <div class="form-group">
              <label :for="'pepItemDescricao' + index">Descrição do Item de Avaliação:</label>
              <textarea :id="'pepItemDescricao' + index" v-model="item.descricaoItem" rows="2" required placeholder="Descreva o que deve ser avaliado..."></textarea>
            </div>
            <fieldset class="pontuacoes-group">
              <legend>Critérios e Pontuações do Item</legend>
              <div>
                <label :for="'pepItemAdequadoCriterio' + index">Critério - Adequado:</label>
                <input type="text" :id="'pepItemAdequadoCriterio' + index" v-model="item.pontuacoes.adequado.criterio" placeholder="Ex: Realizou completamente e corretamente.">
                <label :for="'pepItemAdequadoPontos' + index">Pontos:</label>
                <input type="number" step="0.01" :id="'pepItemAdequadoPontos' + index" v-model.number="item.pontuacoes.adequado.pontos">
              </div>
              <div>
                <label :for="'pepItemParcialCriterio' + index">Critério - Parcialmente Adequado:</label>
                <input type="text" :id="'pepItemParcialCriterio' + index" v-model="item.pontuacoes.parcialmenteAdequado.criterio" placeholder="Ex: Realizou parcialmente ou com pequenas falhas.">
                <label :for="'pepItemParcialPontos' + index">Pontos:</label>
                <input type="number" step="0.01" :id="'pepItemParcialPontos' + index" v-model.number="item.pontuacoes.parcialmenteAdequado.pontos">
              </div>
              <div>
                <label :for="'pepItemInadequadoCriterio' + index">Critério - Inadequado / Não Fez:</label>
                <input type="text" :id="'pepItemInadequadoCriterio' + index" v-model="item.pontuacoes.inadequado.criterio" placeholder="Ex: Não realizou ou realizou incorretamente.">
                <label :for="'pepItemInadequadoPontos' + index">Pontos:</label>
                <input type="number" step="0.01" :id="'pepItemInadequadoPontos' + index" v-model.number="item.pontuacoes.inadequado.pontos">
              </div>
            </fieldset>
          </div>
          <button type="button" @click="adicionarItemAvaliacaoPEP" class="add-item-button">+ Adicionar Item de Avaliação</button>

          <div class="form-group pep-total-score-display">
            <label for="pepPontuacaoTotal">Pontuação Total Máxima da Estação (PEP):</label>
            <input type="number" step="0.01" id="pepPontuacaoTotal" v-model.number="formData.padraoEsperadoProcedimento.pontuacaoTotalEstacao" readonly title="Calculado automaticamente com base nos pontos 'Adequado' de cada item.">
            <span v-if="typeof calcularPontuacaoTotalPEP === 'number'">(Calculado: {{ calcularPontuacaoTotalPEP.toFixed(2) }})</span>
            <span v-else>(Calculado: N/A)</span>
          </div>

          <button type="submit" :disabled="isSaving" class="save-manual-button">
            <span v-if="isSaving">Salvando Alterações...</span>
            <span v-else>Salvar Alterações da Estação</span>
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Dialog para escolher posição do novo item -->
  <div v-if="showPositionDialog" class="dialog-overlay" @click="cancelarAdicaoItem">
    <div class="dialog-content" @click.stop>
      <h3>Escolher Posição do Novo Item</h3>
      <p>Onde você deseja inserir o novo item de avaliação?</p>
      
      <div class="position-options">
        <div v-for="(item, index) in formData.padraoEsperadoProcedimento.itensAvaliacao" :key="'pos-' + index" class="position-option">
          <button 
            type="button" 
            @click="adicionarItemNaPosicao(index + 1)"
            class="position-button"
          >
            Posição {{ index + 1 }} (antes de: "{{ item.descricaoItem || 'Item ' + (index + 1) }}")
          </button>
        </div>
        
        <button 
          type="button" 
          @click="adicionarItemNaPosicao('fim')"
          class="position-button position-end"
        >
          No final (Posição {{ formData.padraoEsperadoProcedimento.itensAvaliacao.length + 1 }})
        </button>
      </div>
      
      <div class="dialog-actions">
        <button type="button" @click="cancelarAdicaoItem" class="cancel-button">Cancelar</button>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.admin-upload-page { 
  max-width: 950px; 
  margin: 20px auto; 
  padding: 20px; 
  font-family: 'Inter', sans-serif; 
}

.admin-upload-page h2 { 
  text-align: center; 
  color: #2c3e50; 
  margin-bottom: 25px; 
  font-weight: 600; 
}

.loading-container {
  text-align: center;
  padding: 40px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.back-button, .delete-button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.back-button {
  background-color: #6c757d;
  color: white;
}

.back-button:hover {
  background-color: #5a6268;
}

.delete-button {
  background-color: #dc3545;
  color: white;
}

.delete-button:hover:not(:disabled) {
  background-color: #c82333;
}

.delete-button:disabled {
  background-color: #adb5bd;
  cursor: not-allowed;
}

.tab-content .card { 
  background-color: #ffffff; 
  padding: 30px; 
  border: 1px solid #e0e0e0; 
  border-radius: 8px; 
  box-shadow: 0 4px 12px rgba(0,0,0,0.08); 
}

.tab-content .card h3 { 
  margin-top: 0; 
  color: #0056b3; 
  border-bottom: 1px solid #eaeaea; 
  padding-bottom: 12px; 
  margin-bottom: 25px; 
  font-weight: 600; 
}

.manual-form .form-group { 
  margin-bottom: 20px; 
}

.manual-form label { 
  display: block; 
  margin-bottom: 6px; 
  font-weight: 500; 
  color: #34495e; 
  font-size: 0.95em; 
}

.manual-form input[type="text"],
.manual-form input[type="number"],
.manual-form select,
.manual-form textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 1em;
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.manual-form input[type="text"]:focus,
.manual-form input[type="number"]:focus,
.manual-form select:focus,
.manual-form textarea:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
  outline: none;
}

.manual-form textarea { 
  resize: vertical; 
  min-height: 80px; 
}

.manual-form h4 { 
  margin-top: 35px; 
  margin-bottom: 20px; 
  color: #0056b3; 
  border-bottom: 1px solid #e0e0e0; 
  padding-bottom: 10px; 
  font-weight: 600; 
  font-size: 1.2em; 
}

.manual-form h5 { 
  margin-top: 25px; 
  margin-bottom: 15px; 
  color: #17a2b8; 
  font-weight: 500; 
  font-size: 1.1em; 
}

.manual-form h6 { 
  margin-top: 18px; 
  margin-bottom: 12px; 
  color: #28a745; 
  font-weight: 500; 
  font-size: 1.05em;
}

.dynamic-item-group {
  background-color: #f9f9f9;
  border: 1px solid #e7e7e7;
  border-left: 4px solid #6c757d;
  border-radius: 5px;
  padding: 20px;
  margin-bottom: 25px;
  position: relative;
}

.dynamic-item-group h5, .dynamic-item-group h6 { 
  margin-top: 0; 
}

.dynamic-item-group-nested {
  background-color: #f0f0f0;
  border: 1px solid #d0d0d0;
  border-left: 3px solid #17a2b8;
  padding: 15px;
  margin-top: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.dynamic-item-group-very-nested {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 5px;
  padding-left: 10px;
}

.dynamic-item-group-very-nested input[type="text"] {
  flex-grow: 1;
}

.pep-item { 
  border-left-color: #28a745; 
}

.foco-pep-item { 
  display: flex; 
  align-items: center; 
  margin-bottom: 8px; 
}

.foco-pep-item input[type="text"] { 
  flex-grow: 1; 
  margin-right: 8px; 
}

.add-item-button, .remove-item-button {
  border: none; 
  padding: 8px 15px; 
  border-radius: 4px; 
  cursor: pointer; 
  font-size: 0.9em; 
  margin-top: 10px; 
  transition: background-color 0.2s, transform 0.1s;
  font-weight: 500;
}

.add-item-button { 
  background-color: #007bff; 
  color: white; 
  margin-bottom: 20px; 
  display: inline-block; 
}

.remove-item-button { 
  background-color: #dc3545; 
  color: white; 
}

.dynamic-item-group > .remove-item-button {
  position: absolute;
  top: 15px;
  right: 15px;
  margin-top: 0;
  padding: 6px 10px;
}

.add-item-button:hover:not(:disabled) { 
  background-color: #0056b3; 
  transform: translateY(-1px); 
}

.remove-item-button:hover:not(:disabled) { 
  background-color: #c82333; 
  transform: translateY(-1px); 
}

.add-item-button-small, .remove-item-button-small {
  padding: 5px 10px; 
  font-size: 0.85em; 
  margin-left: 8px; 
  border-radius: 3px;
  border: none; 
  color: white; 
  cursor: pointer;
}

.add-item-button-small { 
  background-color: #5cb85c; 
}

.remove-item-button-small { 
  background-color: #fd7e14; 
}

.add-item-button-small:hover { 
  background-color: #4cae4c;
}

.remove-item-button-small:hover { 
  background-color: #e6690b;
}

.pontuacoes-group { 
  border: 1px solid #ced4da; 
  padding: 15px; 
  margin-top:15px; 
  border-radius: 4px; 
  background-color: #fff; 
}

.pontuacoes-group legend { 
  font-size: 1em; 
  font-weight: 500; 
  padding: 0 8px; 
  color: #495057; 
  margin-bottom: 10px;
}

.pontuacoes-group > div { 
  margin-bottom: 12px; 
  display: grid; 
  grid-template-columns: auto 1fr auto 80px; 
  gap: 8px 12px; 
  align-items: center;
}

.pontuacoes-group > div > label:first-child { 
  font-weight:normal; 
  font-size:0.9em; 
  color: #495057;
}

.pontuacoes-group > div > label:nth-of-type(2) { 
  font-weight:normal; 
  font-size:0.9em; 
  justify-self: end; 
  color: #495057;
}

.pontuacoes-group input[type="text"], .pontuacoes-group input[type="number"] { 
  font-size: 0.95em; 
  padding: 8px 10px;
}

.pep-total-score-display { 
  margin-top: 20px; 
  padding-top:15px; 
  border-top: 1px solid #eee;
}

.pep-total-score-display label { 
  font-weight: 600; 
}

.pep-total-score-display input[type="number"] { 
  background-color: #e9ecef; 
  cursor: not-allowed; 
  width: auto; 
  display: inline-block; 
  max-width:100px; 
  margin-right: 10px;
}

.pep-total-score-display span { 
  font-size: 0.9em; 
  color: #495057;
}

.save-manual-button { 
  display: block; 
  width: 100%; 
  padding: 14px; 
  font-size: 1.15em; 
  font-weight: 600; 
  color: white; 
  background-color: #17a2b8; 
  border: none; 
  border-radius: 5px; 
  cursor: pointer; 
  margin-top: 30px; 
  transition: background-color 0.2s, transform 0.1s; 
}

.save-manual-button:hover:not(:disabled) { 
  background-color: #138496; 
  transform: translateY(-1px); 
}

.save-manual-button:disabled { 
  background-color: #adb5bd; 
  cursor: not-allowed; 
}

.status-message-internal { 
  margin-top: 20px; 
  padding: 15px; 
  border-radius: 5px; 
  font-weight: 500; 
  border: 1px solid transparent; 
  line-height: 1.5;
}

.status-message-internal.info { 
  background-color: #e6f7ff; 
  color: #005f87; 
  border-color: #91d5ff; 
}

.status-message-internal.sucesso { 
  background-color: #f6ffed; 
  color: #389e0d; 
  border-color: #b7eb8f; 
}

.status-message-internal.erro { 
  background-color: #fff1f0; 
  color: #cf1322; 
  border-color: #ffa39e; 
}

/* Estilos para controles de reordenação */
.pep-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e9ecef;
}

.pep-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.position-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.position-label {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  color: #495057;
}

.position-select {
  padding: 5px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
  min-width: 60px;
}

.position-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.move-buttons {
  display: flex;
  gap: 5px;
}

.move-button {
  width: 32px;
  height: 32px;
  border: 1px solid #dee2e6;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.move-button:hover:not(:disabled) {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.move-button:disabled {
  background-color: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
  opacity: 0.5;
}

.move-button.move-up {
  color: #28a745;
}

.move-button.move-down {
  color: #dc3545;
}

/* Estilos para o dialog de posição */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background-color: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.dialog-content h3 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 20px;
}

.dialog-content p {
  margin: 0 0 20px 0;
  color: #6c757d;
}

.position-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.position-option {
  width: 100%;
}

.position-button {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  background-color: #f8f9fa;
  border-radius: 6px;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.position-button:hover {
  background-color: #e9ecef;
  border-color: #007bff;
}

.position-button.position-end {
  background-color: #e3f2fd;
  border-color: #2196f3;
  color: #1976d2;
  font-weight: 500;
}

.position-button.position-end:hover {
  background-color: #bbdefb;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #dee2e6;
}

.cancel-button {
  padding: 8px 16px;
  border: 1px solid #6c757d;
  background-color: transparent;
  color: #6c757d;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.cancel-button:hover {
  background-color: #6c757d;
  color: white;
}

/* Estilos para header das seções */
.secao-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.secao-header h5 {
  margin: 0;
  color: #495057;
  font-weight: 600;
}

.remove-item-button-header {
  padding: 6px 12px;
  border: 1px solid #dc3545;
  background-color: #dc3545;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-item-button-header:hover {
  background-color: #c82333;
  border-color: #bd2130;
  transform: translateY(-1px);
}

.remove-item-button-header:active {
  transform: translateY(0);
}
</style>
