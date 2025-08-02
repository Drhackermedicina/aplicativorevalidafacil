<template>
  <VRow>
    <VCol cols="12">
      <VCard title="Progresso do Candidato">
        <VCardText>
          <p class="text-body-1 mb-4">Acompanhe seu progresso geral e o avanço em cada módulo de estudo.</p>

          <!-- Loading state -->
          <div v-if="loading" class="text-center py-8">
            <VProgressCircular indeterminate color="primary" size="48" />
            <p class="text-body-2 mt-4">Carregando seu progresso...</p>
          </div>

          <!-- Content when loaded -->
          <div v-else>
            <h3 class="text-h6 mb-2">Progresso Geral</h3>
            <VProgressLinear
              v-model="overallProgress"
              color="primary"
              height="20"
              rounded
              class="mb-4"
            >
              <template #default="{ value }">
                <strong>{{ Math.ceil(value) }}%</strong>
              </template>
            </VProgressLinear>
            <p class="text-caption text-medium-emphasis">Seu progresso é calculado com base nas simulações e módulos concluídos.</p>

            <VDivider class="my-6" />

            <h3 class="text-h6 mb-4">Progresso por Módulo</h3>
            <VList>
              <VListItem
                v-for="module in modules"
                :key="module.name"
                class="mb-4"
              >
                <VListItemTitle class="font-weight-medium">{{ module.name }}</VListItemTitle>
                <VListItemSubtitle class="text-caption">{{ module.description }}</VListItemSubtitle>
                <VProgressLinear
                  :model-value="module.progress"
                  color="info"
                  height="10"
                  rounded
                  class="mt-2"
                >
                  <template #default="{ value }">
                    <span class="text-caption font-weight-bold">{{ Math.ceil(value) }}%</span>
                  </template>
                </VProgressLinear>
              </VListItem>
            </VList>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<script setup>
import { currentUser } from '@/plugins/auth';
import { db } from '@/plugins/firebase';
import { collection, doc, getDoc, getDocs, query } from 'firebase/firestore';
import { computed, onMounted, ref, watch } from 'vue';

const overallProgress = ref(0);
const modules = ref([]);
const loading = ref(true);

// Especialidades mapeadas para módulos
const especialidadeModulos = {
  'clinica-medica': { nome: 'Clínica Médica', descricao: 'Revisão de casos clínicos e diretrizes.' },
  'cirurgia': { nome: 'Cirurgia Geral', descricao: 'Procedimentos cirúrgicos e manejo pós-operatório.' },
  'pediatria': { nome: 'Pediatria', descricao: 'Desenvolvimento infantil e doenças comuns.' },
  'ginecologia-obstetricia': { nome: 'Ginecologia e Obstetrícia', descricao: 'Saúde da mulher e acompanhamento gestacional.' },
  'medicina-preventiva': { nome: 'Medicina Preventiva', descricao: 'Epidemiologia e saúde pública.' },
};

// Carregar dados reais do usuário
const loadUserProgress = async () => {
  if (!currentUser.value?.uid) {
    loading.value = false;
    return;
  }
  
  try {
    console.log('🔍 Carregando progresso do usuário:', currentUser.value.uid);
    
    // Buscar dados do usuário
    const userDoc = await getDoc(doc(db, 'usuarios', currentUser.value.uid));
    if (!userDoc.exists()) {
      console.log('❌ Documento do usuário não encontrado');
      loading.value = false;
      return;
    }
    
    const userData = userDoc.data();
    console.log('📊 Dados do usuário carregados:', userData);
    
    // Buscar total de estações disponíveis
    const estacoesSnapshot = await getDocs(collection(db, 'estacoes_clinicas'));
    const totalEstacoes = estacoesSnapshot.size;
    console.log('📈 Total de estações disponíveis:', totalEstacoes);
    
    // Calcular progresso geral baseado em estações concluídas
    const estacoesConcluidas = userData.estacoesConcluidas?.length || 0;
    overallProgress.value = totalEstacoes > 0 ? (estacoesConcluidas / totalEstacoes) * 100 : 0;
    
    console.log('✅ Progresso geral calculado:', {
      estacoesConcluidas,
      totalEstacoes,
      progresso: overallProgress.value
    });
    
    // Processar módulos baseado em statistics
    const modulosData = [];
    
    if (userData.statistics) {
      // Contar estações por especialidade
      const estacoesPorEspecialidade = {};
      estacoesSnapshot.docs.forEach(doc => {
        const estacao = doc.data();
        const area = estacao.area?.slug || 'outros';
        estacoesPorEspecialidade[area] = (estacoesPorEspecialidade[area] || 0) + 1;
      });
      
      console.log('📊 Estações por especialidade:', estacoesPorEspecialidade);
      
      // Criar módulos baseado nas statistics e especialidades mapeadas
      Object.entries(userData.statistics).forEach(([especialidade, dados]) => {
        if (especialidade !== 'geral' && especialidadeModulos[especialidade]) {
          const totalEstacoesEspecialidade = estacoesPorEspecialidade[especialidade] || 10;
          const concluidasEspecialidade = dados.concluidas || 0;
          const progressoEspecialidade = totalEstacoesEspecialidade > 0 
            ? (concluidasEspecialidade / totalEstacoesEspecialidade) * 100 
            : 0;
          
          modulosData.push({
            name: `Módulo: ${especialidadeModulos[especialidade].nome}`,
            description: especialidadeModulos[especialidade].descricao,
            progress: Math.min(progressoEspecialidade, 100) // Garantir que não passe de 100%
          });
        }
      });
    }
    
    // Se não há statistics, criar módulos baseado nas especialidades padrão
    if (modulosData.length === 0) {
      Object.entries(especialidadeModulos).forEach(([slug, info]) => {
        modulosData.push({
          name: `Módulo: ${info.nome}`,
          description: info.descricao,
          progress: 0
        });
      });
    }
    
    modules.value = modulosData;
    console.log('🎯 Módulos processados:', modules.value);
    
  } catch (error) {
    console.error('❌ Erro ao carregar progresso:', error);
  } finally {
    loading.value = false;
  }
};

// Watch para recarregar quando o usuário mudar
watch(currentUser, (newUser) => {
  if (newUser) {
    loadUserProgress();
  }
}, { immediate: true });

onMounted(() => {
  if (currentUser.value) {
    loadUserProgress();
  }
});
</script>
