import App from '@/App.vue'
import { registerPlugins } from '@core/utils/plugins'
import { createApp } from 'vue'

// O plugin de autenticação não precisa mais ser importado aqui

// Styles
import '@core/scss/template/index.scss'
import '@layouts/styles/index.scss'
import '@styles/styles.scss'

const app = createApp(App)

// Registra os plugins e monta o app imediatamente, de forma padrão.
registerPlugins(app)
app.mount('#app')
