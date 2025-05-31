'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '../lib/socket';

interface OrderAlert {
  id: string;
  title: string;
  message: string;
  tableNumber: number;
  itemCount: number;
  timestamp: Date;
}

export default function WaiterOrderAlert() {
  const [alerts, setAlerts] = useState<OrderAlert[]>([]);
  const { socket, notifications, markAsRead, isConnected } = useSocket();

  // Monitorar notificações do socket provider
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userRole = localStorage.getItem('userRole');
      
      if (userRole !== 'garcom') {
        return;
      }

      // Filtrar notificações de pedidos prontos para garçom
      const waiterNotifications = notifications.filter(notif => {
        return notif.type === 'waiter_order_ready' && !notif.read;
      });

      // Converter notificações em alertas visuais
      const newAlerts = waiterNotifications.map(notif => ({
        id: notif.id,
        title: notif.title,
        message: notif.message,
        tableNumber: notif.data?.tableId?.number || 0,
        itemCount: notif.data?.items?.length || 0,
        timestamp: notif.timestamp
      }));

      setAlerts(newAlerts);
    }
  }, [notifications]);

  const removeAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    markAsRead(alertId);
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-gradient-to-r from-red-500 to-orange-600 text-white p-6 rounded-xl shadow-2xl border-4 border-yellow-400 animate-pulse max-w-sm transform hover:scale-105 transition-all"
          style={{
            animation: 'bounce 0.6s infinite alternate, glow 2s ease-in-out infinite alternate'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-white rounded-full animate-ping mr-3"></div>
              <h3 className="font-black text-xl">🚨 PEDIDO PRONTO!</h3>
            </div>
            <button
              onClick={() => removeAlert(alert.id)}
              className="text-white hover:text-gray-200 text-2xl font-bold bg-red-600 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
          
          <div className="text-sm">
            <div className="font-bold mb-2 text-xl">
              🍽️ Mesa {alert.tableNumber}
            </div>
            <div className="text-base opacity-95 mb-2">
              {alert.itemCount} item(s) prontos para entrega
            </div>
            <div className="mt-3 text-sm bg-white bg-opacity-20 p-2 rounded">
              🏃‍♂️ DIRIJA-SE À COZINHA AGORA!
            </div>
            <div className="mt-2 text-xs opacity-75">
              ⏰ {alert.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes bounce {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-20px); }
        }
        
        @keyframes glow {
          0% { 
            box-shadow: 0 0 20px rgba(255, 255, 0, 0.8);
          }
          100% { 
            box-shadow: 0 0 40px rgba(255, 255, 0, 1), 0 0 60px rgba(255, 165, 0, 0.8);
          }
        }
      `}</style>
    </div>
  );
} 