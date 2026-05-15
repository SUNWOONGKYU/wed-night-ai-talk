# Git History PII 정제 (사용자 확인 필요 — Destructive)

**작성일**: 2026-05-15
**상태**: 작업 트리는 마스킹 완료. **git history는 아직 raw 상태**.

## 배경
다음 마이그레이션 파일들에 멤버 실명과 휴대폰이 평문으로 포함돼 있어 **git log 이력 탐색** 시 노출 가능:

```
supabase/migrations/20260511190000_remove_specific_attendance.sql
supabase/migrations/20260511200000_remove_hantaehee.sql
supabase/migrations/20260511220000_remove_kimgyeongmin.sql
supabase/migrations/20260512000000_add_leeseongki_to_noeul.sql
supabase/migrations/20260512010000_add_jeongpilwan_to_noeul.sql
supabase/migrations/20260512020000_add_jeongpilwan_retry.sql
supabase/migrations/20260512040000_remove_jeongpilwan_from_noeul.sql
supabase/migrations/20260512060000_swap_seonunggyu_to_simuiyeol.sql
supabase/migrations/20260512070000_remove_ohhyunjeong_kimmigeum.sql
supabase/migrations/20260512080000_remove_leeseongki_from_noeul.sql
```

## 현재 상태
- ✅ 작업 트리 (working copy): 실명 → `[member-X]`, 휴대폰 → `[masked-phone]`
- ❌ git history: 여전히 원본 평문 노출

## 옵션

### A. 그대로 두고 신규 커밋만 정제 (추천 — 안전)
- 다음 커밋부터 마스킹된 버전이 들어감
- 과거 커밋의 노출은 git log/blame 깊이 파야 보임
- 비공개 저장소면 위험 낮음

### B. git history 재작성 (Destructive — 사용자 결정)

⚠️ **모든 협업자가 강제 fetch/reset 해야 함. force push 필요.**

#### 도구 추천: `git filter-repo` (BFG보다 안전)

설치:
```bash
pip install git-filter-repo
```

실행 (저장소 백업 후):
```bash
# 1) 저장소 전체 백업
cp -r WAAT WAAT.backup

# 2) 변경 대상 파일 목록
cat > replacements.txt <<EOF
[member-A]==>[member-A]
[member-B]==>[member-B]
[member-C]==>[member-C]
[member-D]==>[member-D]
[member-E]==>[member-E]
[member-F]==>[member-F]
[member-G]==>[member-G]
[member-H]==>[member-H]
regex:01\d{8,9}==>[masked-phone]
EOF

# 3) 정제 실행 (모든 브랜치 + 태그 적용)
git filter-repo --replace-text replacements.txt --force

# 4) 원격에 force push
git push --force --all
git push --force --tags
```

#### 영향
- 모든 커밋 SHA가 바뀜 — 이슈/PR 참조 깨질 수 있음
- 기존 clone은 재clone 필요
- 협업자(있다면) 사전 공지 필수

## 결정 요청

다음 중 하나를 선택해주세요:
- [ ] A: 작업 트리 마스킹만 적용 (즉시 가능, 과거 history는 둠)
- [ ] B: git history 재작성 (사용자 명시적 승인 후 진행)

## 참고
- 비공개 저장소면 A로 충분
- 공개 저장소거나 외부 협업자가 있으면 B 권장
- B를 선택하면 별도 작업 세션에서 단계별로 실행
