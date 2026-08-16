import fs from 'node:fs';
const file='src/features/content/PublicHealthScreen.tsx';
let text=fs.readFileSync(file,'utf8');
function one(from,to,label){const n=text.split(from).length-1;if(n!==1)throw new Error(`${label}: expected 1, found ${n}`);text=text.replace(from,to);}
one(
`  const errorRef = useRef<HTMLDivElement | null>(null);`,
`  const errorRef = useRef<HTMLDivElement | null>(null);\n  const detailRequestId = useRef(0);`,
'request id ref');
one(
`  async function open(reference: string) {
    if (detailLoading) return;
    try {
      setDetailLoading(true); setOpeningReference(reference); setError(''); setStatus('');
      setDetail(await getPublicContentEntry(reference, locale));
    } catch (err: any) { setError(err?.message || 'İçerik açılamadı.'); }
    finally { setDetailLoading(false); setOpeningReference(''); }
  }`,
`  async function open(reference: string) {
    if (detailLoading) return;
    const requestId = ++detailRequestId.current;
    try {
      setDetailLoading(true); setOpeningReference(reference); setError(''); setStatus('');
      const next = await getPublicContentEntry(reference, locale);
      if (requestId !== detailRequestId.current) return;
      setDetail(next);
    } catch (err: any) {
      if (requestId === detailRequestId.current) setError(err?.message || 'İçerik açılamadı.');
    } finally {
      if (requestId === detailRequestId.current) { setDetailLoading(false); setOpeningReference(''); }
    }
  }

  function cancelDetailLoading() {
    detailRequestId.current += 1;
    setDetailLoading(false);
    setOpeningReference('');
  }`,
'open request guard');
one(
`      {detailLoading ? <ContentLoadingDialog onClose={() => { /* request cannot be aborted safely; loading dialog remains until settled */ }} /> : null}`,
`      {detailLoading ? <ContentLoadingDialog onClose={cancelDetailLoading} /> : null}`,
'loading close');
fs.writeFileSync(file,text);
console.log('Health detail loading cancellation guard applied.');
