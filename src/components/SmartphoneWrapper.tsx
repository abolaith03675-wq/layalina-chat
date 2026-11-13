import React from 'react';

interface SmartphoneWrapperProps {
  children: React.ReactNode;
}

export const SmartphoneWrapper: React.FC<SmartphoneWrapperProps> = ({ children }) => {
  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#070a12] text-slate-100 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="flex-1 w-full h-full flex flex-col overflow-hidden relative bg-[#070a12]">
        {children}
      </div>
    </div>
  );
};
