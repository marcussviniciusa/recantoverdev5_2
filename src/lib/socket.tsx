'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Tipos para notificações
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: Notification[];
  unreadCount: number;
  connect: (userData: any) => void;
  disconnect: () => void;
  markAsRead: (notificationId: string) => void;
  clearNotifications: () => void;
  emitEvent: (event: string, data: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket deve ser usado dentro de um SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const connectingRef = useRef<boolean>(false);
  const userDataRef = useRef<any | null>(null);
  
  // Sons de notificação usando Web Audio API
  const playNotificationSound = (type: string, userRole?: string) => {
    if (typeof window !== 'undefined') {
      // Usar diretamente Web Audio API para evitar 404s
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const createTone = (frequency: number, duration: number, volume: number = 0.3) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = frequency;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        };

        switch (type) {
          case 'order_ready_waiter':
            // Sequência chamativa para garçom: 3 tons altos
            createTone(800, 0.2, 0.8);
            setTimeout(() => createTone(1000, 0.2, 0.8), 200);
            setTimeout(() => createTone(800, 0.2, 0.8), 400);
            setTimeout(() => createTone(1000, 0.3, 0.8), 600);
            break;
            
          case 'new_order':
            // Tom discreto para novos pedidos
            createTone(400, 0.3, 0.3);
            break;
            
          case 'order_ready':
            // Tom médio para recepcionistas
            createTone(600, 0.4, 0.4);
            setTimeout(() => createTone(800, 0.2, 0.4), 400);
            break;
            
          case 'payment_received':
            // Tom para pagamento
            createTone(700, 0.3, 0.5);
            setTimeout(() => createTone(900, 0.2, 0.5), 300);
            break;
            
          default:
            // Som padrão
            createTone(500, 0.2, 0.3);
        }
      } catch (error) {
        console.warn('Web Audio API não disponível:', error);
      }
    }
  };

  // Mostrar notificação do browser
  const showBrowserNotification = (notification: Notification) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id
      });
    }
  };

  // Pedir permissão para notificações
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  };

  const connect = (userData: any) => {
    // Evitar múltiplas conexões
    if (socketRef.current?.connected) {
      return;
    }
    
    if (connectingRef.current) {
      return;
    }

    connectingRef.current = true;
    
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

    newSocket.on('connect', () => {
      setIsConnected(true);
      connectingRef.current = false;
      
      // Autenticar usuário
      newSocket.emit('authenticate', userData);
    });

    newSocket.on('authenticated', () => {
      requestNotificationPermission();
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
    });

    newSocket.on('reconnect', () => {
      setIsConnected(true);
      // Reautenticar após reconexão
      newSocket.emit('authenticate', userData);
    });

    // === LISTENERS DE NOTIFICAÇÕES ===

    // Novos pedidos
    newSocket.on('new_order', (data) => {
      const notification: Notification = {
        id: `order_${data.order._id}_${Date.now()}`,
        type: 'new_order',
        title: data.title,
        message: data.message,
        timestamp: new Date(data.timestamp),
        read: false,
        data: data.order
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Limitar a 50 notificações
      playNotificationSound('new_order');
      showBrowserNotification(notification);
    });

    // Updates de pedidos
    newSocket.on('order_notification', (data) => {
      const notification: Notification = {
        id: `order_update_${data.order._id}_${Date.now()}`,
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: new Date(data.timestamp),
        read: false,
        data: data.order
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      
      // Som específico baseado no status e tipo de usuário
      if (data.status === 'pronto') {
        // Se for garçom e o pedido ficou pronto, tocar som chamativo
        if (userDataRef.current?.role === 'garcom') {
          playNotificationSound('order_ready_waiter', userDataRef.current.role);
          
          // Adicionar vibração se disponível (mobile)
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
        } else {
          // Para recepcionistas, som mais discreto
          playNotificationSound('order_ready', userDataRef.current?.role);
        }
      } else {
        playNotificationSound('default', userDataRef.current?.role);
      }
      showBrowserNotification(notification);
    });

    // Listener específico para notificações de garçom
    newSocket.on('waiter_order_ready', (data) => {
      const notification: Notification = {
        id: `waiter_ready_${data.order._id}_${Date.now()}`,
        type: 'waiter_order_ready',
        title: `🍽️ PEDIDO PRONTO - Mesa ${data.order.tableId.number}!`,
        message: `Seu pedido está pronto para entrega! ${data.order.items.length} item(s)`,
        timestamp: new Date(),
        read: false,
        data: data.order
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      
      // Som muito chamativo apenas para garçons
      playNotificationSound('order_ready_waiter', 'garcom');
      
      // Vibração intensa para chamar atenção
      if (navigator.vibrate) {
        navigator.vibrate([300, 200, 300, 200, 300, 200, 300]);
      }
      
      // Notificação visual mais chamativa
      showBrowserNotification(notification);
      
      // Flash visual na tela para chamar ainda mais atenção
      if (document.body) {
        document.body.style.backgroundColor = '#fef3c7'; // Amarelo claro
        setTimeout(() => {
          document.body.style.backgroundColor = '';
        }, 500);
      }
    });

    // Notificações de mesa
    newSocket.on('table_notification', (data) => {
      const notification: Notification = {
        id: `table_${data.table._id}_${Date.now()}`,
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: new Date(data.timestamp),
        read: false,
        data: data.table
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      playNotificationSound('default');
      showBrowserNotification(notification);
    });

    // Notificações de pagamento
    newSocket.on('payment_notification', (data) => {
      const notification: Notification = {
        id: `payment_${data.payment._id}_${Date.now()}`,
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: new Date(data.timestamp),
        read: false,
        data: data.payment
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      playNotificationSound('default');
      showBrowserNotification(notification);
    });

    // Notificações de usuário
    newSocket.on('user_notification', (data) => {
      const notification: Notification = {
        id: `user_${data.user._id}_${Date.now()}`,
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: new Date(data.timestamp),
        read: false,
        data: data.user
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      playNotificationSound('default');
      showBrowserNotification(notification);
    });

    // Notificações do sistema
    newSocket.on('system_notification', (data) => {
      const notification: Notification = {
        id: `system_${Date.now()}`,
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: new Date(data.timestamp),
        read: false,
        data: null
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      playNotificationSound('default');
      showBrowserNotification(notification);
    });

    // Erros de conexão
    newSocket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão Socket.IO:', error);
      connectingRef.current = false;
    });

    console.log('📡 Socket criado, aguardando conexão...');
    socketRef.current = newSocket;
    setSocket(newSocket);
    userDataRef.current = userData;
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      connectingRef.current = false;
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId
          ? { ...notif, read: true }
          : notif
      )
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const emitEvent = (event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  };

  // Disponibilizar a função de emit globalmente para integração
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).socketEmitter = emitEvent;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).socketEmitter;
      }
    };
  }, []);

  // Limpeza na desmontagem
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Calcular notificações não lidas
  const unreadCount = notifications.filter(notif => !notif.read).length;

  const value: SocketContextType = {
    socket,
    isConnected,
    notifications,
    unreadCount,
    connect,
    disconnect,
    markAsRead,
    clearNotifications,
    emitEvent
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export type { Notification }; 