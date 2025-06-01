# 🔧 Correção do Socket.IO no Deploy - Recanto Verde

## ❌ Problema Identificado

O Socket.IO não estava funcionando no ambiente de produção Docker por 3 motivos principais:

1. **Server.js não copiado**: O Dockerfile não estava copiando o `server.js` customizado
2. **Hostname incorreto**: O server estava usando `localhost` em vez de `0.0.0.0` no Docker  
3. **Configuração Traefik**: Faltavam headers específicos para WebSocket

## ✅ Correções Implementadas

### 1. **Dockerfile Atualizado**
```dockerfile
# Copy server.js customizado com Socket.IO
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

# Instalar dependências de produção necessárias para o Socket.IO
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
RUN npm ci --only=production && npm cache clean --force
```

### 2. **Server.js Corrigido**
```javascript
// Antes
const hostname = 'localhost';

// Depois
const hostname = process.env.HOSTNAME || (dev ? 'localhost' : '0.0.0.0');
```

### 3. **Socket.IO Cliente Melhorado**
```javascript
// Configurar URL do Socket.IO baseado no ambiente
const socketUrl = process.env.NODE_ENV === 'production' 
  ? undefined // Em produção, conecta ao mesmo domínio
  : 'http://localhost:3000'; // Em desenvolvimento, conecta ao servidor local

const newSocket = io(socketUrl, {
  timeout: 5000,
  retries: 3,
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling'] // Especificar transports explicitamente
});
```

### 4. **Docker-Compose com WebSocket**
```yaml
labels:
  # Configurações para WebSocket/Socket.IO
  - "traefik.http.services.recanto-app.loadbalancer.sticky.cookie=true"
  - "traefik.http.services.recanto-app.loadbalancer.sticky.cookie.name=recanto-lb"
  # Headers para WebSocket
  - "traefik.http.middlewares.recanto-headers.headers.customrequestheaders.Upgrade=websocket"
  - "traefik.http.middlewares.recanto-headers.headers.customrequestheaders.Connection=upgrade"
  - "traefik.http.routers.recanto-secure.middlewares=recanto-headers"
```

## 🚀 Como Fazer o Deploy

### 1. **Build nova imagem:**
```bash
sudo docker build -t marcussviniciusa/recantoverde:latest .
sudo docker push marcussviniciusa/recantoverde:latest
```

### 2. **Atualizar no servidor:**
```bash
cd /opt/recanto-verde
docker-compose down
docker-compose pull
docker-compose up -d
```

### 3. **Verificar logs:**
```bash
docker-compose logs -f recanto-app
```

## ✅ Como Verificar se Funcionou

### **Logs do Servidor:**
Procure por estas mensagens nos logs:
```
🚀 Servidor rodando em http://0.0.0.0:3000
⚡ Socket.IO habilitado para notificações em tempo real
```

### **Logs de Conexão:**
Quando usuários se conectam:
```
🔌 10 conexões ativas
📊 Status: 5 conexões ativas, 3 usuários autenticados
```

### **Logs de Notificações:**
Quando eventos ocorrem:
```
📝 Novo pedido: [ID]
✅ Evento Socket.IO emitido com sucesso!
🔄 Pedido atualizado: [ID] → pronto
```

### **Teste Manual:**
1. Abra 2 abas: Admin e Garçom
2. Crie um pedido no Garçom  
3. Verifique se aparece instantaneamente no Admin
4. Mude status para "pronto" no Admin
5. Verifique se garçom recebe notificação

## 🔍 Troubleshooting

### **Se ainda não funcionar:**

1. **Verificar se server.js está sendo usado:**
```bash
docker exec -it recanto-app ls -la server.js
```

2. **Verificar logs de conexão WebSocket:**
```bash
docker-compose logs -f | grep -i socket
```

3. **Verificar se Traefik está passando headers:**
```bash
curl -H "Host: recantoverde.marcussviniciusa.cloud" \
     -H "Upgrade: websocket" \
     -H "Connection: upgrade" \
     https://recantoverde.marcussviniciusa.cloud/socket.io/
```

4. **Verificar no navegador:**
- Abrir DevTools → Network
- Procurar por conexões `socket.io`
- Verificar se WebSocket está estabelecido

### **Comandos úteis de debug:**
```bash
# Ver se Socket.IO está ativo
docker exec -it recanto-app netstat -tulpn | grep 3000

# Ver processos
docker exec -it recanto-app ps aux

# Logs em tempo real filtrados
docker-compose logs -f | grep -E "(Socket|🔌|📡|⚠️)"
```

## 📊 Estrutura Esperada

Após o deploy, a estrutura deve ser:
```
/app/
├── server.js              ← ✅ Servidor customizado com Socket.IO
├── package.json           ← ✅ Dependências do Socket.IO
├── node_modules/          ← ✅ Socket.IO instalado
├── .next/
│   └── standalone/        ← ✅ Build do Next.js
└── public/                ← ✅ Assets estáticos
```

## 🎯 Resultado Esperado

Com estas correções, o sistema deve:

- ✅ Conectar ao Socket.IO automaticamente
- ✅ Mostrar notificações em tempo real
- ✅ Não mostrar mais "Socket.IO não disponível"
- ✅ Exibir contadores de conexão nos logs
- ✅ Funcionar tanto em HTTP quanto HTTPS
- ✅ Suportar WebSocket e fallback para polling

**Mensagem de sucesso nos logs:**
```
⚡ Socket.IO habilitado para notificações em tempo real
📊 Logs otimizados - conexões agrupadas para reduzir spam
🔌 5 conexões ativas
``` 