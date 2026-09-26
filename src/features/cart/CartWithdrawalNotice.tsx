import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { cartWithdrawalGroups } from '../catalog/withdrawalRight';

type Item = { productName: string; handlingProfile?: unknown };

/**
 * Right of withdrawal for everything in the cart, shown next to the total and
 * before payment. Same wording and rules as the product page
 * (withdrawalRight.ts). Renders nothing when no item has a known profile.
 */
export function CartWithdrawalNotice({ items }: { items: ReadonlyArray<Item> }) {
  const groups = cartWithdrawalGroups(items.map(item => ({ name: item.productName, handling: item.handlingProfile })));
  if (!groups.length) return null;
  const single = groups.length === 1;
  return (
    <section
      aria-labelledby="cart-withdrawal-title"
      data-testid="cart-withdrawal-notice"
      className="mt-4 rounded-xl border-2 border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
    >
      <h3 id="cart-withdrawal-title" className="flex items-center gap-2 text-base font-bold">
        <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-green-700 dark:text-green-400" />
        {single ? groups[0].title : 'İade ve cayma hakkı'}
      </h3>
      {single ? (
        <p className="mt-2">{groups[0].body}</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {groups.map(group => (
            <li key={group.tier}>
              <p className="font-bold">{group.title}</p>
              <p className="text-gray-700 dark:text-gray-300">{group.products.join(', ')}</p>
              <p className="mt-1">{group.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
