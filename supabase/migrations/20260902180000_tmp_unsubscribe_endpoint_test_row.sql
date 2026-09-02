-- [임시·검증용] 수신거부 엔드포인트(Edge Function) 실동작 확인용 프로필 1행 (2026-09-02)
--
-- List-Unsubscribe 헤더가 가리키는 /functions/v1/unsubscribe 를 실제로 호출해
-- GET(링크 클릭) / POST(메일 앱 원클릭) 두 경로가 모두 도는지 확인해야 한다.
-- 토큰은 설계상 클라이언트에서 읽을 수 없고, 실제 회원 토큰을 쓰면 그 사람이 진짜로
-- 수신거부되므로, 값을 미리 정해둔 테스트 행으로 검증한다.
--
-- 검증 후 20260902190000 에서 삭제한다. 이름·이메일·전화는 전부 가짜다.

INSERT INTO public.profiles (id, name, phone, email, unsubscribe_token, notes)
VALUES (
    '6c45d80a-ca4c-4580-83b4-7b1e5959ade9',
    '[테스트] 수신거부 엔드포인트',
    '01000000000',
    'unsub-endpoint-test@example.com',
    'f5fdeda1-5e3d-4290-99b7-a99b9b197491',
    '수신거부 엔드포인트 검증용 임시 행 — 20260902190000 에서 삭제'
)
ON CONFLICT (id) DO NOTHING;
