import { log } from '@/lib/logger';

/**
 * 座標情報
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
}

/**
 * 住所情報
 */
export interface AddressInfo {
  formatted: string;
  prefecture: string;
  city: string;
  ward?: string;
  district?: string;
  building?: string;
  postalCode?: string;
}

/**
 * 地理的コンテキスト情報
 */
export interface GeospatialContext {
  // 基本位置情報
  coordinates: Coordinates;
  
  // 住所情報
  address: AddressInfo;
  
  // 地理的区分
  administrativeRegion: {
    prefecture: string;
    specialWard?: string;  // 特別区
    city: string;
    town?: string;
    metropolitanArea: string;
  };
  
  // 交通・アクセス情報
  transportation: {
    nearestStations: Array<{
      name: string;
      lines: string[];
      distance: number;     // meters
      walkingTime: number;  // minutes
      coordinates: Coordinates;
    }>;
    accessibleBy: ('walking' | 'bicycle' | 'train' | 'bus' | 'car')[];
  };
  
  // 近隣施設・ランドマーク
  nearbyLandmarks: Array<{
    name: string;
    type: string;
    distance: number;
    direction: string;
    coordinates: Coordinates;
  }>;
  
  // 地理的特性
  geographicFeatures: {
    elevation?: number;
    terrain: string;
    waterBodies: string[];
    parks: string[];
  };
  
  // 検索範囲設定
  searchRadii: {
    walking: number;      // 徒歩圏内 (meters)
    cycling: number;      // 自転車圏内 (meters)
    transit: number;      // 公共交通圏内 (meters)
  };
}

/**
 * 距離計算結果
 */
export interface DistanceResult {
  distance: number;        // meters
  walkingTime: number;     // minutes
  cyclingTime: number;     // minutes
  drivingTime?: number;    // minutes
}

/**
 * 最寄り施設検索結果
 */
export interface NearbyFacility {
  id: string;
  name: string;
  type: string;
  coordinates: Coordinates;
  address: string;
  distance: number;
  walkingTime: number;
  isAccessible: boolean;
  operatingHours?: {
    isOpen: boolean;
    hours: string;
  };
}

/**
 * 位置情報コンテキストサービス
 * 位置に関連する文脈情報を収集・解析する
 */
export class GeospatialContextService {
  // 東京都の主要駅データ（サンプル）
  private tokyoStations = [
    {
      name: '東京駅',
      lines: ['JR山手線', 'JR中央線', 'JR東海道線', '東京メトロ丸ノ内線'],
      coordinates: { latitude: 35.6812, longitude: 139.7671 }
    },
    {
      name: '新宿駅',
      lines: ['JR山手線', 'JR中央線', '小田急線', '京王線'],
      coordinates: { latitude: 35.6896, longitude: 139.7006 }
    },
    {
      name: '渋谷駅',
      lines: ['JR山手線', 'JR埼京線', '東急東横線', '東京メトロ銀座線'],
      coordinates: { latitude: 35.6580, longitude: 139.7016 }
    },
    {
      name: '池袋駅',
      lines: ['JR山手線', 'JR埼京線', '東武東上線', '西武池袋線'],
      coordinates: { latitude: 35.7295, longitude: 139.7109 }
    },
    {
      name: '上野駅',
      lines: ['JR山手線', 'JR京浜東北線', '東京メトロ銀座線', '東京メトロ日比谷線'],
      coordinates: { latitude: 35.7139, longitude: 139.7774 }
    },
    {
      name: '品川駅',
      lines: ['JR山手線', 'JR東海道線', '京急本線'],
      coordinates: { latitude: 35.6284, longitude: 139.7387 }
    },
    {
      name: '六本木駅',
      lines: ['東京メトロ日比谷線', '都営大江戸線'],
      coordinates: { latitude: 35.6627, longitude: 139.7311 }
    },
    {
      name: '銀座駅',
      lines: ['東京メトロ銀座線', '東京メトロ丸ノ内線', '東京メトロ日比谷線'],
      coordinates: { latitude: 35.6719, longitude: 139.7656 }
    }
  ];
  
  // 東京都の主要ランドマーク
  private tokyoLandmarks = [
    {
      name: '東京スカイツリー',
      type: 'landmark',
      coordinates: { latitude: 35.7101, longitude: 139.8107 }
    },
    {
      name: '東京タワー',
      type: 'landmark',
      coordinates: { latitude: 35.6586, longitude: 139.7454 }
    },
    {
      name: '皇居',
      type: 'park',
      coordinates: { latitude: 35.6852, longitude: 139.7528 }
    },
    {
      name: '上野公園',
      type: 'park',
      coordinates: { latitude: 35.7153, longitude: 139.7743 }
    },
    {
      name: '代々木公園',
      type: 'park',
      coordinates: { latitude: 35.6732, longitude: 139.6958 }
    },
    {
      name: '東京ビッグサイト',
      type: 'event_venue',
      coordinates: { latitude: 35.6300, longitude: 139.7956 }
    },
    {
      name: '羽田空港',
      type: 'airport',
      coordinates: { latitude: 35.5494, longitude: 139.7798 }
    },
    {
      name: '東京駅',
      type: 'station',
      coordinates: { latitude: 35.6812, longitude: 139.7671 }
    }
  ];

  /**
   * 位置情報から地理的コンテキストを生成
   */
  async generateGeospatialContext(coordinates: Coordinates): Promise<GeospatialContext> {
    try {
      log.info('Generating geospatial context', {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy: coordinates.accuracy
      });

      // 住所情報を取得（リバースジオコーディング）
      const address = await this.reverseGeocode(coordinates);
      
      // 行政区分を解析
      const administrativeRegion = this.parseAdministrativeRegion(address);
      
      // 最寄り駅を検索
      const nearestStations = this.findNearestStations(coordinates, 5);
      
      // 近隣ランドマークを検索
      const nearbyLandmarks = this.findNearbyLandmarks(coordinates, 10);
      
      // 地理的特性を判定
      const geographicFeatures = this.analyzeGeographicFeatures(coordinates, address);
      
      // 交通手段を判定
      const accessibleBy = this.determineAccessibleTransportation(coordinates, nearestStations);
      
      // 検索範囲を設定
      const searchRadii = this.calculateSearchRadii(administrativeRegion);

      const context: GeospatialContext = {
        coordinates,
        address,
        administrativeRegion,
        transportation: {
          nearestStations,
          accessibleBy
        },
        nearbyLandmarks,
        geographicFeatures,
        searchRadii
      };
      
      log.info('Geospatial context generated successfully', {
        prefecture: address.prefecture,
        city: address.city,
        nearestStation: nearestStations[0]?.name,
        landmarkCount: nearbyLandmarks.length
      });
      
      return context;
    } catch (error) {
      log.error('Failed to generate geospatial context', error as Error, {
        coordinates
      });
      throw new Error('地理的コンテキストの生成に失敗しました');
    }
  }

  /**
   * リバースジオコーディング（座標から住所）
   */
  private async reverseGeocode(coordinates: Coordinates): Promise<AddressInfo> {
    // 実際の実装では Google Maps Geocoding API などを使用
    // ここでは東京都内の代表的な位置を模擬的に返す
    
    const { latitude, longitude } = coordinates;
    
    // 東京都内の大まかな地域判定
    if (latitude >= 35.65 && latitude <= 35.75 && longitude >= 139.69 && longitude <= 139.80) {
      // 東京都心部
      if (longitude < 139.72) {
        return {
          formatted: '東京都港区六本木1-1-1',
          prefecture: '東京都',
          city: '港区',
          ward: '六本木',
          district: '1丁目',
          postalCode: '106-6108'
        };
      } else if (longitude < 139.75) {
        return {
          formatted: '東京都千代田区丸の内1-1-1',
          prefecture: '東京都',
          city: '千代田区',
          ward: '丸の内',
          district: '1丁目',
          postalCode: '100-0005'
        };
      } else {
        return {
          formatted: '東京都台東区上野1-1-1',
          prefecture: '東京都',
          city: '台東区',
          ward: '上野',
          district: '1丁目',
          postalCode: '110-0005'
        };
      }
    } else {
      // 東京都外または郊外
      return {
        formatted: '東京都新宿区西新宿1-1-1',
        prefecture: '東京都',
        city: '新宿区',
        ward: '西新宿',
        district: '1丁目',
        postalCode: '160-0023'
      };
    }
  }

  /**
   * 行政区分を解析
   */
  private parseAdministrativeRegion(address: AddressInfo): GeospatialContext['administrativeRegion'] {
    const city = address.city;
    let metropolitanArea = '首都圏';
    
    // 特別区の判定
    const specialWards = [
      '千代田区', '中央区', '港区', '新宿区', '文京区', '台東区', '墨田区',
      '江東区', '品川区', '目黒区', '大田区', '世田谷区', '渋谷区', '中野区',
      '杉並区', '豊島区', '北区', '荒川区', '板橋区', '練馬区', '足立区', '葛飾区', '江戸川区'
    ];
    
    const isSpecialWard = specialWards.includes(city);
    
    return {
      prefecture: address.prefecture,
      specialWard: isSpecialWard ? city : undefined,
      city: city,
      town: address.ward,
      metropolitanArea
    };
  }

  /**
   * 最寄り駅を検索
   */
  private findNearestStations(coordinates: Coordinates, limit: number = 5): GeospatialContext['transportation']['nearestStations'] {
    const stationsWithDistance = this.tokyoStations.map(station => {
      const distance = this.calculateDistance(coordinates, station.coordinates);
      const walkingTime = Math.round(distance / 80); // 80m/min で計算
      
      return {
        name: station.name,
        lines: station.lines,
        distance: Math.round(distance),
        walkingTime,
        coordinates: station.coordinates
      };
    });
    
    return stationsWithDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  /**
   * 近隣ランドマークを検索
   */
  private findNearbyLandmarks(coordinates: Coordinates, limit: number = 10): GeospatialContext['nearbyLandmarks'] {
    const landmarksWithDistance = this.tokyoLandmarks.map(landmark => {
      const distance = this.calculateDistance(coordinates, landmark.coordinates);
      const direction = this.calculateDirection(coordinates, landmark.coordinates);
      
      return {
        name: landmark.name,
        type: landmark.type,
        distance: Math.round(distance),
        direction,
        coordinates: landmark.coordinates
      };
    });
    
    return landmarksWithDistance
      .filter(landmark => landmark.distance < 10000) // 10km以内
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  /**
   * 地理的特性を分析
   */
  private analyzeGeographicFeatures(coordinates: Coordinates, address: AddressInfo): GeospatialContext['geographicFeatures'] {
    const terrain = this.determineTerrain(coordinates, address);
    const waterBodies = this.findNearbyWaterBodies(coordinates);
    const parks = this.findNearbyParks(coordinates);
    
    return {
      terrain,
      waterBodies,
      parks
    };
  }

  /**
   * 地形を判定
   */
  private determineTerrain(coordinates: Coordinates, address: AddressInfo): string {
    const specialWardsUrban = [
      '千代田区', '中央区', '港区', '新宿区', '渋谷区', '豊島区'
    ];
    
    const specialWardsResidential = [
      '世田谷区', '杉並区', '練馬区', '文京区', '目黒区'
    ];
    
    if (specialWardsUrban.includes(address.city)) {
      return 'urban_center';
    } else if (specialWardsResidential.includes(address.city)) {
      return 'residential';
    } else {
      return 'suburban';
    }
  }

  /**
   * 近隣の水域を検索
   */
  private findNearbyWaterBodies(coordinates: Coordinates): string[] {
    const waterBodies: string[] = [];
    
    // 簡易的な判定（実際にはより詳細な地理データベースを使用）
    if (coordinates.latitude > 35.65 && coordinates.longitude > 139.77) {
      waterBodies.push('隅田川');
    }
    
    if (coordinates.latitude > 35.63 && coordinates.latitude < 35.67 && 
        coordinates.longitude > 139.74 && coordinates.longitude < 139.78) {
      waterBodies.push('皇居外濠');
    }
    
    return waterBodies;
  }

  /**
   * 近隣の公園を検索
   */
  private findNearbyParks(coordinates: Coordinates): string[] {
    const parks: string[] = [];
    
    // 上野公園周辺
    if (this.calculateDistance(coordinates, { latitude: 35.7153, longitude: 139.7743 }) < 1000) {
      parks.push('上野公園');
    }
    
    // 代々木公園周辺
    if (this.calculateDistance(coordinates, { latitude: 35.6732, longitude: 139.6958 }) < 1000) {
      parks.push('代々木公園');
    }
    
    // 皇居周辺
    if (this.calculateDistance(coordinates, { latitude: 35.6852, longitude: 139.7528 }) < 1000) {
      parks.push('皇居東御苑');
    }
    
    return parks;
  }

  /**
   * アクセス可能な交通手段を判定
   */
  private determineAccessibleTransportation(
    coordinates: Coordinates, 
    nearestStations: GeospatialContext['transportation']['nearestStations']
  ): GeospatialContext['transportation']['accessibleBy'] {
    const accessible: GeospatialContext['transportation']['accessibleBy'] = ['walking'];
    
    // 自転車（平坦な地域で駅から3km以内）
    if (nearestStations.length > 0 && nearestStations[0].distance < 3000) {
      accessible.push('bicycle');
    }
    
    // 電車（駅から徒歩15分以内）
    if (nearestStations.length > 0 && nearestStations[0].walkingTime <= 15) {
      accessible.push('train');
    }
    
    // バス（都市部はバス路線が発達）
    accessible.push('bus');
    
    // 車（郊外地域）
    accessible.push('car');
    
    return accessible;
  }

  /**
   * 検索範囲を計算
   */
  private calculateSearchRadii(administrativeRegion: GeospatialContext['administrativeRegion']): GeospatialContext['searchRadii'] {
    // 都心部は狭く、郊外は広く設定
    const isUrbanCenter = ['千代田区', '中央区', '港区', '新宿区', '渋谷区'].includes(
      administrativeRegion.city
    );
    
    if (isUrbanCenter) {
      return {
        walking: 500,    // 500m
        cycling: 2000,   // 2km
        transit: 5000    // 5km
      };
    } else {
      return {
        walking: 800,    // 800m
        cycling: 3000,   // 3km
        transit: 10000   // 10km
      };
    }
  }

  /**
   * 2点間の距離を計算（Haversine formula）
   */
  calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371000; // 地球の半径（メートル）
    const lat1Rad = point1.latitude * Math.PI / 180;
    const lat2Rad = point2.latitude * Math.PI / 180;
    const deltaLatRad = (point2.latitude - point1.latitude) * Math.PI / 180;
    const deltaLngRad = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 方角を計算
   */
  private calculateDirection(from: Coordinates, to: Coordinates): string {
    const deltaLng = to.longitude - from.longitude;
    const deltaLat = to.latitude - from.latitude;
    
    const angle = Math.atan2(deltaLng, deltaLat) * 180 / Math.PI;
    const normalizedAngle = (angle + 360) % 360;
    
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return '北';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return '北東';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return '東';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return '南東';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return '南';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return '南西';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return '西';
    return '北西';
  }

  /**
   * 詳細な距離計算結果を取得
   */
  calculateDetailedDistance(point1: Coordinates, point2: Coordinates): DistanceResult {
    const distance = this.calculateDistance(point1, point2);
    
    return {
      distance: Math.round(distance),
      walkingTime: Math.round(distance / 80),     // 80m/min (平均歩行速度)
      cyclingTime: Math.round(distance / 250),    // 250m/min (平均自転車速度)
      drivingTime: Math.round(distance / 500)     // 500m/min (都市部平均運転速度)
    };
  }

  /**
   * 最寄り施設を検索
   */
  async findNearbyFacilities(
    coordinates: Coordinates,
    facilityType: string,
    radius: number = 1000,
    limit: number = 10
  ): Promise<NearbyFacility[]> {
    // 実際の実装では施設データベースから検索
    // ここでは模擬データを返す
    
    const mockFacilities: NearbyFacility[] = [
      {
        id: 'facility_001',
        name: `${facilityType}サンプル1`,
        type: facilityType,
        coordinates: {
          latitude: coordinates.latitude + 0.001,
          longitude: coordinates.longitude + 0.001
        },
        address: '東京都港区六本木1-1-1',
        distance: 150,
        walkingTime: 2,
        isAccessible: true,
        operatingHours: {
          isOpen: true,
          hours: '9:00-18:00'
        }
      },
      {
        id: 'facility_002',
        name: `${facilityType}サンプル2`,
        type: facilityType,
        coordinates: {
          latitude: coordinates.latitude - 0.002,
          longitude: coordinates.longitude + 0.003
        },
        address: '東京都港区赤坂2-2-2',
        distance: 350,
        walkingTime: 4,
        isAccessible: true,
        operatingHours: {
          isOpen: false,
          hours: '10:00-17:00'
        }
      }
    ];
    
    return mockFacilities
      .filter(facility => facility.distance <= radius)
      .slice(0, limit);
  }

  /**
   * 地域表現を解釈してフィルタ条件を生成
   */
  async interpretLocationExpression(
    expression: string,
    currentContext?: GeospatialContext
  ): Promise<{
    boundingBox?: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    center?: Coordinates;
    radius?: number;
    locationFilter: string;
    description: string;
  }> {
    const normalizedExpression = expression.toLowerCase().trim();
    
    // 近く・近隣
    if (normalizedExpression.includes('近く') || normalizedExpression.includes('近隣') || 
        normalizedExpression.includes('周辺')) {
      if (!currentContext) {
        throw new Error('現在位置の情報が必要です');
      }
      
      return {
        center: currentContext.coordinates,
        radius: currentContext.searchRadii.walking,
        locationFilter: 'nearby',
        description: `現在地から${currentContext.searchRadii.walking}m圏内`
      };
    }
    
    // 特定の区
    const wardMatches = normalizedExpression.match(/([\u4e00-\u9faf]+区)/);
    if (wardMatches) {
      const ward = wardMatches[1];
      return {
        locationFilter: 'ward',
        description: ward
      };
    }
    
    // 駅周辺
    const stationMatches = normalizedExpression.match(/([\u4e00-\u9faf]+駅)/);
    if (stationMatches) {
      const stationName = stationMatches[1];
      const station = this.tokyoStations.find(s => s.name === stationName);
      
      if (station) {
        return {
          center: station.coordinates,
          radius: 1000, // 駅から1km圏内
          locationFilter: 'station_area',
          description: `${stationName}周辺`
        };
      }
    }
    
    // 徒歩圏内
    if (normalizedExpression.includes('徒歩') || normalizedExpression.includes('歩い')) {
      if (!currentContext) {
        throw new Error('現在位置の情報が必要です');
      }
      
      return {
        center: currentContext.coordinates,
        radius: currentContext.searchRadii.walking,
        locationFilter: 'walking_distance',
        description: '徒歩圏内'
      };
    }
    
    // 自転車圏内
    if (normalizedExpression.includes('自転車') || normalizedExpression.includes('チャリ')) {
      if (!currentContext) {
        throw new Error('現在位置の情報が必要です');
      }
      
      return {
        center: currentContext.coordinates,
        radius: currentContext.searchRadii.cycling,
        locationFilter: 'cycling_distance',
        description: '自転車圏内'
      };
    }
    
    // デフォルト（位置制限なし）
    return {
      locationFilter: 'any_location',
      description: '場所指定なし'
    };
  }

  /**
   * 位置フィルタリング用のヘルパー関数
   */
  createLocationFilter(
    locationExpression: string, 
    currentContext?: GeospatialContext
  ): (item: any) => boolean {
    return (item: any) => {
      if (!item.coordinates && !item.address && !item.location) {
        return true; // 位置情報がない場合は含める
      }
      
      // 実際のフィルタリングロジックは、具体的なデータ構造に応じて実装
      return true;
    };
  }

  /**
   * 座標の妥当性検証
   */
  validateCoordinates(coordinates: Coordinates): boolean {
    const { latitude, longitude } = coordinates;
    
    // 基本的な範囲チェック
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return false;
    }
    
    // 東京都周辺の妥当性チェック（大まかな範囲）
    if (latitude < 35.0 || latitude > 36.0 || longitude < 138.5 || longitude > 140.5) {
      log.warn('Coordinates outside Tokyo metropolitan area', { latitude, longitude });
      // 警告するが、エラーにはしない
    }
    
    return true;
  }
}