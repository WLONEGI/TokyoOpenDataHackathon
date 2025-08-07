import { log } from '@/lib/logger';

/**
 * 時間的コンテキスト情報
 */
export interface TemporalContext {
  // 基本時間情報
  currentTime: Date;
  timezone: string;
  timestamp: number;
  
  // 日時分解情報
  year: number;
  month: number;        // 1-12
  day: number;          // 1-31
  dayOfWeek: number;    // 0-6 (Sunday-Saturday)
  hour: number;         // 0-23
  minute: number;       // 0-59
  
  // 文脈的時間情報
  timeOfDay: 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  dayType: 'weekday' | 'weekend' | 'holiday';
  
  // 相対時間情報
  isBusinessHours: boolean;
  isToday: boolean;
  isThisWeek: boolean;
  isThisMonth: boolean;
  isThisYear: boolean;
  
  // 日本の祝日・特別日
  holidays: Array<{
    name: string;
    date: string;
    type: 'national' | 'local' | 'observance';
  }>;
  
  // 営業時間チェック機能
  businessHours: {
    [facilityType: string]: {
      isOpen: boolean;
      opensAt?: string;
      closesAt?: string;
      nextOpen?: Date;
      specialHours?: string;
    };
  };
  
  // 時間的関連性
  relativeTimeExpressions: {
    thisWeek: { start: Date; end: Date };
    thisMonth: { start: Date; end: Date };
    thisYear: { start: Date; end: Date };
    nextWeekend: { start: Date; end: Date };
    nextMonth: { start: Date; end: Date };
  };
}

/**
 * 営業時間定義
 */
interface BusinessHoursDefinition {
  [facilityType: string]: {
    weekday: { open: string; close: string };
    weekend: { open: string; close: string } | null;
    holiday: { open: string; close: string } | null;
    exceptions?: Array<{
      date: string;
      hours: { open: string; close: string } | null;
      reason: string;
    }>;
  };
}

/**
 * 時間コンテキストサービス
 * 時間に関連する文脈情報を収集・解析する
 */
export class TimeContextService {
  private timezone: string = 'Asia/Tokyo';
  private locale: string = 'ja-JP';
  
  // 日本の祝日データ（2025年）
  private japaneseHolidays2025 = [
    { name: '元日', date: '2025-01-01', type: 'national' as const },
    { name: '成人の日', date: '2025-01-13', type: 'national' as const },
    { name: '建国記念の日', date: '2025-02-11', type: 'national' as const },
    { name: '天皇誕生日', date: '2025-02-23', type: 'national' as const },
    { name: '春分の日', date: '2025-03-20', type: 'national' as const },
    { name: '昭和の日', date: '2025-04-29', type: 'national' as const },
    { name: '憲法記念日', date: '2025-05-03', type: 'national' as const },
    { name: 'みどりの日', date: '2025-05-04', type: 'national' as const },
    { name: 'こどもの日', date: '2025-05-05', type: 'national' as const },
    { name: '海の日', date: '2025-07-21', type: 'national' as const },
    { name: '山の日', date: '2025-08-11', type: 'national' as const },
    { name: '敬老の日', date: '2025-09-15', type: 'national' as const },
    { name: '秋分の日', date: '2025-09-23', type: 'national' as const },
    { name: 'スポーツの日', date: '2025-10-13', type: 'national' as const },
    { name: '文化の日', date: '2025-11-03', type: 'national' as const },
    { name: '勤労感謝の日', date: '2025-11-23', type: 'national' as const }
  ];
  
  // 施設タイプ別営業時間
  private businessHoursData: BusinessHoursDefinition = {
    library: {
      weekday: { open: '09:00', close: '20:00' },
      weekend: { open: '09:00', close: '17:00' },
      holiday: { open: '09:00', close: '17:00' }
    },
    city_hall: {
      weekday: { open: '08:30', close: '17:15' },
      weekend: null,
      holiday: null
    },
    park: {
      weekday: { open: '24:00', close: '24:00' }, // 24時間
      weekend: { open: '24:00', close: '24:00' },
      holiday: { open: '24:00', close: '24:00' }
    },
    museum: {
      weekday: { open: '09:30', close: '17:00' },
      weekend: { open: '09:30', close: '17:00' },
      holiday: null
    },
    nursery: {
      weekday: { open: '07:00', close: '19:00' },
      weekend: null,
      holiday: null
    },
    hospital: {
      weekday: { open: '08:30', close: '17:00' },
      weekend: { open: '09:00', close: '12:00' },
      holiday: { open: '09:00', close: '12:00' }
    },
    pharmacy: {
      weekday: { open: '09:00', close: '19:00' },
      weekend: { open: '09:00', close: '18:00' },
      holiday: { open: '10:00', close: '18:00' }
    },
    shopping_center: {
      weekday: { open: '10:00', close: '21:00' },
      weekend: { open: '10:00', close: '21:00' },
      holiday: { open: '10:00', close: '20:00' }
    },
    restaurant: {
      weekday: { open: '11:00', close: '22:00' },
      weekend: { open: '11:00', close: '22:00' },
      holiday: { open: '11:00', close: '21:00' }
    },
    gym: {
      weekday: { open: '06:00', close: '23:00' },
      weekend: { open: '08:00', close: '21:00' },
      holiday: { open: '08:00', close: '21:00' }
    }
  };

  /**
   * 現在の時間コンテキストを取得
   */
  async getCurrentTimeContext(): Promise<TemporalContext> {
    try {
      const now = new Date();
      const jstTime = new Date(now.toLocaleString('en-US', { timeZone: this.timezone }));
      
      const context = this.buildTemporalContext(jstTime);
      
      log.info('Time context generated', {
        currentTime: context.currentTime.toISOString(),
        timeOfDay: context.timeOfDay,
        season: context.season,
        dayType: context.dayType,
        isBusinessHours: context.isBusinessHours
      });
      
      return context;
    } catch (error) {
      log.error('Failed to generate time context', error as Error);
      throw new Error('時間コンテキストの生成に失敗しました');
    }
  }

  /**
   * 時間コンテキストを構築
   */
  private buildTemporalContext(currentTime: Date): TemporalContext {
    const year = currentTime.getFullYear();
    const month = currentTime.getMonth() + 1; // 0-11 → 1-12
    const day = currentTime.getDate();
    const dayOfWeek = currentTime.getDay(); // 0=Sunday
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    
    return {
      // 基本時間情報
      currentTime,
      timezone: this.timezone,
      timestamp: currentTime.getTime(),
      
      // 日時分解情報
      year,
      month,
      day,
      dayOfWeek,
      hour,
      minute,
      
      // 文脈的時間情報
      timeOfDay: this.determineTimeOfDay(hour),
      season: this.determineSeason(month),
      dayType: this.determineDayType(currentTime),
      
      // 相対時間情報
      isBusinessHours: this.isBusinessHours(currentTime),
      isToday: this.isToday(currentTime),
      isThisWeek: this.isThisWeek(currentTime),
      isThisMonth: this.isThisMonth(currentTime),
      isThisYear: this.isThisYear(currentTime),
      
      // 祝日情報
      holidays: this.getRelevantHolidays(currentTime),
      
      // 営業時間情報
      businessHours: this.calculateBusinessHours(currentTime),
      
      // 相対時間表現
      relativeTimeExpressions: this.generateRelativeTimeExpressions(currentTime)
    };
  }

  /**
   * 時間帯を判定
   */
  private determineTimeOfDay(hour: number): TemporalContext['timeOfDay'] {
    if (hour >= 5 && hour < 8) return 'early_morning';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 && hour < 24) return 'night';
    return 'late_night'; // 0-4
  }

  /**
   * 季節を判定
   */
  private determineSeason(month: number): TemporalContext['season'] {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter'; // 12, 1, 2
  }

  /**
   * 日タイプを判定（平日・休日・祝日）
   */
  private determineDayType(date: Date): TemporalContext['dayType'] {
    const dayOfWeek = date.getDay();
    const dateString = date.toISOString().split('T')[0];
    
    // 祝日チェック
    const isHoliday = this.japaneseHolidays2025.some(holiday => holiday.date === dateString);
    if (isHoliday) return 'holiday';
    
    // 土日チェック
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'weekend';
    
    return 'weekday';
  }

  /**
   * 営業時間内かどうかを判定
   */
  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const dayType = this.determineDayType(date);
    
    // 一般的な営業時間（9-17時）で判定
    if (dayType === 'weekday') {
      return hour >= 9 && hour < 17;
    } else if (dayType === 'weekend') {
      return hour >= 10 && hour < 16;
    } else {
      return false; // 祝日は営業していない前提
    }
  }

  /**
   * 今日かどうか判定
   */
  private isToday(targetDate: Date): boolean {
    const today = new Date();
    return targetDate.toDateString() === today.toDateString();
  }

  /**
   * 今週かどうか判定
   */
  private isThisWeek(targetDate: Date): boolean {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // 日曜日を週の始まりとする
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return targetDate >= startOfWeek && targetDate <= endOfWeek;
  }

  /**
   * 今月かどうか判定
   */
  private isThisMonth(targetDate: Date): boolean {
    const now = new Date();
    return targetDate.getFullYear() === now.getFullYear() &&
           targetDate.getMonth() === now.getMonth();
  }

  /**
   * 今年かどうか判定
   */
  private isThisYear(targetDate: Date): boolean {
    const now = new Date();
    return targetDate.getFullYear() === now.getFullYear();
  }

  /**
   * 関連する祝日情報を取得
   */
  private getRelevantHolidays(currentDate: Date): TemporalContext['holidays'] {
    const currentMonth = currentDate.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    
    return this.japaneseHolidays2025.filter(holiday => {
      const holidayMonth = parseInt(holiday.date.split('-')[1]);
      return holidayMonth === currentMonth || holidayMonth === nextMonth;
    });
  }

  /**
   * 施設タイプ別営業時間を計算
   */
  private calculateBusinessHours(currentTime: Date): TemporalContext['businessHours'] {
    const result: TemporalContext['businessHours'] = {};
    const dayType = this.determineDayType(currentTime);
    
    for (const [facilityType, hours] of Object.entries(this.businessHoursData)) {
      let todayHours;
      
      if (dayType === 'weekday') {
        todayHours = hours.weekday;
      } else if (dayType === 'weekend') {
        todayHours = hours.weekend;
      } else {
        todayHours = hours.holiday;
      }
      
      if (!todayHours) {
        // 営業していない
        result[facilityType] = {
          isOpen: false,
          specialHours: '本日は休業'
        };
      } else if (todayHours.open === '24:00' && todayHours.close === '24:00') {
        // 24時間営業
        result[facilityType] = {
          isOpen: true,
          opensAt: '24時間',
          closesAt: '24時間',
          specialHours: '24時間営業'
        };
      } else {
        // 通常営業
        const isCurrentlyOpen = this.isCurrentlyOpen(currentTime, todayHours);
        const nextOpen = this.calculateNextOpen(currentTime, facilityType);
        
        result[facilityType] = {
          isOpen: isCurrentlyOpen,
          opensAt: todayHours.open,
          closesAt: todayHours.close,
          nextOpen
        };
      }
    }
    
    return result;
  }

  /**
   * 現在営業中かチェック
   */
  private isCurrentlyOpen(currentTime: Date, hours: { open: string; close: string }): boolean {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const openMinutes = this.timeStringToMinutes(hours.open);
    const closeMinutes = this.timeStringToMinutes(hours.close);
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  /**
   * 次回営業開始時刻を計算
   */
  private calculateNextOpen(currentTime: Date, facilityType: string): Date | undefined {
    const facilityHours = this.businessHoursData[facilityType];
    if (!facilityHours) return undefined;
    
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(currentTime.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowDayType = this.determineDayType(tomorrow);
    let tomorrowHours;
    
    if (tomorrowDayType === 'weekday') {
      tomorrowHours = facilityHours.weekday;
    } else if (tomorrowDayType === 'weekend') {
      tomorrowHours = facilityHours.weekend;
    } else {
      tomorrowHours = facilityHours.holiday;
    }
    
    if (!tomorrowHours) return undefined;
    
    const [openHour, openMinute] = tomorrowHours.open.split(':').map(Number);
    const nextOpenTime = new Date(tomorrow);
    nextOpenTime.setHours(openHour, openMinute, 0, 0);
    
    return nextOpenTime;
  }

  /**
   * 時間文字列を分に変換
   */
  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 相対時間表現を生成
   */
  private generateRelativeTimeExpressions(currentTime: Date): TemporalContext['relativeTimeExpressions'] {
    // 今週
    const thisWeekStart = new Date(currentTime);
    thisWeekStart.setDate(currentTime.getDate() - currentTime.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
    thisWeekEnd.setHours(23, 59, 59, 999);
    
    // 今月
    const thisMonthStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1);
    const thisMonthEnd = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0);
    thisMonthEnd.setHours(23, 59, 59, 999);
    
    // 今年
    const thisYearStart = new Date(currentTime.getFullYear(), 0, 1);
    const thisYearEnd = new Date(currentTime.getFullYear(), 11, 31);
    thisYearEnd.setHours(23, 59, 59, 999);
    
    // 次の週末
    let nextWeekendStart = new Date(currentTime);
    const daysUntilSaturday = (6 - currentTime.getDay() + 7) % 7;
    if (daysUntilSaturday === 0 && currentTime.getDay() === 6) {
      // 今日が土曜日の場合
      nextWeekendStart = new Date(currentTime);
    } else {
      nextWeekendStart.setDate(currentTime.getDate() + daysUntilSaturday);
    }
    nextWeekendStart.setHours(0, 0, 0, 0);
    
    const nextWeekendEnd = new Date(nextWeekendStart);
    nextWeekendEnd.setDate(nextWeekendStart.getDate() + 1); // 日曜日
    nextWeekendEnd.setHours(23, 59, 59, 999);
    
    // 来月
    const nextMonthStart = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 1);
    const nextMonthEnd = new Date(currentTime.getFullYear(), currentTime.getMonth() + 2, 0);
    nextMonthEnd.setHours(23, 59, 59, 999);
    
    return {
      thisWeek: { start: thisWeekStart, end: thisWeekEnd },
      thisMonth: { start: thisMonthStart, end: thisMonthEnd },
      thisYear: { start: thisYearStart, end: thisYearEnd },
      nextWeekend: { start: nextWeekendStart, end: nextWeekendEnd },
      nextMonth: { start: nextMonthStart, end: nextMonthEnd }
    };
  }

  /**
   * 時間表現を解釈してフィルタ条件を生成
   */
  async interpretTemporalExpression(expression: string, context: TemporalContext): Promise<{
    startDate?: Date;
    endDate?: Date;
    timeFilter: string;
    description: string;
  }> {
    const normalizedExpression = expression.toLowerCase().trim();
    
    // 今日
    if (normalizedExpression.includes('今日') || normalizedExpression.includes('きょう')) {
      const today = new Date(context.currentTime);
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      
      return {
        startDate: today,
        endDate: endOfToday,
        timeFilter: 'today',
        description: '今日'
      };
    }
    
    // 今月
    if (normalizedExpression.includes('今月') || normalizedExpression.includes('こんげつ')) {
      return {
        startDate: context.relativeTimeExpressions.thisMonth.start,
        endDate: context.relativeTimeExpressions.thisMonth.end,
        timeFilter: 'this_month',
        description: `${context.year}年${context.month}月`
      };
    }
    
    // 今週
    if (normalizedExpression.includes('今週') || normalizedExpression.includes('こんしゅう')) {
      return {
        startDate: context.relativeTimeExpressions.thisWeek.start,
        endDate: context.relativeTimeExpressions.thisWeek.end,
        timeFilter: 'this_week',
        description: '今週'
      };
    }
    
    // 来月
    if (normalizedExpression.includes('来月') || normalizedExpression.includes('らいげつ')) {
      return {
        startDate: context.relativeTimeExpressions.nextMonth.start,
        endDate: context.relativeTimeExpressions.nextMonth.end,
        timeFilter: 'next_month',
        description: `来月（${context.month === 12 ? 1 : context.month + 1}月）`
      };
    }
    
    // 週末
    if (normalizedExpression.includes('週末') || normalizedExpression.includes('しゅうまつ')) {
      return {
        startDate: context.relativeTimeExpressions.nextWeekend.start,
        endDate: context.relativeTimeExpressions.nextWeekend.end,
        timeFilter: 'next_weekend',
        description: '今度の週末'
      };
    }
    
    // 現在営業中
    if (normalizedExpression.includes('営業中') || normalizedExpression.includes('開いている') || 
        normalizedExpression.includes('今開いている')) {
      return {
        timeFilter: 'currently_open',
        description: '現在営業中'
      };
    }
    
    // デフォルト（時間制限なし）
    return {
      timeFilter: 'any_time',
      description: '期間指定なし'
    };
  }

  /**
   * 営業時間チェック用の便利メソッド
   */
  async checkFacilityOperatingHours(
    facilityType: string, 
    targetTime?: Date
  ): Promise<{
    isOpen: boolean;
    status: string;
    nextChange?: Date;
    details: string;
  }> {
    const context = await this.getCurrentTimeContext();
    const checkTime = targetTime || context.currentTime;
    const facilityHours = context.businessHours[facilityType];
    
    if (!facilityHours) {
      return {
        isOpen: false,
        status: 'unknown',
        details: '営業時間情報が利用できません'
      };
    }
    
    if (facilityHours.specialHours) {
      return {
        isOpen: facilityHours.isOpen,
        status: facilityHours.isOpen ? 'open' : 'closed',
        details: facilityHours.specialHours
      };
    }
    
    const status = facilityHours.isOpen ? 'open' : 'closed';
    const statusText = facilityHours.isOpen ? '営業中' : '営業時間外';
    let details = `営業時間: ${facilityHours.opensAt} - ${facilityHours.closesAt}`;
    
    if (!facilityHours.isOpen && facilityHours.nextOpen) {
      const nextOpenText = facilityHours.nextOpen.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      details += ` (次回営業: ${nextOpenText})`;
    }
    
    return {
      isOpen: facilityHours.isOpen,
      status,
      nextChange: facilityHours.nextOpen,
      details: `${statusText} - ${details}`
    };
  }

  /**
   * 時間フィルタリング用のヘルパー関数
   */
  createTimeFilter(expression: string): (item: any) => boolean {
    return (item: any) => {
      // 実際のフィルタリングロジックは、具体的なデータ構造に応じて実装
      // ここでは基本的な枠組みのみ提供
      if (!item.date && !item.startDate && !item.eventDate) {
        return true; // 日付情報がない場合は含める
      }
      
      const itemDate = new Date(item.date || item.startDate || item.eventDate);
      const now = new Date();
      
      if (expression.includes('今月')) {
        return itemDate.getMonth() === now.getMonth() && 
               itemDate.getFullYear() === now.getFullYear();
      }
      
      if (expression.includes('今日')) {
        return itemDate.toDateString() === now.toDateString();
      }
      
      return true;
    };
  }
}