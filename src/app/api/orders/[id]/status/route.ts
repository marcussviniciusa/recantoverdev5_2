import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../lib/db';
import Order from '../../../../../../models/Order';
import { authenticateRequest } from '../../../../../../lib/auth';

type OrderStatus = 'pendente' | 'preparando' | 'pronto' | 'entregue';

// PATCH - Atualizar status do pedido
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    // Verificar autenticação
    const user = await authenticateRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Token inválido ou expirado' 
        },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    // Validação do status
    const validStatuses: OrderStatus[] = ['pendente', 'preparando', 'pronto', 'entregue'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Status deve ser um dos valores: ${validStatuses.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Buscar pedido
    const order = await Order.findById(id)
      .populate('tableId', 'number capacity status')
      .populate('waiterId', 'username email');

    if (!order) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Pedido não encontrado' 
        },
        { status: 404 }
      );
    }

    // Verificar permissões
    // Admin pode alterar qualquer pedido
    // Garçom só pode alterar seus próprios pedidos
    if (user.role === 'garcom' && order.waiterId._id.toString() !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Você só pode alterar seus próprios pedidos' 
        },
        { status: 403 }
      );
    }

    // Validação de transição de status
    const statusFlow: Record<OrderStatus, OrderStatus[]> = {
      'pendente': ['preparando', 'entregue'], // Pode pular direto para entregue em casos especiais
      'preparando': ['pronto', 'pendente'], // Pode voltar para pendente se houver problema
      'pronto': ['entregue', 'preparando'], // Pode voltar para preparando se necessário
      'entregue': [] // Status final, não pode ser alterado
    };

    if (order.status === 'entregue') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Pedidos entregues não podem ter o status alterado' 
        },
        { status: 400 }
      );
    }

    const currentStatus = order.status as OrderStatus;
    if (!statusFlow[currentStatus].includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Não é possível alterar status de '${order.status}' para '${status}'` 
        },
        { status: 400 }
      );
    }

    // Atualizar status
    order.status = status;
    
    // Se o status for 'entregue', marcar data de entrega
    if (status === 'entregue') {
      order.deliveredAt = new Date();
    }

    await order.save();

    // Recarregar com populate para resposta
    const updatedOrder = await Order.findById(order._id)
      .populate('tableId', 'number capacity status')
      .populate('waiterId', 'username email');

    console.log(`✅ Status do pedido ${updatedOrder._id} atualizado para '${status}'`);

    // 🔔 SOCKET.IO - Emitir notificação de atualização de status
    if ((global as any).io) {
      console.log('📡 Emitindo evento Socket.IO para atualização de status...');
      
      const notifications: Record<string, { title: string; message: string; target: string[] }> = {
        'preparando': {
          title: 'Pedido em Preparo',
          message: `Mesa ${updatedOrder.tableId.number} - Pedido sendo preparado`,
          target: [`waiter_${updatedOrder.waiterId._id}`]
        },
        'pronto': {
          title: 'Pedido Pronto! 🍽️',
          message: `Mesa ${updatedOrder.tableId.number} - Pedido pronto para entrega`,
          target: [`waiter_${updatedOrder.waiterId._id}`, 'role_recepcionista']
        },
        'entregue': {
          title: 'Pedido Entregue ✅',
          message: `Mesa ${updatedOrder.tableId.number} - Pedido entregue com sucesso`,
          target: ['role_recepcionista']
        }
      };

      const notification = notifications[status];
      if (notification) {
        notification.target.forEach((target: string) => {
          (global as any).io.to(target).emit('order_notification', {
            type: 'order_update',
            title: notification.title,
            message: notification.message,
            order: updatedOrder,
            status: status,
            timestamp: new Date()
          });
        });
        console.log(`✅ Evento Socket.IO emitido para targets: ${notification.target.join(', ')}`);
      }

      // Emitir também um evento geral para admins
      (global as any).io.to('role_recepcionista').emit('order_status_updated', {
        type: 'order_status_updated',
        order: updatedOrder,
        previousStatus: currentStatus,
        newStatus: status,
        timestamp: new Date()
      });
      
      console.log('✅ Evento Socket.IO de atualização de status emitido com sucesso!');
    } else {
      console.log('⚠️ Socket.IO não disponível - status atualizado mas sem notificação em tempo real');
    }

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder
      },
      message: `Status do pedido atualizado para '${status}' com sucesso`
    });

  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    
    if (error instanceof Error && error.name === 'ValidationError') {
      const mongooseError = error as any;
      const validationErrors: any = {};
      
      for (const field in mongooseError.errors) {
        validationErrors[field] = mongooseError.errors[field].message;
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Dados inválidos fornecidos',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
} 