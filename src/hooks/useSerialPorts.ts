import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useSerialPorts() {
  const [ports, setPorts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPorts() {
      try {
        const availablePorts = await invoke<string[]>('get_serial_ports');
        setPorts(availablePorts);
        setLoading(false);
      } catch (err) {
        setError(err as string);
        setLoading(false);
      }
    }

    fetchPorts();
  }, []);

  return { ports, loading, error };
}