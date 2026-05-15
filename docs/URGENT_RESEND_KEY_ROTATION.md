# 🚨 긴급: Resend API Key 폐기/재발급 작업

**작성일**: 2026-05-15
**우선순위**: P0 (즉시 처리)

## 배경
- `.env` 파일에 Resend API Key가 평문으로 저장돼 있어 노출 위험이 있다
- `.gitignore`에 등록돼 있어도 로컬 백업/공유 시 노출될 수 있다
- 보안 best practice: API Key는 주기적으로 회전(rotate)한다

## 작업 절차

### 1. Resend 대시보드에서 기존 키 폐기
1. https://resend.com/api-keys 접속
2. 현재 사용 중인 키를 찾는다 (이름이 `WAAT` 또는 `Production` 류)
3. **Revoke** 클릭 → 확인

### 2. 신규 키 발급
1. 같은 페이지에서 **Create API Key** 클릭
2. 이름: `WAAT-Production-2026-05-15`
3. Permission: **Sending access** (Full access 아님)
4. Domain: 발송 도메인만 선택 (가능하면)
5. 새 키 복사 (한 번만 표시됨!)

### 3. Supabase Secrets 갱신
```bash
supabase secrets set RESEND_API_KEY=re_새로_발급된_키
```

또는 Supabase 대시보드:
- Project Settings → Edge Functions → Secrets
- `RESEND_API_KEY` 값을 새 키로 교체

### 4. 로컬 `.env` 갱신
```
RESEND_API_KEY=re_새로_발급된_키
```

### 5. 동작 확인
- 관리자 페이지(admin.html) → 이메일 발송 → 본인에게 테스트 메일 보내기
- 수신 성공 + Resend 대시보드의 Logs에서 신규 키 사용 확인

### 6. 사후 점검
- [ ] 기존 키가 Resend 대시보드에서 사라졌는지 (Revoked 상태)
- [ ] `email_logs` 테이블에 신규 발송 기록이 남는지
- [ ] Edge Function 로그에서 에러 없는지 (`supabase functions logs send-email`)

## 영구 보완책 (다음 단계에서 적용)

1. **로컬 .env 사용 중단**: 개발/테스트도 Supabase Secrets로 일원화
2. **주기적 회전**: 분기마다 키 회전 (캘린더 알림 설정)
3. **권한 최소화**: Resend Sending Access만 부여, Full Access 금지
4. **모니터링**: 비정상 발송 패턴 알림 설정 (Resend 대시보드)
