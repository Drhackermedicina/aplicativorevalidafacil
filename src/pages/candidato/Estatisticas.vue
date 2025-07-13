<template>
  <VRow>
    <VCol cols="12">
      <VCard title="Estatísticas de Desempenho do Candidato">
        <VCardText>
          <p class="text-body-1 mb-4">Analise seu desempenho em diversas áreas e identifique pontos de melhoria.</p>

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
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<script setup>
import { computed, ref } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import { useTheme } from 'vuetify';

const vuetifyTheme = useTheme();

const averageScore = ref(78); // Exemplo de pontuação média
const bestScore = ref(92); // Exemplo de melhor pontuação

const performanceByArea = ref([
  { name: 'Clínica Médica', description: 'Desempenho em casos de clínica médica.', score: 85 },
  { name: 'Cirurgia Geral', description: 'Desempenho em procedimentos cirúrgicos.', score: 70 },
  { name: 'Pediatria', description: 'Desempenho em casos pediátricos.', score: 60 },
  { name: 'Ginecologia e Obstetrícia', description: 'Desempenho em saúde da mulher.', score: 90 },
  { name: 'Medicina Preventiva', description: 'Desempenho em saúde pública e prevenção.', score: 50 },
]);

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
</script>
