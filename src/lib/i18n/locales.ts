import { SupportedLanguage } from '@/types';

export interface Locale {
  // Common UI elements
  common: {
    loading: string;
    error: string;
    retry: string;
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    search: string;
    clear: string;
    back: string;
    next: string;
    previous: string;
    close: string;
    open: string;
    send: string;
    play: string;
    pause: string;
    stop: string;
  };

  // Navigation and header
  nav: {
    title: string;
    subtitle: string;
    clearChat: string;
    languageSelector: string;
    toggleTheme: string;
    enableSpeech: string;
    disableSpeech: string;
  };

  // Chat interface
  chat: {
    inputPlaceholder: string;
    sendMessage: string;
    startVoiceInput: string;
    stopVoiceInput: string;
    recording: string;
    processingVoice: string;
    sendingMessage: string;
    welcomeTitle: string;
    welcomeMessage: string;
    aiThinking: string;
    preparingResponse: string;
    sources: string;
    playAudio: string;
  };

  // Message statuses
  messageStatus: {
    sending: string;
    sent: string;
    delivered: string;
    failed: string;
  };

  // Error messages
  errors: {
    messageFailed: string;
    messageFailedDescription: string;
    voiceRecordingError: string;
    voiceRecordingErrorDescription: string;
    languageChangeFailed: string;
    clearChatFailed: string;
    networkError: string;
    genericError: string;
  };

  // Success messages
  success: {
    languageChanged: string;
    chatCleared: string;
    voiceRecordingStarted: string;
    voiceRecordingStartedDescription: string;
  };

  // Accessibility labels
  a11y: {
    applicationHeader: string;
    chatMessages: string;
    messageInputField: string;
    sendMessageButton: string;
    voiceInputButton: string;
    languageButton: string;
    themeToggleButton: string;
    clearChatButton: string;
    playAudioButton: string;
    messageFromUser: string;
    messageFromAI: string;
  };

  // Keyboard shortcuts
  shortcuts: {
    focusInput: string;
    clearChat: string;
    toggleVoice: string;
  };
}

export const locales: Record<SupportedLanguage, Locale> = {
  ja: {
    common: {
      loading: '読み込み中...',
      error: 'エラー',
      retry: '再試行',
      cancel: 'キャンセル',
      confirm: '確認',
      save: '保存',
      delete: '削除',
      edit: '編集',
      search: '検索',
      clear: 'クリア',
      back: '戻る',
      next: '次へ',
      previous: '前へ',
      close: '閉じる',
      open: '開く',
      send: '送信',
      play: '再生',
      pause: '一時停止',
      stop: '停止',
    },
    nav: {
      title: 'Tokyo AI Assistant',
      subtitle: '子育て支援情報',
      clearChat: 'チャットをクリア',
      languageSelector: '言語選択',
      toggleTheme: 'テーマ切り替え',
      enableSpeech: '音声を有効にする',
      disableSpeech: '音声を無効にする',
    },
    chat: {
      inputPlaceholder: 'メッセージを入力してください...',
      sendMessage: 'メッセージを送信',
      startVoiceInput: '音声入力を開始',
      stopVoiceInput: '音声録音を停止',
      recording: '録音中...',
      processingVoice: '音声を処理中...',
      sendingMessage: 'メッセージを送信中...',
      welcomeTitle: 'ようこそ！',
      welcomeMessage: 'こんにちは！東京都の子育て支援情報についてお答えします。保育園、学童保育、子育て支援制度などについてお気軽にお聞きください。',
      aiThinking: 'AIが考え中...',
      preparingResponse: '最適な回答を準備しています',
      sources: '情報源:',
      playAudio: '音声を再生',
    },
    messageStatus: {
      sending: '送信中',
      sent: '送信済み',
      delivered: '配信済み',
      failed: '送信失敗',
    },
    errors: {
      messageFailed: 'メッセージの送信に失敗しました',
      messageFailedDescription: 'ネットワーク接続を確認して、もう一度お試しください。',
      voiceRecordingError: '音声録音でエラーが発生しました',
      voiceRecordingErrorDescription: 'マイクの許可が必要です。ブラウザの設定を確認してください。',
      languageChangeFailed: '言語の変更に失敗しました',
      clearChatFailed: 'チャットのクリアに失敗しました',
      networkError: 'ネットワークエラーが発生しました',
      genericError: 'エラーが発生しました',
    },
    success: {
      languageChanged: '言語を変更しました',
      chatCleared: 'チャットをクリアしました',
      voiceRecordingStarted: '音声録音を開始しました',
      voiceRecordingStartedDescription: '話し終わったらマイクボタンをもう一度押してください。',
    },
    a11y: {
      applicationHeader: 'アプリケーションヘッダー',
      chatMessages: 'チャットメッセージ',
      messageInputField: 'メッセージ入力欄',
      sendMessageButton: 'メッセージを送信',
      voiceInputButton: '音声入力ボタン',
      languageButton: '言語選択ボタン',
      themeToggleButton: 'テーマ切り替えボタン',
      clearChatButton: 'チャットクリアボタン',
      playAudioButton: '音声再生ボタン',
      messageFromUser: 'ユーザーからのメッセージ',
      messageFromAI: 'AIからのメッセージ',
    },
    shortcuts: {
      focusInput: '/ キーで入力欄にフォーカス',
      clearChat: 'Ctrl+K でチャットをクリア',
      toggleVoice: 'Alt+V で音声入力切り替え',
    },
  },

  en: {
    common: {
      loading: 'Loading...',
      error: 'Error',
      retry: 'Retry',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      search: 'Search',
      clear: 'Clear',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      close: 'Close',
      open: 'Open',
      send: 'Send',
      play: 'Play',
      pause: 'Pause',
      stop: 'Stop',
    },
    nav: {
      title: 'Tokyo AI Assistant',
      subtitle: 'Childcare Support',
      clearChat: 'Clear Chat',
      languageSelector: 'Language Selector',
      toggleTheme: 'Toggle Theme',
      enableSpeech: 'Enable Speech',
      disableSpeech: 'Disable Speech',
    },
    chat: {
      inputPlaceholder: 'Type your message...',
      sendMessage: 'Send Message',
      startVoiceInput: 'Start Voice Input',
      stopVoiceInput: 'Stop Voice Recording',
      recording: 'Recording...',
      processingVoice: 'Processing voice...',
      sendingMessage: 'Sending message...',
      welcomeTitle: 'Welcome!',
      welcomeMessage: 'Hello! I can help you with information about Tokyo\'s childcare support services. Feel free to ask about nurseries, after-school care, childcare support programs, and more.',
      aiThinking: 'AI is thinking...',
      preparingResponse: 'Preparing the best response',
      sources: 'Sources:',
      playAudio: 'Play Audio',
    },
    messageStatus: {
      sending: 'Sending',
      sent: 'Sent',
      delivered: 'Delivered',
      failed: 'Failed',
    },
    errors: {
      messageFailed: 'Failed to send message',
      messageFailedDescription: 'Please check your network connection and try again.',
      voiceRecordingError: 'Voice recording error occurred',
      voiceRecordingErrorDescription: 'Microphone permission is required. Please check your browser settings.',
      languageChangeFailed: 'Failed to change language',
      clearChatFailed: 'Failed to clear chat',
      networkError: 'Network error occurred',
      genericError: 'An error occurred',
    },
    success: {
      languageChanged: 'Language changed',
      chatCleared: 'Chat cleared',
      voiceRecordingStarted: 'Voice recording started',
      voiceRecordingStartedDescription: 'Press the microphone button again when you finish speaking.',
    },
    a11y: {
      applicationHeader: 'Application Header',
      chatMessages: 'Chat Messages',
      messageInputField: 'Message Input Field',
      sendMessageButton: 'Send Message Button',
      voiceInputButton: 'Voice Input Button',
      languageButton: 'Language Button',
      themeToggleButton: 'Theme Toggle Button',
      clearChatButton: 'Clear Chat Button',
      playAudioButton: 'Play Audio Button',
      messageFromUser: 'Message from User',
      messageFromAI: 'Message from AI',
    },
    shortcuts: {
      focusInput: 'Press / to focus input',
      clearChat: 'Ctrl+K to clear chat',
      toggleVoice: 'Alt+V to toggle voice input',
    },
  },

  zh: {
    common: {
      loading: '加载中...',
      error: '错误',
      retry: '重试',
      cancel: '取消',
      confirm: '确认',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      search: '搜索',
      clear: '清除',
      back: '返回',
      next: '下一步',
      previous: '上一步',
      close: '关闭',
      open: '打开',
      send: '发送',
      play: '播放',
      pause: '暂停',
      stop: '停止',
    },
    nav: {
      title: 'Tokyo AI Assistant',
      subtitle: '育儿支援信息',
      clearChat: '清除聊天',
      languageSelector: '语言选择',
      toggleTheme: '切换主题',
      enableSpeech: '启用语音',
      disableSpeech: '禁用语音',
    },
    chat: {
      inputPlaceholder: '请输入您的消息...',
      sendMessage: '发送消息',
      startVoiceInput: '开始语音输入',
      stopVoiceInput: '停止语音录制',
      recording: '录制中...',
      processingVoice: '正在处理语音...',
      sendingMessage: '正在发送消息...',
      welcomeTitle: '欢迎！',
      welcomeMessage: '您好！我可以为您提供东京都育儿支援信息。请随时询问关于托儿所、课后照顾、育儿支援制度等问题。',
      aiThinking: 'AI正在思考...',
      preparingResponse: '正在准备最佳回答',
      sources: '信息来源:',
      playAudio: '播放音频',
    },
    messageStatus: {
      sending: '发送中',
      sent: '已发送',
      delivered: '已送达',
      failed: '发送失败',
    },
    errors: {
      messageFailed: '消息发送失败',
      messageFailedDescription: '请检查网络连接后重试。',
      voiceRecordingError: '语音录制出现错误',
      voiceRecordingErrorDescription: '需要麦克风权限。请检查浏览器设置。',
      languageChangeFailed: '语言切换失败',
      clearChatFailed: '清除聊天失败',
      networkError: '网络错误',
      genericError: '发生错误',
    },
    success: {
      languageChanged: '语言已更改',
      chatCleared: '聊天已清除',
      voiceRecordingStarted: '语音录制已开始',
      voiceRecordingStartedDescription: '说完后请再次按麦克风按钮。',
    },
    a11y: {
      applicationHeader: '应用程序标题',
      chatMessages: '聊天消息',
      messageInputField: '消息输入框',
      sendMessageButton: '发送消息按钮',
      voiceInputButton: '语音输入按钮',
      languageButton: '语言按钮',
      themeToggleButton: '主题切换按钮',
      clearChatButton: '清除聊天按钮',
      playAudioButton: '播放音频按钮',
      messageFromUser: '用户消息',
      messageFromAI: 'AI消息',
    },
    shortcuts: {
      focusInput: '按 / 键聚焦输入框',
      clearChat: 'Ctrl+K 清除聊天',
      toggleVoice: 'Alt+V 切换语音输入',
    },
  },

  ko: {
    common: {
      loading: '로딩 중...',
      error: '오류',
      retry: '다시 시도',
      cancel: '취소',
      confirm: '확인',
      save: '저장',
      delete: '삭제',
      edit: '편집',
      search: '검색',
      clear: '지우기',
      back: '뒤로',
      next: '다음',
      previous: '이전',
      close: '닫기',
      open: '열기',
      send: '전송',
      play: '재생',
      pause: '일시정지',
      stop: '정지',
    },
    nav: {
      title: 'Tokyo AI Assistant',
      subtitle: '육아 지원 정보',
      clearChat: '채팅 지우기',
      languageSelector: '언어 선택',
      toggleTheme: '테마 전환',
      enableSpeech: '음성 활성화',
      disableSpeech: '음성 비활성화',
    },
    chat: {
      inputPlaceholder: '메시지를 입력하세요...',
      sendMessage: '메시지 보내기',
      startVoiceInput: '음성 입력 시작',
      stopVoiceInput: '음성 녹음 중지',
      recording: '녹음 중...',
      processingVoice: '음성 처리 중...',
      sendingMessage: '메시지 전송 중...',
      welcomeTitle: '환영합니다!',
      welcomeMessage: '안녕하세요! 도쿄의 육아 지원 정보에 대해 답변해드립니다. 보육원, 학동보육, 육아 지원 제도 등에 대해 언제든지 문의해주세요.',
      aiThinking: 'AI가 생각 중...',
      preparingResponse: '최적의 답변을 준비하고 있습니다',
      sources: '정보원:',
      playAudio: '오디오 재생',
    },
    messageStatus: {
      sending: '전송 중',
      sent: '전송됨',
      delivered: '전달됨',
      failed: '전송 실패',
    },
    errors: {
      messageFailed: '메시지 전송 실패',
      messageFailedDescription: '네트워크 연결을 확인하고 다시 시도해주세요.',
      voiceRecordingError: '음성 녹음 오류 발생',
      voiceRecordingErrorDescription: '마이크 권한이 필요합니다. 브라우저 설정을 확인해주세요.',
      languageChangeFailed: '언어 변경 실패',
      clearChatFailed: '채팅 지우기 실패',
      networkError: '네트워크 오류 발생',
      genericError: '오류가 발생했습니다',
    },
    success: {
      languageChanged: '언어가 변경되었습니다',
      chatCleared: '채팅이 지워졌습니다',
      voiceRecordingStarted: '음성 녹음이 시작되었습니다',
      voiceRecordingStartedDescription: '말씀이 끝나면 마이크 버튼을 다시 눌러주세요.',
    },
    a11y: {
      applicationHeader: '애플리케이션 헤더',
      chatMessages: '채팅 메시지',
      messageInputField: '메시지 입력란',
      sendMessageButton: '메시지 보내기 버튼',
      voiceInputButton: '음성 입력 버튼',
      languageButton: '언어 버튼',
      themeToggleButton: '테마 전환 버튼',
      clearChatButton: '채팅 지우기 버튼',
      playAudioButton: '오디오 재생 버튼',
      messageFromUser: '사용자 메시지',
      messageFromAI: 'AI 메시지',
    },
    shortcuts: {
      focusInput: '/ 키로 입력란 포커스',
      clearChat: 'Ctrl+K로 채팅 지우기',
      toggleVoice: 'Alt+V로 음성 입력 전환',
    },
  },
};

export function getLocale(language: SupportedLanguage): Locale {
  return locales[language] || locales.ja;
}