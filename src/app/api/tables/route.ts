import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../lib/db';
import Table from '../../../../models/Table';
import { authenticateRequest, hasPermission } from '../../../../lib/auth';

// GET - Listar mesas (filtradas por garçom se não for admin)
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

    let tables;

    // Se for admin (recepcionista), ver todas as mesas
    if (hasPermission(user, 'recepcionista')) {
      tables = await Table.find()
        .populate('assignedWaiter', 'username email')
        .sort({ number: 1 });
    } else {
      // Se for garçom, ver apenas suas próprias mesas
      tables = await Table.find({ assignedWaiter: user.id })
        .populate('assignedWaiter', 'username email')
        .sort({ number: 1 });
    }

    return NextResponse.json({
      success: true,
      data: {
        tables
      },
      message: 'Mesas recuperadas com sucesso'
    });

  } catch (error) {
    console.error('Erro ao buscar mesas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar nova mesa (garçoms criam mesas dinamicamente)
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

    // Agora garçoms podem criar mesas
    if (!hasPermission(user, 'garcom') && !hasPermission(user, 'recepcionista')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Apenas garçoms e recepcionistas podem criar mesas' 
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { number, capacity, currentCustomers, identification } = body;

    // Validação dos dados
    if (!number || !capacity || !currentCustomers) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Número da mesa, capacidade e número de clientes são obrigatórios' 
        },
        { status: 400 }
      );
    }

    if (number < 1) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Número da mesa deve ser maior que 0' 
        },
        { status: 400 }
      );
    }

    if (capacity < 1 || capacity > 20) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Capacidade deve ser entre 1 e 20 pessoas' 
        },
        { status: 400 }
      );
    }

    if (currentCustomers < 1 || currentCustomers > capacity) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Número de clientes deve ser entre 1 e a capacidade da mesa' 
        },
        { status: 400 }
      );
    }

    if (!identification || identification.trim() === '') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Nome/identificação do cliente é obrigatório' 
        },
        { status: 400 }
      );
    }

    // Verificar se já existe mesa com o mesmo número
    const existingTable = await Table.findOne({ number });
    if (existingTable) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Já existe uma mesa com este número. Escolha outro número.' 
        },
        { status: 409 }
      );
    }

    // Criar nova mesa já ocupada pelo garçom
    const newTable = new Table({
      number,
      capacity,
      status: 'ocupada',
      currentCustomers,
      identification: identification.trim(),
      assignedWaiter: user.id,
      openedAt: new Date()
    });

    await newTable.save();

    // Buscar a mesa criada com dados populados
    const createdTable = await Table.findById(newTable._id)
      .populate('assignedWaiter', 'username email');

    return NextResponse.json({
      success: true,
      data: {
        table: createdTable
      },
      message: 'Mesa criada e ocupada com sucesso'
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar mesa:', error);
    
    // Se for erro de validação do Mongoose
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Dados inválidos fornecidos' 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
} 