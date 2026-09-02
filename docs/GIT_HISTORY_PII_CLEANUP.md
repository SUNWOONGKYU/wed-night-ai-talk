# Git History PII 정제 — 종결 (2026-09-02)

**작성일**: 2026-05-15
**종결일**: 2026-09-02
**상태**: ✅ **조치 불필요 — 실측으로 확인**

---

## 결론 먼저

**git history 에는 실명·휴대폰 평문이 없다.** 2026-05-15 문서가 경고하던
"history 는 여전히 raw 상태"는 사실이 아니었다. history 재작성(`git filter-repo`)은
필요하지 않고, 하지 않는다.

2026-09-02 에 아래 두 가지를 실제로 돌려 확인했다.

### 1) 대상 파일들의 '최초 커밋' 시점 내용이 이미 마스킹돼 있다

```bash
git show <최초커밋>:supabase/migrations/<파일>.sql | head -5
```

| 파일(당시 이름) | 최초 커밋 | 그 시점 내용 |
|---|---|---|
| `20260511190000_remove_specific_attendance.sql` | `1cec1d1` | `[member-A]` / `[masked-phone]` |
| `20260511200000_remove_hantaehee.sql` | `998e5aa` | `[member-B]` / `[masked-phone]` |
| `20260512070000_remove_ohhyunjeong_kimmigeum.sql` | `f63bfdb` | `[member-F]`, `[member-G]` |
| `20260512060000_swap_seonunggyu_to_simuiyeol.sql` | `f63bfdb` | `[member-H]` |

즉 마스킹은 **커밋 전에** 끝나 있었다. 되돌려 꺼낼 원본이 history 에 없다.

### 2) history 전체에서 휴대폰 평문을 찾아봤다

```bash
git log --all --oneline -G"01[016789][0-9]{7,8}" -- supabase/migrations
```

결과는 **커밋 1건**이고, 그건 2026-09-02 수신거부 검증용 임시 행
(`20260902130000_tmp_unsubscribe_test_row.sql`)의 **가짜 번호 `01000000000`** 이다.
실제 회원 번호가 아니다. (그 행은 `20260902140000` 에서 삭제했다)

---

## 남아 있던 진짜 문제 — 파일명 (2026-09-02 조치 완료)

본문은 마스킹됐는데 **파일명에 로마자 실명이 그대로 남아** 있었다.
이 저장소는 **PUBLIC** 이라 파일 목록만으로 "누구를 몇 회차 어느 슬롯에서 뺐다"가 읽혔다.

2026-09-02 에 본문의 마스킹 라벨과 맞춰 이름을 바꿨다.

| 이전 | 이후 |
|---|---|
| `20260511200000_remove_hantaehee.sql` | `20260511200000_remove_member_b_from_haetsal.sql` |
| `20260511220000_remove_kimgyeongmin.sql` | `20260511220000_remove_member_c_from_haetsal.sql` |
| `20260512000000_add_leeseongki_to_noeul.sql` | `20260512000000_add_member_d_to_noeul.sql` |
| `20260512010000_add_jeongpilwan_to_noeul.sql` | `20260512010000_add_member_e_to_noeul.sql` |
| `20260512020000_add_jeongpilwan_retry.sql` | `20260512020000_add_member_e_retry.sql` |
| `20260512030000_add_seonunggyu_to_dalbit.sql` | `20260512030000_add_operator_to_dalbit.sql` |
| `20260512040000_remove_jeongpilwan_from_noeul.sql` | `20260512040000_remove_member_e_from_noeul.sql` |
| `20260512060000_swap_seonunggyu_to_simuiyeol.sql` | `20260512060000_swap_operator_to_member_h.sql` |
| `20260512070000_remove_ohhyunjeong_kimmigeum.sql` | `20260512070000_remove_member_f_and_member_g.sql` |
| `20260512080000_remove_leeseongki_from_noeul.sql` | `20260512080000_remove_member_d_from_noeul.sql` |

`git mv` 로 바꿨고, `supabase migration list` 로 로컬 파일과 원격 적용 이력이
여전히 1:1로 맞는 것을 확인했다 (Supabase 는 timestamp prefix 로 추적하므로 이름 변경은 무해하다).

### 한계 — 정직하게 남긴다

**옛 파일명은 git history 에 그대로 남는다.** 지우려면 history 재작성이 필요한데,
- 노출되는 것은 로마자 성명뿐이고 (본문의 "누가 무엇을" 정보는 이미 마스킹돼 있다),
- 모든 커밋 SHA 가 바뀌어 기존 clone·참조가 깨지며,
- force push 가 필요하다.

이 정도 노출에 history 재작성은 과하다고 판단해 하지 않았다.
PO 가 원하면 위 옵션 B 절차(아래 보존)로 진행할 수 있다.

---

## 앞으로의 규칙

`supabase/migrations/README.md` 정책 3번과 같다.

- **SQL 본문에 실명·휴대폰 평문 금지.** UUID 로 지정하거나 `[member-X]` 라벨을 쓴다.
- **파일명에도 실명 금지.** 본문에서 쓰는 라벨과 같은 이름을 쓴다.
- 운영자 본인은 `operator` 로 표기한다.

---

## 부록 — history 재작성 절차 (필요해질 때만)

⚠️ **Destructive. 모든 협업자가 강제 fetch/reset 해야 하고 force push 가 필요하다.**

```bash
pip install git-filter-repo

cp -r WAAT WAAT.backup          # 1) 백업

cat > replacements.txt <<EOF    # 2) 치환 규칙 (좌변에 실제 값을 넣는다)
regex:01\d{8,9}==>[masked-phone]
EOF

git filter-repo --replace-text replacements.txt --force   # 3) 실행
git push --force --all && git push --force --tags          # 4) 반영
```

파일명까지 지우려면 `--path-rename old:new` 를 함께 쓴다.
