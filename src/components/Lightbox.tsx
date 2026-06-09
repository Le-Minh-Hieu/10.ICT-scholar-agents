import React, { useState, useEffect, useCallback } from 'react';
import { DataGrid } from './DataGrid';

type ImageItem = {
  src: string;
  alt: string;
};

type LightboxProps = {
  images: ImageItem[];
  initialIndex: number;
  onClose: () => void;
  agentData?: any;
};

export const Lightbox: React.FC<LightboxProps> = ({ images, initialIndex, onClose, agentData }) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [showReadMode, setShowReadMode] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const next = useCallback(() => {
    setIndex((prev) => (prev + 1) % images.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [images.length]);

  const prev = useCallback(() => {
    setIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === '+') setZoom(z => Math.min(z + 0.5, 5));
      if (e.key === '-') setZoom(z => Math.max(z - 0.5, 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, next, prev]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) setZoom(z => Math.min(z + 0.1, 5));
    else setZoom(z => Math.max(z - 0.1, 1));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const currentImage = images[index];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Controls Overlay */}
      <div className="absolute top-0 inset-x-0 h-20 flex items-center justify-between px-8 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-4 text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">
          <span>Evidence {index + 1} of {images.length}</span>
          <div className="h-4 w-px bg-gray-800"></div>
          <span className="text-blue-500 font-mono">{currentImage.alt}</span>
        </div>
        <div className="flex items-center gap-6">
          {agentData && (
            <button 
              onClick={() => setShowReadMode(!showReadMode)}
              className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors ${
                showReadMode ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Read Mode
            </button>
          )}
          <div className="flex items-center bg-gray-900 rounded-full border border-gray-800 p-1">
            <button onClick={() => setZoom(z => Math.max(z - 0.5, 1))} className="p-2 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
            <span className="px-4 text-[10px] font-black font-mono w-16 text-center text-blue-400">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(z + 0.5, 5))} className="p-2 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
          </div>
          <button 
            className="p-2 text-gray-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button 
        onClick={prev}
        className="absolute left-8 p-4 bg-gray-900/50 hover:bg-gray-800 rounded-full border border-gray-800 text-gray-400 hover:text-white transition-all z-10"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button 
        onClick={next}
        className="absolute right-8 p-4 bg-gray-900/50 hover:bg-gray-800 rounded-full border border-gray-800 text-gray-400 hover:text-white transition-all z-10"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>

      {/* Content Area */}
      <div className="absolute inset-0 top-20 bottom-20 flex p-8 gap-8 overflow-hidden">
        {/* Image Container */}
        <div 
          className={`relative ${showReadMode ? 'w-2/3' : 'w-full'} h-full rounded-2xl overflow-hidden transition-all duration-300 ${zoom > 1 ? 'cursor-move' : 'cursor-default'} flex items-center justify-center`}
          onMouseDown={handleMouseDown}
        >
          <img 
            src={currentImage.src} 
            alt={currentImage.alt} 
            className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-200"
            style={{ 
              transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            }}
            draggable={false}
          />
        </div>

        {/* Read Mode Side Panel */}
        {showReadMode && agentData && (
          <div 
            className="w-1/3 h-full bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 overflow-y-auto no-scrollbar animate-in slide-in-from-right-8 duration-300"
            onWheel={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-8">
              <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em]">Agent Context</h3>
              <div className="h-px flex-1 bg-gray-800/50"></div>
            </div>
            <DataGrid data={agentData} />
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-8 text-[9px] font-black text-gray-500 uppercase tracking-widest z-10">
         <span className="flex items-center gap-2"><span className="px-1.5 py-0.5 border border-gray-800 rounded">Arrows</span> Navigate</span>
         <span className="flex items-center gap-2"><span className="px-1.5 py-0.5 border border-gray-800 rounded">Scroll/+-</span> Zoom</span>
         <span className="flex items-center gap-2"><span className="px-1.5 py-0.5 border border-gray-800 rounded">Drag</span> Pan</span>
         <span className="flex items-center gap-2"><span className="px-1.5 py-0.5 border border-gray-800 rounded">Esc</span> Close</span>
      </div>
    </div>
  );
};
