-- 강의(event_type='event') 슬롯 정원을 events.capacity 로 일원화.
--
-- 증상: 관리자 대시보드에서 강의 정원을 5로 바꿔도 화면에는 10으로 표시.
-- 원인: 20260814075010 에서 event_slots.capacity DEFAULT 10 이 붙었고, 관리자 폼은
--       events.capacity 만 갱신한다. 화면·attend_event 는 COALESCE(slot, event, 20) 이라
--       슬롯의 10 이 폼의 5 를 덮어썼다.
-- 조치: 강의 슬롯의 capacity 를 NULL 로 비워 events.capacity 로 폴백시킨다.
--       (모임 슬롯은 햇살/노을/달빛 개별 정원을 쓰므로 건드리지 않는다)
--       이후 신규 강의 슬롯은 js/admin.js 가 capacity: null 을 명시 저장한다.
UPDATE public.event_slots es
   SET capacity = NULL
  FROM public.events ev
 WHERE ev.id = es.event_id
   AND ev.event_type = 'event'
   AND es.capacity IS NOT NULL;
