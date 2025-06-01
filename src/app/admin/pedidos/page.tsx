'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '../../../lib/socket';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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
  items: OrderItem[];
  status: 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';
  totalAmount: number;
  observations?: string;
  createdAt: string;
  
  // Campos de cancelamento
  cancelledBy?: {
    username: string;
  };
  cancelledAt?: string;
  cancellationReason?: string;
}

const statusColors = {
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  preparando: 'bg-blue-100 text-blue-800 border-blue-200',
  pronto: 'bg-green-100 text-green-800 border-green-200',
  entregue: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200'
};

const statusLabels = {
  pendente: 'Pendente',
  preparando: 'Preparando',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
};

const nextStatus = {
  pendente: 'preparando',
  preparando: 'pronto',
  pronto: 'entregue',
  entregue: null,
  cancelado: null
};

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Estados para cancelamento
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  const { emitEvent, socket } = useSocket();

  // Buscar pedidos
  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const allOrders = data.data?.orders || data.orders || [];
        
        // Filtrar pedidos válidos (com tableId e waiterId)
        const validOrders = allOrders.filter((order: Order) => 
          order.tableId && 
          order.waiterId && 
          order.tableId.number !== undefined && 
          order.waiterId.username !== undefined
        );
        
        setOrders(validOrders);
      } else {
        console.error('Erro na resposta da API:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar status do pedido
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updatedOrder = await response.json();
        
        // Atualizar estado local
        setOrders(prev => prev.map(order => 
          order._id === orderId 
            ? { ...order, status: newStatus as any }
            : order
        ));

        // Emitir evento via Socket.IO
        emitEvent('order_status_updated', updatedOrder.order);
      }
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      alert('Erro ao atualizar status do pedido');
    }
  };

  // Função para cancelar pedido
  const cancelOrder = async () => {
    if (!orderToCancel || !cancellationReason.trim() || cancellationReason.trim().length < 10) {
      alert('Motivo do cancelamento é obrigatório e deve ter pelo menos 10 caracteres.');
      return;
    }

    setCancelling(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${orderToCancel._id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: cancellationReason.trim() })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Pedido cancelado com sucesso!');
        closeCancelModal();
        fetchOrders(); // Recarregar pedidos
      } else {
        alert('Erro ao cancelar pedido: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      alert('Erro de conexão');
    } finally {
      setCancelling(false);
    }
  };

  // Funções para o modal de cancelamento
  const openCancelModal = (order: Order) => {
    setOrderToCancel(order);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setOrderToCancel(null);
    setCancellationReason('');
    setShowCancelModal(false);
  };

  // Verificar se pode cancelar pedido
  const canCancelOrder = (order: Order) => {
    return order.status !== 'entregue' && order.status !== 'cancelado';
  };

  // Filtrar e ordenar pedidos
  const filteredOrders = orders
    .filter(order => {
      // Filtro por status
      if (filter !== 'todos' && order.status !== filter) return false;
      
      // Filtro por busca
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          (order.tableId?.number?.toString().includes(searchLower)) ||
          (order.waiterId?.username?.toLowerCase().includes(searchLower)) ||
          order._id.toLowerCase().includes(searchLower) ||
          order.items.some(item => 
            item.productName.toLowerCase().includes(searchLower)
          )
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'table':
          aValue = a.tableId?.number || 0;
          bValue = b.tableId?.number || 0;
          break;
        case 'total':
          aValue = a.totalAmount;
          bValue = b.totalAmount;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  useEffect(() => {
    fetchOrders();
  }, []);

  // Escutar eventos Socket.IO
  useEffect(() => {
    if (socket) {
      console.log('🔌 Configurando listeners Socket.IO...');
      
      const handleNewOrder = (data: any) => {
        console.log('🔔 Novo pedido recebido via Socket.IO:', data);
        if (data.order) {
          setOrders(prev => [data.order, ...prev]);
          console.log('✅ Pedido adicionado à lista automaticamente');
        }
      };

      const handleOrderStatusUpdate = (data: any) => {
        console.log('🔄 Status do pedido atualizado via Socket.IO:', data);
        if (data.order) {
          setOrders(prev => prev.map(order => 
            order._id === data.order._id ? data.order : order
          ));
          console.log('✅ Status do pedido atualizado automaticamente');
        }
      };

      // Escutar eventos conforme emitidos pelo servidor Socket.IO
      socket.on('new_order', handleNewOrder);
      socket.on('order_notification', handleOrderStatusUpdate);

      console.log('✅ Listeners Socket.IO configurados');

      return () => {
        console.log('🔌 Removendo listeners Socket.IO...');
        socket.off('new_order', handleNewOrder);
        socket.off('order_notification', handleOrderStatusUpdate);
      };
    }
  }, [socket]);

  // Atualizar automaticamente a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Pedidos</h1>
        <p className="text-gray-600 mt-2">
          Acompanhe e gerencie todos os pedidos em tempo real
        </p>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-yellow-800 text-sm font-medium">Pendentes</div>
          <div className="text-2xl font-bold text-yellow-900">
            {orders.filter(o => o.status === 'pendente').length}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800 text-sm font-medium">Preparando</div>
          <div className="text-2xl font-bold text-blue-900">
            {orders.filter(o => o.status === 'preparando').length}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-800 text-sm font-medium">Prontos</div>
          <div className="text-2xl font-bold text-green-900">
            {orders.filter(o => o.status === 'pronto').length}
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-gray-800 text-sm font-medium">Entregues</div>
          <div className="text-2xl font-bold text-gray-900">
            {orders.filter(o => o.status === 'entregue').length}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 text-sm font-medium">Cancelados</div>
          <div className="text-2xl font-bold text-red-900">
            {orders.filter(o => o.status === 'cancelado').length}
          </div>
        </div>
      </div>

      {/* Filtros e busca */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Busca */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar por mesa, garçom, ID do pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="preparando">Preparando</option>
              <option value="pronto">Pronto</option>
              <option value="entregue">Entregue</option>
              <option value="cancelado">Cancelado</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt">Data/Hora</option>
              <option value="table">Mesa</option>
              <option value="total">Valor Total</option>
              <option value="status">Status</option>
            </select>

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>

            <button
              onClick={fetchOrders}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="text-gray-500 text-lg">
              {searchTerm || filter !== 'todos' 
                ? 'Nenhum pedido encontrado com os filtros aplicados'
                : 'Nenhum pedido cadastrado'
              }
            </div>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order._id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* Header do pedido */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                <div className="flex items-center gap-4 mb-3 lg:mb-0">
                  <div className="text-lg font-semibold text-gray-900">
                    Mesa {order.tableId?.number || 'N/A'}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                  <div className="text-sm text-gray-500">
                    ID: {order._id.slice(-6)}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      R$ {order.totalAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(order.createdAt)} às {formatTime(order.createdAt)}
                    </div>
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="flex gap-2">
                    {canCancelOrder(order) && (
                      <button
                        onClick={() => openCancelModal(order)}
                        className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 transition-colors"
                      >
                        🚫 Cancelar
                      </button>
                    )}
                    {nextStatus[order.status] && (
                      <button
                        onClick={() => updateOrderStatus(order._id, nextStatus[order.status] as string)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors"
                      >
                        → {statusLabels[nextStatus[order.status] as keyof typeof statusLabels]}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Detalhes do pedido */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Itens do pedido */}
                <div className="lg:col-span-2">
                  <h4 className="font-medium text-gray-900 mb-3">Itens do Pedido</h4>
                  <div className="space-y-2">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex-1">
                          <span className="font-medium">{item.productName}</span>
                          <span className="text-gray-500 ml-2">x{item.quantity}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">R$ {item.totalPrice.toFixed(2)}</div>
                          <div className="text-sm text-gray-500">
                            R$ {item.unitPrice.toFixed(2)} cada
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Informações adicionais */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Informações</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Garçom:</span>
                      <span className="ml-2 font-medium">{order.waiterId?.username || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Itens:</span>
                      <span className="ml-2 font-medium">{order.items.length}</span>
                    </div>
                    {order.observations && (
                      <div>
                        <span className="text-gray-500">Observações:</span>
                        <div className="mt-1 p-2 bg-gray-50 rounded text-sm">
                          {order.observations}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Informações de cancelamento */}
              {order.status === 'cancelado' && order.cancellationReason && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 text-sm">🚫</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-red-800 mb-1">Pedido Cancelado</h4>
                      <p className="text-sm text-red-700 mb-2">
                        <strong>Motivo:</strong> {order.cancellationReason}
                      </p>
                      {order.cancelledBy && (
                        <p className="text-xs text-red-600">
                          Cancelado por: {order.cancelledBy.username}
                          {order.cancelledAt && ` em ${new Date(order.cancelledAt).toLocaleString('pt-BR')}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer com total */}
      {filteredOrders.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex justify-between items-center">
            <div className="text-gray-600">
              Mostrando {filteredOrders.length} de {orders.length} pedidos
            </div>
            <div className="text-lg font-bold text-gray-900">
              Total: R$ {filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento */}
      {showCancelModal && orderToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Header do Modal */}
            <div className="bg-red-600 text-white p-6 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Cancelar Pedido</h2>
                <p className="text-red-100 mt-1">
                  Mesa {orderToCancel.tableId.number} • R$ {orderToCancel.totalAmount.toFixed(2)}
                </p>
              </div>
              <button
                onClick={closeCancelModal}
                className="text-white hover:text-gray-200 text-2xl font-bold w-8 h-8 flex items-center justify-center"
                disabled={cancelling}
              >
                ×
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-4">
                  Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
                </p>
                
                {/* Lista de itens do pedido */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Itens do pedido:</h4>
                  <div className="space-y-1">
                    {orderToCancel.items.map((item, index) => (
                      <div key={index} className="text-sm text-gray-600">
                        {item.quantity}x {item.productName} - R$ {item.totalPrice.toFixed(2)}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <div className="text-sm font-medium text-gray-900">
                      Garçom: {orderToCancel.waiterId.username}
                    </div>
                  </div>
                </div>

                {/* Motivos pré-definidos */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivos frequentes:
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      'Cliente desistiu',
                      'Produto em falta',
                      'Erro no pedido',
                      'Demora excessiva',
                      'Problema na cozinha',
                      'Solicitação do garçom'
                    ].map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setCancellationReason(reason)}
                        className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition-colors"
                        disabled={cancelling}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campo de motivo personalizado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo do cancelamento *
                  </label>
                  <textarea
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Descreva o motivo do cancelamento (mínimo 10 caracteres)..."
                    className="
                      w-full px-4 py-3 border border-gray-300 rounded-lg 
                      focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
                      resize-none
                    "
                    rows={3}
                    disabled={cancelling}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {cancellationReason.length}/10 caracteres mínimos
                  </p>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex gap-3">
                <button
                  onClick={closeCancelModal}
                  disabled={cancelling}
                  className="
                    flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg 
                    hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-200
                  "
                >
                  Voltar
                </button>
                <button
                  onClick={cancelOrder}
                  disabled={cancelling || cancellationReason.trim().length < 10}
                  className="
                    flex-1 px-4 py-3 bg-red-600 text-white rounded-lg 
                    hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-200 font-medium
                  "
                >
                  {cancelling ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Cancelando...
                    </span>
                  ) : (
                    '🚫 Confirmar Cancelamento'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 