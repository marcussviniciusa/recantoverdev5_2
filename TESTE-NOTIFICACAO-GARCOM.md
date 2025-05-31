# 🔔 Sistema de Notificação para Garçons - Teste

## **Status Atual**
✅ Sistema implementado e funcionando
🧪 Modo de teste ativo para verificação

## **Como Testar**

### **1. Acesso ao Sistema**
1. Acesse: http://localhost:3000
2. Faça login como **garçom** (usuário: teste, senha: 123456)
3. Vá para a página "Mesas"

### **2. Teste Manual**
Na página de mesas do garçom, há um botão azul "**Testar Notificação Visual**"

**O que deve acontecer ao clicar:**
- 🎵 **Som alto** (3x repetições)
- 📳 **Vibração** (dispositivos móveis)
- 🟡 **Flash verde** na tela por 1 segundo
- 🚨 **Alerta visual** no canto superior direito
- 🔔 **Notificação do browser** (se permitido)

### **3. Teste Real**
1. **Como recepcionista**: Marque um pedido como "pronto"
2. **Como garçom**: Deve receber notificação automaticamente

## **Arquitetura Implementada**

### **Fluxo de Notificação:**
```
Recepcionista marca pedido "pronto" 
    ↓
API emite evento Socket.IO "waiter_order_ready"
    ↓
Socket Provider recebe e processa
    ↓
WaiterOrderAlert exibe alerta visual
```

### **Componentes:**
- **`/src/lib/socket.tsx`**: Gerencia conexão e eventos
- **`/src/components/WaiterOrderAlert.tsx`**: Alerta visual
- **`/src/app/api/orders/[id]/status/route.ts`**: API que emite eventos

### **Eventos Socket.IO:**
- `waiter_order_ready`: Notificação específica para garçom
- `test_waiter_notification`: Evento de teste

## **Logs de Debug**

### **Console do Garçom:**
```
🚨 WaiterOrderAlert - Componente montado
🔌 Socket disponível: true
👤 UserRole: garcom
✅ Usuário é garçom - configurando sistema de alertas
🔄 Monitorando notificações - total: X
🔔 Notificações filtradas para garçom: X
🚨 Alertas criados: X
```

### **Console do Servidor:**
```
✅ Status do pedido XXX atualizado para 'pronto'
📡 Emitindo evento Socket.IO para atualização de status...
🔔🎵 Emitindo notificação sonora específica para garçom...
🎯 Notificação sonora enviada especificamente para garçom XXX
```

## **Troubleshooting**

### **Notificação não aparece:**
1. ✅ Verificar se está logado como garçom
2. ✅ Verificar console para logs de debug
3. ✅ Testar com botão de teste primeiro
4. ✅ Verificar se Socket.IO está conectado

### **Som não toca:**
1. ✅ Verificar volume do dispositivo
2. ✅ Permitir reprodução automática no browser
3. ✅ Fallback: Web Audio API gera tons básicos

### **Vibração não funciona:**
1. ✅ Apenas em dispositivos móveis
2. ✅ Verificar se browser suporta `navigator.vibrate`

## **Próximos Passos**
1. 🧪 Remover botão de teste após validação
2. 🎵 Adicionar arquivos MP3 reais em `/public/sounds/`
3. 🔧 Ajustar volumes e durações conforme feedback
4. 📱 Testar em dispositivos móveis reais

## **Arquivos Modificados**
- `src/lib/socket.tsx` - Sistema de notificação
- `src/components/WaiterOrderAlert.tsx` - Alerta visual
- `src/app/garcom/mesas/page.tsx` - Botão de teste
- `src/app/api/orders/[id]/status/route.ts` - Emissão de eventos 