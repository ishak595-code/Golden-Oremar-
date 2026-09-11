// Enhanced error messaging utilities for better user experience

type ErrorContext = {
  operation?: string;
  resource?: string;
  userAction?: string;
};

export function enhanceErrorMessage(
  error: unknown,
  context?: ErrorContext
): string {
  const baseMessage = error instanceof Error ? error.message : String(error || '');
  
  // If it's already a good user-friendly message, use it
  if (baseMessage.length > 10 && !baseMessage.includes('Error:') && !baseMessage.match(/^\w+Error:/)) {
    return baseMessage;
  }
  
  // Map technical errors to user-friendly messages
  const technicalPatterns: Record<string, string> = {
    'network': 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
    'timeout': 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.',
    'unauthorized': 'Bu işlem için giriş yapmanız gerekiyor.',
    'forbidden': 'Bu işlem için yetkiniz bulunmuyor.',
    'not found': 'Aradığınız içerik bulunamadı.',
    'conflict': 'Bu işlem başka bir işlemle çakışıyor. Lütfen sayfayı yenileyin.',
    'server': 'Sunucuda geçici bir sorun oluştu. Lütfen tekrar deneyin.',
    '500': 'Sunucuda geçici bir sorun oluştu. Lütfen tekrar deneyin.',
    '503': 'Servis şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
  };
  
  const lowerMessage = baseMessage.toLowerCase();
  for (const [pattern, friendly] of Object.entries(technicalPatterns)) {
    if (lowerMessage.includes(pattern)) {
      return friendly;
    }
  }
  
  // Build contextual message
  if (context) {
    const parts: string[] = [];
    
    if (context.resource) {
      parts.push(context.resource);
    }
    
    if (context.operation) {
      parts.push(context.operation);
    } else {
      parts.push('işlemi');
    }
    
    parts.push('şu anda tamamlanamadı.');
    
    if (context.userAction) {
      parts.push(context.userAction);
    } else {
      parts.push('Lütfen tekrar deneyin.');
    }
    
    return parts.join(' ');
  }
  
  // Generic fallback
  return 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, max 8s
  return Math.min(1000 * Math.pow(2, attemptNumber - 1), 8000);
}

export function shouldRetry(error: unknown, attemptNumber: number): boolean {
  if (attemptNumber >= 3) return false;
  
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  
  // Retry on network and server errors
  const retryablePatterns = ['network', 'timeout', 'server', '500', '502', '503', '504'];
  return retryablePatterns.some(pattern => lowerMessage.includes(pattern));
}

// Error boundary error logging
export function logErrorForDevelopment(
  error: Error,
  errorInfo?: { componentStack?: string }
): void {
  if (process.env.NODE_ENV === 'development') {
    console.group('🚨 Error caught by boundary');
    console.error('Error:', error);
    if (errorInfo?.componentStack) {
      console.error('Component stack:', errorInfo.componentStack);
    }
    console.groupEnd();
  }
}
