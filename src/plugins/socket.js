// src/plugins/socket.js
import { backendUrl } from '@/utils/backendUrl.js'
import { io } from 'socket.io-client'

let socket

function connectSocket(params = {}) {
  if (socket) return socket
  socket = io(backendUrl, {
    autoConnect: true,
    transports: ['websocket'],
    auth: params, // Corrigido: agora envia os parâmetros corretamente
  })
  return socket
}

export { connectSocket }

