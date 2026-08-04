import axios from 'axios';

export interface TrendNewsArticle {
    title: string;
    source: string;
    link: string;
    pubDate: string;
    snippet: string;
}

/**
 * 구글 뉴스 RSS에서 한국 취업/채용/자소서/면접 관련 실시간 뉴스 파싱
 */
export async function fetchLatestCareerTrend(): Promise<TrendNewsArticle | null> {
    try {
        console.log('🔍 [TrendFetcher] 실시간 취업/채용 뉴스 및 트렌드 데이터 수집 중...');
        
        // 채용, 취업, 자소서, 면접 관련 실시간 구글 뉴스 RSS 쿼리 (한국어)
        const rssUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent('채용 OR 취업 OR 자소서 OR 면접') + '&hl=ko&gl=KR&ceid=KR:ko';
        
        const response = await axios.get(rssUrl, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const xmlData = response.data;
        if (!xmlData || typeof xmlData !== 'string') {
            throw new Error('RSS 응답 데이터가 비어있습니다.');
        }

        // 간단하고 안전한 XML <item> 파싱
        const itemRegex = /<item>[\s\S]*?<\/item>/gi;
        const items = xmlData.match(itemRegex);

        if (!items || items.length === 0) {
            console.warn('⚠️ [TrendFetcher] 트렌드 뉴스를 찾을 수 없습니다.');
            return null;
        }

        // 상위 10개 뉴스 중 1개 무작위 선택하여 다양성 확보
        const candidateItems = items.slice(0, 10);
        const selectedItemXml = candidateItems[Math.floor(Math.random() * candidateItems.length)];

        // 필드 추출
        const titleMatch = selectedItemXml.match(/<title>(.*?)<\/title>/i);
        const linkMatch = selectedItemXml.match(/<link>(.*?)<\/link>/i);
        const pubDateMatch = selectedItemXml.match(/<pubDate>(.*?)<\/pubDate>/i);
        const sourceMatch = selectedItemXml.match(/<source[^>]*>(.*?)<\/source>/i);

        let rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1') : '';
        let link = linkMatch ? linkMatch[1] : '';
        let pubDate = pubDateMatch ? pubDateMatch[1] : new Date().toLocaleDateString('ko-KR');
        let source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1') : '구글 뉴스';

        // 뉴스 제목에서 언론사 이름 분리 (예: "취업 시장 훈풍... - 한국경제" -> 제목 / 한국경제)
        if (rawTitle.includes(' - ')) {
            const parts = rawTitle.split(' - ');
            source = parts.pop()?.trim() || source;
            rawTitle = parts.join(' - ').trim();
        }

        // HTML 태그 제거
        const cleanTitle = rawTitle.replace(/<[^>]+>/g, '').trim();

        if (!cleanTitle) {
            return null;
        }

        const article: TrendNewsArticle = {
            title: cleanTitle,
            source: source,
            link: link,
            pubDate: pubDate,
            snippet: `언론사 [${source}]에서 보도된 최신 채용/취업 뉴스: "${cleanTitle}"`
        };

        console.log(`✅ [TrendFetcher] 실시간 뉴스 수집 완료! [출처: ${article.source}] "${article.title}"`);
        return article;

    } catch (error: any) {
        console.warn('⚠️ [TrendFetcher] 뉴스 수집 실패 (기본 트렌드 라이브러리로 대체):', error.message || error);
        return null;
    }
}
