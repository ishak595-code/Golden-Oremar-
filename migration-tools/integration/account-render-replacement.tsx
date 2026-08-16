
if (currentTab === 'account') {
  return (
    <AccountCenter
      requestedView={accountView}
      theme={settings.theme}
      onThemeChange={(nextTheme) => updateSettings({ theme: nextTheme })}
      onBack={goBack}
      onOpenProduct={(slug) => {
        const product = products.find((item: any) =>
          item.slug === slug || String(item.id) === slug
        );
        if (product) handleProductClick(product);
        else showToast('Ürün güncel katalogda bulunamadı.');
      }}
      onOpenProducer={(slug) => {
        const vendor =
          products.find((item: any) => item.vendor?.slug === slug)?.vendor ||
          products.find((item: any) => item.vendor_slug === slug)?.vendor;
        if (vendor) {
          setSelectedVendor(vendor);
          navigateToTab('vendor-store');
        } else {
          showToast('Üretici profili güncel katalogdan açılacak.');
        }
      }}
      onStartGift={() => navigateToTab('home')}
      onOpenContact={() => navigateToTab('contact')}
      onOpenHealth={() => navigateToTab('health')}
      onOpenEvents={() => navigateToTab('events')}
      onOpenAdmin={() => navigateToTab('admin')}
      onOpenSellerApplication={() => setAccountView('vendor-apply')}
      onOpenSellerProductManager={() => setAccountView('vendor-dashboard')}
      onOpenNotificationAction={(url) => {
        if (url?.includes('/messages/')) setAccountView('support');
        else if (url?.includes('producer')) setAccountView('seller');
        else if (url?.includes('order')) setAccountView('orders');
      }}
    />
  );
}
