# 🎃 Halloween Mini Games — KDS

เว็บมินิเกม Halloween 3 เกม (🧛 Vampire Run · 👻 Ghost Hunt · 🃏 Memory Match) พร้อม Leaderboard กลางบน **Supabase**
ผู้เล่นไม่ต้องสมัครหรือล็อกอิน — ระบบสร้างตัวตนแบบ **Supabase Anonymous Auth** ให้อัตโนมัติ

| ส่วน | เก็บที่ไหน |
|---|---|
| Leaderboard / Best Score (แยก 3 เกม) | Supabase `public.scores` (1 ผู้เล่น + 1 เกม = 1 Best Score) |
| Personal Theme | Supabase `public.user_themes` (1 ผู้เล่น = 1 theme, อ่าน/แก้ได้เฉพาะเจ้าของ) |
| ชื่อผู้เล่น, cache กระดานล่าสุด, คิวคะแนนที่ยังส่งไม่สำเร็จ | `localStorage` (แค่ cache/คิว — ไม่ใช่ source of truth) |

## โครงสร้าง
```
├── index.html
├── src/
│   ├── main.js            เกม + UI + Theme Studio + Leaderboard renderer
│   ├── style.css
│   └── lib/
│       ├── supabase.js    สร้าง client (ใช้ URL + publishable key เท่านั้น)
│       └── repo.js        data layer: auth, leaderboard, submit/verify, theme, pending queue
├── supabase/migrations/20261006000000_init_kds.sql   ตาราง + RLS + trigger + RPC + grants
├── scripts/verify-supabase.mjs   ชุดทดสอบ A–G กับ Supabase จริง
├── .env.example · package.json · vite.config.js
```

## Deploy ทีละขั้น
1. **สร้าง Supabase project** (supabase.com → New project)
2. **เปิด Anonymous sign-ins:** Authentication → Sign In / Providers → *Anonymous Sign-Ins* = ON
   (แนะนำเปิด CAPTCHA/Turnstile ใน Auth → Attack Protection เพื่อกัน bot สร้างผู้เล่นปลอมจำนวนมาก)
3. **รัน SQL:** SQL Editor → วางไฟล์ `supabase/migrations/20261006000000_init_kds.sql` → Run
   (หรือ `supabase link` แล้ว `supabase db push`)
4. **ตรวจ RLS:** Table Editor → `scores` และ `user_themes` ต้องมีป้าย *RLS enabled* และ Policies ตามไฟล์ SQL
5. **ตั้ง env:** `cp .env.example .env` แล้วใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY`
   (Project Settings → API Keys → **Publishable key** — ห้ามใช้ secret / service_role; แอปจะปฏิเสธ key เหล่านี้เอง)
6. `npm install`
7. **ทดสอบกับ Supabase จริง:** `npm run verify:supabase` (ต้องผ่านทุกข้อ — ดูหัวข้อด้านล่าง)
8. `npm run dev` (ทดลองในเครื่อง) · `npm run build` · `npm run preview`
9. **Deploy:** Vercel → Import repo → Framework *Vite* · Build `npm run build` · Output `dist`
   (หรือ static hosting ใดก็ได้ที่เสิร์ฟโฟลเดอร์ `dist`)
10. **ใส่ Environment Variables ใน hosting** (ทั้งสองตัว ขึ้นต้น `VITE_`) แล้ว redeploy
11. **Auth URL:** Anonymous Auth ไม่ใช้ redirect — แต่ถ้ามีการจำกัดโดเมน ให้เพิ่มโดเมนจริงใน Auth → URL Configuration → Site URL
12. **ทดสอบ production:** เปิดเว็บ 2 เบราว์เซอร์ → เล่นเกม → คะแนนต้องขึ้นกระดานในอีกเครื่อง ชิป `☁️ Synced` ต้องขึ้นเฉพาะเมื่อเชื่อมต่อได้จริง

## ชุดทดสอบ Supabase จริง (`npm run verify:supabase`)
ใช้เฉพาะ publishable key + ผู้ใช้ anonymous 2 คน: A (500 → B เห็น), B (800 → A เห็น), C (300 ไม่ลด Best),
D (RLS: แก้/เพิ่ม/ลบ row ของคนอื่นถูกปฏิเสธ, เปลี่ยน owner ไม่ได้, คะแนนเกินช่วงถูกปฏิเสธ, ผู้เยี่ยมชมที่ไม่ล็อกอินเขียนไม่ได้),
E/F (Theme เป็นส่วนตัว และกลับมาหลังเชื่อมต่อใหม่), G (3 เกมไม่ปะปน) + tie-break
หลังรันให้ลบข้อมูลทดสอบ: `delete from public.scores where player_name like 'KDS-VERIFY-%';`

## หมายเหตุด้านความปลอดภัยและข้อจำกัด
- **Security อยู่ที่ฐานข้อมูล:** RLS เปิดทั้ง 2 ตาราง ใช้ `auth.uid()` ใน policy (SELECT/INSERT/UPDATE มี `WITH CHECK`), trigger กัน
  เปลี่ยน `user_id`/`game` และกันคะแนนลด, `submit_score` เป็น `SECURITY INVOKER` (RLS ยังบังคับใช้), ไม่มี DELETE policy ของ scores
- **ไม่มี secret ฝั่ง client:** ไม่มี service-role / secret key / db password ใน source หรือ `.env.example`
- **Anti-cheat จำกัด:** เกมรันในเบราว์เซอร์ ผู้เล่นที่เขียนโค้ดเองอาจส่งคะแนนปลอมของ *ตัวเอง* ได้ภายในช่วงที่ CHECK อนุญาต
  (`run`/`memory` ≤ 300,000, `hunt` ≤ 5,000) — แก้คะแนนคนอื่นไม่ได้ ถ้าต้องการเข้มกว่านี้ต้องตรวจฝั่ง server (Edge Function)
- **Tie-break:** คะแนนเท่ากัน → `updated_at` เก่ากว่าชนะ (`updated_at` เปลี่ยนเฉพาะตอน Best Score เพิ่มขึ้น จึงหมายถึง "ทำคะแนนนี้ได้ก่อน")
- **Anonymous identity:** ตัวตนผูกกับเบราว์เซอร์/อุปกรณ์ (session ใน localStorage) — ล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง = เป็นผู้เล่นใหม่
  (ต้องการข้ามอุปกรณ์ → ให้ผู้เล่นผูก email ด้วย `linkIdentity`/`updateUser` ซึ่งยังไม่ได้ทำใน repo นี้)
- **ออฟไลน์:** ถ้าส่งคะแนนไม่สำเร็จ แอปไม่ขึ้น "SCORE SAVED" และไม่ขึ้น Synced; คะแนนเข้าคิวในเครื่องและส่งซ้ำผ่าน Supabase เมื่อออนไลน์
