<script setup>
import { firebaseAuth } from '@/plugins/firebase'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'

// Imagens e Logo
import authV1MaskDark from '@images/pages/auth-v1-mask-dark.png'
import authV1MaskLight from '@images/pages/auth-v1-mask-light.png'
import revalidaFacilLogo from '@images/revalidafacillogo.png'

const vuetifyTheme = useTheme()
const router = useRouter()
const loading = ref(false)

const authThemeMask = computed(() => {
  return vuetifyTheme.global.name.value === 'light' ? authV1MaskLight : authV1MaskDark
})

const loginComGoogle = async () => {
  loading.value = true
  const provider = new GoogleAuthProvider()

  try {
    const result = await signInWithPopup(firebaseAuth, provider)
    const currentUser = result.user
    console.log('UID do usuário autenticado:', currentUser.value.uid)
    // Após o login bem-sucedido, redireciona para o dashboard
    router.push('/app/dashboard')
  } catch (error) {
    console.error("Erro no login com Google:", error)
    alert("Ocorreu um erro ao tentar fazer o login. Tente novamente.")
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-wrapper d-flex align-center justify-center pa-4">
    <VCard
      class="auth-card pa-4 pt-7"
      max-width="448"
    >
      <VCardItem class="justify-center">
        <RouterLink
          to="/"
          class="d-flex align-center gap-3"
        >
          <img
            :src="revalidaFacilLogo"
            alt="Revalida Fácil Logo"
            style="block-size: 40px;"
          >
          <h2 class="font-weight-medium text-2xl text-uppercase">
            REVALIDA FÁCIL
          </h2>
        </RouterLink>
      </VCardItem>

      <VCardText class="pt-2">
        <h4 class="text-h4 mb-1">
          Bem-vindo! 👋🏻
        </h4>
        <p class="mb-0">
          Acesse usando sua conta do Google para começar
        </p>
      </VCardText>

      <VCardText>
        <VRow>
          <VCol cols="12">
            <VBtn
              block
              @click="loginComGoogle"
              :loading="loading"
              color="#DB4437"
              class="text-white"
            >
              <VIcon
                start
                icon="ri-google-fill"
              />
              Entrar com Google
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <VImg
      class="auth-footer-mask d-none d-md-block"
      :src="authThemeMask"
    />
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";
</style>
