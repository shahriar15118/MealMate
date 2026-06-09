import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export default function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgColor = 'bg-[#1A1D2E]';
          let borderClr = 'border-[#2D3142]';
          let textColor = 'text-[#E8E9F3]';
          let icon = <Info className="w-5 h-5 text-blue-400 shrink-0" />;

          switch (toast.type) {
            case 'success':
              bgColor = 'bg-[#1A1D2E]/95';
              borderClr = 'border-[#00D4AA]/30';
              icon = <CheckCircle className="w-5 h-5 text-[#00D4AA] shrink-0" />;
              break;
            case 'error':
              bgColor = 'bg-[#1D141E]/95';
              borderClr = 'border-[#FF6B6B]/30';
              icon = <XCircle className="w-5 h-5 text-[#FF6B6B] shrink-0" />;
              break;
            case 'warning':
              bgColor = 'bg-[#1E1B15]/95';
              borderClr = 'border-amber-500/30';
              icon = <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
              break;
            case 'info':
              bgColor = 'bg-[#1A1D2E]/95';
              borderClr = 'border-[#6C63FF]/30';
              icon = <Info className="w-5 h-5 text-[#6C63FF] shrink-0" />;
              break;
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${bgColor} ${borderClr} shadow-lg backdrop-blur-md`}
            >
              {icon}
              <div className="flex-1 text-xs font-sans font-medium text-[#E8E9F3] leading-relaxed">
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-gray-500 hover:text-white transition shrink-0 self-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
