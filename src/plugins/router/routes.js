export const routes = [
  // Landing, login e register SEM layout global
  {
    path: '/',
    component: () => import('@/layouts/components/blank.vue'),
    children: [
      {
        path: '',
        name: 'landing-page',
        component: () => import('@/pages/landingpage.vue'),
      },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/pages/login.vue'),
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('@/pages/register.vue'),
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'error',
        component: () => import('@/pages/[...error].vue'),
      },
    ],
  },
  // Demais rotas protegidas com layout global
  {
    path: '/app',
    component: () => import('@/layouts/default.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/dashboard.vue'),
      },
      {
        path: 'account-settings',
        name: 'account-settings',
        component: () => import('@/pages/account-settings.vue'),
      },
      {
        path: 'typography',
        name: 'typography',
        component: () => import('@/pages/typography.vue'),
      },
      {
        path: 'icons',
        name: 'icons',
        component: () => import('@/pages/icons.vue'),
      },
      {
        path: 'cards',
        name: 'cards',
        component: () => import('@/pages/cards.vue'),
      },
      {
        path: 'tables',
        name: 'tables',
        component: () => import('@/pages/tables.vue'),
      },
      {
        path: 'form-layouts',
        name: 'form-layouts',
        component: () => import('@/pages/form-layouts.vue'),
      },
       {
        path: 'teste-ia',
        name: 'teste-ia',
        component: () => import('@/pages/teste-ia.vue'),
      },
      {
        path: 'admin-upload',
        name: 'admin-upload',
        component: () => import('@/pages/AdminUpload.vue'),
      },
      {
        path: 'admin',
        name: 'admin-view',
        component: () => import('@/pages/AdminView.vue'),
      },
      {
        path: 'chat',
        name: 'chat-view',
        component: () => import('@/pages/ChatView.vue'),
      },
      {
        path: 'performance',
        name: 'performance-view',
        component: () => import('@/pages/PerformanceView.vue'),
      },
      {
        path: 'ranking',
        name: 'ranking-view',
        component: () => import('@/pages/RankingView.vue'),
      },
      {
        path: 'simulation/:id',
        name: 'simulation-view',
        component: () => import('@/pages/SimulationView.vue'),
        props: true,
      },
      {
        path: 'station-list',
        name: 'station-list',
        component: () => import('@/pages/StationList.vue'),
      },     
      {
        path: 'station/:id',
        name: 'station-view',
        component: () => import('@/pages/StationView.vue'),
        props: true,
      },
      {
        path: 'station/:id/simulate',
        name: 'station-simulation',
        component: () => import('@/pages/SimulationView.vue'),
        props: true,
      },
      {
        path: 'stations-index',
        name: 'stations-index',
        component: () => import('@/pages/StationList.vue'),
      },
      {
        path: 'arena/buscar-usuarios',
        name: 'buscar-usuarios',
        component: () => import('@/pages/BuscarUsuarios.vue'),
      },
      {
        path: 'arena/chat',
        name: 'chat-view',
        component: () => import('@/pages/ChatView.vue'),
      },
      {
        path: 'aguarde-simulacao',
        name: 'aguarde-simulacao',
        component: () => import('@/pages/aguarde-simulacao.vue'),
      }, 
    ],
  },

  // Rotas da Área do Candidato
  {
    path: '/candidato',
    component: () => import('@/layouts/default.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'progresso',
        name: 'candidato-progresso',
        component: () => import('@/pages/candidato/Progresso.vue'),
      },
      {
        path: 'estatisticas',
        name: 'candidato-estatisticas',
        component: () => import('@/pages/candidato/Estatisticas.vue'),
      },
      {
        path: 'ranking',
        name: 'candidato-ranking',
        component: () => import('@/pages/candidato/Ranking.vue'),
      },
      {
        path: 'historico',
        name: 'candidato-historico',
        component: () => import('@/pages/candidato/Historico.vue'),
      },
    ],
  },

  // Rotas absolutas para acesso direto às estações e simulação (REMOVIDAS para garantir layout global)
  // {
  //   path: '/station/:id',
  //   name: 'station-view-absolute',
  //   component: () => import('@/pages/StationView.vue'),
  //   props: true,
  // },
  // {
  //   path: '/station/:id/simulate',
  //   name: 'station-simulation-absolute',
  //   component: () => import('@/pages/SimulationView.vue'),
  //   props: true,
  // },
]
