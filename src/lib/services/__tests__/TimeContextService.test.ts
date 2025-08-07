import { TimeContextService, TemporalContext } from '../TimeContextService';

describe('TimeContextService', () => {
  let timeContextService: TimeContextService;

  beforeEach(() => {
    timeContextService = new TimeContextService();
  });

  describe('getCurrentTimeContext', () => {
    test('should generate current temporal context', async () => {
      const context = await timeContextService.getCurrentTimeContext();

      expect(context.currentTime).toBeDefined();
      expect(context.timezone).toBe('Asia/Tokyo');
      expect(context.timeOfDay).toBeDefined();
      expect(context.season).toBeDefined();
      expect(typeof context.isBusinessHours).toBe('boolean');
      expect(context.year).toBeGreaterThan(2020);
      expect(context.month).toBeGreaterThanOrEqual(1);
      expect(context.month).toBeLessThanOrEqual(12);
    });
  });

  describe('interpretTemporalExpression', () => {
    test('should interpret "今日" (today)', async () => {
      const context = await timeContextService.getCurrentTimeContext();
      const result = await timeContextService.interpretTemporalExpression('今日', context);

      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      expect(result.timeFilter).toBe('today');
      expect(result.description).toContain('今日');
    });

    test('should interpret "今月" (this month)', async () => {
      const context = await timeContextService.getCurrentTimeContext();
      const result = await timeContextService.interpretTemporalExpression('今月', context);

      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      expect(result.timeFilter).toBe('this_month');
      expect(result.description).toContain('月');
    });

    test('should handle unrecognized expressions', async () => {
      const context = await timeContextService.getCurrentTimeContext();
      const result = await timeContextService.interpretTemporalExpression('未来の時間', context);

      expect(result.timeFilter).toBe('any_time');
      expect(result.description).toContain('期間指定なし');
    });
  });

  describe('checkFacilityOperatingHours', () => {
    test('should check library operating hours', async () => {
      const result = await timeContextService.checkFacilityOperatingHours('library');

      expect(result.isOpen).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.details).toBeDefined();
      expect(typeof result.isOpen).toBe('boolean');
    });

    test('should handle unknown facility type', async () => {
      const result = await timeContextService.checkFacilityOperatingHours('unknown_facility');

      expect(result.isOpen).toBe(false);
      expect(result.status).toBe('unknown');
      expect(result.details).toContain('営業時間情報が利用できません');
    });
  });

  describe('createTimeFilter', () => {
    test('should create time filter function', () => {
      const filter = timeContextService.createTimeFilter('今日');

      expect(typeof filter).toBe('function');
      
      // Test filter with sample data
      const todayItem = { date: new Date().toISOString() };
      const oldItem = { date: '2020-01-01' };
      
      expect(filter(todayItem)).toBe(true);
      expect(filter({})).toBe(true); // No date should pass
    });
  });
});