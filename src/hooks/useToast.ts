import { useCallback } from 'react';
import toast, { ToastOptions } from 'react-hot-toast';

type ToastType = 'success' | 'error' | 'loading' | 'warning' | 'custom';

interface ToastParams {
  message: string;
  type?: ToastType;
  options?: ToastOptions;
}

type ToastFunction = {
  (params: ToastParams): void;
  (message: string, type?: ToastType, options?: ToastOptions): void;
};

interface UseToastReturn {
  toast: ToastFunction;
  dismiss: (toastId: string) => void;
}

export const useToast = (): UseToastReturn => {
  const showToast: ToastFunction = useCallback((
    messageOrParams: string | ToastParams,
    type?: ToastType,
    options?: ToastOptions
  ): void => {
    let message: string;
    let toastType: ToastType = 'custom';
    let toastOptions: ToastOptions = {};

    if (typeof messageOrParams === 'string') {
      message = messageOrParams;
      toastType = type || 'custom';
      toastOptions = options || {};
    } else {
      message = messageOrParams.message;
      toastType = messageOrParams.type || 'custom';
      toastOptions = messageOrParams.options || {};
    }

    switch (toastType) {
      case 'success':
        toast.success(message, toastOptions);
        break;
      case 'error':
        toast.error(message, toastOptions);
        break;
      case 'loading':
        toast.loading(message, toastOptions);
        break;
      case 'warning':
        toast(message, {
          ...toastOptions,
          icon: '⚠️',
          style: { ...toastOptions.style, backgroundColor: '#FFA500', color: '#FFFFFF' }
        });
        break;
      case 'custom':
      default:
        toast(message, toastOptions);
        break;
    }
  }, []);

  const dismiss = useCallback((toastId: string) => {
    toast.dismiss(toastId);
  }, []);

  return { toast: showToast, dismiss };
};