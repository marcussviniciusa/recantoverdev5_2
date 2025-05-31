'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSocket } from '../../../../lib/socket';
import AnimatedCard from '../../../../components/ui/AnimatedCard';
import AnimatedButton from '../../../../components/ui/AnimatedButton';
import GarcomBottomNav from '../../../../components/ui/GarcomBottomNav';
import { AnimatedPageContainer, StaggeredGrid, StaggeredItem } from '../../../../components/ui/PageTransition';
import { 
  ShoppingCartIcon, 
  PlusIcon, 
  MinusIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  preparationTime?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  observations: string;
  totalPrice: number;
}

interface Table {
  _id: string;
  number: number;
  capacity: number;
  status: string;
  currentCustomers?: number;
}

export default function CriarPedido() {
  const router = useRouter();
  const params = useParams();
  const tableId = params.tableId as string;
  const { emitEvent } = useSocket();

  const [table, setTable] = useState<Table | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [observations, setObservations] = useState('');

  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Carregar mesa, produtos e categorias em paralelo
      const [tableRes, productsRes, categoriesRes] = await Promise.all([
        fetch(`/api/tables/${tableId}`, { headers }),
        fetch('/api/products', { headers }),
        fetch('/api/products/categories', { headers })
      ]);

      const tableData = await tableRes.json();
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();

      if (tableData.success) {
        setTable(tableData.data.table);
      }

      if (productsData.success) {
        setProducts(productsData.data.products.filter((p: Product) => p.available));
      }

      if (categoriesData.success) {
        const categoryNames = categoriesData.data.categoriesWithProducts.map((c: { name: string }) => c.name);
        setCategories(categoryNames);
        if (categoryNames.length > 0) {
          setSelectedCategory(categoryNames[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'garcom') {
      router.push('/auth/login?role=garcom');
      return;
    }

    if (tableId) {
      loadData();
    }
  }, [tableId, router, loadData]);

  const filteredProducts = products.filter(product => {
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product._id === product._id);
    
    if (existingItem) {
      updateCartItem(product._id, existingItem.quantity + 1, existingItem.observations);
    } else {
      const newItem: CartItem = {
        product,
        quantity: 1,
        observations: '',
        totalPrice: product.price
      };
      setCart([...cart, newItem]);
    }
  };

  const updateCartItem = (productId: string, quantity: number, observations: string) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item => 
      item.product._id === productId 
        ? { 
            ...item, 
            quantity, 
            observations,
            totalPrice: Math.round(item.product.price * quantity * 100) / 100
          }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product._id !== productId));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      alert('Adicione pelo menos um item ao pedido');
      return;
    }

    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      const orderData = {
        tableId,
        items: cart.map(item => ({
          productId: item.product._id,
          quantity: item.quantity,
          observations: item.observations
        })),
        observations,
        estimatedTime: 15 // Tempo padrão mínimo de 15 minutos
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Pedido criado:', data.data.order);
        
        // Emitir evento Socket.IO para notificar admin em tempo real
        emitEvent('order_created', data.data.order);
        
        alert('Pedido criado com sucesso!');
        router.push('/garcom/mesas');
      } else {
        alert('Erro ao criar pedido: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      alert('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <AnimatedPageContainer className="bg-gradient-to-br from-primary-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="min-h-screen flex items-center justify-center pb-24">
          <AnimatedCard variant="glass" padding="xl" className="text-center">
            <motion.div
              className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <motion.h2
              className="text-xl font-semibold text-gray-800 dark:text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Carregando cardápio...
            </motion.h2>
          </AnimatedCard>
        </div>
        <GarcomBottomNav />
      </AnimatedPageContainer>
    );
  }

  if (!table) {
    return (
      <AnimatedPageContainer className="bg-gradient-to-br from-primary-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="min-h-screen flex items-center justify-center pb-24">
          <AnimatedCard variant="default" padding="xl" className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Mesa não encontrada</h2>
            <Link href="/garcom/mesas">
              <AnimatedButton variant="primary" size="lg">
                Voltar para Mesas
              </AnimatedButton>
            </Link>
          </AnimatedCard>
        </div>
        <GarcomBottomNav />
      </AnimatedPageContainer>
    );
  }

  return (
    <AnimatedPageContainer className="bg-gradient-to-br from-primary-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <motion.header
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/20 shadow-lg sticky top-0 z-40"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <motion.div
              className="flex items-center"
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <Link href="/garcom/mesas">
                <motion.div 
                  className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center mr-3 shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </motion.div>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Novo Pedido</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Mesa {table.number} • {table.currentCustomers} clientes</p>
              </div>
            </motion.div>

            <motion.div
              className="text-right"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Total: {formatCurrency(getTotalAmount())}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{getTotalItems()} itens</p>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Produtos */}
          <div className="lg:col-span-2">
            {/* Busca e Filtros */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <AnimatedCard variant="default" padding="lg" className="mb-6">
                <div className="space-y-4">
                  {/* Busca */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar produtos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                    />
                  </div>

                  {/* Categorias */}
                  <div className="flex flex-wrap gap-2">
                    <AnimatedButton
                      variant={selectedCategory === '' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setSelectedCategory('')}
                    >
                      Todos
                    </AnimatedButton>
                    {categories.map(category => (
                      <AnimatedButton
                        key={category}
                        variant={selectedCategory === category ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </AnimatedButton>
                    ))}
                  </div>
                </div>
              </AnimatedCard>
            </motion.div>

            {/* Lista de Produtos */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              {filteredProducts.length === 0 ? (
                <AnimatedCard variant="default" padding="xl" className="text-center">
                  <div className="text-gray-500 dark:text-gray-400">
                    <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Nenhum produto encontrado</h3>
                    <p className="text-sm">Tente ajustar os filtros ou termo de busca.</p>
                  </div>
                </AnimatedCard>
              ) : (
                <StaggeredGrid className="grid grid-cols-1 md:grid-cols-2 gap-4" staggerDelay={0.1}>
                  {filteredProducts.map((product, index) => (
                    <StaggeredItem key={product._id}>
                      <AnimatedCard variant="default" padding="lg" hoverable={true} className="h-full">
                        <div className="flex flex-col h-full">
                          <div className="flex-1 mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              {product.name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {product.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-primary-600">
                                {formatCurrency(product.price)}
                              </span>
                              {product.preparationTime && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                                  ⏱️ {product.preparationTime} min
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <AnimatedButton
                            variant="primary"
                            size="md"
                            fullWidth
                            onClick={() => addToCart(product)}
                          >
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Adicionar ao Pedido
                          </AnimatedButton>
                        </div>
                      </AnimatedCard>
                    </StaggeredItem>
                  ))}
                </StaggeredGrid>
              )}
            </motion.div>
          </div>

          {/* Carrinho */}
          <motion.div
            className="lg:col-span-1"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <div className="sticky top-24">
              <AnimatedCard variant="glass" padding="lg" className="backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCartIcon className="w-6 h-6 text-primary-600" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Carrinho</h2>
                  {cart.length > 0 && (
                    <span className="bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
                      {getTotalItems()}
                    </span>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4 opacity-50" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Carrinho vazio</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Adicione produtos do cardápio
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                      {cart.map((item, index) => (
                        <motion.div
                          key={item.product._id}
                          className="border-b border-gray-200 dark:border-gray-700 pb-4"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                {item.product.name}
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {formatCurrency(item.product.price)} cada
                              </p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.product._id)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateCartItem(
                                  item.product._id, 
                                  Math.max(1, item.quantity - 1), 
                                  item.observations
                                )}
                                className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                              >
                                <MinusIcon className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center font-medium text-gray-900 dark:text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateCartItem(
                                  item.product._id, 
                                  item.quantity + 1, 
                                  item.observations
                                )}
                                className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                              >
                                <PlusIcon className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="font-medium text-primary-600">
                              {formatCurrency(item.totalPrice)}
                            </span>
                          </div>

                          <div>
                            <input
                              type="text"
                              placeholder="Observações..."
                              value={item.observations}
                              onChange={(e) => updateCartItem(
                                item.product._id, 
                                item.quantity, 
                                e.target.value
                              )}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Observações Gerais */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <DocumentTextIcon className="w-4 h-4 inline mr-1" />
                        Observações Gerais
                      </label>
                      <textarea
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        placeholder="Observações para o pedido..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none"
                      />
                    </div>

                    {/* Total */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-6">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-medium text-gray-900 dark:text-white">Total:</span>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-primary-600">
                            {formatCurrency(getTotalAmount())}
                          </span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'itens'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Botão Enviar */}
                    <AnimatedButton
                      variant="success"
                      size="lg"
                      fullWidth
                      loading={submitting}
                      onClick={submitOrder}
                      disabled={cart.length === 0}
                    >
                      {submitting ? 'Enviando...' : '🚀 Enviar Pedido'}
                    </AnimatedButton>
                  </>
                )}
              </AnimatedCard>
            </div>
          </motion.div>
        </div>
      </main>

      <GarcomBottomNav />
    </AnimatedPageContainer>
  );
} 