// src/plugins/socket.js
import { io } from 'socket.io-client'

let socket

function connectSocket(params = {}) {
  if (socket) return socket
  socket = io('https://backendraiway-production.up.railway.app', {
    autoConnect: true,
    transports: ['websocket'],
    auth: params, // Corrigido: agora envia os parâmetros corretamente
  })
  return socket
}

export { connectSocket }

