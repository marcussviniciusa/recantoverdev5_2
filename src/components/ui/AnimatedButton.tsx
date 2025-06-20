'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const variants = {
  primary: 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 dark:from-primary-500 dark:to-green-500 dark:hover:from-primary-600 dark:hover:to-green-600 text-white shadow-lg shadow-blue-500/30 dark:shadow-primary-500/30 border border-blue-600 dark:border-primary-500 focus:ring-blue-500/50 dark:focus:ring-primary-500/50',
  secondary: 'bg-white dark:bg-gray-800 border-2 border-gray-600 dark:border-gray-400 hover:border-blue-600 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md hover:shadow-lg font-semibold focus:ring-gray-500/50 dark:focus:ring-gray-400/50',
  success: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 dark:from-green-500 dark:to-green-600 dark:hover:from-green-600 dark:hover:to-green-700 text-white shadow-lg shadow-green-500/30 border border-green-600 dark:border-green-500 focus:ring-green-500/50',
  danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 dark:from-red-500 dark:to-red-600 dark:hover:from-red-600 dark:hover:to-red-700 text-white shadow-lg shadow-red-500/30 border border-red-600 dark:border-red-500 focus:ring-red-500/50',
  warning: 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 dark:from-amber-500 dark:to-amber-600 dark:hover:from-amber-600 dark:hover:to-amber-700 text-white shadow-lg shadow-amber-500/30 border border-amber-600 dark:border-amber-500 focus:ring-amber-500/50',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
  xl: 'px-8 py-4 text-lg rounded-2xl',
};

export default function AnimatedButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  type = 'button'
}: AnimatedButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative overflow-hidden font-medium transition-all duration-300
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-60 cursor-not-allowed saturate-50' : 'cursor-pointer'}
        ${className}
        focus:outline-none focus:ring-4
        active:scale-[0.98]
      `}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
    >
      {/* Background shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />
      
      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading && (
          <motion.div
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {children}
      </span>
    </motion.button>
  );
} 