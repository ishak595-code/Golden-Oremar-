import React from 'react';

function safeHref(value: string) {
  const href = value.trim();
  if (/^https:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) return href;
  return '';
}

function renderSafeNode(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map((child, index) => renderSafeNode(child, `${key}-${index}`));

  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') return <h2 key={key} className="mt-7 text-xl font-bold text-brand-green first:mt-0 dark:text-brand-gold">{children}</h2>;
  if (tag === 'p') return <p key={key} className="mt-3 leading-7 text-gray-700 dark:text-gray-300">{children}</p>;
  if (tag === 'ul') return <ul key={key} className="mt-3 list-disc space-y-2 pl-6 text-gray-700 dark:text-gray-300">{children}</ul>;
  if (tag === 'ol') return <ol key={key} className="mt-3 list-decimal space-y-2 pl-6 text-gray-700 dark:text-gray-300">{children}</ol>;
  if (tag === 'li') return <li key={key}>{children}</li>;
  if (tag === 'strong' || tag === 'b') return <strong key={key}>{children}</strong>;
  if (tag === 'em' || tag === 'i') return <em key={key}>{children}</em>;
  if (tag === 'blockquote') return <blockquote key={key} className="mt-4 border-l-4 border-brand-gold/50 pl-4 italic text-gray-600 dark:text-gray-300">{children}</blockquote>;
  if (tag === 'code') return <code key={key} className="rounded bg-gray-100 px-1 py-0.5 text-sm dark:bg-gray-800">{children}</code>;
  if (tag === 'br') return <br key={key} />;
  if (tag === 'a') {
    const href = safeHref(element.getAttribute('href') || '');
    return href ? <a key={key} href={href} target={href.startsWith('https://') ? '_blank' : undefined} rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined} className="font-semibold text-brand-green underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:text-brand-gold">{children}</a> : <React.Fragment key={key}>{children}</React.Fragment>;
  }
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

export default function SafePublishedBody({ source, className = '' }: { source: string; className?: string }) {
  const safeSource = typeof source === 'string' ? source.trim().slice(0, 200000) : '';
  if (!safeSource) return null;
  if (typeof DOMParser === 'undefined') {
    const text = safeSource.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return <div className={`whitespace-pre-wrap break-words leading-7 text-gray-700 dark:text-gray-300 ${className}`.trim()}>{text}</div>;
  }
  const parsed = new DOMParser().parseFromString(safeSource, 'text/html');
  return <div className={`break-words ${className}`.trim()}>{Array.from(parsed.body.childNodes).map((node, index) => renderSafeNode(node, `published-${index}`))}</div>;
}
