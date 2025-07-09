// src/stores/userStore.js
// Store mínimo para evitar erro de build. Adapte conforme sua lógica de usuário.
import { reactive } from 'vue'

const state = reactive({
  user: null,
  isAuthenticated: false,
})

function setUser(user) {
  state.user = user
  state.isAuthenticated = !!user
}

function clearUser() {
  state.user = null
  state.isAuthenticated = false
}

const userStore = {
  state,
  setUser,
  clearUser,
}

function useUserStore() {
  return userStore
}

export default userStore
export { useUserStore }

