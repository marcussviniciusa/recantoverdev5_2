'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  TableCellsIcon, 
  DocumentTextIcon, 
  CreditCardIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  TableCellsIcon as TableCellsIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  Bars3Icon as Bars3IconSolid
} from '@heroicons/react/24/solid';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  iconSolid: any;
  badge?: number;
}

const navItems: NavItem[] = [
  {
    href: '/garcom/dashboard',
    label: 'Início',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
  },
  {
    href: '/garcom/mesas',
    label: 'Mesas',
    icon: TableCellsIcon,
    iconSolid: TableCellsIconSolid,
  },
  {
    href: '/garcom/pedidos',
    label: 'Pedidos',
    icon: DocumentTextIcon,
    iconSolid: DocumentTextIconSolid,
  },
  {
    href: '/garcom/pagamentos',
    label: 'Pagamentos',
    icon: CreditCardIcon,
    iconSolid: CreditCardIconSolid,
  },
];

export default function GarcomBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/garcom/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 shadow-2xl"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item, index) => {
            const active = isActive(item.href);
            const IconComponent = active ? item.iconSolid : item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1"
              >
                <motion.div
                  className={`
                    relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300
                    ${active 
                      ? 'text-white shadow-xl shadow-primary-600/40' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400'
                    }
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  {/* Background indicator for active state */}
                  {active && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl shadow-lg"
                      layoutId="activeTab"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}

                  {/* Icon and label */}
                  <div className="relative z-10 flex flex-col items-center">
                    <IconComponent className="w-5 h-5 mb-1" />
                    <span className="text-xs font-medium leading-none">
                      {item.label}
                    </span>

                    {/* Badge for notifications */}
                    {item.badge && item.badge > 0 && (
                      <motion.div
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Safe area for devices with home indicator */}
      <div className="h-safe-area-inset-bottom" />
    </motion.nav>
  );
} 