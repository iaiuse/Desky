import React from 'react';
import { Home, Settings, HelpCircle,  ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const navItems = [
    { name: '首页', icon: Home, path: '/' },
    { name: '设置', icon: Settings, path: '/settings' },
    { name: '帮助', icon: HelpCircle, path: '/help' },
    { name: '日志', icon: ClipboardList, path: '/log' },
  ];

  return (
    <div className="w-64 bg-gray-800 text-white p-4 h-screen">
      <h1 className="text-2xl font-bold mb-8">SmartBot-X</h1>
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