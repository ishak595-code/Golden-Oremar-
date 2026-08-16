import React from 'react';
import { AdminPage } from './AdminPage';

type LegacyAdminEntryProps = {
  currentUser: any;
  onLogout: () => void | Promise<void>;
  onBack?: () => void;
};

export default function LegacyAdminEntry({ onLogout, onBack }: LegacyAdminEntryProps) {
  return <AdminPage onLogout={onLogout} onBack={onBack} />;
}
