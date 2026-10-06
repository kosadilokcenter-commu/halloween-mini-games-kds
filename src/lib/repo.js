// Data layer: Supabase is the source of truth for the leaderboard, best scores and personal themes.
// localStorage is used only as (a) a read cache of the last successful fetch and
// (b) a pending queue of scores that could not be sent yet. Pending scores reach the
// leaderboard ONLY by being sent through Supabase (submit_score RPC).
import { supabase, isConfigured } from './supabase.js';

export const GAME_IDS = ['run', 'hunt', 'memory'];
const MAX = { run: 300000, hunt: 5000, memory: 300000 }; // mirrors the CHECK constraint in SQL
const LS_PENDING = 'kds_pending_v1', LS_CACHE = 'kds_lbcache_v1';
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const err = (code, message) => Object.assign(new Error(message || code), { code });

export const Repo = {
  mode: 'local',     // 'cloud' only after a real authenticated session exists
  id: null,          // auth.uid() of this (anonymous) player
  B: {},             // B[game]  = top-100 rows  [{playerId,name,score,updated}]
  ME: {},            // ME[game] = {rank,score,name} of the current player (any rank)
  onStatus() {}, onBoards() {}, onTheme() {},
  _busy: null,

  async init() {
    const c = read(LS_CACHE, null);
    if (c && !Object.keys(this.B).length) { this.B = c.B || {}; this.ME = c.ME || {}; this.id = c.uid || null; this.onBoards(); }
    if (!isConfigured) { this.onStatus('unconfigured'); return; }
    if (this._busy) return this._busy;
    this.onStatus('conn');
    this._busy = (async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const r = await supabase.auth.signInAnonymously(); // no email/password for players
          if (r.error) throw r.error;
          session = r.data.session;
        }
        this.id = session.user.id; this.mode = 'cloud';
        await this.refreshAll();
        await this.loadTheme();
        await this.flush();
      } catch (e) { this.mode = 'local'; this.onStatus('off'); }
      finally { this._busy = null; }
    })();
    return this._busy;
  },

  // ---- leaderboard ----
  async fetchBoard(g) {
    const { data, error } = await supabase.from('scores')
      .select('user_id,player_name,score,updated_at').eq('game', g)
      .order('score', { ascending: false }).order('updated_at', { ascending: true }).limit(100);
    if (error) throw error;
    this.B[g] = data.map(d => ({ playerId: d.user_id, name: d.player_name, score: d.score, updated: Date.parse(d.updated_at) }));
    const r = await supabase.rpc('my_rank', { p_game: g });
    if (r.error) throw r.error;
    const m = r.data && r.data[0];
    this.ME[g] = m ? { rank: Number(m.rank), score: m.score, name: m.player_name } : null;
  },
  async refreshAll() {
    if (this.mode !== 'cloud') return this.init();
    try {
      await Promise.all(GAME_IDS.map(g => this.fetchBoard(g)));
      write(LS_CACHE, { B: this.B, ME: this.ME, uid: this.id, at: Date.now() });
      this.onStatus('ok'); this.onBoards();
    } catch (e) { this.onStatus('off'); }
  },

  // ---- scores ----
  async _send(g, score, name) {
    const { error } = await supabase.rpc('submit_score', { p_game: g, p_score: score, p_name: name });
    if (error) throw error;
  },
  async _own(g) {
    const { data, error } = await supabase.from('scores').select('score').eq('user_id', this.id).eq('game', g).maybeSingle();
    if (error) throw error;
    return data;
  },
  _queue(g, score, name) {
    const p = read(LS_PENDING, {}); if (!p[g] || p[g].score < score) p[g] = { score, name }; write(LS_PENDING, p);
  },
  async submit(g, score, name) {
    score = Math.max(0, Math.min(MAX[g] ?? 1e6, Math.floor(score)));
    if (!isConfigured) throw err('unconfigured');
    if (this.mode !== 'cloud') { this._queue(g, score, name); throw err('offline'); }
    try {
      const prev = await this._own(g);
      await this._send(g, score, name);
      const v = await this._own(g);                       // confirm from the database before claiming success
      if (!v || v.score < score) throw err('verify', 'not persisted');
      await this.refreshAll();
      return { isHigh: score > 0 && score > (prev ? prev.score : 0), best: v.score };
    } catch (e) {
      if (e.code !== '42501' && e.code !== '23514') this._queue(g, score, name); // keep for retry (not for rejected writes)
      throw e;
    }
  },
  async flush() {
    if (this.mode !== 'cloud') return;
    const p = read(LS_PENDING, {});
    for (const g of Object.keys(p)) {
      try { await this._send(g, p[g].score, p[g].name); delete p[g]; write(LS_PENDING, p); } catch (e) { if (e.code === '42501' || e.code === '23514') { delete p[g]; write(LS_PENDING, p); } }
    }
    if (!Object.keys(read(LS_PENDING, {})).length) await this.refreshAll();
  },
  async setName(n) {
    if (this.mode !== 'cloud') return;
    const { error } = await supabase.from('scores').update({ player_name: n.slice(0, 24) }).eq('user_id', this.id);
    if (!error) this.refreshAll();
  },

  // ---- personal theme (one row per player, RLS-private) ----
  async loadTheme() {
    const { data, error } = await supabase.from('user_themes').select('theme_data').eq('user_id', this.id).maybeSingle();
    if (error) throw error;
    if (data) this.onTheme(data.theme_data);
    else { try { const local = JSON.parse(localStorage.getItem('kds_theme_v1')); if (local) await this.pushTheme(local); } catch { /* ignore */ } }
  },
  async pushTheme(t) {
    if (this.mode !== 'cloud') return 'local';
    const { error } = await supabase.from('user_themes').upsert({ user_id: this.id, theme_data: t }, { onConflict: 'user_id' });
    return error ? 'off' : 'ok';
  },
  async deleteTheme() {
    if (this.mode !== 'cloud') return 'local';
    const { error } = await supabase.from('user_themes').delete().eq('user_id', this.id);
    return error ? 'off' : 'ok';
  },
};
window.addEventListener('online', () => Repo.flush());
