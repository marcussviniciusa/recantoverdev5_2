# 🚀 Deploy Manual - Recanto Verde

## 📋 Pré-requisitos no Servidor

- ✅ Docker instalado
- ✅ Traefik configurado e rodando
- ✅ MongoDB configurado e rodando  
- ✅ Portainer instalado (opcional)

## 🐳 1. Build e Push da Imagem

### Build local:
```bash
sudo docker build -t marcussviniciusa/recantoverde:latest .
```

### Login no Docker Hub:
```bash
sudo docker login
```

### Push para Docker Hub:
```bash
sudo docker push marcussviniciusa/recantoverde:latest
```

## ⚙️ 2. Configuração no Servidor

### 2.1. Criar arquivo .env de produção:

```bash
# Criar diretório do projeto
mkdir -p /opt/recanto-verde
cd /opt/recanto-verde

# Criar arquivo .env
nano .env
```

**Conteúdo do .env:**
```env
# Domínio
DOMAIN=seudominio.com.br

# Banco de dados (ajustar conforme sua configuração)
MONGODB_URI=mongodb://usuario:senha@localhost:27017/recanto-verdetest5?authSource=admin

# Segurança (GERAR CHAVES FORTES!)
JWT_SECRET=sua-chave-jwt-super-secreta-32-chars-minimo
NEXTAUTH_SECRET=sua-chave-nextauth-super-secreta
NEXTAUTH_URL=https://seudominio.com.br

# Docker
DOCKER_IMAGE=marcussviniciusa/recantoverde:latest

# Ambiente
NODE_ENV=production
```

### 2.2. Criar docker-compose.yml:

```bash
nano docker-compose.yml
```

**Conteúdo do docker-compose.yml:**
```yaml
version: '3.8'

services:
  recanto-app:
    image: ${DOCKER_IMAGE:-marcussviniciusa/recantoverde:latest}
    container_name: recanto-app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      MONGODB_URI: ${MONGODB_URI}
      JWT_SECRET: ${JWT_SECRET}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
    labels:
      # Traefik labels para proxy reverso
      - traefik.enable=true
      - traefik.docker.network=traefik
      
      # HTTP -> HTTPS redirect
      - traefik.http.routers.recanto-web.rule=Host(`${DOMAIN}`)
      - traefik.http.routers.recanto-web.entrypoints=web
      - traefik.http.routers.recanto-web.middlewares=redirect-to-https
      
      # HTTPS
      - traefik.http.routers.recanto-websecure.rule=Host(`${DOMAIN}`)
      - traefik.http.routers.recanto-websecure.entrypoints=websecure
      - traefik.http.routers.recanto-websecure.tls=true
      - traefik.http.routers.recanto-websecure.tls.certresolver=letsencrypt
      - traefik.http.services.recanto-app.loadbalancer.server.port=3000
      
      # Middleware para redirect
      - traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https
      - traefik.http.middlewares.redirect-to-https.redirectscheme.permanent=true
      
      # Portainer labels (opcional)
      - portainer.managed=true
      - portainer.app=recanto-verde
    networks:
      - traefik
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  traefik:
    external: true
```

## 🚀 3. Deploy

### 3.1. Primeira execução:
```bash
cd /opt/recanto-verde
docker-compose up -d
```

### 3.2. Verificar logs:
```bash
docker-compose logs -f recanto-app
```

### 3.3. Verificar health:
```bash
curl http://localhost:3000/api/health
```

## 🔄 4. Atualizações

### Para atualizar a aplicação:
```bash
# Parar container
docker-compose down

# Baixar nova imagem
docker-compose pull

# Subir novamente
docker-compose up -d

# Verificar logs
docker-compose logs -f recanto-app
```

## 🔍 5. Monitoramento

### Verificar status:
```bash
docker-compose ps
```

### Ver logs em tempo real:
```bash
docker-compose logs -f
```

### Verificar health da aplicação:
```bash
curl https://seudominio.com.br/api/health
```

## ⚠️ 6. Troubleshooting

### Se o container não subir:
1. Verificar logs: `docker-compose logs recanto-app`
2. Verificar variáveis de ambiente no `.env`
3. Verificar se o MongoDB está acessível
4. Verificar se a rede `traefik` existe: `docker network ls`

### Se não conseguir acessar pelo domínio:
1. Verificar se o Traefik está rodando
2. Verificar labels do container
3. Verificar DNS do domínio

### Comandos úteis:
```bash
# Reiniciar apenas a aplicação
docker-compose restart recanto-app

# Ver informações do container
docker inspect recanto-app

# Acessar shell do container
docker exec -it recanto-app sh

# Ver configuração do Traefik
docker logs traefik
```

## 🛡️ 7. Segurança

### Recomendações importantes:
- ✅ Usar chaves JWT e NextAuth fortes (32+ caracteres)
- ✅ Configurar firewall para bloquear portas desnecessárias
- ✅ Manter MongoDB com autenticação habilitada
- ✅ Usar certificados SSL (Let's Encrypt via Traefik)
- ✅ Fazer backup regular do banco de dados
- ✅ Monitorar logs de acesso

### Gerar chaves seguras:
```bash
# Para JWT_SECRET (32 chars):
openssl rand -base64 32

# Para NEXTAUTH_SECRET:
openssl rand -base64 48
``` 