'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'glass' | 'gradient' | 'floating';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  delay?: number;
}

const variants = {
  default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg',
  glass: 'bg-white/10 dark:bg-gray-800/10 backdrop-blur-md border border-white/20 dark:border-gray-700/20 shadow-xl',
  gradient: 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg',
  floating: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl shadow-primary-500/10',
};

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

export default function AnimatedCard({
  children,
  className = '',
  hoverable = true,
  clickable = false,
  onClick,
  variant = 'default',
  padding = 'md',
  delay = 0,
}: AnimatedCardProps) {
  const cardMotionProps = {
    initial: { 
      opacity: 0, 
      y: 50,
      scale: 0.95,
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
    },
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      delay: delay,
    },
    whileHover: hoverable ? {
      y: -5,
      scale: 1.02,
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25,
      }
    } : {},
    whileTap: clickable ? {
      scale: 0.98,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 30,
      }
    } : {},
  };

  return (
    <motion.div
      {...cardMotionProps}
      onClick={clickable ? onClick : undefined}
      className={`
        rounded-2xl overflow-hidden transition-all duration-300
        ${variants[variant]}
        ${paddings[padding]}
        ${clickable ? 'cursor-pointer' : ''}
        ${className}
        relative group
      `}
    >
      {/* Hover glow effect */}
      {hoverable && (
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 0.1 }}
        />
      )}
      
      {/* Shimmer effect on glass variant */}
      {variant === 'glass' && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 opacity-0 group-hover:opacity-100"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
      
      {/* Floating variant shadow */}
      {variant === 'floating' && (
        <motion.div
          className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-3/4 h-6 bg-primary-500/20 rounded-full blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-300"
          animate={{
            scaleX: [1, 1.1, 1],
            opacity: [0.5, 0.7, 0.5],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
} 