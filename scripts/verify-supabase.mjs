// Production verification against a REAL Supabase project (TEST A–G from the brief).
// Usage:  VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... npm run verify:supabase
// Uses only the publishable key + two anonymous users (no secret keys). It leaves rows named
// "KDS-VERIFY-*" on the leaderboard: delete them with the SQL printed at the end.
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) { console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY'); process.exit(2); }
const mk = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = Date.now().toString(36).slice(-4).toUpperCase();
let fails = 0;
const t = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const signIn = async (c) => { const { data, error } = await c.auth.signInAnonymously(); if (error) throw new Error('Anonymous sign-in failed: ' + error.message + ' (enable Anonymous Sign-Ins in Auth settings)'); return data.user.id; };
const submit = (c, game, score, name) => c.rpc('submit_score', { p_game: game, p_score: score, p_name: name });
const board = async (c, game) => (await c.from('scores').select('user_id,player_name,score,updated_at').eq('game', game).order('score', { ascending: false }).order('updated_at', { ascending: true }).limit(500)).data || [];

const A = mk(), B = mk();
const idA = await signIn(A), idB = await signIn(B);
const nameA = `KDS-VERIFY-A${tag}`, nameB = `KDS-VERIFY-B${tag}`;

// TEST A
let r = await submit(A, 'run', 500, nameA); t('A0 submit_score works for A', !r.error, r.error?.message || '');
let rows = await board(B, 'run');
t('A  B sees User A — 500 on Vampire Run board', rows.some(x => x.user_id === idA && x.score === 500 && x.player_name === nameA));
// TEST B
await submit(B, 'run', 800, nameB);
rows = await board(A, 'run');
const iB = rows.findIndex(x => x.user_id === idB), iA = rows.findIndex(x => x.user_id === idA);
t('B  A sees User B — 800, ranked above A', iB >= 0 && rows[iB].score === 800 && iB < iA);
// TEST C
await submit(B, 'run', 300, nameB);
rows = await board(A, 'run');
t('C  lower score does not reduce Best (still 800)', rows.find(x => x.user_id === idB)?.score === 800);
// Tie-break: A raises to 800 later -> must rank BELOW B (B reached 800 first)
await submit(A, 'run', 800, nameA);
rows = await board(A, 'run');
t('C2 tie on 800: earlier achiever (B) ranks first', rows.findIndex(x => x.user_id === idB) < rows.findIndex(x => x.user_id === idA));
const rk = await A.rpc('my_rank', { p_game: 'run' });
t('C3 my_rank returns a rank for A', !rk.error && rk.data?.[0]?.rank >= 1, JSON.stringify(rk.data));
// TEST D (RLS)
const hack1 = await B.from('scores').update({ score: 299999 }).eq('user_id', idA).eq('game', 'run').select();
const afterA = (await board(B, 'run')).find(x => x.user_id === idA);
t('D1 B cannot modify A\'s score (RLS)', (hack1.data?.length ?? 0) === 0 && afterA.score === 800, hack1.error?.message || 'no rows updated');
const hack2 = await B.from('scores').insert({ user_id: idA, game: 'hunt', score: 10, player_name: 'hax' });
t('D2 B cannot insert a row owned by A', !!hack2.error, hack2.error?.code || '');
const hack3 = await B.from('scores').update({ user_id: idA }).eq('user_id', idB).eq('game', 'run').select();
t('D3 B cannot hand its row to A (user_id immutable / WITH CHECK)', !!hack3.error || (hack3.data?.length ?? 0) === 0, hack3.error?.code || '');
const hack4 = await B.from('scores').update({ score: 1 }).eq('user_id', idB).eq('game', 'run').select();
t('D4 direct UPDATE cannot lower own Best', (hack4.data?.[0]?.score ?? 800) === 800);
const hack5 = await submit(B, 'run', 999999999, nameB);
t('D5 out-of-range score rejected (CHECK)', !!hack5.error, hack5.error?.code || '');
const hack6 = await B.from('scores').delete().eq('user_id', idA);
const still = (await board(B, 'run')).some(x => x.user_id === idA);
t('D6 B cannot delete A\'s score', still, hack6.error?.code || '');
const anon = mk(); const pub = await anon.from('scores').select('score').limit(1);
t('D7 signed-out visitor can read leaderboard but not write', !pub.error && !!(await anon.from('scores').insert({ game: 'run', score: 1, player_name: 'x' })).error);
// TEST E / F (themes)
const themeA = { preset: 'vampire', c: { bg: '#12040a' }, lb: 'goth' };
const up = await A.from('user_themes').upsert({ user_id: idA, theme_data: themeA }, { onConflict: 'user_id' });
t('E0 A saves personal theme', !up.error, up.error?.message || '');
const seeB = await B.from('user_themes').select('*').eq('user_id', idA);
t('E  B cannot read A\'s theme (and sees none)', (seeB.data?.length ?? 0) === 0);
const ownB = await B.from('user_themes').select('*');
t('E2 B own theme list does not contain A\'s', !(ownB.data || []).some(x => x.user_id === idA));
const hackT = await B.from('user_themes').update({ theme_data: { preset: 'hacked' } }).eq('user_id', idA).select();
t('E3 B cannot edit A\'s theme', (hackT.data?.length ?? 0) === 0);
const A2 = mk(); const { data: { session } } = await A.auth.getSession(); await A2.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
const back = await A2.from('user_themes').select('theme_data').eq('user_id', idA).maybeSingle();
t('F  A (same identity, new client/"refresh") gets Vampire theme back', back.data?.theme_data?.preset === 'vampire');
const del = await A.from('user_themes').delete().eq('user_id', idA);
const scoreKept = (await board(A, 'run')).some(x => x.user_id === idA);
t('F2 resetting theme (delete) leaves scores intact', !del.error && scoreKept);
// TEST G
await submit(A, 'hunt', 40, nameA); await submit(A, 'memory', 70, nameA);
const [br, bh, bm] = await Promise.all(['run', 'hunt', 'memory'].map(g => board(B, g)));
const ownRows = (x) => x.filter(y => y.user_id === idA).map(y => y.score);
t('G  games do not mix (run=800, hunt=40, memory=70)', ownRows(br)[0] === 800 && ownRows(bh)[0] === 40 && ownRows(bm)[0] === 70);
console.log(`\n${fails ? '❌ ' + fails + ' check(s) FAILED' : '✅ all checks passed'}`);
console.log(`Cleanup (SQL editor):  delete from public.scores where player_name like 'KDS-VERIFY-%';`);
process.exit(fails ? 1 : 0);
