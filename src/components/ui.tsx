import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline', size?: 'sm' | 'md' | 'lg' | 'icon' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm dark:bg-emerald-600 dark:hover:bg-emerald-500',
      secondary: 'bg-zinc-800 text-white hover:bg-zinc-900 shadow-sm dark:bg-zinc-700 dark:hover:bg-zinc-600',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm dark:bg-rose-700 dark:hover:bg-rose-800',
      outline: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
      ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      icon: 'p-2'
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export const Modal = ({ isOpen, onClose, title, children, zIndex = 50, maxWidth = 'max-w-lg' }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; zIndex?: number; maxWidth?: string }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-0" style={{ zIndex }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm dark:bg-black/60"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(`relative w-full ${maxWidth} max-h-[90dvh] bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden flex flex-col`)}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 overflow-y-auto overflow-x-hidden min-h-0">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message }: any) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-300">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Confirmar</Button>
        </div>
      </div>
    </Modal>
  );
}
