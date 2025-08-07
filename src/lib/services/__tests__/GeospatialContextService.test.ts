import { GeospatialContextService, Coordinates, GeospatialContext } from '../GeospatialContextService';

describe('GeospatialContextService', () => {
  let geospatialService: GeospatialContextService;

  beforeEach(() => {
    geospatialService = new GeospatialContextService();
  });

  describe('calculateDistance', () => {
    test('should calculate distance between Tokyo Station and Shibuya', () => {
      const tokyoStation = { latitude: 35.6812, longitude: 139.7671 };
      const shibuya = { latitude: 35.6580, longitude: 139.7016 };

      const distance = geospatialService.calculateDistance(tokyoStation, shibuya);

      expect(distance).toBeGreaterThan(6000); // Approximately 6-7 km in meters
      expect(distance).toBeLessThan(8000);
    });

    test('should return 0 for same coordinates', () => {
      const point = { latitude: 35.6812, longitude: 139.7671 };

      const distance = geospatialService.calculateDistance(point, point);

      expect(distance).toBe(0);
    });
  });

  describe('generateGeospatialContext', () => {
    test('should generate geospatial context for Tokyo coordinates', async () => {
      const coordinates: Coordinates = { latitude: 35.6812, longitude: 139.7671 };

      const context = await geospatialService.generateGeospatialContext(coordinates);

      expect(context.coordinates).toEqual(coordinates);
      expect(context.address).toBeDefined();
      expect(context.address.prefecture).toBe('東京都');
      expect(context.administrativeRegion).toBeDefined();
      expect(context.transportation).toBeDefined();
      expect(context.transportation.nearestStations).toBeDefined();
      expect(Array.isArray(context.transportation.nearestStations)).toBe(true);
      expect(context.nearbyLandmarks).toBeDefined();
      expect(Array.isArray(context.nearbyLandmarks)).toBe(true);
    });
  });

  describe('calculateDetailedDistance', () => {
    test('should calculate detailed distance information', () => {
      const point1 = { latitude: 35.6812, longitude: 139.7671 };
      const point2 = { latitude: 35.6580, longitude: 139.7016 };

      const result = geospatialService.calculateDetailedDistance(point1, point2);

      expect(result.distance).toBeGreaterThan(6000);
      expect(result.walkingTime).toBeGreaterThan(70); // About 80+ minutes
      expect(result.cyclingTime).toBeGreaterThan(20); // About 25+ minutes
      expect(result.drivingTime).toBeGreaterThan(10); // About 13+ minutes
    });
  });

  describe('findNearbyFacilities', () => {
    test('should find nearby facilities', async () => {
      const coordinates: Coordinates = { latitude: 35.6812, longitude: 139.7671 };
      
      const facilities = await geospatialService.findNearbyFacilities(coordinates, 'library', 1000, 5);

      expect(Array.isArray(facilities)).toBe(true);
      expect(facilities.length).toBeGreaterThan(0);
      
      if (facilities.length > 0) {
        const facility = facilities[0];
        expect(facility.id).toBeDefined();
        expect(facility.name).toBeDefined();
        expect(facility.type).toBe('library');
        expect(facility.coordinates).toBeDefined();
        expect(facility.distance).toBeDefined();
        expect(facility.walkingTime).toBeDefined();
      }
    });
  });

  describe('interpretLocationExpression', () => {
    test('should interpret ward expressions', async () => {
      const result = await geospatialService.interpretLocationExpression('港区');
      expect(result.locationFilter).toBe('ward');
      expect(result.description).toBe('港区');
    });

    test('should interpret station expressions', async () => {
      const result = await geospatialService.interpretLocationExpression('東京駅');
      expect(result.locationFilter).toBe('station_area');
      expect(result.description).toBe('東京駅周辺');
      expect(result.center).toBeDefined();
      expect(result.radius).toBe(1000);
    });

    test('should interpret expressions with context', async () => {
      const mockContext = await geospatialService.generateGeospatialContext({
        latitude: 35.6812,
        longitude: 139.7671
      });
      
      const nearbyResult = await geospatialService.interpretLocationExpression('近く', mockContext);
      expect(nearbyResult.locationFilter).toBe('nearby');
      expect(nearbyResult.center).toBeDefined();
      expect(nearbyResult.radius).toBeDefined();
    });

    test('should handle default expressions', async () => {
      const result = await geospatialService.interpretLocationExpression('どこでも');
      expect(result.locationFilter).toBe('any_location');
      expect(result.description).toContain('場所指定なし');
    });
  });

  describe('createLocationFilter', () => {
    test('should create location filter function', () => {
      const filter = geospatialService.createLocationFilter('近く');

      expect(typeof filter).toBe('function');
      
      // Test filter with sample data
      const itemWithLocation = { 
        coordinates: { latitude: 35.6812, longitude: 139.7671 }
      };
      const itemWithoutLocation = { title: 'No location data' };
      
      expect(filter(itemWithLocation)).toBe(true);
      expect(filter(itemWithoutLocation)).toBe(true); // No location should pass
    });
  });

  describe('validateCoordinates', () => {
    test('should validate correct coordinates', () => {
      const validCoords: Coordinates = { latitude: 35.6812, longitude: 139.7671 };
      expect(geospatialService.validateCoordinates(validCoords)).toBe(true);
    });

    test('should reject invalid coordinates', () => {
      const invalidCoords: Coordinates = { latitude: 91, longitude: 181 };
      expect(geospatialService.validateCoordinates(invalidCoords)).toBe(false);
    });
  });
});