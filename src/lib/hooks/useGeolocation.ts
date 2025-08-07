'use client';

import { useState, useEffect, useCallback } from 'react';
import { Coordinates } from '@/lib/services/GeospatialContextService';

export interface GeolocationState {
  location: Coordinates | null;
  loading: boolean;
  error: string | null;
  permission: PermissionState | null;
  isSupported: boolean;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoStart?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    autoStart = false
  } = options;

  const [state, setState] = useState<GeolocationState>({
    location: null,
    loading: false,
    error: null,
    permission: null,
    isSupported: false
  });

  // Check if Geolocation API is supported
  useEffect(() => {
    const isSupported = 'geolocation' in navigator;
    setState(prev => ({ ...prev, isSupported }));
  }, []);

  // Check permission status
  const checkPermission = useCallback(async () => {
    if (!('permissions' in navigator)) return;
    
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setState(prev => ({ ...prev, permission: result.state }));
      
      result.addEventListener('change', () => {
        setState(prev => ({ ...prev, permission: result.state }));
      });
    } catch (error) {
      console.warn('Permission API not supported:', error);
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Success callback
  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = position.coords;
    
    setState({
      location: {
        latitude,
        longitude,
        accuracy,
        timestamp: new Date(position.timestamp)
      },
      loading: false,
      error: null,
      permission: 'granted' as PermissionState,
      isSupported: true
    });
  }, []);

  // Error callback
  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = '';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = '位置情報の使用が許可されていません';
        setState(prev => ({ ...prev, permission: 'denied' as PermissionState }));
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = '位置情報を取得できません';
        break;
      case error.TIMEOUT:
        errorMessage = '位置情報の取得がタイムアウトしました';
        break;
      default:
        errorMessage = '位置情報の取得中にエラーが発生しました';
    }
    
    setState(prev => ({
      ...prev,
      loading: false,
      error: errorMessage,
      location: null
    }));
  }, []);

  // Get current position
  const getCurrentPosition = useCallback(() => {
    if (!state.isSupported) {
      setState(prev => ({
        ...prev,
        error: 'ブラウザが位置情報をサポートしていません'
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const options: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      options
    );
  }, [state.isSupported, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  // Watch position with cleanup
  const watchPosition = useCallback(() => {
    if (!state.isSupported) {
      setState(prev => ({
        ...prev,
        error: 'ブラウザが位置情報をサポートしていません'
      }));
      return null;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const options: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge
    };

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      options
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setState(prev => ({ ...prev, loading: false }));
    };
  }, [state.isSupported, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  // Auto-start location tracking if enabled
  useEffect(() => {
    if (autoStart && state.isSupported && !state.location && !state.loading) {
      getCurrentPosition();
    }
  }, [autoStart, state.isSupported, state.location, state.loading, getCurrentPosition]);

  // Clear location
  const clearLocation = useCallback(() => {
    setState(prev => ({
      ...prev,
      location: null,
      error: null,
      loading: false
    }));
  }, []);

  return {
    ...state,
    getCurrentPosition,
    watchPosition,
    clearLocation,
    checkPermission
  };
}