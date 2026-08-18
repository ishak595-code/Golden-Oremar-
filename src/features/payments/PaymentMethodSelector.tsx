import React from 'react';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { paymentMethodLabel, type PaymentReadiness, type SavedPaymentMethod } from './api';

type Props = {
  idPrefix: string;
  methods: SavedPaymentMethod[];
  readiness: PaymentReadiness | null;
  selectedId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
};

export default function PaymentMethodSelector({
  idPrefix,
  methods,
  readiness,
  selectedId,
  onChange,
  disabled = false,
  title = 'Ödeme yöntemi',
  description = 'Kayıtlı kartınızı seçin. Yalnız doğrulanmış, maskelenmiş kart bilgileri gösterilir.',
}: Props) {
  const activeMethods = methods.filter(method => method.status === 'active');
  const livePayments = readiness?.liveCardPaymentsEnabled === true && Boolean(readiness?.provider);
  const paymentRequired = livePayments;

  return (
    <section aria-labelledby={`${idPrefix}-title`} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${idPrefix}-title`} className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <CreditCard aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-green" />
      </div>

      {activeMethods.length ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Kayıtlı ödeme yöntemlerinden birini seçin</legend>
          {activeMethods.map(method => {
            const inputId = `${idPrefix}-${method.id}`;
            const selected = selectedId === method.id;
            return (
              <label
                key={method.id}
                htmlFor={inputId}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${selected ? 'border-brand-green bg-brand-green/5 ring-1 ring-brand-green' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`${idPrefix}-payment-method`}
                  value={method.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange(method.id)}
                  className="h-5 w-5 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{paymentMethodLabel(method)}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {[method.billingName, method.billingCountryCode].filter(Boolean).join(' • ') || 'Doğrulanmış kayıtlı kart'}
                  </span>
                </span>
                {method.isDefault ? <span className="rounded-full bg-brand-green/10 px-2 py-1 text-xs font-bold text-brand-green">Varsayılan</span> : null}
              </label>
            );
          })}
        </fieldset>
      ) : (
        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          Hesabınızda aktif kayıtlı ödeme yöntemi yok.
        </div>
      )}

      {paymentRequired && activeMethods.length === 0 ? (
        <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          Canlı kart ödemesi açık olduğunda siparişi tamamlamak için doğrulanmış bir ödeme yöntemi gerekir.
        </div>
      ) : null}

      <div className="mt-3 flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
        <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
        <p>
          Kart numarası ve CVC bu listede saklanmaz veya gösterilmez. Kart ekleme sırasında hassas bilgiler ödeme sağlayıcısının güvenli alanında işlenir; Golden Oremar yalnız sağlayıcı referansı ve maskelenmiş kart metadatasını tutar.
        </p>
      </div>
    </section>
  );
}
