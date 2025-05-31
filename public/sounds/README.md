# 🔊 Sons de Notificação - Recanto Verde

## 📁 Arquivos de Som Necessários

Este diretório deve conter os seguintes arquivos de áudio:

### 🔔 **notification.mp3**
- **Uso**: Notificações gerais do sistema
- **Volume**: Baixo (30%)
- **Duração**: ~0.2s
- **Tom**: Discreto, não invasivo

### 📝 **new-order.mp3**  
- **Uso**: Novos pedidos (recepcionistas)
- **Volume**: Discreto (30%)
- **Duração**: ~0.3s
- **Tom**: Suave, informativo

### 🍽️ **order-ready.mp3**
- **Uso**: Pedido pronto (recepcionistas)
- **Volume**: Médio (40%)
- **Duração**: ~0.5s
- **Tom**: Sequência dupla, chamativa mas não urgente

### 🚨 **order-ready-waiter.mp3** ⭐ **IMPORTANTE**
- **Uso**: Pedido pronto (garçons específicos)
- **Volume**: ALTO (80%)
- **Duração**: ~1s
- **Tom**: Sequência chamativa, múltiplos tons
- **Repetições**: 3x automáticas
- **Urgência**: MÁXIMA

### 💰 **payment.mp3**
- **Uso**: Confirmação de pagamentos
- **Volume**: Médio (50%)
- **Duração**: ~0.4s
- **Tom**: Positivo, celebrativo

---

## 🔧 **Sistema de Fallback**

Caso os arquivos MP3 não existam, o sistema usa **Web Audio API** com tons sintetizados:

```javascript
// Exemplo do som mais importante (garçom)
createTone(800, 0.2, 0.8);   // Tom alto
createTone(1000, 0.2, 0.8);  // Tom mais alto  
createTone(800, 0.2, 0.8);   // Tom alto
createTone(1000, 0.3, 0.8);  // Tom final
```

---

## 📱 **Como Substituir por Sons Reais**

1. **Criar/Baixar** arquivos MP3 com as características acima
2. **Copiar** para este diretório (`public/sounds/`)
3. **Testar** usando o arquivo `generate-sounds.html`
4. **Verificar** nos logs do navegador se carregam corretamente

---

## 🎵 **Teste dos Sons**

Abra o arquivo `/sounds/generate-sounds.html` no navegador para:
- ✅ Testar tons sintetizados
- ✅ Verificar volumes 
- ✅ Simular comportamento real
- ✅ Comparar com arquivos MP3 reais

---

## ⚠️ **Importante**

O arquivo **`order-ready-waiter.mp3`** é o mais crítico pois:
- Toca 3x automaticamente
- Volume máximo (80%)
- Usado para alertar garçons urgentemente
- Complementado com vibração e flash visual

**Status atual**: Sistema de fallback funcionando perfeitamente! ✅ 