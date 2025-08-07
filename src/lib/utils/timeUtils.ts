/**
 * 時刻関連のユーティリティ関数
 */

/**
 * 現在時刻を日本語で整形
 */
export function getCurrentTimeFormatted(language: 'ja' | 'en' | 'zh' | 'ko' = 'ja'): string {
  const now = new Date();
  const jstTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  
  const year = jstTime.getFullYear();
  const month = jstTime.getMonth() + 1;
  const day = jstTime.getDate();
  const hour = jstTime.getHours();
  const minute = jstTime.getMinutes();
  const second = jstTime.getSeconds();
  
  const weekdays = {
    ja: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    zh: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  };
  
  const weekday = weekdays[language][jstTime.getDay()];
  
  switch (language) {
    case 'ja':
      return `${year}年${month}月${day}日（${weekday}）${hour}時${minute}分${second}秒`;
    case 'en':
      return `${weekday}, ${month}/${day}/${year} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
    case 'zh':
      return `${year}年${month}月${day}日 ${weekday} ${hour}时${minute}分${second}秒`;
    case 'ko':
      return `${year}년 ${month}월 ${day}일 ${weekday} ${hour}시 ${minute}분 ${second}초`;
    default:
      return `${year}年${month}月${day}日（${weekday}）${hour}時${minute}分${second}秒`;
  }
}

/**
 * 時刻関連の質問かどうかを判定
 */
export function isTimeQuery(message: string): boolean {
  const timeKeywords = [
    // 日本語
    '時刻', '時間', '何時', '今何時', '現在時刻', '現在時間', '今の時間', '時計',
    '今日の日付', '今日', '曜日', '何曜日', '年月日', '日時',
    // 英語
    'time', 'what time', 'current time', 'clock', 'now', 'today', 'date', 'day',
    // 中国語
    '时间', '现在时间', '几点', '今天', '日期', '星期',
    // 韓国語
    '시간', '몇시', '지금', '오늘', '날짜', '요일'
  ];
  
  const normalizedMessage = message.toLowerCase().trim();
  return timeKeywords.some(keyword => 
    normalizedMessage.includes(keyword.toLowerCase())
  );
}

/**
 * 時刻レスポンスを生成
 */
export function generateTimeResponse(message: string, language: 'ja' | 'en' | 'zh' | 'ko' = 'ja'): string {
  const currentTime = getCurrentTimeFormatted(language);
  
  const responses = {
    ja: `現在の時刻は**${currentTime}**です。\n\n日本標準時（JST）で表示しています。`,
    en: `The current time is **${currentTime}**.\n\nDisplayed in Japan Standard Time (JST).`,
    zh: `当前时间是**${currentTime}**。\n\n以日本标准时间（JST）显示。`,
    ko: `현재 시각은 **${currentTime}**입니다.\n\n일본 표준시(JST)로 표시됩니다.`
  };
  
  return responses[language] || responses.ja;
}

/**
 * 相対時間を日本語で表現
 */
export function getRelativeTimeExpression(targetDate: Date, language: 'ja' | 'en' | 'zh' | 'ko' = 'ja'): string {
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (Math.abs(diffMinutes) < 1) {
    return language === 'ja' ? 'たった今' : 
           language === 'en' ? 'just now' :
           language === 'zh' ? '刚才' : '방금';
  }
  
  if (Math.abs(diffMinutes) < 60) {
    const unit = language === 'ja' ? '分' : 
                 language === 'en' ? 'minute' + (Math.abs(diffMinutes) === 1 ? '' : 's') :
                 language === 'zh' ? '分钟' : '분';
                 
    if (diffMinutes > 0) {
      return language === 'ja' ? `${diffMinutes}${unit}後` :
             language === 'en' ? `in ${diffMinutes} ${unit}` :
             language === 'zh' ? `${diffMinutes}${unit}后` : `${diffMinutes}${unit} 후`;
    } else {
      return language === 'ja' ? `${Math.abs(diffMinutes)}${unit}前` :
             language === 'en' ? `${Math.abs(diffMinutes)} ${unit} ago` :
             language === 'zh' ? `${Math.abs(diffMinutes)}${unit}前` : `${Math.abs(diffMinutes)}${unit} 전`;
    }
  }
  
  if (Math.abs(diffHours) < 24) {
    const unit = language === 'ja' ? '時間' : 
                 language === 'en' ? 'hour' + (Math.abs(diffHours) === 1 ? '' : 's') :
                 language === 'zh' ? '小时' : '시간';
                 
    if (diffHours > 0) {
      return language === 'ja' ? `${diffHours}${unit}後` :
             language === 'en' ? `in ${diffHours} ${unit}` :
             language === 'zh' ? `${diffHours}${unit}后` : `${diffHours}${unit} 후`;
    } else {
      return language === 'ja' ? `${Math.abs(diffHours)}${unit}前` :
             language === 'en' ? `${Math.abs(diffHours)} ${unit} ago` :
             language === 'zh' ? `${Math.abs(diffHours)}${unit}前` : `${Math.abs(diffHours)}${unit} 전`;
    }
  }
  
  const unit = language === 'ja' ? '日' : 
               language === 'en' ? 'day' + (Math.abs(diffDays) === 1 ? '' : 's') :
               language === 'zh' ? '天' : '일';
               
  if (diffDays > 0) {
    return language === 'ja' ? `${diffDays}${unit}後` :
           language === 'en' ? `in ${diffDays} ${unit}` :
           language === 'zh' ? `${diffDays}${unit}后` : `${diffDays}${unit} 후`;
  } else {
    return language === 'ja' ? `${Math.abs(diffDays)}${unit}前` :
           language === 'en' ? `${Math.abs(diffDays)} ${unit} ago` :
           language === 'zh' ? `${Math.abs(diffDays)}${unit}前` : `${Math.abs(diffDays)}${unit} 전`;
  }
}

/**
 * 時刻を含む自然な表現を生成
 */
export function generateContextualTimeResponse(
  message: string, 
  language: 'ja' | 'en' | 'zh' | 'ko' = 'ja'
): string {
  const now = new Date();
  const jstTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const hour = jstTime.getHours();
  
  let greeting = '';
  
  if (hour >= 5 && hour < 10) {
    greeting = language === 'ja' ? 'おはようございます' :
               language === 'en' ? 'Good morning' :
               language === 'zh' ? '早上好' : '안녕하세요';
  } else if (hour >= 10 && hour < 18) {
    greeting = language === 'ja' ? 'こんにちは' :
               language === 'en' ? 'Good afternoon' :
               language === 'zh' ? '下午好' : '안녕하세요';
  } else {
    greeting = language === 'ja' ? 'こんばんは' :
               language === 'en' ? 'Good evening' :
               language === 'zh' ? '晚上好' : '안녕하세요';
  }
  
  const timeString = getCurrentTimeFormatted(language);
  
  const responses = {
    ja: `${greeting}！現在の時刻は**${timeString}**です。`,
    en: `${greeting}! The current time is **${timeString}**.`,
    zh: `${greeting}！当前时间是**${timeString}**。`,
    ko: `${greeting}! 현재 시각은 **${timeString}**입니다.`
  };
  
  return responses[language] || responses.ja;
}