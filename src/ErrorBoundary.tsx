import React, { Component, ErrorInfo, ReactNode } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Log to Firebase
    try {
      addDoc(collection(db, 'system_logs'), {
        type: 'error',
        action: 'react_crash',
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        timestamp: serverTimestamp(),
      });
    } catch (firebaseErr) {
      console.error("Failed to log error to Firebase:", firebaseErr);
    }
  }

  public render() {
    // @ts-ignore
    const props = this.props as Props;
    if (this.state.hasError) {
      if (props.fallback) {
        return props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a1911] text-white p-4">
          <div className="max-w-md w-full bg-red-950/20 border border-red-500/30 p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-red-500 mb-2">Sistem Hatası</h2>
            <p className="text-gray-300 mb-4 text-sm">Uygulama çalışırken beklenmedik bir hata oluştu. Lütfen sayfayı yenilemeyi deneyin.</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors px-4 py-2 rounded-lg font-medium w-full text-sm"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return props.children;
  }
}

export default ErrorBoundary;
