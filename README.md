# Smart Milk Shop Management System
Stack: Next.js + TypeScript + Tailwind + Supabase (Postgres, Auth, RLS) + Recharts.

## Status
- [x] Phase 1: schema, RLS, inventory ledger, POS function, delivery deduction, reconciliation, day closing (`supabase/migrations/001_schema.sql`)
- [ ] Phase 2-8: UI dashboards, POS, subscriptions, deliveries, reports, notifications

## Demo
Open `demo/index.html` in a browser (working prototype, data saved in browser).

## Setup
1. Create a Supabase project, enable Phone auth (SMS provider).
2. Run `supabase/migrations/001_schema.sql` in SQL Editor.
3. Make your first admin: `update profiles set role='admin' where mobile='+91XXXXXXXXXX';`
