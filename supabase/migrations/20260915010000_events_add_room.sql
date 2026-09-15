-- 강의(행사) 세부 장소 — 예: "5번 중회의실". 장소(location)는 Location 섹션 카드와 이름으로 연결되므로
-- 회의실 같은 세부 정보는 별도 컬럼에 두고 카드에서 장소 링크 옆에 표시한다.
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS room TEXT;
