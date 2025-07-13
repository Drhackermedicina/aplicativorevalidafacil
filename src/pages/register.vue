<script setup>
import { firebaseAuth } from '@/plugins/firebase'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { collection, doc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const db = getFirestore()

const loading = ref(false)
const error = ref('')

const usuarioGoogle = ref(null)

const form = ref({
  nome: '',
  sobrenome: '',
  cpf: '',
  cidade: '',
  paisOrigem: '',
  aceitouTermos: false,
})

watch(usuarioGoogle, (novoValor) => {
  if (novoValor) {
    // Preencha nome/sobrenome se vier do Google
    form.value.nome = novoValor.displayName?.split(' ')[0] || ''
    form.value.sobrenome = novoValor.displayName?.split(' ').slice(1).join(' ') || ''
  }
})

const loginComGoogle = async () => {
  loading.value = true
  error.value = ''
  try {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(firebaseAuth, provider)
    usuarioGoogle.value = result.user
  } catch (e) {
    error.value = 'Erro ao fazer login com Google: ' + e.message
  } finally {
    loading.value = false
  }
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '')
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false
  let soma = 0, resto
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.substring(9, 10))) return false
  soma = 0
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.substring(10, 11))) return false
  return true
}

function aplicarMascaraCPF(valor) {
  valor = valor.replace(/\D/g, '')
  valor = valor.replace(/(\d{3})(\d)/, '$1.$2')
  valor = valor.replace(/(\d{3})(\d)/, '$1.$2')
  valor = valor.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  return valor
}

async function salvarUsuarioFirestore() {
  loading.value = true
  error.value = ''
  try {
    const user = firebaseAuth.currentUser
    if (!user) throw new Error('Usuário não autenticado')
    if (!validarCPF(form.value.cpf)) throw new Error('CPF inválido')
    // Verifica se já existe usuário com o mesmo CPF
    const usuariosRef = collection(db, 'usuarios')
    const q = query(usuariosRef, where('cpf', '==', form.value.cpf))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) throw new Error('Já existe um usuário cadastrado com este CPF')
    await setDoc(doc(db, 'usuarios', user.uid), {
      nome: form.value.nome,
      sobrenome: form.value.sobrenome,
      cpf: form.value.cpf,
      cidade: form.value.cidade,
      paisOrigem: form.value.paisOrigem,
      aceitouTermos: form.value.aceitouTermos,
      dataCadastro: new Date(),
      trialExpiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      plano: 'trial',
      planoExpiraEm: null,
      estacoesConcluidas: [],
      nivelHabilidade: 0,
      statistics: {},
      ranking: 0,
      status: 'disponivel',
    })
    router.push('/app/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="fill-height d-flex align-center justify-center" style="background: #f5f5f9;">
    <v-card class="pa-6" max-width="500" elevation="10" rounded="lg">
      <v-card-title class="justify-center">
        <v-avatar color="primary" size="48" class="mb-2">
          <v-icon size="32">mdi-account-plus</v-icon>
        </v-avatar>
      </v-card-title>
      <v-card-subtitle class="text-center mb-4">
        <span class="text-h5 font-weight-bold">Cadastro</span>
        <div class="text-body-2 mt-1">Cadastre-se com Google e complete seus dados</div>
      </v-card-subtitle>
      <v-card-text>
        <v-btn
          v-if="!usuarioGoogle"
          @click="loginComGoogle"
          color="primary"
          block
          class="mb-4"
          :loading="loading"
        >
          <v-icon left>mdi-google</v-icon>
          Entrar com Google
        </v-btn>

        <v-form v-if="usuarioGoogle" @submit.prevent="salvarUsuarioFirestore">
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.nome" label="Nome" required prepend-inner-icon="mdi-account" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.sobrenome" label="Sobrenome" required prepend-inner-icon="mdi-account-outline" />
            </v-col>
            <v-col cols="12" sm="12">
              <v-text-field
                v-model="form.cpf"
                label="CPF"
                required
                prepend-inner-icon="mdi-card-account-details"
                maxlength="14"
                hint="Digite apenas números"
                persistent-hint
                @input="form.cpf = aplicarMascaraCPF(form.cpf)"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.cidade" label="Cidade" prepend-inner-icon="mdi-city" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.paisOrigem" label="País de Origem" prepend-inner-icon="mdi-earth" />
            </v-col>
          </v-row>

          <v-checkbox
            v-model="form.aceitouTermos"
            label="Li e aceito os termos de uso"
            required
            class="mt-2"
          />

          <v-alert v-if="error" type="error" class="my-2" dense>
            <v-icon left>mdi-alert-circle</v-icon>
            {{ error }}
          </v-alert>

          <v-btn
            :loading="loading"
            type="submit"
            color="success"
            block
            class="mt-4"
            :disabled="!form.nome || !form.sobrenome || !form.cpf || !form.aceitouTermos"
          >
            <v-icon left>mdi-arrow-right-bold</v-icon>
            Salvar e Continuar
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>
