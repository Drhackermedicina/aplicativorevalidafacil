import { currentUser } from '@/plugins/auth'
import { computed, ref, watch } from 'vue'

/**
 * Composable para verificação de permissões de admin
 * Baseado na lógica existente do EditStationView.vue
 */
export function useAdminAuth() {
  // Estado de loading para aguardar o currentUser
  const isLoading = ref(true)
  
  // Watch para aguardar o currentUser ser carregado
  watch(currentUser, (user) => {
    if (user !== undefined) {
      isLoading.value = false
    }
  }, { immediate: true })

  // Verifica se o usuário atual é admin
  const isAdmin = computed(() => {
    if (isLoading.value || !currentUser.value) {
      console.log('🔍 Admin check: User not loaded or not logged in', { 
        isLoading: isLoading.value, 
        currentUser: currentUser.value 
      })
      return false
    }
    
    // Lista de UIDs de administradores
    const adminUIDs = [
      'LCG3oqAL9WgmG8x3D6mEKjZH8V23', // UID do admin principal
      'M6WE5uIgTBWLhEJ8HDBxrTg1Lf53', // Adicione outros UIDs de admin aqui
      'RtfNENOqMUdw7pvgeeaBVSuin662', // Seu UID - identificado pelos logs de sucesso
      'KiSITAxXMAY5uU3bOPW5JMQPent2', // Admin adicional
      'UD7S8aiyR8TJXHyxdw29BHNfjEf1', // Admin adicional  
      'lNwhdYgMwLhS1ZyufRzw9xLD10y1', // Admin adicional
    ]
    
    const userUID = currentUser.value.uid
    const isUserAdmin = adminUIDs.includes(userUID)
    
    // Modo de desenvolvimento removido - usando apenas verificação por UID
    
    console.log('🔍 Admin check by UID:', { 
      userUID, 
      adminUIDs, 
      isUserAdmin,
      currentUserData: currentUser.value 
    })
    
    return isUserAdmin
  })

  // Verifica se o usuário tem papel de admin (se implementado no futuro)
  const hasAdminRole = computed(() => {
    if (isLoading.value || !currentUser.value) return false
    
    // Verificar se existe um campo 'role' no usuário
    const userRole = currentUser.value.role || currentUser.value.customClaims?.role
    const hasRole = userRole === 'admin' || userRole === 'administrator'
    
    console.log('🔍 Admin check by role:', { 
      userRole, 
      hasRole,
      customClaims: currentUser.value.customClaims 
    })
    
    return hasRole
  })

  // Verificação combinada - admin por UID ou por role
  const isAuthorizedAdmin = computed(() => {
    const authorized = isAdmin.value || hasAdminRole.value
    
    console.log('🔍 Final admin authorization:', { 
      isAdmin: isAdmin.value,
      hasAdminRole: hasAdminRole.value,
      isAuthorizedAdmin: authorized,
      isLoading: isLoading.value
    })
    
    return authorized
  })

  return {
    isAdmin,
    hasAdminRole,
    isAuthorizedAdmin,
    isLoading
  }
}
