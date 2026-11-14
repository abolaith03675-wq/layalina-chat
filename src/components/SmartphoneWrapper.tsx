import React from 'react';

interface SmartphoneWrapperProps {
  children: React.ReactNode;
}

export const SmartphoneWrapper: React.FC<SmartphoneWrapperProps> = ({ children }) => {
  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-slate-50 dark:bg-[#070a12] text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] transition-colors duration-300">
      <div className="flex-1 w-full h-full flex flex-col overflow-hidden relative bg-slate-50 dark:bg-[#070a12] transition-colors duration-300">
        {children}
      </div>
    </div>
  );
};
