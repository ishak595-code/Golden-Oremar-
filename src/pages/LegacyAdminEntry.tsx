import React from 'react';
import { DataProvider } from '../context/DataContext';
import { AdminPage } from './AdminPage';

type LegacyAdminEntryProps = {
  currentUser: any;
  onLogout: () => void | Promise<void>;
  onBack?: () => void;
};

export default function LegacyAdminEntry({ currentUser, onLogout, onBack }: LegacyAdminEntryProps) {
  return (
    <DataProvider initialCurrentUser={currentUser}>
      <AdminPage onLogout={onLogout} onBack={onBack} />
    </DataProvider>
  );
}
