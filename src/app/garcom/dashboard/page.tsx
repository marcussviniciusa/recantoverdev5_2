'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSocket } from '../../../lib/socket';

interface Table {
  _id: string;
  number: number;
  capacity: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'manutencao';
}

interface Order {
  _id: string;
  tableId: {
    _id: string;
    number: number;
  };
  waiterId: {
    _id: string;
    username: string;
  };
  status: 'pendente' | 'preparando' | 'pronto' | 'entregue';
  totalAmount: number;
  items: {
    productName: string;
    quantity: number;
  }[];
  createdAt: string;
}

export default function GarcomDashboard() {
  const [myTables, setMyTables] = useState<Table[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { notifications, unreadCount } = useSocket();

  // Buscar mesas atribuídas
  const fetchMyTables = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('userName');
      
      console.log('🔍 Dashboard - UserID:', userId);
      console.log('🔍 Dashboard - UserName:', userName);
      
      const response = await fetch('/api/tables', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('📊 Dashboard - Todas as mesas:', data.data.tables.length);
          console.log('🔍 Dashboard - Estrutura da primeira mesa:', data.data.tables[0]);
          
          // Como as mesas não têm assignedWaiter, vamos mostrar todas as mesas
          // e filtrar pelos pedidos do garçom nas próximas funções
          const allTables = data.data.tables || [];
          console.log('📊 Dashboard - Mostrando todas as mesas disponíveis:', allTables.length);
          setMyTables(allTables);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar mesas:', error);
    }
  };

  // Buscar pedidos do garçom
  const fetchMyOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('userName');
      
      const response = await fetch('/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('📊 Dashboard - Todos os pedidos:', data.data.orders.length);
          console.log('🔍 Dashboard - Estrutura do primeiro pedido:', data.data.orders[0]);
          
          // Filtrar pedidos pelo waiterId (ObjectId simples na estrutura real)
          const myOrdersList = data.data.orders.filter((order: any) => {
            // Se waiterId for um objeto, usar _id, senão comparar diretamente
            const orderWaiterId = typeof order.waiterId === 'object' ? order.waiterId._id : order.waiterId;
            return orderWaiterId === userId;
          });
          console.log('📊 Dashboard - Pedidos do garçom:', myOrdersList.length);
          setMyOrders(myOrdersList);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTables();
    fetchMyOrders();
  }, []);

  // Atualizar automaticamente a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMyTables();
      fetchMyOrders();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Estatísticas rápidas
  const stats = {
    totalTables: myTables.length,
    occupiedTables: myTables.filter(t => t.status === 'ocupada').length,
    freeTables: myTables.filter(t => t.status === 'disponivel').length,
    pendingOrders: myOrders.filter(o => o.status === 'pendente').length,
    preparingOrders: myOrders.filter(o => o.status === 'preparando').length,
    readyOrders: myOrders.filter(o => o.status === 'pronto').length,
    todayRevenue: myOrders
      .filter(o => {
        const today = new Date().toDateString();
        const orderDate = new Date(o.createdAt).toDateString();
        return today === orderDate;
      })
      .reduce((sum, order) => sum + order.totalAmount, 0)
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          Bem-vindo, {localStorage.getItem('userName')}!
        </h1>
        <p className="text-gray-600 mt-2">
          Seu painel de controle como garçom
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800 text-sm font-medium">Mesas Atribuídas</div>
          <div className="text-2xl font-bold text-blue-900">{stats.totalTables}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-800 text-sm font-medium">Mesas Ocupadas</div>
          <div className="text-2xl font-bold text-green-900">{stats.occupiedTables}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-yellow-800 text-sm font-medium">Pedidos Pendentes</div>
          <div className="text-2xl font-bold text-yellow-900">{stats.pendingOrders}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 text-sm font-medium">Pedidos Prontos</div>
          <div className="text-2xl font-bold text-red-900">{stats.readyOrders}</div>
        </div>
      </div>

      {/* Notificações recentes */}
      {unreadCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            <div className="font-medium text-orange-800">
              Você tem {unreadCount} notificação{unreadCount > 1 ? 'ões' : ''} não lida{unreadCount > 1 ? 's' : ''}
            </div>
          </div>
          <div className="mt-2 text-sm text-orange-700">
            Verifique o ícone de notificações no canto superior direito para mais detalhes.
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Minhas Mesas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Minhas Mesas</h3>
            <Link
              href="/garcom/mesas"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Ver todas →
            </Link>
          </div>
          
          {myTables.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              Nenhuma mesa atribuída
            </div>
          ) : (
            <div className="space-y-3">
              {myTables.slice(0, 3).map((table) => (
                <div key={table._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">Mesa {table.number}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      table.status === 'disponivel' ? 'bg-green-100 text-green-800' :
                      table.status === 'ocupada' ? 'bg-red-100 text-red-800' :
                      table.status === 'reservada' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {table.status === 'disponivel' ? 'Livre' :
                       table.status === 'ocupada' ? 'Ocupada' :
                       table.status === 'reservada' ? 'Reservada' : 'Manutenção'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{table.capacity} pessoas</span>
                </div>
              ))}
              {myTables.length > 3 && (
                <div className="text-center text-sm text-gray-500">
                  +{myTables.length - 3} mesa{myTables.length - 3 > 1 ? 's' : ''} adiciona{myTables.length - 3 > 1 ? 'is' : 'l'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pedidos Ativos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pedidos Ativos</h3>
            <Link
              href="/garcom/pedidos"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Ver todos →
            </Link>
          </div>
          
          {myOrders.filter(o => o.status !== 'entregue').length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              Nenhum pedido ativo
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders
                .filter(o => o.status !== 'entregue')
                .slice(0, 3)
                .map((order) => (
                  <div key={order._id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Mesa {order.tableId.number}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'preparando' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {order.status === 'pendente' ? 'Pendente' :
                         order.status === 'preparando' ? 'Preparando' : 'Pronto'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {order.items.length} item{order.items.length > 1 ? 's' : ''} • R$ {order.totalAmount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTime(order.createdAt)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Resumo do Dia */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Dia</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-green-800 font-medium">Faturamento</span>
              <span className="text-green-900 font-bold">R$ {stats.todayRevenue.toFixed(2)}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-center p-2 bg-blue-50 rounded">
                <div className="font-medium text-blue-900">{stats.preparingOrders}</div>
                <div className="text-blue-700">Preparando</div>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <div className="font-medium text-green-900">{stats.readyOrders}</div>
                <div className="text-green-700">Prontos</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Link
            href="/garcom/mesas"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">Visualizar Mesas</div>
              <div className="text-sm text-gray-500">Veja suas mesas atribuídas</div>
            </div>
          </Link>

          <Link
            href="/garcom/pedidos"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">Meus Pedidos</div>
              <div className="text-sm text-gray-500">Acompanhe seus pedidos</div>
            </div>
          </Link>

          <Link
            href="/garcom/pagamentos"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">Meus Pagamentos</div>
              <div className="text-sm text-gray-500">Controle suas contas</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Nova seção para Atualizar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sistema</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">Atualizar Dados</div>
              <div className="text-sm text-gray-500">Recarregar informações do sistema</div>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around">
          <button className="flex flex-col items-center py-2 px-4 text-green-600">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Dashboard</span>
          </button>
          <Link href="/garcom/mesas" className="flex flex-col items-center py-2 px-4 text-gray-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
            <span className="text-xs">Mesas</span>
          </Link>
          <Link href="/garcom/pedidos" className="flex flex-col items-center py-2 px-4 text-gray-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Pedidos</span>
          </Link>
          <Link href="/garcom/pagamentos" className="flex flex-col items-center py-2 px-4 text-gray-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            <span className="text-xs">Pagamentos</span>
          </Link>
        </div>
      </nav>
    </div>
  );
} 