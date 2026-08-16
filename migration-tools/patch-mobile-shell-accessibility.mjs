import fs from 'node:fs';

const file = 'src/App.tsx';
let text = fs.readFileSync(file, 'utf8');

function replaceExact(from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  text = text.replace(from, to);
}

replaceExact(
`            <button 
              onClick={() => navigateToTab('home')} 
              className="shrink-0 group relative focus:outline-none" 
              aria-label="Golden Oremar Logo"
            >
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-750 shadow-[0_2px_8px_rgba(0,0,0,0.06)] group-hover:scale-105 active:scale-95 transition-all p-1">
                <img src={settings.logoUrl || '/logo.svg'} alt="Golden Oremar Logo" className="w-full h-full object-contain" />
              </div>
            </button>`,
`            <button
              type="button"
              onClick={() => navigateToTab('home')}
              className="group relative grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              aria-label="Ana sayfaya git"
            >
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all group-hover:scale-105 group-active:scale-95 dark:border-gray-700 dark:bg-gray-800">
                <img src={settings.logoUrl || '/logo.svg'} alt="" aria-hidden="true" className="h-full w-full object-contain" />
              </div>
            </button>`,
  'mobile logo target',
);

replaceExact(
`            <button 
              onClick={() => navigateToTab('home')} 
              className="shrink-0 group relative focus:outline-none" 
              aria-label="Golden Oremar Logo"
            >
              <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-750 shadow-[0_3px_10px_rgba(0,0,0,0.05)] group-hover:scale-105 active:scale-95 transition-all p-1.5">
                <img src={settings.logoUrl || '/logo.svg'} alt="Golden Oremar Logo" className="w-full h-full object-contain" />
              </div>
            </button>`,
`            <button
              type="button"
              onClick={() => navigateToTab('home')}
              className="group relative shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              aria-label="Ana sayfaya git"
            >
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_3px_10px_rgba(0,0,0,0.05)] transition-all group-hover:scale-105 group-active:scale-95 dark:border-gray-700 dark:bg-gray-800">
                <img src={settings.logoUrl || '/logo.svg'} alt="" aria-hidden="true" className="h-full w-full object-contain" />
              </div>
            </button>`,
  'desktop logo semantics',
);

replaceExact(
`                <Search className="h-[18px] w-[18px] text-[#A0AEC0] transition-colors" />`,
`                <Search aria-hidden="true" className="h-[18px] w-[18px] text-[#A0AEC0] transition-colors" />`,
  'mobile decorative search icon',
);

replaceExact(
`                <Search className="h-5 w-5 text-[#A0AEC0] transition-colors" />`,
`                <Search aria-hidden="true" className="h-5 w-5 text-[#A0AEC0] transition-colors" />`,
  'desktop decorative search icon',
);

replaceExact(
`                id="mobile-search-input"
                type="text"
                className="block w-full pl-[46px] pr-[46px] py-[14px] bg-gray-100 hover:bg-gray-200/40 dark:bg-[#16191E] dark:hover:bg-[#1d2127] border border-transparent rounded-xl text-xs text-brand-text placeholder-[#A0AEC0] focus:outline-none focus:ring-2 focus:ring-brand-gold/45 focus:bg-white dark:focus:bg-[#16191E] transition-all font-medium h-11"`,
`                id="mobile-search-input"
                type="text"
                aria-label="Ürün, üretici veya köy ara"
                className="block h-11 w-full rounded-xl border border-transparent bg-gray-100 py-[14px] pl-[46px] pr-12 text-sm font-medium text-brand-text placeholder-[#A0AEC0] transition-all hover:bg-gray-200/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45 dark:bg-[#16191E] dark:hover:bg-[#1d2127] dark:focus:bg-[#16191E]"`,
  'mobile search accessible label',
);

replaceExact(
`                  <button 
                    onClick={() => setSearchQuery('')} 
                    className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-colors focus:outline-none"
                    aria-label="Aramayı Temizle"
                  >
                    <X className="w-[18px] h-[18px]" />
                  </button>`,
`                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="grid min-h-11 min-w-11 place-items-center rounded-lg text-[#A0AEC0] transition-colors hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                    aria-label="Aramayı temizle"
                  >
                    <X aria-hidden="true" className="h-[18px] w-[18px]" />
                  </button>`,
  'mobile clear search target',
);

replaceExact(
`                  <button 
                    onClick={triggerVoiceSearch} 
                    className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-all active:scale-90 focus:outline-none"
                    aria-label="Sesli Arama"
                  >
                    <Mic className="w-[18px] h-[18px]" />
                  </button>`,
`                  <button
                    type="button"
                    onClick={triggerVoiceSearch}
                    className="grid min-h-11 min-w-11 place-items-center rounded-lg text-[#A0AEC0] transition-all hover:text-brand-gold active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                    aria-label="Sesli arama"
                  >
                    <Mic aria-hidden="true" className="h-[18px] w-[18px]" />
                  </button>`,
  'mobile voice search target',
);

replaceExact(
`                id="unified-search-input"
                  type="text"
                  className="block w-full pl-[48px] pr-[48px] py-[14px] bg-gray-100 hover:bg-gray-200/40 dark:bg-[#16191E] dark:hover:bg-[#1d2127] border border-transparent rounded-xl text-sm text-brand-text placeholder-[#A0AEC0] focus:outline-none focus:ring-2 focus:ring-brand-gold/45 focus:bg-white dark:focus:bg-[#16191E] transition-all shadow-inner focus:shadow-md font-medium h-[46px]"`,
`                id="unified-search-input"
                  type="text"
                  aria-label="Ürün, üretici veya köy ara"
                  className="block h-[46px] w-full rounded-xl border border-transparent bg-gray-100 py-[14px] pl-[48px] pr-[48px] text-sm font-medium text-brand-text shadow-inner transition-all hover:bg-gray-200/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45 focus:shadow-md dark:bg-[#16191E] dark:hover:bg-[#1d2127] dark:focus:bg-[#16191E]"`,
  'desktop search accessible label',
);

replaceExact(
`                    <button 
                      onClick={() => setSearchQuery('')} 
                      className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-colors focus:outline-none" 
                      aria-label="Aramayı Temizle"
                    >
                      <X className="w-5 h-5" />
                    </button>`,
`                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="grid min-h-11 min-w-11 place-items-center rounded-lg text-[#A0AEC0] transition-colors hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                      aria-label="Aramayı temizle"
                    >
                      <X aria-hidden="true" className="h-5 w-5" />
                    </button>`,
  'desktop clear search semantics',
);

replaceExact(
`                    <button 
                      onClick={triggerVoiceSearch} 
                      className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-all active:scale-90 focus:outline-none" 
                      aria-label="Sesli Arama"
                    >
                      <Mic className="w-5 h-5" />
                    </button>`,
`                    <button
                      type="button"
                      onClick={triggerVoiceSearch}
                      className="grid min-h-11 min-w-11 place-items-center rounded-lg text-[#A0AEC0] transition-all hover:text-brand-gold active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                      aria-label="Sesli arama"
                    >
                      <Mic aria-hidden="true" className="h-5 w-5" />
                    </button>`,
  'desktop voice search semantics',
);

replaceExact(
`                className="relative p-2 text-gray-500 dark:text-gray-440 hover:text-brand-gold hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-full transition-all focus:outline-none group"`,
`                className="group relative grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 transition-all hover:bg-gray-100/70 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:text-gray-400 dark:hover:bg-gray-800"`,
  'mobile notification target',
);

{
  const from = `                className="relative p-2 text-gray-500 dark:text-gray-440 hover:text-brand-gold hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-full transition-all focus:outline-none group"`;
  const to = `                className="group relative grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 transition-all hover:bg-gray-100/70 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:text-gray-400 dark:hover:bg-gray-800"`;
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`mobile cart target: expected remaining 1 match, found ${count}`);
  text = text.replace(from, to);
}

replaceExact(
`                aria-label="Sepetim"
              >
                <ShoppingCart className="w-[1.3rem] h-[1.3rem] group-hover:scale-105 transition-transform" />
                {cart.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-gold text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-md ring-1.5 ring-white dark:ring-gray-950 animate-bounce duration-1000">`,
`                aria-label={cart.length > 0 ? `Sepetim, ${cart.length} ürün` : 'Sepetim'}
              >
                <ShoppingCart aria-hidden="true" className="h-[1.3rem] w-[1.3rem] transition-transform group-hover:scale-105" />
                {cart.length > 0 && (
                  <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[8px] font-black text-white shadow-md ring-1.5 ring-white duration-1000 animate-bounce dark:ring-gray-950">`,
  'mobile cart accessible count',
);

replaceExact(
`                <Bell className="w-[1.3rem] h-[1.3rem] group-hover:scale-105 transition-transform" />`,
`                <Bell aria-hidden="true" className="h-[1.3rem] w-[1.3rem] transition-transform group-hover:scale-105" />`,
  'mobile notification icon',
);

replaceExact(
`                <Bell className="w-[1.45rem] h-[1.45rem] group-hover:scale-105 transition-transform" />`,
`                <Bell aria-hidden="true" className="h-[1.45rem] w-[1.45rem] transition-transform group-hover:scale-105" />`,
  'desktop notification icon',
);

replaceExact(
`                aria-label="Sepetim"
              >
                <ShoppingCart className="w-[1.45rem] h-[1.45rem] group-hover:scale-105 transition-transform" />
                {cart.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-brand-gold text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-gray-900 shadow-sm">`,
`                aria-label={cart.length > 0 ? `Sepetim, ${cart.length} ürün` : 'Sepetim'}
              >
                <ShoppingCart aria-hidden="true" className="h-[1.45rem] w-[1.45rem] transition-transform group-hover:scale-105" />
                {cart.length > 0 && (
                  <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-gold px-1 text-[9px] font-black text-white shadow-sm ring-2 ring-white dark:ring-gray-900">`,
  'desktop cart accessible count',
);

{
  const from = `className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-[#16191E] dark:hover:bg-[#1c2026] text-xs font-semibold text-brand-text border border-gray-150 dark:border-gray-800 rounded-xl transition-all shadow-sm active:scale-98"`;
  const to = `className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-brand-text shadow-sm transition-all hover:bg-gray-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-800 dark:bg-[#16191E] dark:hover:bg-[#1c2026]"`;
  const count = text.split(from).length - 1;
  if (count !== 2) throw new Error(`filter/sort triggers: expected 2 matches, found ${count}`);
  text = text.split(from).join(to);
}

replaceExact(
`                <SlidersHorizontal className="w-4 h-4 text-brand-gold" />`,
`                <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-brand-gold" />`,
  'filter trigger icon',
);

replaceExact(
`                <ArrowDownUp className="w-4 h-4 text-brand-gold" />`,
`                <ArrowDownUp aria-hidden="true" className="h-4 w-4 text-brand-gold" />`,
  'sort trigger icon',
);

replaceExact(
`      <div className="md:hidden fixed z-[60] left-4 right-4 flex justify-around items-center h-[68px] rounded-3xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] px-2 transition-all" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <BottomNavButton icon={Home} label="Ana Sayfa" active={currentTab === 'home'} onClick={() => navigateToTab('home')} />
        <BottomNavButton icon={Grid} label="Kategoriler" active={currentTab === 'categories'} onClick={() => navigateToTab('categories')} />
        <BottomNavButton icon={Heart} label="Favoriler" active={currentTab === 'account' && accountView === 'favorites'} onClick={() => { navigateToTab('account'); setAccountView('favorites'); }} />
        <BottomNavButton icon={ShoppingCart} label="Sepetim" active={currentTab === 'cart'} onClick={() => navigateToTab('cart')} badge={cart.length} />
        <BottomNavButton icon={User} label="Hesabım" active={currentTab === 'account' && accountView !== 'favorites'} onClick={() => { navigateToTab('account'); setAccountView('menu'); }} badge={unreadCount} />
      </div>`,
`      <nav aria-label="Ana gezinme" className="fixed left-4 right-4 z-[60] flex h-[68px] items-center justify-around rounded-3xl border border-gray-200/50 bg-white/90 px-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all dark:border-gray-800/50 dark:bg-gray-900/90 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] md:hidden" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <BottomNavButton icon={Home} label="Ana Sayfa" accessibilityLabel="Ana Sayfa" active={currentTab === 'home'} onClick={() => navigateToTab('home')} />
        <BottomNavButton icon={Grid} label="Kategoriler" accessibilityLabel="Kategoriler" active={currentTab === 'categories'} onClick={() => navigateToTab('categories')} />
        <BottomNavButton icon={Heart} label="Favoriler" accessibilityLabel="Favoriler" active={currentTab === 'account' && accountView === 'favorites'} onClick={() => { navigateToTab('account'); setAccountView('favorites'); }} />
        <BottomNavButton icon={ShoppingCart} label="Sepetim" accessibilityLabel={cart.length > 0 ? `Sepetim, ${cart.length} ürün` : 'Sepetim'} active={currentTab === 'cart'} onClick={() => navigateToTab('cart')} badge={cart.length} />
        <BottomNavButton icon={User} label="Hesabım" accessibilityLabel={unreadCount > 0 ? `Hesabım, ${unreadCount} okunmamış bildirim` : 'Hesabım'} active={currentTab === 'account' && accountView !== 'favorites'} onClick={() => { navigateToTab('account'); setAccountView('menu'); }} badge={unreadCount} />
      </nav>`,
  'bottom navigation semantics',
);

replaceExact(
`function BottomNavButton({ icon: Icon, label, active, onClick, badge }: any) {
  return (
    <button 
      onClick={onClick} 
      className={\`relative flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 \${active ? 'text-brand-gold scale-110' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}\`}
    >
      <div className={\`relative flex items-center justify-center transition-transform duration-300 \${active ? '-translate-y-1' : ''}\`}>
        <Icon className={\`w-6 h-6 transition-all duration-300 \${active ? 'fill-current' : 'stroke-[1.5]'}\`} />
        
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm border border-white dark:border-gray-900 pointer-events-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        
        {active && (
          <span className="absolute -bottom-3 w-1 h-1 bg-brand-gold rounded-full shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
        )}
      </div>
      <span className={\`text-[9px] font-bold tracking-wide transition-all duration-300 \${active ? 'opacity-100 translate-y-0.5' : 'opacity-70'}\`}>{label}</span>
      {active && (
        <div className="absolute inset-0 bg-brand-gold/5 blur-md rounded-full -z-10" />
      )}
    </button>
  );
}`,
`function BottomNavButton({ icon: Icon, label, active, onClick, badge = 0, accessibilityLabel }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={accessibilityLabel || label}
      className={\`relative flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold \${active ? 'text-brand-gold' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}\`}
    >
      <div className={\`relative flex items-center justify-center transition-transform duration-300 \${active ? '-translate-y-0.5' : ''}\`}>
        <Icon aria-hidden="true" className={\`h-6 w-6 transition-all duration-300 \${active ? 'fill-current' : 'stroke-[1.5]'}\`} />
        {badge > 0 && (
          <span aria-hidden="true" className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-red-500 px-0.5 text-[9px] font-bold text-white shadow-sm dark:border-gray-900">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        {active && <span aria-hidden="true" className="absolute -bottom-2.5 h-1 w-1 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(212,175,55,0.8)]" />}
      </div>
      <span className={\`text-[11px] font-bold leading-none tracking-wide transition-opacity duration-300 \${active ? 'opacity-100' : 'opacity-80'}\`}>{label}</span>
      {active && <span aria-hidden="true" className="absolute inset-1 -z-10 rounded-2xl bg-brand-gold/5" />}
    </button>
  );
}`,
  'bottom nav button accessibility',
);

fs.writeFileSync(file, text);
console.log('Mobile shell accessibility patch applied.');
