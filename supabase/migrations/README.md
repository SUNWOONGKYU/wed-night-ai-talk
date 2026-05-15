# Supabase Migrations 분류 가이드

이 폴더의 마이그레이션은 시간순으로 적용된다. 모든 파일이 동일하게 "스키마 진화"는 아니다.

## 분류

### A. 스키마 진화 (Schema migrations) — 새 환경 셋업 시 반드시 필요
테이블/RPC/정책 신설·수정. 새 환경에 그대로 적용해야 한다.

예시:
- `20260510084835_first_meeting.sql`
- `20260510140000_add_slot_columns.sql`
- `20260510150000_slot_rpcs.sql`
- `20260510160000_event_slots_redesign.sql`
- `20260510210000_fix_admin_rls_jwt.sql`
- `20260514070000_email_logs.sql`
- ...

### B. 버그 수정 / 데이터 정합성 (Schema-adjacent)
스키마와 함께 데이터 정합성을 맞추는 작업.

예시:
- `20260511150000_relink_orphan_attendance.sql`
- `20260511180000_relink_orphan_inquiries.sql`
- `20260512050000_attendance_capacity_trigger.sql`

### C. 일회성 데이터 정리 (Operational data cleanup) — 새 환경에서 NO-OP
특정 사용자/행 삭제, 운영 중 발생한 일회성 정리. **이미 운영에 적용됨**.
새 환경에서는 해당 데이터가 없으므로 0 row affected.

예시:
- `20260511190000_remove_specific_attendance.sql`
- `20260511200000_remove_hantaehee.sql`
- `20260511210000_remove_haetsal_two_users.sql`
- `20260511220000_remove_kimgyeongmin.sql`
- `20260511230000_split_guest_attendance.sql` (실제로는 스키마 마이그레이션이지만 데이터 split 포함)
- `20260512000000_add_leeseongki_to_noeul.sql` ~ `20260512080000_remove_leeseongki_from_noeul.sql` (운영 중 수동 신청/취소 처리)
- `20260512070000_remove_ohhyunjeong_kimmigeum.sql`

이 파일들은 **PII 마스킹 처리됨** (2026-05-15 작업 트리). git history에는 원본 잔존 — 정제 절차는 `docs/GIT_HISTORY_PII_CLEANUP.md` 참조.

### D. 디버그/조사용 (Investigative)
실제 변경 없이 SELECT 위주. 이미 응답 받았으니 새 환경에서 다시 실행해도 무해.

예시:
- `20260510290000_debug_locations.sql`
- `20260510310000_debug_attendance.sql`
- `20260510350000_debug_inquiries_schema.sql`

## 정책

1. **새 마이그레이션은 항상 timestamp prefix** (`YYYYMMDDHHMMSS_`)
2. **일회성 데이터 정리는 이름에 `_oneoff_` 또는 `data_` prefix 명시**해서 검토 시 식별 가능하게 한다
3. **PII가 포함된 SQL은 작성 단계에서 user_id로 처리**한다 — 실명/휴대폰 평문 금지
4. **debug_* 파일은 응답 확인 후 다음 마이그레이션에서 결과를 반영**한다. 디렉토리에 남기되 주석에 "응답 확인 완료" 표시

## 실행 추적
Supabase는 `supabase_migrations.schema_migrations` 테이블로 적용 여부를 추적한다.
이 폴더에서 파일을 옮기거나 삭제하면 trace가 어긋난다 — **삭제/이동 금지**.
