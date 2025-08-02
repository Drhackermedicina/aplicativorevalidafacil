<template>
  <VRow>
    <VCol cols="12">
      <VCard title="Estatísticas de Desempenho do Candidato">
        <VCardText>
          <p class="text-body-1 mb-4">Analise seu desempenho em diversas áreas e identifique pontos de melhoria.</p>

          <!-- Loading State -->
          <div v-if="loading" class="d-flex justify-center align-center pa-8">
            <VProgressCircular indeterminate color="primary" size="64" />
            <span class="ml-4 text-h6">Carregando estatísticas...</span>
          </div>

          <!-- Content -->
          <div v-else>
            <VRow>
            <VCol cols="12" md="6">
              <VCard class="mb-4">
                <VCardTitle class="d-flex align-center gap-2">
                  <VIcon icon="ri-line-chart-line" color="primary" size="24" />
                  <span class="text-h6 font-weight-bold">Pontuação Média por Simulação</span>
                </VCardTitle>
                <VCardText>
                  <VueApexCharts
                    type="radialBar"
                    height="200"
                    :options="averageScoreChartOptions"
                    :series="[averageScore]"
                  />
                  <p class="text-caption text-medium-emphasis text-center mt-n4">Sua média nas últimas simulações.</p>
                </VCardText>
              </VCard>
            </VCol>

            <VCol cols="12" md="6">
              <VCard class="mb-4">
                <VCardTitle class="d-flex align-center gap-2">
                  <VIcon icon="ri-medal-line" color="warning" size="24" />
                  <span class="text-h6 font-weight-bold">Melhor Pontuação</span>
                </VCardTitle>
                <VCardText>
                  <VueApexCharts
                    type="radialBar"
                    height="200"
                    :options="bestScoreChartOptions"
                    :series="[bestScore]"
                  />
                  <p class="text-caption text-medium-emphasis text-center mt-n4">Sua maior pontuação em uma única simulação.</p>
                </VCardText>
              </VCard>
            </VCol>
          </VRow>

          <VDivider class="my-6" />

          <h3 class="text-h6 mb-4">Desempenho por Área</h3>
          <VueApexCharts
            type="bar"
            height="350"
            :options="performanceByAreaChartOptions"
            :series="performanceByAreaSeries"
          />
          <p class="text-caption text-medium-emphasis text-center mt-4">Desempenho detalhado em cada área de conhecimento.</p>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<script setup>
import { currentUser } from '@/plugins/auth';
import { db } from '@/plugins/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { computed, onMounted, ref, watch } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import { useTheme } from 'vuetify';

const vuetifyTheme = useTheme();
const loading = ref(true);

const averageScore = ref(0);
const bestScore = ref(0);
const performanceByArea = ref([]);

// Mapeamento de especialidades
const especialidadeNomes = {
  'clinica-medica': 'Clínica Médica',
  'cirurgia': 'Cirurgia Geral',
  'pediatria': 'Pediatria',
  'ginecologia-obstetricia': 'Ginecologia e Obstetrícia',
  'medicina-preventiva': 'Medicina Preventiva',
};

// Carregar estatísticas reais do usuário
const loadUserStatistics = async () => {
  if (!currentUser.value?.uid) {
    loading.value = false;
    return;
  }
  
  try {
    console.log('📊 Carregando estatísticas do usuário:', currentUser.value.uid);
    
    const userDoc = await getDoc(doc(db, 'usuarios', currentUser.value.uid));
    if (!userDoc.exists()) {
      console.log('❌ Documento do usuário não encontrado');
      loading.value = false;
      return;
    }
    
    const userData = userDoc.data();
    console.log('📈 Dados do usuário carregados:', userData);
    
    // Média geral baseada no nível de habilidade
    if (userData.nivelHabilidade !== undefined) {
      averageScore.value = Math.round(userData.nivelHabilidade * 10); // Converter para escala 0-100
    }
    
    // Melhor pontuação das estações concluídas
    if (userData.estacoesConcluidas?.length) {
      const notas = userData.estacoesConcluidas.map(estacao => estacao.nota || 0);
      bestScore.value = Math.max(...notas);
      console.log('🏆 Melhor pontuação encontrada:', bestScore.value);
    }
    
    // Performance por área baseada em statistics
    const areasData = [];
    
    if (userData.statistics) {
      Object.entries(userData.statistics).forEach(([especialidade, dados]) => {
        if (especialidade !== 'geral' && especialidadeNomes[especialidade]) {
          const mediaNotas = dados.mediaNotas || 0;
          const score = Math.round(mediaNotas * 10); // Converter para escala 0-100
          
          areasData.push({
            name: especialidadeNomes[especialidade],
            description: `Desempenho em ${especialidadeNomes[especialidade].toLowerCase()}`,
            score: Math.min(score, 100) // Garantir que não passe de 100
          });
        }
      });
    }
    
    // Se não há statistics, criar áreas padrão com score 0
    if (areasData.length === 0) {
      Object.entries(especialidadeNomes).forEach(([slug, nome]) => {
        areasData.push({
          name: nome,
          description: `Desempenho em ${nome.toLowerCase()}`,
          score: 0
        });
      });
    }
    
    performanceByArea.value = areasData;
    
    console.log('✅ Estatísticas processadas:', {
      averageScore: averageScore.value,
      bestScore: bestScore.value,
      performanceByArea: performanceByArea.value
    });
    
  } catch (error) {
    console.error('❌ Erro ao carregar estatísticas:', error);
  } finally {
    loading.value = false;
  }
};

// Opções para o gráfico de Pontuação Média
const averageScoreChartOptions = computed(() => ({
  chart: {
    type: 'radialBar',
    sparkline: {
      enabled: true,
    },
  },
  plotOptions: {
    radialBar: {
      hollow: {
        size: '50%',
      },
      dataLabels: {
        name: {
          show: false,
        },
        value: {
          offsetY: 5,
          fontSize: '22px',
          fontWeight: 600,
          formatter: (val) => `${val}%`,
        },
      },
    },
  },
  stroke: {
    lineCap: 'round',
  },
  colors: [vuetifyTheme.current.value.colors.success],
  labels: ['Média'],
}));

// Opções para o gráfico de Melhor Pontuação
const bestScoreChartOptions = computed(() => ({
  chart: {
    type: 'radialBar',
    sparkline: {
      enabled: true,
    },
  },
  plotOptions: {
    radialBar: {
      hollow: {
        size: '50%',
      },
      dataLabels: {
        name: {
          show: false,
        },
        value: {
          offsetY: 5,
          fontSize: '22px',
          fontWeight: 600,
          formatter: (val) => `${val}%`,
        },
      },
    },
  },
  stroke: {
    lineCap: 'round',
  },
  colors: [vuetifyTheme.current.value.colors.warning],
  labels: ['Melhor'],
}));

// Opções e séries para o gráfico de Desempenho por Área (Barra)
const performanceByAreaChartOptions = computed(() => ({
  chart: {
    type: 'bar',
    toolbar: {
      show: false,
    },
  },
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 5,
      dataLabels: {
        position: 'top',
      },
    },
  },
  dataLabels: {
    enabled: true,
    formatter: (val) => `${val}%`,
    offsetX: 30,
    style: {
      fontSize: '12px',
      colors: [vuetifyTheme.current.value.colors.onSurface],
    },
  },
  xaxis: {
    categories: performanceByArea.value.map(area => area.name),
    max: 100,
    labels: {
      formatter: (val) => `${val}%`,
      style: {
        colors: vuetifyTheme.current.value.colors.onSurface,
      },
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: vuetifyTheme.current.value.colors.onSurface,
      },
    },
  },
  grid: {
    show: false,
  },
  colors: [vuetifyTheme.current.value.colors.info],
  tooltip: {
    y: {
      formatter: (val) => `${val}%`,
    },
  },
}));

const performanceByAreaSeries = computed(() => [
  {
    name: 'Pontuação',
    data: performanceByArea.value.map(area => area.score),
  },
]);

// Lifecycle hooks
onMounted(() => {
  loadUserStatistics();
});

// Watch para mudanças no usuário
watch(currentUser, (newUser) => {
  if (newUser?.uid) {
    loadUserStatistics();
  }
}, { immediate: false });
</script>
