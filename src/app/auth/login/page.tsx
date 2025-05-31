'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimatedButton from '../../../components/ui/AnimatedButton';
import AnimatedCard from '../../../components/ui/AnimatedCard';
import { AnimatedPageContainer } from '../../../components/ui/PageTransition';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Salvar token e dados do usuário
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('userId', data.data.user.id);
        localStorage.setItem('userRole', data.data.user.role);
        localStorage.setItem('userName', data.data.user.username);
        localStorage.setItem('userEmail', data.data.user.email);

        // Redirecionar baseado no role
        if (data.data.user.role === 'recepcionista') {
          router.push('/admin/dashboard');
        } else if (data.data.user.role === 'garcom') {
          router.push('/garcom/mesas');
        }
      } else {
        setError(data.error || 'Erro ao fazer login');
      }
    } catch (error) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPageContainer className="bg-gradient-to-br from-primary-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-400/20 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <div className="w-full max-w-md space-y-8 relative z-10">
          {/* Header */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <motion.h1
              className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-green-600 bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ['0%', '100%', '0%'],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              Recanto Verde
            </motion.h1>
            <motion.p
              className="mt-2 text-gray-600 dark:text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              {roleParam === 'garcom' ? 'Acesso para Garçons' : 'Sistema de Gestão'}
            </motion.p>
          </motion.div>

          {/* Login Form */}
          <AnimatedCard
            variant="glass"
            padding="lg"
            className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border border-white/20 shadow-2xl"
            delay={0.3}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div
                  className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-xl"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {error}
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <label htmlFor="email" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  📧 Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="
                    block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 
                    rounded-xl shadow-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                    transition-all duration-200 ease-in-out
                    placeholder-gray-500 dark:placeholder-gray-400
                    text-gray-900 dark:text-white font-medium
                  "
                  placeholder="Digite seu email"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <label htmlFor="password" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  🔒 Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="
                    block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 
                    rounded-xl shadow-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                    transition-all duration-200 ease-in-out
                    placeholder-gray-500 dark:placeholder-gray-400
                    text-gray-900 dark:text-white font-medium
                  "
                  placeholder="Digite sua senha"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <AnimatedButton
                  type="submit"
                  loading={loading}
                  fullWidth
                  size="lg"
                  variant="primary"
                  className="font-semibold"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </AnimatedButton>
              </motion.div>
            </form>
          </AnimatedCard>

          {/* Footer */}
          <motion.div
            className="text-center text-sm text-gray-500 dark:text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            © 2024 Recanto Verde. Todos os direitos reservados.
          </motion.div>
        </div>
      </div>
    </AnimatedPageContainer>
  );
} 