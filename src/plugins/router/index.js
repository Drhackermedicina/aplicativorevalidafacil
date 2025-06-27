import { currentUser, waitForAuth } from '@/plugins/auth'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'

let isAuthInitialized = false // Flag para garantir que a espera ocorra apenas uma vez

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...routes,
    // Remova a rota '/dashboard' duplicada se não for usar!
  ],
})

// Guarda de Navegação Global (Async)
router.beforeEach(async (to, from, next) => {
  await waitForAuth()
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!currentUser.value) {
      next('/login')
      return
    }
    const db = getFirestore()
    const userDoc = await getDoc(doc(db, 'usuarios', currentUser.value.uid))
    const user = userDoc.data()
    if (
      !userDoc.exists() ||
      !user.telefoneVerificado ||
      !user.aceitouTermos
    ) {
      // Redirecione para /register se cadastro incompleto
      next('/register')
      return
    }
    // Bloqueio de acesso se trial expirou ou plano vencido
    const agora = new Date()
    if (
      user.plano === 'trial' &&
      new Date(user.trialExpiraEm) < agora
    ) {
      next('/pagamento')
      return
    }
    if (
      user.plano !== 'trial' &&
      user.planoExpiraEm &&
      new Date(user.planoExpiraEm) < agora
    ) {
      next('/pagamento')
      return
    }
  }
  next()
})

export default function (app) {
  app.use(router)
}

export { router }
