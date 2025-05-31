'use client';

import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fragment, ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl',
};

export default function AnimatedModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
}: AnimatedModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          as={motion.div}
          static
          open={isOpen}
          onClose={closeOnOverlayClick ? onClose : () => {}}
          className="relative z-50"
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
              <motion.div
                className={`
                  w-full ${sizes[size]} transform overflow-hidden rounded-3xl
                  bg-white dark:bg-gray-900 text-left align-middle shadow-2xl 
                  transition-all relative
                  ${className}
                `}
                initial={{ 
                  opacity: 0, 
                  scale: 0.8,
                  y: 50,
                }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  y: 0,
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.8,
                  y: 50,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-500/20 via-transparent to-transparent opacity-0 animate-pulse" />
                
                {/* Header */}
                {(title || showCloseButton) && (
                  <motion.div
                    className="flex items-center justify-between p-6 pb-0"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                  >
                    {title && (
                      <Dialog.Title
                        as="h3"
                        className="text-xl font-semibold leading-6 text-gray-900 dark:text-white"
                      >
                        {title}
                      </Dialog.Title>
                    )}
                    
                    {showCloseButton && (
                      <motion.button
                        onClick={onClose}
                        className="
                          rounded-full p-2 text-gray-400 hover:text-gray-600 
                          dark:text-gray-500 dark:hover:text-gray-300
                          hover:bg-gray-100 dark:hover:bg-gray-800
                          transition-colors duration-200
                          focus:outline-none focus:ring-2 focus:ring-primary-500
                        "
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        initial={{ opacity: 0, rotate: -90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </motion.button>
                    )}
                  </motion.div>
                )}

                {/* Content */}
                <motion.div
                  className="p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                >
                  {children}
                </motion.div>
              </motion.div>
            </div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
} 