"use client";

import React from "react";

export const Logo = ({ isOpen }: { isOpen: boolean }) => {
  return (
    <div className={`flex items-center transition-all duration-300 ease-out ${isOpen ? "gap-3 opacity-100" : "gap-0 opacity-100 justify-center"}`}>
      <div className="relative w-8 h-8 flex items-center justify-center group">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-white/10 blur-md rounded-full scale-0 group-hover:scale-110 transition-transform duration-500" />
        
        {/* Main Logo SVG */}
        <svg 
          viewBox="0 0 24 24" 
          className="w-8 h-8 relative z-10 drop-shadow-sm" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--text-2)" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          
          {/* Outer Hexagon/Shield frame */}
          <path 
            d="M12 2L20 7V17L12 22L4 17V7L12 2Z" 
            stroke="url(#logo-grad)" 
            strokeWidth="1.5" 
            className="transition-all duration-300 group-hover:stroke-white"
          />
          
          {/* Stylized 'H' center */}
          <path 
            d="M8 8V16M16 8V16M8 12H16" 
            stroke="white" 
            strokeWidth="2" 
            strokeLinecap="round" 
            className="transition-all duration-300 group-hover:scale-110"
          />
          
          {/* Status Dot (The 'Pulse' of the HQ) */}
          <circle 
            cx="18" 
            cy="6" 
            r="2" 
            fill="var(--up)" 
            className="animate-pulse" 
          />
        </svg>
      </div>

      <span className={`font-medium text-[var(--text)] tracking-tight text-[14px] transition-all duration-300 ease-out ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden pointer-events-none"}`}>
        Hermy HQ
      </span>
    </div>
  );
};
