// Build-time home shell. Runs after prerender-seo (package.json "build").
//
// dist/index.html gets, inside #root, the first screen of the home page as
// plain HTML: the brand line and today's "Bugünün Önerisi" hero with its photo,
// drawn from the shipped catalogue copy (dist/offline-catalog), plus the home
// stylesheet inlined. The photo starts downloading while the app's JavaScript
// is still on its way, so the largest paint no longer waits for it.
//
// It sits above the app as a layer (#go-home-shell) and is removed by the app
// as soon as the real hero is on screen (HomeSpotlight), or at once on any
// other route, or after 10 s at the latest. The hero product is picked exactly
// like the app does (components/spotlightPick.ts, the day decides the order),
// so the app takes over with the same product in the same place.
//
// Like prerender-seo, this step must never fail the build: any problem logs a
// warning and leaves index.html as it was.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const DIST = 'dist';
// Same as HomeSpotlight. Phones take the 640 px file (sharp on 2x screens, a third of the 960 px bytes).
const HERO_SIZES = '(min-width: 1280px) 620px, (min-width: 768px) 50vw, 86vw';
const log = message => console.log(`[home-shell] ${message}`);
const warn = message => console.warn(`[home-shell] WARNING: ${message}`);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

async function loadModules() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-home-shell-'));
  const files = {
    'customerCopy.mjs': 'src/features/customer-experience/customerCopy.ts',
    'productMakers.mjs': 'src/features/catalog/productMakers.ts',
    'spotlightPick.mjs': 'src/features/home/components/spotlightPick.ts',
  };
  for (const [out, src] of Object.entries(files)) {
    let { code } = await transformWithEsbuild(fs.readFileSync(src, 'utf8'), path.basename(src), { loader: 'ts', format: 'esm' });
    code = code.replace(/from\s*['"]\.\.\/\.\.\/customer-experience\/customerCopy['"]/g, "from './customerCopy.mjs'");
    if (/from\s*['"]\.{1,2}\//.test(code.replace(/from '\.\/customerCopy\.mjs'/g, ''))) throw new Error(`${src} has imports the shell cannot follow`);
    fs.writeFileSync(path.join(dir, out), code);
  }
  const pick = await import(pathToFileURL(path.join(dir, 'spotlightPick.mjs')).href);
  const makers = await import(pathToFileURL(path.join(dir, 'productMakers.mjs')).href);
  fs.rmSync(dir, { recursive: true, force: true });
  return { pickSpotlights: pick.pickSpotlights, productMaker: makers.productMaker };
}

const readJson = file => { try { return JSON.parse(fs.readFileSync(path.join(DIST, 'offline-catalog', file), 'utf8')); } catch { return null; } };
const photosDir = path.join(DIST, 'product-photos');
const hasPhoto = slug => fs.existsSync(path.join(photosDir, `${slug}-640.avif`)) && fs.existsSync(path.join(photosDir, `${slug}-320.webp`));

function price(minor, currency) {
  const digits = minor % 100 === 0 ? 0 : 2;
  const amount = (minor / 100).toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return String(currency).toUpperCase() === 'TRY' ? `${amount} TL` : `${amount} ${currency}`;
}

function heroHtml(item, { heading, cta, count, productMaker }) {
  const where = [item.producer?.village, item.producer?.district || item.producer?.province].filter(Boolean).join(', ');
  const origin = [productMaker(item.slug), where].filter(Boolean).join(' · ');
  const base = `/product-photos/${item.slug}`;
  const sizes = HERO_SIZES;
  return `<section class="go-home-section go-spotlight go-hero-v5"><div class="go-spotlight__track"><div class="go-spotlight__slide"><a class="go-spotlight__card" href="/urun/${esc(encodeURIComponent(item.slug))}">`
    + `<span class="go-spotlight__media"><picture class="go-home-picture"><source type="image/avif" srcset="${[160, 320, 640, 960].map(w => `${base}-${w}.avif ${w}w`).join(', ')}" sizes="${sizes}"><img class="go-home-img" alt="" fetchpriority="high" decoding="async" src="${base}-320.webp" srcset="${base}-160.webp 160w, ${base}-320.webp 320w, ${base}-480.webp 480w, ${base}.webp 1200w" sizes="${sizes}"></picture></span>`
    + `<span class="go-spotlight__copy"><span class="go-spotlight__eyebrow">${esc(heading)}</span><strong class="go-spotlight__name">${esc(item.name)}</strong>`
    + (origin ? `<span class="go-hero-v5__origin">${esc(origin)}</span>` : '')
    + (item.shortDescription ? `<span class="go-hero-v5__story">${esc(item.shortDescription)}</span>` : '')
    + `<span class="go-spotlight__foot"><span class="go-spotlight__price">${esc(price(item.variant.priceMinor, item.currency))}</span><span class="go-spotlight__cta">${esc(cta)}</span></span></span></a></div></div>`
    + (count > 1 ? `<span class="go-spotlight__count">1/${count}</span>` : '')
    + `</section>`;
}

async function main() {
  const indexPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexPath)) return warn('dist/index.html not found; skipping.');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes('id="go-home-shell"')) return log('already present.');
  const experience = readJson('home_experience.json');
  if (!experience || !Array.isArray(experience.sections)) return warn('no shipped home copy; skipping.');
  const cssFile = fs.readdirSync(path.join(DIST, 'assets')).find(file => /^HomeSection-[\w-]+\.css$/.test(file));
  if (!cssFile) return warn('home stylesheet not found; skipping.');
  const css = fs.readFileSync(path.join(DIST, 'assets', cssFile), 'utf8').replace(/<\/style/gi, '<\\/style');

  const { pickSpotlights, productMaker } = await loadModules();
  const seasonalKey = experience.sections.find(section => section?.source?.kind === 'seasonal')?.key;
  const seasonal = (seasonalKey && readJson(`sections/${seasonalKey}.json`)?.items) || [];
  const featured = experience.sections.find(section => !section.deferred)?.items || [];
  // The app normalises items without makerName (maker from the slug table), so do the same.
  const strip = items => items.filter(item => item && item.slug && item.variant).map(({ makerName, ...rest }) => rest);
  const now = new Date();
  const today = pickSpotlights(strip(seasonal), strip(featured), now, 3);
  if (!today.length) return warn('no hero products in the shipped copy; skipping.');
  // Undo today's rotation: the page script turns the list by the visitor's day.
  const day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86400000);
  const shift = day % today.length;
  const list = [...today.slice(today.length - shift), ...today.slice(0, today.length - shift)];
  if (!list.every(item => hasPhoto(item.slug))) return warn('a hero product has no shipped photo variants; skipping.');

  const iface = experience.interface || {};
  const heading = String(iface.heroTitle || '').trim() || 'Bugünün Önerisi';
  const cta = String(iface.heroButtonText || '').trim() || 'Öneriyi Keşfet';
  const brand = String(experience.brand?.name || 'Golden Oremar');
  const subtitle = String(iface.heroSubtitle || '').trim();
  const line = !subtitle || /öne çıkan fırsat|öne çıkanlar\.?$/i.test(subtitle) ? 'Köyünden, üreticisinden, mevsiminde.' : subtitle;
  const templates = list.map((item, index) => `<template data-go-hero="${index}">${heroHtml(item, { heading, cta, count: list.length, productMaker })}</template>`).join('');

  const shell = `<div id="go-home-shell" aria-hidden="true"><div class="go-premium-home-v2"><div class="go-home-content"><header class="go-home-intro"><h1><span class="go-home-intro__brand">${esc(brand)}</span> <span class="go-home-intro__line">${esc(line)}</span></h1></header><div id="go-home-shell-hero"></div></div></div>${templates}</div>`
    + `<script>(function(){var d=document,s=d.getElementById('go-home-shell');if(!s)return;var q=new URLSearchParams(location.search),t=q.get('tab');`
    + `if(location.pathname!=='/'||(t&&t!=='home')){s.remove();return;}`
    + `d.documentElement.setAttribute('data-app-tab','home');`
    + `var n=new Date(),day=Math.floor((Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())-Date.UTC(n.getFullYear(),0,0))/864e5),k=${list.length},closed=false;`
    + `try{closed=localStorage.getItem('golden-oremar:home-spotlight-closed')===n.toISOString().slice(0,10);}catch(e){}`
    + `var tp=s.querySelector('template[data-go-hero="'+(day%k)+'"]');if(tp&&!closed)d.getElementById('go-home-shell-hero').appendChild(tp.content.cloneNode(true));`
    + `setTimeout(function(){var e=d.getElementById('go-home-shell');if(e)e.remove();},10000);})();</script>`;

  // In <head>, before the app's scripts and styles: today's hero photo is
  // requested first, at high priority, while the rest of the page loads.
  const sets = list.map(item => { const base = `/product-photos/${item.slug}`; return [160, 320, 640, 960].map(w => `${base}-${w}.avif ${w}w`).join(', '); });
  const preload = `<script>(function(){try{if(location.pathname!=='/')return;var t=new URLSearchParams(location.search).get('tab');if(t&&t!=='home')return;var n=new Date(),day=Math.floor((Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())-Date.UTC(n.getFullYear(),0,0))/864e5),s=${JSON.stringify(sets)},l=document.createElement('link');l.rel='preload';l.as='image';l.type='image/avif';l.setAttribute('imagesrcset',s[day%s.length]);l.setAttribute('imagesizes',${JSON.stringify(HERO_SIZES)});l.setAttribute('fetchpriority','high');document.head.appendChild(l);}catch(e){}})();</script>`;
  const style = `<style id="go-home-shell-css">${css}\n#go-home-shell{position:absolute;z-index:30;left:0;right:0;top:var(--go-header-h,73px);min-height:calc(100vh - 73px);background:#06130e;pointer-events:none}#go-home-shell .go-spotlight__track{overflow:hidden}@media(min-width:1024px){#go-home-shell{left:96px}}</style>`
    + `<link rel="preconnect" href="https://rmfcziawxjgcnxexbrvw.supabase.co" crossorigin>`;

  if (!html.includes('<div id="root"></div>') || !html.includes('</head>')) return warn('unexpected index.html shape; skipping.');
  html = html.replace(/<head>\s*/, match => `${match}${preload}\n`).replace('</head>', `${style}\n</head>`).replace('<div id="root"></div>', `<div id="root"></div>${shell}`);
  fs.writeFileSync(indexPath, html);
  log(`wrote the home first screen (${list.map(item => item.slug).join(', ')}), ${Math.round(css.length / 1024)} KB of home styles inlined.`);
}

main().catch(error => warn(`skipped: ${error?.message || error}`));
