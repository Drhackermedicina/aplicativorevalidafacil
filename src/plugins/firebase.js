// src/plugins/firebase.js

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDuakOooHv9a5slO0I3o3gttSBlSXD0aWw",
  authDomain: "revalida-companion.firebaseapp.com",
  projectId: "revalida-companion",
  storageBucket: "revalida-companion.firebasestorage.app",
  messagingSenderId: "772316263153",
  appId: "1:772316263153:web:d0af4ecc404b6ca16a2f50"
}

const firebaseApp = initializeApp(firebaseConfig)

// Debug da configuração
console.log('Firebase App configurado com Storage Bucket:', firebaseConfig.storageBucket);

export { firebaseApp }
export const firebaseAuth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)

// Debug do storage inicializado
console.log('Storage inicializado:', storage);
