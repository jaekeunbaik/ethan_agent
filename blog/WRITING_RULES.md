# EDOHAN 블로그·카드뉴스 작성 규칙

브랜드: EDOHAN (이도한, "마감도 서류도, 이 또한 지나가리"). 독자: 바쁜 직장인·사업자. 톤: 친절한 존댓말, 짧은 문장, 체크리스트 중심.

## 정확성 (가장 중요)
- 날짜·금액·대상·신청처는 **공식 출처(.go.kr / .or.kr 공공기관, 정책브리핑)에서 그 해 기준으로 확인한 것만** 쓴다.
- 문장마다 근거가 될 공식 URL을 sources에 남긴다. 블로그·카페·뉴스 요약만으로 확인한 사실은 쓰지 않는다.
- 확인 못 한 항목은 본문에서 빼고, meta.json의 unverified 배열에 적는다. 추측·"아마"·지어낸 숫자 금지.
- 법·세금 해석을 단정하지 않는다. 개인 상황이 다를 수 있으면 "홈택스/관할 기관에서 확인" 안내를 붙인다.
- 저작권: 기관 문서·기사 문장을 복사하지 않는다. 사실만 가져와 직접 쓴다.

## 블로그 글 (blog_queue/<YYYY-MM-DD>_<topicId>/post.html)
- 티스토리 **HTML 모드**에 그대로 붙일 수 있는 본문 HTML만 (`<html>`/`<head>`/`<style>`/스크립트 없음). 사용 태그: h2, h3, p, ul, ol, li, strong, table, br, a.
- 링크는 `<a href="https://...">설명 문구</a>` 형태로, 링크 글자는 URL이 아닌 설명(예: "복지로 공지 바로가기")으로 쓴다. (HTML 모드 붙여넣기에서 정상 동작 확인 2026-11-28. 기본 에디터에 붙이면 href가 깨진다.)
- 구성: 한 줄 요약 → 누가 해당되나 → 언제까지(날짜, 출처 링크) → 방법(번호 단계) → 자주 하는 실수 → 체크리스트 → 출처 목록.
- 1,500~2,500자. **본문에 제목 h2를 넣지 않는다** (티스토리 제목 칸에 meta.title이 들어가서 중복됨). 본문은 한 줄 요약부터, 소제목은 h3. meta.title은 검색어를 앞에 (예: "2027 연말정산 간소화 서비스, 회사 내기 전 체크 5가지").
- 맨 아래에 `<!-- 검수자 의견 1~2문단 여기에 추가 -->` 주석을 남긴다 (사람이 경험·의견을 덧붙이는 자리).
- edenbid 주제(calendar의 "edenbid": true)는 끝에 "입찰 공고를 키워드로 매일 받아보고 싶다면 프로필 링크에서 무료 알림 신청" 한 줄.

## 카드뉴스 (sns_queue/<YYYY-MM-DD>_<topicId>/card.json) — 렌더러 제약, 어기면 게시가 거부됨
- 스키마: `{ topic, approved:false, sources:[https...], tags:[...], thread_text, insta_caption, slides:[...] }`.
- tags: 표지 해시태그 3~5개, 주제에 맞게 (예: `["#에너지바우처", "#정부지원금", "#신청마감", "#생활정보"]`). 각 `#` 포함 10자 이하, 이모지 금지. **approved는 항상 false** (사람이 검수 후 true로 바꿈).
- slides 3~5장, 1번 COVER, 마지막 CTA, 나머지 BODY. slideNumber는 1부터 순서대로.
- BODY: title ≤20자, contentLines ≤4줄, 각 줄 ≤26자. 이모지 쓰지 않는다(□로 깨짐).
- COVER: title(줄바꿈 됨) + subtitle 한 줄. CTA: title, subtitle, contentLines 정확히 3개(블로그에서 볼 수 있는 내용 3가지).
- 블로그 주소: https://ontheday.tistory.com (티스토리 "온 더 데이"). 아직 발행 전이라 개별 글 주소는 모른다.
- thread_text ≤500자 (스레드), 마지막 줄 "자세한 일정과 방법은 블로그에 정리했어요 → ontheday.tistory.com". insta_caption은 요약 + 해시태그 5~8개.
- 카드의 사실도 블로그와 같은 출처 기준. 블로그에 없는 사실을 카드에 넣지 않는다.

## 메타 (blog_queue/<YYYY-MM-DD>_<topicId>/meta.json)
`{ "topicId", "title", "createdAt", "deadline": "YYYY-MM-DD 또는 null", "sources": [...], "unverified": [...], "selfCheck": "통과 항목 요약" }`
