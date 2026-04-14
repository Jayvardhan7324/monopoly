import React from 'react';
import { motion } from 'motion/react';

interface NavDockItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  title?: string;
  asChild?: boolean;
}

export const NavDockItem = React.forwardRef<HTMLButtonElement, NavDockItemProps>(
  ({ children, className = '', onClick, title }, ref) => (
    <motion.button
      ref={ref}
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors text-sm font-medium cursor-pointer select-none focus:outline-none ${className}`}
    >
      {children}
    </motion.button>
  )
);
NavDockItem.displayName = 'NavDockItem';

export const NavDockLink: React.FC<{ href: string; title?: string; children: React.ReactNode }> = ({
  href, title, children,
}) => (
  <motion.a
    href={href}
    title={title}
    whileHover={{ scale: 1.06 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-white/8 transition-colors text-sm font-medium select-none"
  >
    {children}
  </motion.a>
);

/** Thin separator between dock sections */
export const NavDockSep: React.FC = () => (
  <div className="w-px h-4 bg-slate-700/60 mx-0.5 shrink-0" />
);

interface NavDockProps {
  children: React.ReactNode;
}

/** A single rounded pill that holds all top-nav items */
const NavDock: React.FC<NavDockProps> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.05 }}
    className="flex items-center gap-0.5 px-1.5 py-1.5 rounded-2xl bg-slate-900/80 border border-slate-700/50 backdrop-blur-md shadow-xl shadow-black/30"
  >
    {children}
  </motion.div>
);

export default NavDock;
