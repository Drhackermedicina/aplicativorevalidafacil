<template>
  <div class="ranking-view">
    <v-container>
      <v-row>
        <!-- Top 3 Cards -->
        <v-col cols="12">
          <div class="top3-row d-flex flex-wrap justify-center mb-6 animate-fade-in">
            <div v-for="(usuario, idx) in top3" :key="usuario.id" :class="['top3-card', `top${idx+1}`]">
              <v-avatar :size="90" :color="obterCorRanking(idx+1)" class="top3-avatar elevation-6">
                <v-icon v-if="idx === 0" color="#ffd600" size="48">mdi-trophy</v-icon>
                <v-icon v-else-if="idx === 1" color="#bdbdbd" size="48">mdi-trophy</v-icon>
                <v-icon v-else-if="idx === 2" color="#ff9800" size="48">mdi-trophy</v-icon>
                <span v-else>{{ idx+1 }}</span>
              </v-avatar>
              <div class="top3-nome">{{ usuario.nome }} {{ usuario.sobrenome }}</div>
              <div class="top3-pontos">{{ parseInt(usuario.pontos) || 0 }} pts</div>
              <div class="top3-cidade">{{ usuario.cidade }}</div>
            </div>
          </div>
        </v-col>
        <!-- Seu ranking -->
        <v-col cols="12">
          <v-card elevation="2" class="mb-6 meu-ranking animate-fade-in">
            <v-card-title class="text-h5 d-flex align-center justify-space-between">
              <span>Seu ranking</span>
              <v-btn color="primary" variant="tonal" @click="$router.push('/app/dashboard')" prepend-icon="mdi-arrow-left">
                Voltar ao Dashboard
              </v-btn>
            </v-card-title>
            <v-card-text>
              <div class="d-flex flex-wrap align-center justify-space-between">
                <v-avatar size="70" :color="obterCorRanking(meuRanking?.posicao || 999)" class="white--text mb-2">
                  {{ meuRanking?.posicao || '?' }}
                </v-avatar>
                <div class="flex-grow-1 ms-4">
                  <div class="text-h6">{{ meuRanking?.nome || 'Seu nome' }}</div>
                  <div class="font-weight-bold">{{ parseInt(meuRanking?.pontos) || 0 }} pontos</div>
                  <div class="d-flex gap-4 mt-2">
                    <span><b>Estações:</b> {{ meuRanking?.estacoesConcluidas || 0 }}</span>
                    <span><b>Média:</b> {{ formatarNota(meuRanking?.mediaNota) }}</span>
                    <span><b>Nível:</b> {{ formatarNivel(meuRanking?.nivelHabilidade) }}</span>
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <!-- Busca -->
        <v-col cols="12">
          <v-text-field
            v-model="buscaNome"
            label="Buscar por nome"
            prepend-inner-icon="mdi-magnify"
            class="mb-4"
            clearable
            hide-details
            dense
          />
        </v-col>
        <!-- Tabela Ranking -->
        <v-col cols="12">
          <v-card elevation="2" class="ranking-table animate-fade-in">
            <v-card-text>
              <v-alert v-if="loading" type="info" text>
                Carregando dados do ranking...
              </v-alert>
              <v-alert v-if="error" type="error" text>
                {{ error }}
              </v-alert>
              <v-table v-if="!loading && !error">
                <thead>
                  <tr>
                    <th class="text-center">Posição</th>
                    <th class="text-left">Nome</th>
                    <th class="text-right">Estações</th>
                    <th class="text-right">Pontuação</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="(usuario, index) in rankingFiltrado" 
                    :key="usuario.id"
                    :class=" [
                      {'minha-linha': usuario.id === currentUserId},
                      {'top1': index === 0},
                      {'top2': index === 1},
                      {'top3': index === 2}
                    ]"
                    @mouseover="hoveredRow = usuario.id"
                    @mouseleave="hoveredRow = null"
                  >
                    <td class="text-center">
                      <v-avatar 
                        size="36" 
                        :color="obterCorRanking(index + 1)"
                        class="white--text mr-2"
                        :class="{'pulse': hoveredRow === usuario.id}"
                      >
                        <v-icon v-if="index === 0" color="#ffd600">mdi-trophy</v-icon>
                        <v-icon v-else-if="index === 1" color="#bdbdbd">mdi-trophy</v-icon>
                        <v-icon v-else-if="index === 2" color="#ff9800">mdi-trophy</v-icon>
                        <span v-else>{{ index + 1 }}</span>
                      </v-avatar>
                    </td>
                    <td>
                      <div class="d-flex align-center">
                        <v-avatar class="mr-3" size="40" :color="obterCorRanking(index + 1)">
                          <v-img
                            v-if="usuario.photoURL"
                            :src="usuario.photoURL"
                            alt="Avatar"
                          ></v-img>
                          <span v-else>{{ obterIniciais(usuario.nome, usuario.sobrenome) }}</span>
                        </v-avatar>
                        <div>
                          <div class="font-weight-medium">{{ usuario.nome }} {{ usuario.sobrenome }}</div>
                          <div class="text-caption">{{ usuario.cidade }}, {{ usuario.paisOrigem }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="text-right">{{ usuario.estacoesConcluidas || 0 }}</td>
                    <td class="text-right font-weight-bold">{{ parseInt(usuario.pontos) || 0 }}</td>
                  </tr>
                  <tr v-if="rankingFiltrado.length === 0">
                    <td colspan="4" class="text-center py-5">
                      Nenhum usuário encontrado no ranking. 😕
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-col>
        <!-- Estatísticas por Especialidade -->
        <v-col cols="12">
          <v-card elevation="2" class="mb-6 animate-fade-in">
            <v-card-title class="text-h5">
              Estatísticas por Especialidade
            </v-card-title>
            <v-card-text>
              <v-row v-if="!loading && especialidades.length > 0">
                <v-col v-for="especialidade in especialidades" :key="especialidade.nome" cols="12" md="4">
                  <v-card variant="outlined" class="pa-3">
                    <div class="text-h6 mb-2">{{ especialidade.nome }}</div>
                    <div class="d-flex justify-space-between mb-1">
                      <span class="text-caption">Estações:</span>
                      <span class="font-weight-medium">{{ especialidade.concluidas }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-1">
                      <span class="text-caption">Média de notas:</span>
                      <span class="font-weight-medium">{{ formatarNota(especialidade.mediaNotas) }}</span>
                    </div>
                    <v-progress-linear
                      :model-value="(especialidade.mediaNotas/10)*100"
                      :color="obterCorNota(especialidade.mediaNotas)"
                      height="10"
                      rounded
                      class="mt-2"
                    ></v-progress-linear>
                  </v-card>
                </v-col>
              </v-row>
              <v-alert v-else-if="!loading" type="info" text>
                Você ainda não completou nenhuma estação.
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup>
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query } from 'firebase/firestore';
import { computed, onMounted, ref } from 'vue';

// Estado
const loading = ref(true);
const error = ref(null);
const ranking = ref([]);
const currentUserId = ref(null);
const meuRanking = ref(null);
const especialidades = ref([]);
const filtroAtivo = ref('geral');
const buscaNome = ref('');
const hoveredRow = ref(null);

// Firebase
const auth = getAuth();
const db = getFirestore();

const rankingFiltrado = computed(() => {
  if (!buscaNome.value) return ranking.value;
  return ranking.value.filter(u => {
    const nomeCompleto = `${u.nome} ${u.sobrenome}`.toLowerCase();
    return nomeCompleto.includes(buscaNome.value.toLowerCase());
  });
});

const top3 = computed(() => ranking.value.slice(0, 3));

// Buscar ranking
async function buscarRanking() {
  loading.value = true;
  error.value = null;
  
  try {
    // Determinar campo para ordenar com base no filtro
    let campoOrdenacao = 'ranking'; // padrão
    
    if (filtroAtivo.value === 'mediaNota') {
      campoOrdenacao = 'nivelHabilidade';
    } else if (filtroAtivo.value === 'quantidade') {
      campoOrdenacao = 'estacoesConcluidas';
    }
    
    // Buscar top 50 usuários
    const usuariosRef = collection(db, 'usuarios');
    const q = query(usuariosRef, orderBy(campoOrdenacao, 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    
    const rankingData = [];
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      
      // Calcular estações concluídas
      const estacoesConcluidas = Array.isArray(userData.estacoesConcluidas) 
        ? userData.estacoesConcluidas.length 
        : 0;
      
      // Calcular média de notas
      const mediaNota = userData.nivelHabilidade || 0;
      
      // Calcular pontos
      const pontos = userData.ranking || 0;
      
      rankingData.push({
        id: doc.id,
        nome: userData.nome || 'Usuário',
        sobrenome: userData.sobrenome || '',
        cidade: userData.cidade || 'Desconhecida',
        paisOrigem: userData.paisOrigem || 'Brasil',
        photoURL: userData.photoURL,
        estacoesConcluidas,
        mediaNota,
        nivelHabilidade: userData.nivelHabilidade || 0,
        pontos,
      });
    });
    
    ranking.value = rankingData;
    
    // Encontrar minha posição no ranking
    if (currentUserId.value) {
      const minhaPos = rankingData.findIndex(u => u.id === currentUserId.value);
      if (minhaPos !== -1) {
        meuRanking.value = {
          ...rankingData[minhaPos],
          posicao: minhaPos + 1
        };
      } else {
        // Se não estiver nos top 50, buscar especificamente meus dados
        await buscarMeusDados();
      }
    }
  } catch (err) {
    console.error('Erro ao buscar ranking:', err);
    error.value = 'Não foi possível carregar o ranking. Tente novamente mais tarde.';
  } finally {
    loading.value = false;
  }
}

// Buscar meus dados quando não estou no top 50
async function buscarMeusDados() {
  if (!currentUserId.value) return;
  
  try {
    const userDoc = await getDoc(doc(db, 'usuarios', currentUserId.value));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Calcular estações concluídas
      const estacoesConcluidas = Array.isArray(userData.estacoesConcluidas) 
        ? userData.estacoesConcluidas.length 
        : 0;
      
      // Calcular média de notas
      const mediaNota = userData.nivelHabilidade || 0;
      
      // Calcular pontos
      const pontos = userData.ranking || 0;
      
      meuRanking.value = {
        id: userDoc.id,
        nome: userData.nome || 'Você',
        sobrenome: userData.sobrenome || '',
        estacoesConcluidas,
        mediaNota,
        nivelHabilidade: userData.nivelHabilidade || 0,
        pontos,
        posicao: 999 // Posição desconhecida fora do top 50
      };
      
      // Processar estatísticas por especialidade
      processarEstatisticas(userData.statistics || {});
    }
  } catch (err) {
    console.error('Erro ao buscar meus dados:', err);
  }
}

// Processar estatísticas por especialidade
function processarEstatisticas(statistics) {
  const especialidadesData = [];
  
  // Remover a estatística geral para processamento separado
  const { geral, ...especialidadesObj } = statistics;
  
  // Processar cada especialidade
  for (const [nome, dados] of Object.entries(especialidadesObj)) {
    especialidadesData.push({
      nome: nome.charAt(0).toUpperCase() + nome.slice(1), // Capitalizar
      concluidas: dados.concluidas || 0,
      mediaNotas: dados.mediaNotas || 0,
      total: dados.total || 0
    });
  }
  
  // Ordenar por número de estações concluídas
  especialidadesData.sort((a, b) => b.concluidas - a.concluidas);
  
  especialidades.value = especialidadesData;
}

// Filtrar ranking
function filtrarPor(filtro) {
  filtroAtivo.value = filtro;
  buscarRanking();
}

// Formatar nota para exibição
function formatarNota(nota) {
  if (nota === undefined || nota === null) return '0.00';
  return (Math.round(nota * 100) / 100).toFixed(2);
}

// Formatar nível para exibição
function formatarNivel(nivel) {
  if (nivel === undefined || nivel === null) return 'Iniciante';
  
  if (nivel >= 9) return 'Expert';
  if (nivel >= 7.5) return 'Avançado';
  if (nivel >= 5) return 'Intermediário';
  return 'Iniciante';
}

// Obter cor com base na posição no ranking
function obterCorRanking(posicao) {
  if (posicao === 1) return 'amber-darken-2'; // Ouro
  if (posicao === 2) return 'grey-lighten-1'; // Prata
  if (posicao === 3) return 'amber-darken-4'; // Bronze
  if (posicao <= 10) return 'blue';
  if (posicao <= 20) return 'teal';
  return 'grey';
}

// Obter cor com base na nota
function obterCorNota(nota) {
  if (nota >= 9) return 'success';
  if (nota >= 7) return 'info';
  if (nota >= 5) return 'warning';
  return 'error';
}

// Obter iniciais do nome
function obterIniciais(nome, sobrenome) {
  const n = nome ? nome.charAt(0).toUpperCase() : '';
  const s = sobrenome ? sobrenome.charAt(0).toUpperCase() : '';
  return n + s;
}

// Monitorar usuário autenticado
onMounted(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId.value = user.uid;
      buscarRanking();
    } else {
      error.value = 'Você precisa estar autenticado para ver o ranking.';
      loading.value = false;
    }
  });
  
  // Limpar listener ao desmontar
  return () => unsubscribe();
});
</script>

<style scoped>
.ranking-view {
  min-height: 100vh;
  background: #f8f9fb;
}
.top3-row {
  gap: 32px;
}
.top3-card {
  background: linear-gradient(120deg, #fffde7 0%, #ede7f6 100%);
  border-radius: 18px;
  box-shadow: 0 4px 24px 0 rgba(123, 31, 162, 0.10), 0 1.5px 4px 0 rgba(0,0,0,0.04);
  padding: 24px 32px;
  margin: 0 8px;
  min-width: 220px;
  max-width: 260px;
  text-align: center;
  transition: transform 0.18s, box-shadow 0.18s;
  cursor: pointer;
  position: relative;
  z-index: 1;
}
.top3-card:hover {
  transform: scale(1.04) translateY(-4px);
  box-shadow: 0 8px 32px 0 rgba(123, 31, 162, 0.18), 0 3px 8px 0 rgba(0,188,212,0.10);
}
.top3-avatar {
  margin-bottom: 8px;
  border: 3px solid #ffd600;
  box-shadow: 0 2px 8px #ffd60033;
}
.top1 .top3-avatar { border-color: #ffd600; }
.top2 .top3-avatar { border-color: #bdbdbd; }
.top3 .top3-avatar { border-color: #ff9800; }
.top3-nome {
  font-size: 1.15rem;
  font-weight: bold;
  margin-bottom: 2px;
}
.top3-pontos {
  font-size: 1.1rem;
  color: #7b1fa2;
  font-weight: bold;
}
.top3-cidade {
  font-size: 0.95rem;
  color: #888;
}
.ranking-card-hero {
  border-radius: 18px;
  box-shadow: 0 4px 24px 0 rgba(123, 31, 162, 0.10), 0 1.5px 4px 0 rgba(0,0,0,0.04);
  background: #fff;
}
.ranking-table {
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 8px 0 rgba(123, 31, 162, 0.06);
}
.meu-ranking {
  background: linear-gradient(90deg, #ede7f6 0%, #fffde7 100%);
  border-radius: 12px;
  box-shadow: 0 2px 8px 0 rgba(123, 31, 162, 0.08);
}
.minha-linha {
  background-color: #e3f2fd !important;
}
.top1 {
  background: linear-gradient(90deg, #fffde7 0%, #fff9c4 100%);
}
.top2 {
  background: linear-gradient(90deg, #f5f5f5 0%, #e0e0e0 100%);
}
.top3 {
  background: linear-gradient(90deg, #ffe0b2 0%, #fff3e0 100%);
}
.pulse {
  animation: pulse 0.7s;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 #ffd60055; }
  70% { box-shadow: 0 0 0 10px #ffd60011; }
  100% { box-shadow: 0 0 0 0 #ffd60000; }
}
.animate-fade-in {
  animation: fadeInUp 0.7s cubic-bezier(.55,0,.1,1);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 900px) {
  .ranking-card-hero, .meu-ranking, .ranking-table, .top3-card { border-radius: 8px; }
  .top3-row { gap: 12px; }
  .top3-card { padding: 16px 8px; min-width: 140px; max-width: 180px; }
}
@media (max-width: 600px) {
  .ranking-view { padding: 0 2px; }
  .ranking-card-hero, .meu-ranking, .ranking-table, .top3-card { border-radius: 4px; }
  .top3-row { flex-direction: column; align-items: center; gap: 8px; }
  .top3-card { margin: 8px 0; }
}
</style>
