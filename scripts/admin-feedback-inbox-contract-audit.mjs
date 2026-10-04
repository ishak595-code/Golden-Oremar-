// Admins read Geri bildirim / contact messages in the admin panel:
// newest first, status filter, detail, read / resolved, unread badge in the
// admin menu. Only admins: the table stays closed to clients (forced RLS)
// and every function checks private.is_admin(); anon cannot call them.
import fs from 'node:fs';
const failures = [];
const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (failures.push(`${file} is missing.`), ''));
const need = (cond, message) => { if (!cond) failures.push(message); };
const sql = read('supabase/migrations/20261004220000_admin_feedback_inbox_v1.sql');
const api = read('src/admin/feedbackAdminApi.ts');
const screen = read('src/admin/AdminFeedback.tsx');
const layout = read('src/admin/AdminLayout.tsx');
const page = read('src/pages/AdminPage.tsx');
const caps = read('src/admin/adminCapabilities.ts');
for (const fn of ['admin_list_contact_messages_v1', 'admin_get_contact_message_v1', 'admin_update_contact_message_v1', 'admin_contact_messages_unread_count_v1']) {
  need(new RegExp(`create or replace function private\\.${fn}[\\s\\S]*?private\\.is_admin\\(\\)`).test(sql), `${fn} must require an admin.`);
  need(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon;`).test(sql), `${fn} must not be callable by anon.`);
}
need(/order by m\.created_at desc/.test(sql), 'Feedback list must be newest first.');
need(/read_by/.test(sql) && /resolved_by/.test(sql), 'Who read / resolved a message must be kept.');
need(!/grant [a-z, ]+ on (table )?private\.contact_messages to (anon|authenticated)/i.test(sql), 'contact_messages must stay closed to clients.');
need(/'Misafir'|`Misafir/.test(api) && /FEEDBACK_CHANGED_EVENT/.test(api), 'Guests show as Misafir; changes notify the menu badge.');
need(/Okunmamış/.test(screen) && /Çözüldü olarak işaretle/.test(screen) && /useBackHandler\(Boolean\(detail\)/.test(screen), 'Screen must filter, resolve and close the detail with Android back.');
need(/feedback:'support\.read'/.test(caps) && /case'feedback':return<AdminFeedback\/>/.test(page) && /lazy\(\(\) => import\('\.\.\/admin\/AdminFeedback'\)\)/.test(page), 'Feedback tab must be registered and lazy.');
need(/item\.id==='feedback'&&feedbackUnread>0/.test(layout) && /getUnreadFeedbackCount/.test(layout), 'Admin menu must show the unread badge.');
if (failures.length) { console.error(`Admin feedback inbox audit failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Admin feedback inbox contract audit passed.');
