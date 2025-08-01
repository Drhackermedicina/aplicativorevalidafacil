<script setup>
import { currentUser } from '@/plugins/auth.js'
import { db, firebaseAuth } from '@/plugins/firebase.js'
import { backendUrl } from '@/utils/backendUrl'
import { signOut } from 'firebase/auth'
import { collection, getDocs } from 'firebase/firestore'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
const router = useRouter()
const theme = useTheme()

// --- Refs do Estado ---
const isDevelopment = ref(false); // Adiciona variável de ambiente
const stations = ref([]);
const isLoadingStations = ref(true);
const errorMessage = ref('');
const creatingSessionForStationId = ref(null);
const isLoadingSession = ref(false);
const generatedCandidateLink = ref('');
const errorApi = ref('');
const showUserMenu = ref(false);
const sidebarOpen = ref(true);
const unreadMessages = ref(0);
const onlineUsers = ref([]);
const userStats = reactive({ simulationsCompleted: 0, averageScore: 0, currentStreak: 0 });

// --- Refs para filtros e pesquisa ---
const searchQuery = ref('');
const selectedArea = ref('');
const selectedCategory = ref(''); // INEP REVALIDA - PROVAS ANTERIORES ou REVALIDA FÁCIL
const showSuggestions = ref(false);
const searchSuggestions = ref([]);

// --- Refs para controle dos accordions ---
const showPreviousExamsSection = ref(false);
const show2024_2Stations = ref(false);
const showRevalidaFacilStations = ref(false); // RECOLHIDO POR PADRÃO
const showRevalidaFacilClinicaMedica = ref(false); // RECOLHIDO POR PADRÃO
const showRevalidaFacilGO = ref(false); // RECOLHIDO POR PADRÃO  
const showRevalidaGO = ref(false); // Alias para GO
const showRevalidaFacilCirurgia = ref(false); // RECOLHIDO POR PADRÃO
const showRevalidaFacilPreventiva = ref(false); // RECOLHIDO POR PADRÃO
const showRevalidaFacilPediatria = ref(false); // RECOLHIDO POR PADRÃO

// --- Computed Properties ---
// Computeds para tema
const isDarkTheme = computed(() => theme.global.current.value.dark)

const isAdmin = computed(() => {
  const adminStatus = currentUser.value && (
    currentUser.value.uid === 'RtfNENOqMUdw7pvgeeaBVSuin662' || 
    currentUser.value.uid === 'KiSITAxXMAY5uU3bOPW5JMQPent2' ||
    currentUser.value.uid === 'UD7S8aiyR8TJXHyxdw29BHNfjEf1' || // Novo admin adicionado
    currentUser.value.uid === 'lNwhdYgMwLhS1ZyufRzw9xLD10y1' // Novo admin adicionado
  );
  console.log(`[DEBUG Admin] CurrentUser: ${currentUser.value?.uid} | isAdmin: ${adminStatus}`);
  return adminStatus;
});

const stations2024_2 = computed(() => {
  const filtered = stations.value.filter(station => {
    const idEstacao = station.idEstacao || '';
    const titulo = station.tituloEstacao?.toUpperCase() || '';
    if (titulo.includes("INEP") && titulo.includes("2024.2")) {
      console.log(`[DEBUG INEP 2024.2] Estação encontrada no título: ID=${station.id}, idEstacao=${idEstacao}, Titulo=${station.tituloEstacao}`);
    }
    return idEstacao.startsWith("REVALIDA") && idEstacao.includes("2024");
  });
  console.log(`[DEBUG INEP 2024.2] Total de estações filtradas por idEstacao: ${filtered.length}`);
  return filtered;
});

const stationsRevalidaFacil = computed(() => {
  if (!stations.value) return [];
  
  const filteredStations = stations.value.filter(station => {
    // Modificado para filtrar pelo campo 'origem' em vez do título
    const origem = station.origem?.toUpperCase() || '';
    return origem === 'REVALIDA_FACIL';
  });

  console.log(`[DEBUG RevalidaFacil] Total de estações encontradas: ${filteredStations.length}`);
  
  // Debug: contagem por especialidade
  if (filteredStations.length > 0) {
    const especialidadeCount = {};
    const areaCount = {};
    
    filteredStations.forEach(station => {
      const especialidade = station.especialidade || 'SEM_ESPECIALIDADE';
      const area = getStationArea(station);
      
      especialidadeCount[especialidade] = (especialidadeCount[especialidade] || 0) + 1;
      areaCount[area.key] = (areaCount[area.key] || 0) + 1;
    });
    
    console.log('[DEBUG RevalidaFacil] Contagem por especialidade:', especialidadeCount);
    console.log('[DEBUG RevalidaFacil] Contagem por área:', areaCount);
  }
  
  return filteredStations;
});

const filteredStationsRevalidaFacilClinicaMedica = computed(() => {
  return stationsRevalidaFacil.value.filter(station => getStationArea(station).key === 'clinica-medica');
});

const filteredStationsRevalidaFacilCirurgia = computed(() => {
  return stationsRevalidaFacil.value.filter(station => getStationArea(station).key === 'cirurgia');
});

const filteredStationsRevalidaFacilPreventiva = computed(() => {
  return stationsRevalidaFacil.value.filter(station => getStationArea(station).key === 'preventiva');
});

const filteredStationsRevalidaFacilPediatria = computed(() => {
  const pediatriaStations = stationsRevalidaFacil.value.filter(station => getStationArea(station).key === 'pediatria');
  console.log(`[DEBUG Pediatria] Total de estações de Pediatria REVALIDA FÁCIL: ${pediatriaStations.length}`);
  
  // Debug detalhado das estações pediátricas
  if (pediatriaStations.length > 0) {
    console.log('[DEBUG Pediatria] Estações encontradas:', pediatriaStations.map(s => ({
      id: s.id,
      titulo: s.tituloEstacao,
      especialidade: s.especialidade,
      origem: s.origem,
      area: getStationArea(s)
    })));
  } else {
    // Verificar se há estações que deveriam ser pediatria
    const allRevalidaFacil = stationsRevalidaFacil.value;
    console.log('[DEBUG Pediatria] Verificando todas as estações REVALIDA FÁCIL para palavras-chave pediátricas:');
    allRevalidaFacil.forEach(station => {
      const titulo = (station.tituloEstacao || '').toLowerCase();
      const especialidade = (station.especialidade || '').toLowerCase();
      const area = getStationArea(station);
      
      if (titulo.includes('pediatr') || titulo.includes('criança') || titulo.includes('infantil') || 
          especialidade.includes('pediatr') || especialidade.includes('criança')) {
        console.log('[DEBUG Pediatria] Estação que deveria ser pediátrica:', {
          id: station.id,
          titulo: station.tituloEstacao,
          especialidade: station.especialidade,
          area: area,
          origem: station.origem
        });
      }
    });
  }
  
  return pediatriaStations;
});

const filteredStationsRevalidaFacilGO = computed(() => {
  return stationsRevalidaFacil.value.filter(station => getStationArea(station).key === 'ginecologia');
});

// --- Função para limpar títulos das estações ---
function getCleanStationTitle(originalTitle) {
  if (!originalTitle) return 'ESTAÇÃO SEM TÍTULO';
  let cleanTitle = originalTitle;

  // Remover completamente prefixos INEP ou REVALIDA
  cleanTitle = cleanTitle.replace(/^INEP\s*2024\.2[\s\:\-]*/gi, '');
  cleanTitle = cleanTitle.replace(/INEP\s*2024\.2[\s\:\-]*/gi, '');
  cleanTitle = cleanTitle.replace(/^REVALIDA[\s\:\-]*/gi, '');
  
  // Remove o prefixo REVALIDA FACIL (com variações de conectores)
  cleanTitle = cleanTitle.replace(/^REVALIDA\s*F[AÁ]CIL\s*[\-\:\s]+/i, '');
  cleanTitle = cleanTitle.replace(/^REVALIDAFACIL\s*[\-\:\s]+/i, '');
  
  // Remove outros prefixos comuns e especialidades do início
  cleanTitle = cleanTitle.replace(/^(ESTAÇÃO|CLINICA\s*MEDICA|CLÍNICA\s*MÉDICA|CIRURGIA|PEDIATRIA|PREVENTIVA|GINECOLOGIA|OBSTETRICIA|G\.O|GO|\d{4}\.\d|\d{4}|\d+|\-|\||\:)+/gi, '');

  // Remove abreviações de especialidades em qualquer parte do texto
  cleanTitle = cleanTitle.replace(/\s*[\(\[\-]\s*(CM|CR|PED|G\.O|GO|PREV|GERAL)\s*[\)\]\-]\s*/gi, ' ');
  cleanTitle = cleanTitle.replace(/\s+\-\s+(CM|CR|PED|G\.O|GO|PREV|GERAL)\s*/gi, ' ');
  cleanTitle = cleanTitle.replace(/\s+(CM|CR|PED|G\.O|GO|PREV|GERAL)\s*[\-\:]?\s*/gi, ' ');
  // Remover qualquer sequência de traços, pontos ou símbolos antes da primeira palavra
  cleanTitle = cleanTitle.replace(/^[\s\-\:\|\.\_]*/, '');
  
  // Remove tudo até encontrar a primeira palavra relevante (diagnóstico)
  cleanTitle = cleanTitle.replace(/^[^a-zA-ZÀ-ÿ]*([a-zA-ZÀ-ÿ].*)$/, '$1');

  // Remove espaços extras
  cleanTitle = cleanTitle.trim();
  
  // Se ficou vazio, retorna fallback mas sem os prefixos
  if (!cleanTitle || cleanTitle.length < 2) {
    // Aplicar todas as substituições ao título original para ter um fallback melhor
    let fallback = originalTitle
      .replace(/INEP\s*2024\.2[\s\:\-]*/gi, '')
      .replace(/Clínica Médica|Clinica Medica/gi, '')
      .replace(/Cirurgia Geral|Cirurgia/gi, '')
      .replace(/Pediatria/gi, '')
      .replace(/Ginecologia e Obstetrícia|Ginecologia E Obstetricia/gi, '')
      .replace(/Medicina da Família|Medicina De Familia/gi, '')
      .replace(/(CM|CR|PED|G\.O|GO|PREV|GERAL)[\s\:\-]+/gi, '')
      .replace(/[\s\-\:]{2,}/g, ' ')  // Substitui múltiplos espaços ou símbolos por um único espaço
      .trim();
    
    return fallback || originalTitle;
  }

  // Capitaliza primeira letra de cada palavra (Title Case)
  cleanTitle = cleanTitle.toLowerCase().split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return cleanTitle;
}

// --- Funções para identificar áreas médicas ---
function getStationArea(station) {
  const especialidadeRaw = (station.especialidade || '').toLowerCase();
  const titulo = (station.tituloEstacao || '').toLowerCase();

  // Normaliza e separa o campo especialidade e título em partes para análise
  const especialidades = especialidadeRaw
    .split(/[\\/,;\-\s]+/)
    .map(e => e.trim())
    .filter(e => e.length > 0)
    .map(e => e.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  
  const tituloNormalizado = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Arrays de palavras-chave mais abrangentes e específicas
  const keywords = {
    'clinica-medica': [
      // Especifico
      'clinica medica', 'medicina interna', 'cm', 'clinica', 'medicina clinica',
      // Condições médicas comuns
      'avc', 'acidente vascular cerebral', 'infarto', 'iam', 'miocardio', 'diabetes', 'hipertensao', 'hipertensao arterial',
      'ulcera peptica', 'hemorragia digestiva', 'dengue', 'malaria', 'tuberculose', 'tbc',
      'pneumonia', 'bronquite', 'asma', 'dpoc', 'insuficiencia cardiaca', 'icc',
      'arritmia', 'fibrilacao', 'angina', 'embolia', 'trombose', 'neurologia', 'emergencia clinica',
      'enfarte', 'cardiopatia', 'nefropatia', 'hepatopatia', 'gastrite', 'artrite', 'artrose',
      'lupus', 'hipotireoidismo', 'hipertireoidismo', 'anemia', 'leucemia', 'linfoma',
      // Termos gerais
      'internacao', 'enfermaria', 'ambulatorio', 'consulta', 'isquemico', 'cronico'
    ],
    'cirurgia': [
      // Específico
      'cirurgia', 'cirurgica', 'cr', 'trauma', 'operatoria', 'procedimento cirurgico', 'cirurgia geral',
      // Tipos de cirurgia/trauma
      'trauma abdominal', 'trauma fechado', 'trauma craniano', 'ulcera peptica perfurada', 'ruptura esplenica',
      'oclusao arterial', 'laparotomia', 'apendicectomia', 'colecistectomia', 'herniorrafia', 
      'drenagem', 'sutura', 'urologia', 'ortopedia', 'neurocirurgia',
      // Emergências cirúrgicas
      'abdome agudo', 'hemorragia interna', 'perfuracao', 'obstrucao intestinal', 'perfurada',
      'politraumatismo', 'fraturas', 'luxacao', 'ferimento', 'corte', 'queimadura',
      'apendicite', 'colecistite', 'pancreatite', 'peritonite', 'hernia'
    ],
    'pediatria': [
      // Específico
      'pediatria', 'pediatrica', 'infantil', 'crianca', 'ped', 'neonatal', 'lactente', 'neonato',
      'puericultura', 'adolescente', 'escolar', 'pre escolar', 'meses', 'anos', 'recem nascido',
      // Condições pediátricas específicas
      'criptorquidia', 'fimose', 'pressao arterial crianca', 'vacinacao infantil', 'imunizacao',
      'crescimento', 'desenvolvimento', 'aleitamento', 'diarreia infantil', 'gastroenterite',
      'desidratacao', 'febre crianca', 'convulsao febril', 'aferição pediatrica', 'consulta pediatrica',
      'bronquiolite', 'asma infantil', 'pneumonia pediatrica', 'otite', 'faringite',
      // Termos relacionados à idade
      'lactante', 'escolar', 'adolescencia', 'puberdade', 'menor', 'criancas'
    ],
    'ginecologia': [
      // Específico
      'ginecologia', 'ginecologica', 'obstetricia', 'obstetrica', 'go', 'g.o', 'ginecoobstetricia',
      'mulher', 'gestante', 'gravida', 'gravidez', 'gestacao', 'obstetrico',
      // Obstetrícia
      'pre natal', 'prenatal', 'pielonefrite gestante', 'emergencia obstetrica', 'eclampsia', 'pre eclampsia',
      'sangramento gestacao', 'parto', 'puerpera', 'puerperio', 'amamentacao', 'lactacao',
      'trabalho de parto', 'cesariana', 'cesarea', 'forceps', 'episiotomia',
      // Ginecologia
      'violencia sexual', 'doenca inflamatoria pelvica', 'dip', 'dst', 'corrimento vaginal',
      'cancer colo', 'cancer cervical', 'papanicolaou', 'mama', 'contraceptivo', 'menopausa',
      'ciclo menstrual', 'menstruacao', 'amenorreia', 'dismenorreia', 'endometriose',
      'ovario', 'utero', 'cervix', 'vagina', 'vulva', 'pelvica', 'ginecologico'
    ],
    'preventiva': [
      // Específico
      'preventiva', 'medicina preventiva', 'medicina da familia', 'medicina de familia', 'mfc',
      'familia', 'coletiva', 'saude publica', 'saude coletiva', 'epidemiologia', 'prevencao', 'promocao',
      'medicina comunitaria', 'atencao basica', 'atencao primaria', 'aps', 'sus',
      // Saúde pública e coletiva
      'tuberculose', 'tbc', 'hiv', 'aids', 'coinfeccao', 'lagarta', 'erucismo', 'infectologia',
      'vacinacao', 'imunizacao', 'vigilancia epidemiologica', 'notificacao compulsoria',
      'saneamento', 'agua', 'esgoto', 'zoonose', 'endemias', 'comunidade', 'populacional',
      'educacao em saude', 'promocao da saude', 'prevencao primaria', 'prevencao secundaria',
      'rastreamento', 'screening', 'deteccao precoce', 'programa de saude',
      // Condições relacionadas à saúde pública
      'hanseniase', 'chagas', 'esquistossomose', 'malaria', 'dengue', 'zika', 'chikungunya',
      'hepatite', 'sifilis', 'gonorreia', 'clamydia'
    ]
  };

  // Função helper para checar keywords (busca exata e parcial)
  const matchesKeywords = (text, keywordList) => {
    if (!text) return false;
    
    return keywordList.some(keyword => {
      // Match exato
      if (text.includes(keyword)) {
        return true;
      }
      
      // Match parcial (palavras individuais) - apenas para keywords com múltiplas palavras
      const keywordWords = keyword.split(/\s+/);
      if (keywordWords.length > 1) {
        const allWordsMatch = keywordWords.every(word => text.includes(word));
        if (allWordsMatch) {
          return true;
        }
      }
      
      return false;
    });
  };

  // Checa primeiro a especialidade, depois o título
  let key = 'geral';
  let matchInfo = '';
  
  // Prioridade de checagem: primeiro especialidade, depois título
  for (const [areaKey, keywordList] of Object.entries(keywords)) {
    // Checa especialidade primeiro (mais confiável)
    const especialidadeMatch = especialidades.some(esp => matchesKeywords(esp, keywordList));
    
    if (especialidadeMatch) {
      key = areaKey;
      matchInfo = 'especialidade';
      break;
    }
  }
  
  // Se não encontrou match na especialidade, checa o título
  if (key === 'geral') {
    for (const [areaKey, keywordList] of Object.entries(keywords)) {
      const tituloMatch = matchesKeywords(tituloNormalizado, keywordList);
      
      if (tituloMatch) {
        key = areaKey;
        matchInfo = 'titulo';
        break;
      }
    }
  }

  // Fallback baseado em padrões específicos no título (casos especiais)
  if (key === 'geral') {
    const tituloOriginal = (station.tituloEstacao || '').toLowerCase();
    
    // Padrões específicos que podem ter sido perdidos
    if (tituloOriginal.includes('pre-natal') || tituloOriginal.includes('prenatal') || 
        tituloOriginal.includes('parto') || tituloOriginal.includes('gestante')) {
      key = 'ginecologia';
      matchInfo = 'fallback-obstetrica';
    } else if (tituloOriginal.includes('crianca') || tituloOriginal.includes('pediatrica') || 
               tituloOriginal.includes('lactente') || tituloOriginal.includes('infantil')) {
      key = 'pediatria';
      matchInfo = 'fallback-pediatrico';
    } else if (tituloOriginal.includes('trauma') || tituloOriginal.includes('cirurgica') || 
               tituloOriginal.includes('operacao') || tituloOriginal.includes('procedimento cirurgico')) {
      key = 'cirurgia';
      matchInfo = 'fallback-cirurgico';
    } else if (tituloOriginal.includes('prevencao') || tituloOriginal.includes('sus') || 
               tituloOriginal.includes('atencao basica') || tituloOriginal.includes('familia')) {
      key = 'preventiva';
      matchInfo = 'fallback-preventivo';
    }
  }

  const areas = {
    'clinica-medica': { name: 'CM', fullName: 'Clínica Médica', icon: '🩺' },
    'cirurgia': { name: 'CR', fullName: 'Cirurgia', icon: '🔪' },
    'pediatria': { name: 'PED', fullName: 'Pediatria', icon: '👶' },
    'ginecologia': { name: 'G.O', fullName: 'Ginecologia e Obstetrícia', icon: '👩‍⚕️' },
    'preventiva': { name: 'PREV', fullName: 'Preventiva', icon: '🛡️' },
    'geral': { name: 'GERAL', fullName: 'Medicina Geral', icon: '🏥' }
  };

  // Log apenas para estações que não foram categorizadas
  if (key === 'geral') {
    console.log(`[DEBUG Area] ⚠️ Estação não categorizada: "${station.tituloEstacao}" | Especialidade: "${station.especialidade}"`);
  }

  return { key, ...areas[key] };
}

// --- Função para calcular dificuldade baseada na nota média ---
function getStationDifficulty(stationId, averageScore = null) {
  // Se não tiver nota média, simula uma baseada no hash do ID
  let avgScore = averageScore;
  if (avgScore === null) {
    const hash = stationId?.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0) || 0;
    avgScore = (Math.abs(hash) % 61) + 40; // Entre 40 e 100
  }
  
  // Converte a nota para escala de 0 a 10
  const normalizedScore = avgScore / 10;
  
  // Classifica dificuldade baseada na nota média geral
  if (avgScore >= 80) {
    return { level: 1, text: 'Fácil', color: '#22c55e', score: normalizedScore.toFixed(1) };
  } else if (avgScore >= 60 && avgScore < 80) {
    return { level: 2, text: 'Moderado', color: '#f59e0b', score: normalizedScore.toFixed(1) };
  } else if (avgScore >= 40 && avgScore < 60) {
    return { level: 3, text: 'Difícil', color: '#ef4444', score: normalizedScore.toFixed(1) };
  } else {
    return { level: 4, text: 'Muito Difícil', color: '#dc2626', score: normalizedScore.toFixed(1) };
  }
}

// --- Função para simular nota do usuário ---
function getUserScore(stationId) {
  const userHash = (currentUser.value?.uid || 'anonymous') + stationId;
  const hash = userHash.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0) || 0;
  
  const hasScore = Math.abs(hash) % 3 !== 0;
  if (!hasScore) return null;
  
  const score = (Math.abs(hash) % 41) + 60;
  const finalScore = Math.min(score, 100);
  
  // Retorna a nota normalizada de 0-10
  return (finalScore / 10).toFixed(1);
}

// --- Computed properties para filtros ---
const filteredStations = computed(() => {
  let filtered = stations.value;
  
  // Filtro por categoria principal
  if (selectedCategory.value === 'inep') {
    // Filtra por estações INEP (provas anteriores)
    filtered = filtered.filter(station => {
      const titulo = station.tituloEstacao?.toUpperCase() || '';
      return titulo.includes("INEP") && titulo.includes("2024.2");
    });
  } else if (selectedCategory.value === 'revalida-facil') {
    // Filtra por estações REVALIDA FÁCIL com base na origem
    filtered = filtered.filter(station => {
      const origem = station.origem?.toUpperCase() || '';
      return origem === 'REVALIDA_FACIL';
    });
  }
  
  // Filtro por área de especialidade
  if (selectedArea.value && selectedCategory.value) {
    filtered = filtered.filter(station => {
      const area = getStationArea(station);
      console.log(`[DEBUG] Filtro área: estação ${station.tituloEstacao} | especialidade: ${station.especialidade} | area.key: ${area.key} | selectedArea: ${selectedArea.value}`);
      return area.key === selectedArea.value;
    });
  }
  
  // Filtro por pesquisa
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(station => {
      const title = station.tituloEstacao?.toLowerCase() || '';
      const cleanTitle = getCleanStationTitle(station.tituloEstacao).toLowerCase();
      const area = getStationArea(station).name.toLowerCase();
      return title.includes(query) || cleanTitle.includes(query) || area.includes(query);
    });
  }
  
  return filtered;
});

// --- Computed para sugestões de pesquisa ---
const allStationTitles = computed(() => {
  const titles = [];
  
  if (selectedCategory.value === 'inep') {
    // Títulos das estações INEP
    stations2024_2.value.forEach(station => {
      const cleanTitle = getCleanStationTitle(station.tituloEstacao);
      if (cleanTitle && !titles.includes(cleanTitle)) {
        titles.push(cleanTitle);
      }
    });
  } else if (selectedCategory.value === 'revalida-facil') {
    // Títulos das estações REVALIDA FÁCIL
    stationsRevalidaFacil.value.forEach(station => {
      const cleanTitle = getCleanStationTitle(station.tituloEstacao);
      if (cleanTitle && !titles.includes(cleanTitle)) {
        titles.push(cleanTitle);
      }
    });
  } else {
    // Todos os títulos se nenhuma categoria selecionada
    stations.value.forEach(station => {
      const cleanTitle = getCleanStationTitle(station.tituloEstacao);
      if (cleanTitle && !titles.includes(cleanTitle)) {
        titles.push(cleanTitle);
      }
    });
  }
  
  return titles.sort();
});

// --- Função para atualizar sugestões ---
function updateSuggestions() {
  if (!searchQuery.value.trim()) {
    searchSuggestions.value = [];
    showSuggestions.value = false;
    return;
  }
  
  const query = searchQuery.value.toLowerCase();
  searchSuggestions.value = allStationTitles.value
    .filter(title => title.toLowerCase().includes(query))
    .slice(0, 5); // Máximo 5 sugestões
    
  showSuggestions.value = searchSuggestions.value.length > 0;
}

// --- Função para selecionar sugestão ---
function selectSuggestion(suggestion) {
  searchQuery.value = suggestion;
  showSuggestions.value = false;
}

// --- Função para esconder sugestões ---
function hideSuggestions() {
  setTimeout(() => {
    showSuggestions.value = false;
  }, 150);
}

const filteredStations2024_2 = computed(() => {
  return filteredStations.value.filter(station => {
    const titulo = station.tituloEstacao?.toUpperCase() || '';
    return titulo.includes("INEP") && titulo.includes("2024.2");
  });
});

// --- Função para Buscar Estações ---
async function fetchStations() {
  isLoadingStations.value = true;
  errorMessage.value = '';
  stations.value = [];

  try {
    const stationsColRef = collection(db, 'estacoes_clinicas');
    const querySnapshot = await getDocs(stationsColRef);

    const stationsList = [];
    querySnapshot.forEach((doc) => {
      stationsList.push({ id: doc.id, ...doc.data() });
    });
    
    // Ordenando manualmente no cliente
    stationsList.sort((a, b) => {
      const numA = a.numeroDaEstacao || 0;
      const numB = b.numeroDaEstacao || 0;
      return numA - numB;
    });
    
    stations.value = stationsList;
    console.log(`[DEBUG] Estações carregadas: ${stations.value.length}`);
    
    // Debug específico para verificar estações pediátricas
    console.log('[DEBUG] Verificando todas as estações para palavras-chave pediátricas:');
    stations.value.forEach(station => {
      const titulo = (station.tituloEstacao || '').toLowerCase();
      const especialidade = (station.especialidade || '').toLowerCase();
      
      if (titulo.includes('pediatr') || titulo.includes('criança') || titulo.includes('infantil') || 
          especialidade.includes('pediatr') || especialidade.includes('criança') || especialidade.includes('ped')) {
        console.log('[DEBUG Pediatria] Estação encontrada:', {
          id: station.id,
          titulo: station.tituloEstacao,
          especialidade: station.especialidade,
          origem: station.origem,
          area: getStationArea(station)
        });
      }
    });
    
    if (stations.value.length === 0) {
      errorMessage.value = "Nenhuma estação encontrada no Firestore na coleção 'estacoes_clinicas'.";
    }

  } catch (error) {
    console.error("[DEBUG] ERRO ao buscar lista de estações:", error);
    errorMessage.value = `Falha ao buscar estações: ${error.message}`;
    if (error.code === 'permission-denied') {
      errorMessage.value += " (Erro de permissão! Verifique as Regras de Segurança do Firestore)";
    }
  } finally {
    isLoadingStations.value = false;
  }
}

async function startSimulationAsActor(stationId) {
  console.log(`[DEBUG] startSimulationAsActor chamada com stationId:`, stationId);
  
  if (!stationId) {
    console.error('[DEBUG] stationId ausente:', stationId);
    errorApi.value = "ID da Estação ausente";
    alert("Erro: ID da estação não encontrado.");
    return;
  }

  try {
    creatingSessionForStationId.value = stationId;
    isLoadingSession.value = true;
    errorApi.value = '';
    
    console.log(`[DEBUG] Fazendo requisição para: ${backendUrl}/api/create-session`);
    console.log(`[DEBUG] Payload:`, { stationId });
    
    // O backend espera apenas stationId, não checklistId
    const response = await fetch(`${backendUrl}/api/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stationId: stationId
      }),
    });

    console.log(`[DEBUG] Resposta recebida. Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DEBUG] Erro HTTP ${response.status}:`, errorText);
      throw new Error(`Erro na resposta: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[DEBUG] Resultado do backend:`, result);
    
    if (result.sessionId) {
      const navigationUrl = `/app/simulation/${stationId}?sessionId=${result.sessionId}&role=actor`;
      console.log(`[DEBUG] Navegando para: ${navigationUrl}`);
      
      // Navegar para a simulação com os parâmetros corretos
      router.push({
        path: `/app/simulation/${stationId}`,
        query: {
          sessionId: result.sessionId,
          role: 'actor'
        }
      });
      
      console.log(`[DEBUG] router.push executado com sucesso`);
    } else {
      console.error('[DEBUG] sessionId não encontrado na resposta:', result);
      throw new Error('Sessão criada mas sessionId não retornado');
    }

  } catch (error) {
    console.error('[DEBUG] Erro completo ao criar sessão:', error);
    errorApi.value = `Erro: ${error.message}`;
    alert(`Erro ao iniciar simulação: ${error.message}`);
  } finally {
    isLoadingSession.value = false;
    creatingSessionForStationId.value = null;
    console.log('[DEBUG] startSimulationAsActor finalizada');
  }
}

function goToEditStation(stationId) {
  router.push(`/app/edit-station/${stationId}`);
}

function goToAdminUpload() {
  router.push('/app/admin-upload');
}

function copyLink() {
  try {
    navigator.clipboard.writeText(generatedCandidateLink.value);
    console.log('Link copiado!');
  } catch (error) {
    console.error('Falha ao copiar link:', error);
  }
}

onMounted(() => {
  fetchStations();
});

// --- Watch para limpar área quando categoria mudar ---
watch(selectedCategory, () => {
  selectedArea.value = '';
  searchQuery.value = '';
  showSuggestions.value = false;
});

watch(searchQuery, () => {
  updateSuggestions();
});

// Colapso automático do sidebar
function toggleCollapse() {
  const wrapper = document.querySelector('.layout-wrapper')
  wrapper?.classList.toggle('layout-vertical-nav-collapsed')
}
onMounted(() => {
  const wrapper = document.querySelector('.layout-wrapper')
  wrapper?.classList.add('layout-vertical-nav-collapsed')
})
onUnmounted(() => {
  const wrapper = document.querySelector('.layout-wrapper')
  wrapper?.classList.remove('layout-vertical-nav-collapsed')
})

// Layout global (header/sidebar)
function toggleUserMenu() { showUserMenu.value = !showUserMenu.value; }
function logout() { signOut(firebaseAuth); }
function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value; }
function goToHome() { router.push('/'); }
function openGoogleMeet() { window.open('https://meet.google.com', '_blank'); }
function openGemini() { window.open('https://gemini.google.com', '_blank'); }
function openWhatsApp() { window.open('https://wa.me/', '_blank'); }
function getStatusText(status) { return status; }

// Modo de depuração
const isDebugMode = ref(false);
const selectedElement = ref(null);
const debugStyles = reactive({});

// Ativar/Desativar modo de depuração
function toggleDebugMode() {
  isDebugMode.value = !isDebugMode.value;
  if (!isDebugMode.value) {
    selectedElement.value = null;
    debugStyles.value = {};
  }
}

// Selecionar elemento no clique
function selectElement(event) {
  if (!isDebugMode.value) return;
  event.preventDefault();
  selectedElement.value = event.target;
  // Access reactive object directly without .value
  debugStyles.backgroundColor = event.target.style.backgroundColor || '';
  debugStyles.color = event.target.style.color || '';
}

// Aplicar estilos ao elemento selecionado
function applyStyles() {
  if (selectedElement.value) {
    Object.assign(selectedElement.value.style, debugStyles);
  }
}

// Exemplo de log para depuração
watch(selectedCategory, (newValue) => {
  console.log('[DEBUG] Categoria selecionada mudou para:', newValue);
});

// Corrigindo possíveis erros de declaração ou instrução esperada
// Certifique-se de que todas as declarações estão completas e válidas
const exampleVariable = ref(null); // Exemplo de declaração válida
</script>

<template>
  <v-container fluid class="pa-0">
    <!-- Botão de toggle para expandir/recolher sidebar -->
    <v-tooltip location="right">
      <template #activator="{ props }">
        <v-btn icon fixed top left @click="toggleCollapse" class="ma-3 z-index-5" v-bind="props">
          <v-icon>ri-menu-line</v-icon>
        </v-btn>
      </template>
      Abrir/Fechar menu lateral
    </v-tooltip>
     <v-row>
      <v-col cols="12" md="12" class="mx-auto">
        <!-- Botão Admin Upload (visível apenas para administradores) -->
        <v-card v-if="isAdmin" class="mb-4" elevation="2" rounded color="error" variant="tonal">
          <v-card-text class="py-3">
            <v-row align="center">
              <v-col>
                <div class="d-flex align-center">
                  <v-icon class="me-2" color="error">ri-upload-cloud-2-line</v-icon>
                  <div>
                    <div class="text-subtitle-1 font-weight-bold">Área do Administrador</div>
                    <div class="text-caption text-medium-emphasis">Upload e gerenciamento de estações</div>
                  </div>
                </div>
              </v-col>
              <v-col cols="auto">
                <v-btn
                  color="error"
                  variant="elevated"
                  size="default"
                  @click="goToAdminUpload"
                  class="text-none"
                  prepend-icon="ri-upload-line"
                >
                  Admin Upload
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Expansion Panels para Seções Principais -->
        <v-expansion-panels variant="accordion" class="mb-6">
          
          <!-- INEP Revalida -->
          <v-expansion-panel>
            <v-expansion-panel-title class="text-h6 font-weight-bold">
              <template #default="{ expanded }">
                <v-row no-gutters align="center">
                  <v-col cols="auto">
                    <v-icon class="me-2" color="primary">ri-archive-drawer-line</v-icon>
                  </v-col>
                  <v-col>
                    INEP Revalida – Provas Anteriores
                  </v-col>
                  <v-col cols="auto">
                    <v-badge :content="stations2024_2.length" color="primary" inline />
                  </v-col>
                </v-row>
              </template>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <!-- Sub-accordions para as provas -->
              <v-expansion-panels variant="accordion" class="mt-4">
                <!-- INEP 2024.2 -->
                <v-expansion-panel v-if="stations2024_2.length > 0">
                  <v-expansion-panel-title class="text-subtitle-1 font-weight-medium">
                    <template #default="{ expanded }">
                      <v-row no-gutters align="center">
                        <v-col cols="auto">
                          <v-icon class="me-2" color="info">ri-calendar-event-line</v-icon>
                        </v-col>
                        <v-col>
                          INEP 2024.2
                        </v-col>
                        <v-col cols="auto">
                          <v-badge :content="stations2024_2.length" color="info" inline />
                        </v-col>
                      </v-row>
                    </template>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list density="comfortable">
                      <v-list-item
                        v-for="station in stations2024_2"
                        :key="station.id"
                        class="mb-2 rounded-lg elevation-1 station-list-item clickable-card"
                        :class="isDarkTheme ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'"
                        @click="startSimulationAsActor(station.id)"
                      >
                        <template #prepend>
                          <v-icon color="info">ri-file-list-3-line</v-icon>
                        </template>
                        <v-list-item-title class="font-weight-bold text-body-1">{{ getCleanStationTitle(station.tituloEstacao) }}</v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-secondary">{{ station.especialidade }}</v-list-item-subtitle>
                        <template #append>
                          <div class="d-flex align-center">
                            <v-progress-circular
                              v-if="creatingSessionForStationId === station.id"
                              indeterminate
                              size="24"
                              color="primary"
                              class="me-2"
                            />
                            <v-btn
                              v-if="isAdmin"
                              color="secondary"
                              variant="text"
                              size="small"
                              icon="ri-pencil-line"
                              @click.stop="goToEditStation(station.id)"
                              class="me-2"
                              aria-label="Editar Estação"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- REVALIDA FÁCIL -->
          <v-expansion-panel>
            <v-expansion-panel-title class="text-h6 font-weight-bold">
              <template #default="{ expanded }">
                <v-row no-gutters align="center">
                  <v-col cols="auto">
                    <v-icon class="me-2" color="primary">ri-star-smile-line</v-icon>
                  </v-col>
                  <v-col>
                    REVALIDA FÁCIL
                  </v-col>
                  <v-col cols="auto">
                    <v-badge :content="stationsRevalidaFacil.length" color="primary" inline />
                  </v-col>
                </v-row>
              </template>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <!-- Sub-accordions para especialidades -->
              <v-expansion-panels variant="accordion" class="mt-4">
                
                <!-- Clínica Médica -->
                <v-expansion-panel v-if="filteredStationsRevalidaFacilClinicaMedica.length > 0">
                  <v-expansion-panel-title class="text-subtitle-1 font-weight-medium">
                    <template #default="{ expanded }">
                      <v-row no-gutters align="center">
                        <v-col cols="auto">
                          <v-icon class="me-2" color="info">ri-stethoscope-line</v-icon>
                        </v-col>
                        <v-col>
                          Clínica Médica
                        </v-col>
                        <v-col cols="auto">
                          <v-badge :content="filteredStationsRevalidaFacilClinicaMedica.length" color="info" inline />
                        </v-col>
                      </v-row>
                    </template>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list density="comfortable">
                      <v-list-item
                        v-for="station in filteredStationsRevalidaFacilClinicaMedica"
                        :key="station.id"
                        class="mb-2 rounded-lg elevation-1 station-list-item clickable-card"
                        :class="isDarkTheme ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'"
                        @click="startSimulationAsActor(station.id)"
                      >
                        <template #prepend>
                          <v-icon color="info">ri-file-list-3-line</v-icon>
                        </template>
                        <v-list-item-title class="font-weight-bold text-body-1">{{ getCleanStationTitle(station.tituloEstacao) }}</v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-secondary">{{ station.especialidade }}</v-list-item-subtitle>
                        <template #append>
                          <div class="d-flex align-center">
                            <v-progress-circular
                              v-if="creatingSessionForStationId === station.id"
                              indeterminate
                              size="24"
                              color="primary"
                              class="me-2"
                            />
                            <v-btn
                              v-if="isAdmin"
                              color="secondary"
                              variant="text"
                              size="small"
                              icon="ri-pencil-line"
                              @click.stop="goToEditStation(station.id)"
                              class="me-2"
                              aria-label="Editar Estação"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- Cirurgia -->
                <v-expansion-panel v-if="filteredStationsRevalidaFacilCirurgia.length > 0">
                  <v-expansion-panel-title class="text-subtitle-1 font-weight-medium">
                    <template #default="{ expanded }">
                      <v-row no-gutters align="center">
                        <v-col cols="auto">
                          <v-icon :key="'cirurgia-icon'" class="me-2" color="primary">ri-knife-line</v-icon>
                        </v-col>
                        <v-col>
                          Cirurgia
                        </v-col>
                        <v-col cols="auto">
                          <v-badge :content="filteredStationsRevalidaFacilCirurgia.length" color="primary" inline />
                        </v-col>
                      </v-row>
                    </template>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list density="comfortable">
                      <v-list-item
                        v-for="station in filteredStationsRevalidaFacilCirurgia"
                        :key="station.id"
                        class="mb-2 rounded-lg elevation-1 station-list-item clickable-card"
                        :class="isDarkTheme ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'"
                        @click="startSimulationAsActor(station.id)"
                      >
                        <template #prepend>
                          <v-icon color="info">ri-file-list-3-line</v-icon>
                        </template>
                        <v-list-item-title class="font-weight-bold text-body-1">{{ getCleanStationTitle(station.tituloEstacao) }}</v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-secondary">{{ station.especialidade }}</v-list-item-subtitle>
                        <template #append>
                          <div class="d-flex align-center">
                            <v-progress-circular
                              v-if="creatingSessionForStationId === station.id"
                              indeterminate
                              size="24"
                              color="primary"
                              class="me-2"
                            />
                            <v-btn
                              v-if="isAdmin"
                              color="secondary"
                              variant="text"
                              size="small"
                              icon="ri-pencil-line"
                              @click.stop="goToEditStation(station.id)"
                              class="me-2"
                              aria-label="Editar Estação"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- Ginecologia e Obstetrícia -->
                <v-expansion-panel v-if="filteredStationsRevalidaFacilGO.length > 0">
                  <v-expansion-panel-title class="text-subtitle-1 font-weight-medium">
                    <template #default="{ expanded }">
                      <v-row no-gutters align="center">
                        <v-col cols="auto">
                          <v-icon class="me-2" color="error">ri-women-line</v-icon>
                        </v-col>
                        <v-col>
                          G.O
                        </v-col>
                        <v-col cols="auto">
                          <v-badge :content="filteredStationsRevalidaFacilGO.length" color="error" inline />
                        </v-col>
                      </v-row>
                    </template>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list density="comfortable">
                      <v-list-item
                        v-for="station in filteredStationsRevalidaFacilGO"
                        :key="station.id"
                        class="mb-2 rounded-lg elevation-1 station-list-item clickable-card"
                        :class="isDarkTheme ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'"
                        @click="startSimulationAsActor(station.id)"
                      >
                        <template #prepend>
                          <v-icon color="info">ri-file-list-3-line</v-icon>
                        </template>
                        <v-list-item-title class="font-weight-bold text-body-1">{{ getCleanStationTitle(station.tituloEstacao) }}</v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-secondary">{{ station.especialidade }}</v-list-item-subtitle>
                        <template #append>
                          <div class="d-flex align-center">
                            <v-progress-circular
                              v-if="creatingSessionForStationId === station.id"
                              indeterminate
                              size="24"
                              color="primary"
                              class="me-2"
                            />
                            <v-btn
                              v-if="isAdmin"
                              color="secondary"
                              variant="text"
                              size="small"
                              icon="ri-pencil-line"
                              @click.stop="goToEditStation(station.id)"
                              class="me-2"
                              aria-label="Editar Estação"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- Pediatria -->
                <v-expansion-panel v-if="filteredStationsRevalidaFacilPediatria.length > 0">
                  <v-expansion-panel-title class="text-subtitle-1 font-weight-medium">
                    <template #default="{ expanded }">
                      <v-row no-gutters align="center">
                        <v-col cols="auto">
                          <v-icon class="me-2" color="success">ri-bear-smile-line</v-icon>
                        </v-col>
                        <v-col>
                          Pediatria
                        </v-col>
                        <v-col cols="auto">
                          <v-badge :content="filteredStationsRevalidaFacilPediatria.length" color="success" inline />
                        </v-col>
                      </v-row>
                    </template>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list density="comfortable">
                      <v-list-item
                        v-for="station in filteredStationsRevalidaFacilPediatria"
                        :key="station.id"
                        class="mb-2 rounded-lg elevation-1 station-list-item clickable-card"
                        :class="isDarkTheme ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'"
                        @click="startSimulationAsActor(station.id)"
                      >
                        <template #prepend>
                          <v-icon color="info">ri-file-list-3-line</v-icon>
                        </template>
                        <v-list-item-title class="font-weight-bold text-body-1">{{ getCleanStationTitle(station.tituloEstacao) }}</v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-secondary">{{ station.especialidade }}</v-list-item-subtitle>
                        <template #append>
                          <div class="d-flex align-center">
                            <v-progress-circular
                              v-if="creatingSessionForStationId === station.id"
                              indeterminate
                              size="24"
                              color="primary"
                              class="me-2"
                            />
                            <v-btn
                              v-if="isAdmin"
                              color="secondary"
                              variant="text"
                              size="small"
                              icon="ri-pencil-line"
                              @click.stop="goToEditStation(station.id)"
                              class="me-2"
                              aria-label="Editar Estação"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- Medicina Preventiva -->
                <v-expansion-panel v-if="filteredStationsRevalidaFacilPreventiva.length > 0">
                  <v-expansion-panel-title class="text-subtitle-1 font-weight-medium">
                    <template #default="{ expanded }">
                      <v-row no-gutters align="center">
                        <v-col cols="auto">
                          <v-icon class="me-2" color="warning">ri-shield-cross-line</v-icon>
                        </v-col>
                        <v-col>
                          Preventiva
                        </v-col>
                        <v-col cols="auto">
                          <v-badge :content="filteredStationsRevalidaFacilPreventiva.length" color="warning" inline />
                        </v-col>
                      </v-row>
                    </template>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-list density="comfortable">
                      <v-list-item
                        v-for="station in filteredStationsRevalidaFacilPreventiva"
                        :key="station.id"
                        class="mb-2 rounded-lg elevation-1 station-list-item clickable-card"
                        :class="isDarkTheme ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'"
                        @click="startSimulationAsActor(station.id)"
                      >
                        <template #prepend>
                          <v-icon color="info">ri-file-list-3-line</v-icon>
                        </template>
                        <v-list-item-title class="font-weight-bold text-body-1">{{ getCleanStationTitle(station.tituloEstacao) }}</v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-secondary">{{ station.especialidade }}</v-list-item-subtitle>
                        <template #append>
                          <div class="d-flex align-center">
                            <v-progress-circular
                              v-if="creatingSessionForStationId === station.id"
                              indeterminate
                              size="24"
                              color="primary"
                              class="me-2"
                            />
                            <v-btn
                              v-if="isAdmin"
                              color="secondary"
                              variant="text"
                              size="small"
                              icon="ri-pencil-line"
                              @click.stop="goToEditStation(station.id)"
                              class="me-2"
                              aria-label="Editar Estação"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>

              </v-expansion-panels>
            </v-expansion-panel-text>
          </v-expansion-panel>

        </v-expansion-panels>
      </v-col>
    </v-row>
    <v-row v-if="isLoadingStations">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.station-list-item {
  transition: background-color 0.2s ease-in-out;
}

.station-list-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.clickable-card {
  cursor: pointer;
}

/* Estilos para os Expansion Panels */
.v-expansion-panels {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}

.v-expansion-panel {
  border-radius: 12px !important;
  margin-bottom: 8px;
}

.v-expansion-panel-title {
  padding: 16px 20px;
  font-weight: 600;
}

.v-expansion-panel-text {
  padding: 0 20px 20px 20px;
}

/* Sub-accordions (especialidades) */
.v-expansion-panels .v-expansion-panels {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  background: rgba(var(--v-theme-surface-variant), 0.3);
}

.v-expansion-panels .v-expansion-panels .v-expansion-panel {
  margin-bottom: 4px;
}

.v-expansion-panels .v-expansion-panels .v-expansion-panel-title {
  padding: 12px 16px;
  font-weight: 500;
}

.v-expansion-panels .v-expansion-panels .v-expansion-panel-text {
  padding: 0 16px 16px 16px;
}

/* Transições suaves */
.v-expansion-panel-title,
.v-expansion-panel-text {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Cards responsivos */
@media (max-width: 600px) {
  .v-expansion-panel-title {
    padding: 12px 16px;
    font-size: 0.95rem;
  }
  
  .v-expansion-panel-text {
    padding: 0 16px 16px 16px;
  }
  
  .station-list-item {
    border-radius: 8px !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
}

/* Badge customizations */
.v-badge {
  font-weight: 600;
}

/* Lista de estações */
.v-list {
  background: transparent;
}

.v-list-item {
  margin-bottom: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.8);
}

.v-list-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.15);
}

/* Temas dark/light compatibility */
.v-theme--dark .v-expansion-panels {
  background: rgba(var(--v-theme-surface), 0.9);
}

.v-theme--light .v-expansion-panels {
  background: rgba(var(--v-theme-surface), 1);
}

/* Admin Upload Card */
.v-card.v-theme--light[variant="tonal"] {
  background: rgba(var(--v-theme-error), 0.08) !important;
}

.v-card.v-theme--dark[variant="tonal"] {
  background: rgba(var(--v-theme-error), 0.12) !important;
}

/* Admin button hover effect */
.v-btn[color="error"]:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--v-theme-error), 0.3);
}

.station-item:hover .station-title,
.station-item:hover .station-specialty {
  color: #4a4a4a !important; /* Garante que o texto fique escuro no hover */
}

/* Admin button hover effect */
.admin-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--v-theme-error), 0.3);
}
</style>
