"use client";

import { 
  FiRefreshCw, 
  FiEdit2, 
  FiList, 
  FiTag, 
  FiShare2, 
  FiAtSign, 
  FiImage 
} from "react-icons/fi";
import { FaUsers } from "react-icons/fa";

export function ChatRightSidebar() {
  return (
    <nav className="flex flex-col items-center gap-5 w-14 py-6 bg-white border-l border-gray-200 transition-all duration-200 h-full" style={{ boxShadow: 'none' }}>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FiRefreshCw size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FiEdit2 size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FiList size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FiTag size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FiShare2 size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FaUsers size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FiAtSign size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FiImage size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
      <button className="p-0 flex items-center justify-center hover:bg-gray-100 rounded-md w-10 h-10 transition-colors" style={{ background: 'none' }}>
        <FiList size={22} className="text-gray-400 hover:text-gray-600" />
      </button>
    </nav>
  );
} 