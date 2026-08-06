import axios from 'axios';
import Parser from 'rss-parser';

export interface CommunityStory {
    source: string;
    title: string;
    content: string;
    link?: string;
}

const parser = new Parser();

const COMMUNITY_RSS_FEEDS = [
    'https://news.google.com/rss/search?q=%EC%B7%A8%EC%97%85+%EC%9E%90%EC%86%8C%EC%84%9C+%EB%A9%B4%EC%A0%91+%EC%8B%A4%EC%88%98&hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss/search?q=%EC%B7%A8%EC%A4%80%EC%83%9D+%EC%B7%A8%EC%97%85+%EC%8D%B0+%EC%B9%B4%ED%86%A1&hl=ko&gl=KR&ceid=KR:ko'
];

/**
 * 실시간 인터넷 커뮤니티/채용 게시판 핫이슈 썰 자동 수집기
 */
export async function fetchTrendingCommunityStory(): Promise<CommunityStory> {
    console.log('[CommunityFetcher] 🔍 실시간 커뮤니티 핫이슈 썰 크롤링 시작...');

    for (const feedUrl of COMMUNITY_RSS_FEEDS) {
        try {
            const feed = await parser.parseURL(feedUrl);
            if (feed.items && feed.items.length > 0) {
                const randomItem = feed.items[Math.floor(Math.random() * Math.min(5, feed.items.length))];
                console.log(`[CommunityFetcher] ✅ 실시간 썰 수집 성공!: "${randomItem.title}"`);
                return {
                    source: feed.title || '온라인 커뮤니티',
                    title: randomItem.title || '취업 썰',
                    content: randomItem.contentSnippet || randomItem.content || randomItem.title || '',
                    link: randomItem.link
                };
            }
        } catch (err: any) {
            console.warn('[CommunityFetcher] RSS 수집 경고:', err.message);
        }
    }

    // 기본 백업 시나리오
    return {
        source: '커뮤니티 핫이슈',
        title: '팀장님한테 카톡으로 역대급 실수한 썰',
        content: '팀장님한테 자소서 검수해달라고 카톡 보내다가 오탈자로 누나라고 부름'
    };
}
