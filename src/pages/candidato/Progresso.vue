<template>
  <VRow>
    <VCol cols="12">
      <VCard title="Progresso do Candidato">
        <VCardText>
          <p class="text-body-1 mb-4">Acompanhe seu progresso geral e o avanço em cada módulo de estudo.</p>

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
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<script setup>
import { ref } from 'vue';

const overallProgress = ref(75) // Exemplo de progresso geral

const modules = ref([
  { name: 'Módulo 1: Clínica Médica', description: 'Revisão de casos clínicos e diretrizes.', progress: 90 },
  { name: 'Módulo 2: Cirurgia Geral', description: 'Procedimentos cirúrgicos e manejo pós-operatório.', progress: 60 },
  { name: 'Módulo 3: Pediatria', description: 'Desenvolvimento infantil e doenças comuns.', progress: 45 },
  { name: 'Módulo 4: Ginecologia e Obstetrícia', description: 'Saúde da mulher e acompanhamento gestacional.', progress: 80 },
  { name: 'Módulo 5: Medicina Preventiva', description: 'Epidemiologia e saúde pública.', progress: 20 },
])
</script>
