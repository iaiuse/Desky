import React from 'react';
import { Home, Settings, HelpCircle,  ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const navItems = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Settings', icon: Settings, path: '/settings' },
    { name: 'Help', icon: HelpCircle, path: '/help' },
    { name: 'Log', icon: ClipboardList, path: '/log' },
  ];

  return (
    <div className="w-64 bg-gray-800 text-white p-4 h-screen">
      <h1 className="text-2xl font-bold mb-8">Desky</h1>
      <nav>
        <ul>
          {navItems.map((item) => (
            <li key={item.name} className="mb-4">
              <button
                onClick={() => navigate(item.path)}
                className="flex items-center text-lg hover:text-gray-300 transition-colors duration-200"
              >
                <item.icon className="mr-3" size={20} />
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};