import React from 'react';

type ImageViewerProps = {
  images: { id: string; timeframe: string; url: string }[];
};

export const ImageViewer: React.FC<ImageViewerProps> = ({ images }) => {
  if (!images || images.length === 0) return null;

  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold mb-3">Captured Charts</h2>
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {images.map((img) => (
          <div key={img.id} className="min-w-[200px] border rounded overflow-hidden">
            <div className="bg-gray-200 px-2 py-1 text-xs font-bold text-center">
              {img.timeframe.toUpperCase()}
            </div>
            <img src={img.url} alt={`Chart ${img.timeframe}`} className="w-full h-auto object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
};