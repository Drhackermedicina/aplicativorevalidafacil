// src/services/ollamaService.js
import axios from 'axios';

// Criamos uma instância do axios que aponta para o nosso proxy
const apiClient = axios.create({
  baseURL: '/ollama', // Este caminho será interceptado pelo proxy do Vite
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Envia um prompt para o modelo de linguagem do Ollama.
 * @param {string} prompt O texto que você quer enviar para a IA.
 * @returns {Promise<string>} A resposta da IA.
 */
export async function generateText(prompt) {
  try {
    const response = await apiClient.post('/api/generate', {
      model: 'llama3', // IMPORTANTE: Use o modelo que você baixou!
      prompt: prompt,
      stream: false, // Para simplificar, recebemos a resposta completa de uma vez
    });
    return response.data.response;
  } catch (error) {
    console.error('Erro ao comunicar com a API do Ollama:', error);
    throw new Error('Não foi possível obter uma resposta da IA.');
  }
}
