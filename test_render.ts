import { renderAllCardNewsSlides } from './src/imageRenderer';
import { CardNewsSlide } from './src/contentGenerator';

const testSlides: CardNewsSlide[] = [
    {
        slideNumber: 1,
        type: 'COVER',
        title: '대기업 합격자소서의 비밀',
        subtitle: 'Draft Ethan AI 교정 리포트',
        contentLines: []
    },
    {
        slideNumber: 2,
        type: 'BODY',
        title: 'Before & After 교정 예시',
        subtitle: '추상적인 표현을 성과 중심 비즈니스 용어로!',
        contentLines: [
            'Before: 마케팅 업무를 열심히 수행했습니다.',
            'After: ROAS 320% 달성 및 신규 유저 1.2만 명 유치'
        ],
        highlightText: '수치와 직무 성과를 명시하세요!'
    },
    {
        slideNumber: 3,
        type: 'BODY',
        title: '직무별 핵심 역량 키워드',
        subtitle: '채용담당자의 시선을 사로잡는 단어',
        contentLines: [
            '개발: 리팩토링, CI/CD 구축, 성능 40% 개선',
            '마케팅: 타겟  сег먼테이션, A/B 테스트 최적화'
        ],
        highlightText: '직무 전문 어휘로 역량을 증명하세요.'
    },
    {
        slideNumber: 4,
        type: 'BODY',
        title: '두괄식 서두 작성 공식',
        subtitle: '서두 10초 만에 합불이 갈리는 이유',
        contentLines: [
            '핵심 성과와 기여점을 첫 문장에 배치',
            '질문 핵심 의도에 100% 직진하는 답변 구조'
        ],
        highlightText: '결론부터 명확히 제시하세요.'
    },
    {
        slideNumber: 5,
        type: 'CTA',
        title: '내 자소서도 3분 만에 교정받기',
        subtitle: 'Draft Ethan AI 자소서 연구소',
        contentLines: [
            '무제한 AI 자소서 교정 및 맞춤법 검수',
            '직무 맞춤 키워드 및 대기업 관점 평가',
            '실시간 라인 바이 라인 비포&애프터 제시'
        ]
    }
];

async function run() {
    console.log('Rendering 5 card news slides...');
    const paths = await renderAllCardNewsSlides(testSlides);
    console.log('Successfully generated card news slides:');
    paths.forEach(p => console.log(' -', p));
}

run().catch(console.error);
