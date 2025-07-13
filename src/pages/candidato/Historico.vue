<template>
  <VRow>
    <VCol cols="12">
      <VCard title="Histórico de Simulações Realizadas">
        <VCardText>
          <p class="text-body-1 mb-4">Visualize todas as simulações que você já realizou, com detalhes sobre a data, pontuação e status.</p>

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
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<script setup>
import { ref } from 'vue';

const simulations = ref([
  { id: 1, date: '2024-06-01', type: 'Clínica Médica', score: 85, status: 'Concluída' },
  { id: 2, date: '2024-05-20', type: 'Cirurgia Geral', score: 70, status: 'Concluída' },
  { id: 3, date: '2024-05-10', type: 'Pediatria', score: 60, status: 'Concluída' },
  { id: 4, date: '2024-04-25', type: 'Ginecologia e Obstetrícia', score: 90, status: 'Concluída' },
  { id: 5, date: '2024-04-15', type: 'Medicina Preventiva', score: 50, status: 'Concluída' },
  { id: 6, date: '2024-03-30', type: 'Clínica Médica', score: 78, status: 'Concluída' },
]);

const getScoreColor = (score) => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
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
</script>
