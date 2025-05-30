import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../lib/db';
import Order from '../../../../models/Order';
import Table from '../../../../models/Table';
import Product from '../../../../models/Product';
import { authenticateRequest, hasPermission } from '../../../../lib/auth';

// GET - Listar pedidos
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get('tableId');
    const waiterId = searchParams.get('waiterId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    // Construir filtros
    const filters: any = {};

    if (tableId) {
      filters.tableId = tableId;
    }

    if (waiterId) {
      filters.waiterId = waiterId;
    }

    if (status) {
      filters.status = status;
    }

    // Se for garçom, só pode ver seus próprios pedidos
    if (user.role === 'garcom') {
      filters.waiterId = user.id;
    }

    // Calcular skip para paginação
    const skip = (page - 1) * limit;

    // Buscar pedidos com populate
    const orders = await Order.find(filters)
      .populate('tableId', 'number capacity status')
      .populate('waiterId', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    // Filtrar apenas pedidos válidos (com referências que existem)
    const validOrders = orders.filter(order => 
      order.tableId && 
      order.waiterId && 
      order.tableId.number !== undefined &&
      order.waiterId.username !== undefined
    );

    // Contar total para paginação
    const total = await Order.countDocuments(filters);

    return NextResponse.json({
      success: true,
      data: {
        orders: validOrders,
        pagination: {
          page,
          limit,
          total: validOrders.length,
          pages: Math.ceil(validOrders.length / limit)
        }
      },
      message: 'Pedidos recuperados com sucesso'
    });

  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar novo pedido
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { 
      tableId, 
      items, 
      observations,
      estimatedTime
    } = body;

    // Validação dos dados obrigatórios
    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Mesa e itens são obrigatórios' 
        },
        { status: 400 }
      );
    }

    // Verificar se a mesa existe e está disponível para pedidos
    const table = await Table.findById(tableId);
    if (!table) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Mesa não encontrada' 
        },
        { status: 404 }
      );
    }

    if (table.status !== 'ocupada') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Mesa deve estar ocupada para fazer pedidos' 
        },
        { status: 400 }
      );
    }

    // Se for garçom, verificar se é o garçom responsável pela mesa
    if (user.role === 'garcom') {
      console.log('Debug - Verificação de garçom:');
      console.log('- user.id:', user.id);
      console.log('- table.assignedWaiter:', table.assignedWaiter);
      console.log('- table.assignedWaiter toString:', table.assignedWaiter?.toString());
      
      if (table.assignedWaiter && table.assignedWaiter.toString() !== user.id) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Você não é o garçom responsável por esta mesa. Mesa atribuída para: ${table.assignedWaiter}, seu ID: ${user.id}` 
          },
          { status: 403 }
        );
      }
      
      // Se não tem garçom atribuído, atribuir automaticamente
      if (!table.assignedWaiter) {
        console.log('Mesa sem garçom atribuído, atribuindo automaticamente...');
        table.assignedWaiter = user.id as any;
        await table.save();
      }
    }

    // Validar e processar itens
    const orderItems = [];
    let totalAmount = 0;
    let totalEstimatedTime = 0;

    for (const item of items) {
      const { productId, quantity, observations: itemObservations } = item;

      if (!productId || !quantity || quantity <= 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Todos os itens devem ter produto e quantidade válidos' 
          },
          { status: 400 }
        );
      }

      // Buscar produto
      const product = await Product.findById(productId);
      if (!product) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Produto ${productId} não encontrado` 
          },
          { status: 404 }
        );
      }

      if (!product.available) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Produto ${product.name} não está disponível` 
          },
          { status: 400 }
        );
      }

      const itemTotalPrice = Math.round(quantity * product.price * 100) / 100;
      totalAmount += itemTotalPrice;

      // Calcular tempo estimado (maior tempo entre os itens)
      if (product.preparationTime) {
        totalEstimatedTime = Math.max(totalEstimatedTime, product.preparationTime);
      }

      orderItems.push({
        productId: product._id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        totalPrice: itemTotalPrice,
        observations: itemObservations
      });
    }

    // Determinar waiterId
    let waiterId;
    if (user.role === 'garcom') {
      waiterId = user.id;
    } else if (table.assignedWaiter) {
      waiterId = table.assignedWaiter;
    } else {
      // Se não tem garçom atribuído, usar o usuário atual (recepcionista)
      waiterId = user.id;
    }

    // Criar novo pedido
    const newOrder = new Order({
      tableId,
      waiterId,
      items: orderItems,
      status: 'preparando',
      totalAmount,
      observations,
      estimatedTime: estimatedTime || totalEstimatedTime
    });

    await newOrder.save();

    // Recarregar com populate para resposta
    const populatedOrder = await Order.findById(newOrder._id)
      .populate('tableId', 'number capacity status')
      .populate('waiterId', 'username email');

    console.log('✅ Pedido criado com sucesso!');
    console.log('- ID do pedido:', populatedOrder._id);
    console.log('- Mesa:', populatedOrder.tableId.number);
    console.log('- Garçom:', populatedOrder.waiterId.username);
    console.log('- Status:', populatedOrder.status);
    console.log('- Total de itens:', populatedOrder.items.length);
    console.log('- Valor total:', populatedOrder.totalAmount);

    // 🔔 SOCKET.IO - Emitir notificação de novo pedido
    if ((global as any).io) {
      console.log('📡 Emitindo evento Socket.IO para novo pedido...');
      (global as any).io.emit('order_created', {
        type: 'new_order',
        title: 'Novo Pedido!',
        message: `Mesa ${populatedOrder.tableId.number} - ${populatedOrder.items.length} item(s)`,
        order: populatedOrder,
        timestamp: new Date()
      });
      console.log('✅ Evento Socket.IO emitido com sucesso!');
    } else {
      console.log('⚠️ Socket.IO não disponível - pedido criado mas sem notificação em tempo real');
    }

    return NextResponse.json({
      success: true,
      data: {
        order: populatedOrder
      },
      message: 'Pedido criado com sucesso'
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    
    // Se for erro de validação do Mongoose
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