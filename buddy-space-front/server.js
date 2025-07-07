const express = require('express')
const next = require('next')
const { createProxyMiddleware } = require('http-proxy-middleware')
const http = require('http')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = express()

  // HTTP API 프록시
  server.use(
    '/api',
    createProxyMiddleware({
      target: process.env.NEXT_PUBLIC_CHAT_BASE_URL,
      changeOrigin: true,
    })
  )

  // WS/SockJS 프록시
  const wsProxy = createProxyMiddleware('/ws', {
    target: process.env.NEXT_PUBLIC_CHAT_BASE_URL,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/ws': '/ws' },
  })
  server.use(wsProxy)

  // Next.js 핸들러
  server.all('*', (req, res) => handle(req, res))

  // http 서버로 업그레이드 이벤트도 전달
  const httpServer = http.createServer(server)
  httpServer.on('upgrade', wsProxy.upgrade)
  httpServer.listen(3000, () => {
    console.log('> Ready on http://localhost:3000')
  })
})
