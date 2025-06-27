export const routes = [
  // A rota raiz '/' agora aponta para a landing page
  {
    path: '/',
    component: () => import('@/layouts/blank.vue'),
    children: [
      {
        path: '', // Caminho vazio para a rota raiz
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
      // Remova ou comente a linha abaixo:
      // { path: 'completar-cadastro', name: 'completar-cadastro', component: () => import('@/pages/completar-cadastro.vue') },
      {
        path: '/:pathMatch(.*)*',
        name: 'error',
        component: () => import('@/pages/[...error].vue'),
      },
    ],
  },
  
  // O layout padrão agora está sob um caminho que não é a raiz
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
    ],
  },
]

