'use client';

import React from 'react';
import { MapPin, MapPinOff, Loader2 } from 'lucide-react';
import { Coordinates } from '@/lib/services/GeospatialContextService';

interface LocationButtonProps {
  location: Coordinates | null;
  loading: boolean;
  error: string | null;
  permission: PermissionState | null;
  onRequestLocation: () => void;
  onClearLocation: () => void;
  className?: string;
}

export const LocationButton: React.FC<LocationButtonProps> = ({
  location,
  loading,
  error,
  permission,
  onRequestLocation,
  onClearLocation,
  className = ''
}) => {
  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>位置情報取得中...</span>
        </>
      );
    }

    if (location) {
      return (
        <>
          <MapPin className="h-4 w-4 text-green-600" />
          <span className="text-green-600">位置情報: 有効</span>
        </>
      );
    }

    if (permission === 'denied') {
      return (
        <>
          <MapPinOff className="h-4 w-4 text-red-600" />
          <span className="text-red-600">位置情報: 拒否</span>
        </>
      );
    }

    return (
      <>
        <MapPin className="h-4 w-4" />
        <span>位置情報を使用</span>
      </>
    );
  };

  const getTooltipText = () => {
    if (location) {
      return `緯度: ${location.latitude.toFixed(6)}, 経度: ${location.longitude.toFixed(6)}`;
    }
    if (error) {
      return error;
    }
    if (permission === 'denied') {
      return 'ブラウザの設定で位置情報の使用を許可してください';
    }
    return '現在地を使用して、より正確な情報を提供します';
  };

  const handleClick = () => {
    if (location) {
      onClearLocation();
    } else {
      onRequestLocation();
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleClick}
        disabled={loading || permission === 'denied'}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg
          transition-all duration-200 ease-out
          ${location 
            ? 'bg-green-50 hover:bg-green-100 text-green-700' 
            : permission === 'denied'
            ? 'bg-red-50 text-red-700 cursor-not-allowed opacity-60'
            : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
          }
          ${loading ? 'cursor-wait' : ''}
          ${className}
        `}
        aria-label={location ? '位置情報をクリア' : '位置情報を使用'}
      >
        {getButtonContent()}
      </button>

      {/* Tooltip */}
      <div className="
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2
        bg-gray-900 text-white text-sm rounded-lg
        opacity-0 group-hover:opacity-100 transition-opacity duration-200
        pointer-events-none whitespace-nowrap z-10
      ">
        {getTooltipText()}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>

      {/* Permission helper text */}
      {permission === 'prompt' && !loading && !location && (
        <div className="absolute top-full left-0 mt-1 text-xs text-gray-500">
          クリックして位置情報の使用を許可
        </div>
      )}
    </div>
  );
};