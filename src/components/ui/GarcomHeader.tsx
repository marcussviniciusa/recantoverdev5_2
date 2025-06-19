'use client';

import { motion } from 'framer-motion';
import { logout } from '../../lib/client-auth';
import { 
  BellIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

interface GarcomHeaderProps {
  title: string;
  userName?: string;
  unreadCount?: number;
}

export default function GarcomHeader({ title, userName, unreadCount = 0 }: GarcomHeaderProps) {
  return (
    <motion.header
      className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 shadow-lg sticky top-0 z-40"
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
            <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-green-700 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-lg font-bold">RV</span>
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
              {userName && (
                <p className="text-sm text-gray-700 dark:text-gray-300">👨‍🍳 {userName}</p>
              )}
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-3"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {unreadCount > 0 && (
              <motion.div
                className="relative"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <BellIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center border border-white shadow-lg">
                  {unreadCount}
                </span>
              </motion.div>
            )}

            {/* Botão Logout */}
            <motion.button
              onClick={logout}
              className="
                flex items-center gap-2 px-3 py-2 rounded-lg
                text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400
                hover:bg-gray-100 dark:hover:bg-gray-800
                transition-all duration-200 group
              "
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Fazer logout"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:block">Sair</span>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
} 