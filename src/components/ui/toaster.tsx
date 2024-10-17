
import { Toaster as HotToaster } from 'react-hot-toast';

export const Toaster = () => {
  return (
    <HotToaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        // Define default options
        className: '',
        duration: 5000,
        style: {
          background: '#363636',
          color: '#fff',
        },
        // Default options for specific types
        success: {
          duration: 3000,
          style: {
            background: 'green',
            color: 'white',
          },
        },
        error: {
          duration: 3000,
          style: {
            background: 'red',
            color: 'white',
          },
        },
      }}
    />
  );
};