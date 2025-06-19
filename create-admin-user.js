#!/usr/bin/env node

/**
 * 👤 Script para criar o primeiro usuário administrador
 * 
 * Este script cria um usuário recepcionista padrão para primeiro acesso.
 * Use quando o sistema estiver vazio e precisar do primeiro acesso.
 * 
 * Uso: node create-admin-user.js
 */

require('dotenv').config({ path: '.env.local' });
// Fallback para .env se .env.local não existir
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: '.env' });
}
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Verificar se MONGODB_URI está configurado
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI não encontrado no .env.local');
  console.log('📋 Crie o arquivo .env.local com:');
  console.log('MONGODB_URI=mongodb://localhost:27017/recanto-verde');
  process.exit(1);
}

// Schema do usuário (similar ao modelo User)
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['garcom', 'recepcionista'],
    required: true
  },
  phone: String,
  status: {
    type: String,
    enum: ['ativo', 'inativo'],
    default: 'ativo'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

// Middleware para hash da senha antes de salvar
userSchema.pre('save', async function(next) {
  // Só faz hash se a senha foi modificada
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar senhas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}

async function createAdminUser() {
  try {
    // Dados do usuário administrador padrão
    const adminData = {
      username: 'admin',
      email: 'admin@recantoverde.com',
      password: 'admin123',
      role: 'recepcionista',
      phone: '(11) 99999-9999',
      status: 'ativo'
    };

    // Verificar se já existe um usuário admin
    const existingAdmin = await User.findOne({ 
      $or: [
        { username: adminData.username },
        { email: adminData.email },
        { role: 'recepcionista' }
      ]
    });

    if (existingAdmin) {
      console.log('ℹ️ Já existe um usuário administrador no sistema:');
      console.log(`   👤 Username: ${existingAdmin.username}`);
      console.log(`   📧 Email: ${existingAdmin.email}`);
      console.log(`   🔑 Role: ${existingAdmin.role}`);
      console.log('');
      console.log('💡 Se precisar resetar, delete o usuário e execute novamente');
      console.log('   Comando: db.users.deleteOne({email: "admin@recantoverde.com"})');
      return;
    }

    console.log('👤 Criando usuário administrador...');

    // Hash da senha manualmente para garantir que funcionará
    console.log('🔐 Fazendo hash da senha...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);
    
    // Criar usuário com senha já hasheada
    const newAdmin = new User({
      ...adminData,
      password: hashedPassword
    });

    // Importante: marcar que a senha não foi modificada para evitar hash duplo
    newAdmin.markModified('password');
    newAdmin.isModified = function(path) {
      if (path === 'password') return false;
      return mongoose.Document.prototype.isModified.call(this, path);
    };

    await newAdmin.save();

    // Testar imediatamente se a senha está funcionando
    console.log('🧪 Testando senha criada...');
    const testUser = await User.findOne({ email: adminData.email }).select('+password');
    const isPasswordWorking = await testUser.comparePassword(adminData.password);
    
    if (!isPasswordWorking) {
      throw new Error('Falha na verificação da senha após criação');
    }

    console.log('');
    console.log('🎉 Usuário administrador criado com sucesso!');
    console.log('');
    console.log('📋 Credenciais de acesso:');
    console.log('┌─────────────────────────────────────┐');
    console.log('│  👤 Username: admin                 │');
    console.log('│  📧 Email: admin@recantoverde.com   │');
    console.log('│  🔑 Senha: admin123                │');
    console.log('│  🎭 Role: recepcionista             │');
    console.log('└─────────────────────────────────────┘');
    console.log('');
    console.log('🚀 Acesse o sistema em:');
    console.log('   🌐 http://localhost:3000/auth/login?role=recepcionista');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
    console.log('   Vá em: Admin → Configurações → Perfil');
    console.log('');
    console.log('✅ Senha testada e funcionando corretamente!');

  } catch (error) {
    console.error('❌ Erro ao criar usuário administrador:', error);
    
    if (error.code === 11000) {
      console.log('');
      console.log('⚠️  Erro de duplicação detectado.');
      console.log('💡 Parece que já existe um usuário com esses dados.');
      console.log('   Delete o usuário existente se necessário:');
      console.log('   db.users.deleteOne({email: "admin@recantoverde.com"})');
    }
  }
}

async function main() {
  console.log('🚀 Iniciando criação do usuário administrador...');
  console.log(`🔗 Conectando em: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);
  console.log('');

  await connectDB();
  await createAdminUser();
  
  await mongoose.disconnect();
  console.log('');
  console.log('✅ Desconectado do banco de dados');
  console.log('🎯 Processo concluído!');
}

// Função para mostrar ajuda
function showHelp() {
  console.log('');
  console.log('👤 Script de Criação do Usuário Administrador');
  console.log('');
  console.log('Este script cria o primeiro usuário recepcionista para acessar o sistema.');
  console.log('');
  console.log('📋 Uso:');
  console.log('   node create-admin-user.js        - Criar usuário admin');
  console.log('   node create-admin-user.js --help - Mostrar esta ajuda');
  console.log('');
  console.log('📁 Arquivos necessários:');
  console.log('   .env.local - Deve conter MONGODB_URI');
  console.log('');
  console.log('🔧 Scripts relacionados:');
  console.log('   npm run db:reset - Limpar banco de dados');
  console.log('   npm run dev      - Iniciar servidor');
  console.log('');
}

// Verificar argumentos da linha de comando
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Executar script principal
main().catch(error => {
  console.error('❌ Erro na execução:', error);
  process.exit(1);
}); 