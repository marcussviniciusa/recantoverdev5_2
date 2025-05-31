# 🔧 Instruções para Teste - Correção userId

## **Problema Corrigido:**
- O frontend estava tentando usar `data.data.user._id`
- Mas a API retorna `data.data.user.id` (função sanitizeUser)
- Agora está corrigido para usar o campo correto

## **Para testar:**

### **1. Limpar localStorage**
Abra o console do navegador (F12) e execute:
```javascript
localStorage.clear();
console.log('LocalStorage limpo!');
```

### **2. Fazer novo login**
1. Acesse: http://localhost:3000/auth/login?role=garcom
2. Faça login normalmente
3. **Observe os logs** no console

### **3. Logs esperados no login:**
```
🔍 Resposta da API de login: {...}
📋 Dados do usuário da API: {...}
🆔 ID do usuário (id): "6839a426ec438674770d4cb9"
✅ Verificando localStorage após salvamento:
- userId salvo: "6839a426ec438674770d4cb9"
```

### **4. Logs esperados na página de mesas:**
```
🔍 Dados para socket: { token: true, userRole: "garcom", userId: "6839a426ec438674770d4cb9" }
🔌 Conectando garçom ao Socket.IO...
📋 Dados do usuário: { userId: "6839a426ec438674770d4cb9", userRole: "garcom" }
✅ Socket conectado com sucesso!
🎉 Usuário autenticado com sucesso!
```

### **5. Teste real:**
1. **Como garçom**: Crie um pedido na mesa
2. **Como recepcionista**: Marque o pedido como "pronto"
3. **Verifique**: Deve aparecer notificação visual no garçom

### **6. Logs esperados quando pedido fica pronto:**
```
🎯 EVENTO waiter_order_ready RECEBIDO NO CLIENTE!
👤 Dados do usuário conectado: { id: "6839a426ec438674770d4cb9", role: "garcom" }
📝 Criando notificação: {...}
📋 Notificações atualizadas. Total: 1
🔔🎵 TOCANDO SOM CHAMATIVO PARA GARÇOM!
```

## **Se ainda não funcionar:**
Verifique se:
1. O userId está correto nos logs
2. O Socket.IO está conectado (🟢 Conectado)
3. O servidor está emitindo para o ID correto
4. Os listeners estão registrados

---
**Agora deve funcionar perfeitamente! 🚨🔔** 