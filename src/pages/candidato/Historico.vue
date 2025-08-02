<template>
  <VRow>
    <VCol cols="12">
      <VCard title="Histórico de Simulações Realizadas">
        <VCardText>
          <p class="text-body-1 mb-4">Visualize todas as simulações que você já realizou, com detalhes sobre a data, pontuação e status.</p>

          <!-- Loading State -->
          <div v-if="loading" class="d-flex justify-center align-center pa-8">
            <VProgressCircular indeterminate color="primary" size="64" />
            <span class="ml-4 text-h6">Carregando histórico...</span>
          </div>

          <!-- Content -->
          <div v-else>
            <VTable class="text-no-wrap">
            <thead>
              <tr>
                <th class="text-uppercase">Data</th>
                <th class="text-uppercase">Tipo de Simulação</th>
                <th class="text-uppercase">Pontuação</th>
                <th class="text-uppercase">Status</th>
                <th class="text-uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="simulation in simulations"
                :key="simulation.id"
              >
                <td>{{ simulation.date }}</td>
                <td>{{ simulation.type }}</td>
                <td>
                  <VChip
                    :color="getScoreColor(simulation.score)"
                    size="small"
                    class="font-weight-medium"
                  >
                    {{ simulation.score }}
                  </VChip>
                </td>
                <td>
                  <VChip
                    :color="getStatusColor(simulation.status)"
                    size="small"
                    class="text-capitalize"
                  >
                    {{ simulation.status }}
                  </VChip>
                </td>
                <td>
                  <VBtn
                    icon
                    variant="text"
                    size="small"
                    color="medium-emphasis"
                    @click="viewSimulationDetails(simulation.id)"
                  >
                    <VIcon icon="ri-eye-line" />
                  </VBtn>
                </td>
              </tr>
            </tbody>
          </VTable>

          <VAlert
            v-if="simulations.length === 0"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            Nenhuma simulação encontrada. Comece uma nova simulação para ver seu histórico aqui!
          </VAlert>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<script setup>
import { currentUser } from '@/plugins/auth';
import { db } from '@/plugins/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { computed, onMounted, ref, watch } from 'vue';

const loading = ref(true);
const simulations = ref([]);

// Mapeamento de especialidades
const especialidadeNomes = {
  'clinica-medica': 'Clínica Médica',
  'cirurgia': 'Cirurgia Geral',
  'pediatria': 'Pediatria',
  'ginecologia-obstetricia': 'Ginecologia e Obstetrícia',
  'medicina-preventiva': 'Medicina Preventiva',
};

// Função para formatar data
const formatDate = (timestamp) => {
  if (!timestamp) return 'Data não disponível';
  
  try {
    let date;
    if (timestamp.toDate) {
      // Firestore Timestamp
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      // String ou número
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('pt-BR');
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return 'Data inválida';
  }
};

// Carregar histórico de simulações
const loadSimulationHistory = async () => {
  if (!currentUser.value?.uid) {
    loading.value = false;
    return;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'usuarios', currentUser.value.uid));
    if (!userDoc.exists()) {
      loading.value = false;
      return;
    }
    
    const userData = userDoc.data();
    const simulationsList = [];
    
    // Processar estações concluídas
    if (userData.estacoesConcluidas?.length) {
      for (const estacao of userData.estacoesConcluidas) {
        try {
          // Buscar informações da estação
          let estacaoInfo = null;
          if (estacao.estacaoId) {
            const estacaoDoc = await getDoc(doc(db, 'estacoes_clinicas', estacao.estacaoId));
            estacaoInfo = estacaoDoc.exists() ? estacaoDoc.data() : null;
          }
          
          const simulationEntry = {
            id: estacao.estacaoId || `sim_${Date.now()}_${Math.random()}`,
            date: formatDate(estacao.timestamp || estacao.dataRealizacao),
            type: estacaoInfo?.especialidade ? 
              (especialidadeNomes[estacaoInfo.especialidade] || estacaoInfo.especialidade) : 
              'Simulação Geral',
            score: estacao.nota || 0,
            status: 'Concluída',
            estacaoNome: estacaoInfo?.nome || 'Estação Clínica',
            duracao: estacao.duracao || null,
            tentativas: estacao.tentativas || 1
          };
          
          simulationsList.push(simulationEntry);
        } catch (error) {
          // Silencioso - removido log de erro para reduzir poluição do console
        }
      }
    }
    
    // Ordenar por data (mais recente primeiro)
    simulationsList.sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      return dateB - dateA;
    });
    
    simulations.value = simulationsList;
    
  } catch (error) {
    // Silencioso - removido log de erro para reduzir poluição do console
  } finally {
    loading.value = false;
  }
};

const getScoreColor = (score) => {
  if (score >= 8) return 'success';
  if (score >= 6) return 'warning';
  return 'error';
};

const getStatusColor = (status) => {
  if (status === 'Concluída') return 'success';
  if (status === 'Em Andamento') return 'info';
  return 'error'; // Para status como 'Cancelada' ou 'Falha'
};

const viewSimulationDetails = (id) => {
  // Lógica para navegar para os detalhes da simulação
  console.log(`Visualizar detalhes da simulação ${id}`);
  // Exemplo: router.push({ name: 'simulation-view', params: { id: id } });
};

// Lifecycle hooks
onMounted(() => {
  loadSimulationHistory();
});

// Watch para mudanças no usuário
watch(currentUser, (newUser) => {
  if (newUser?.uid) {
    loadSimulationHistory();
  }
}, { immediate: false });
</script>
