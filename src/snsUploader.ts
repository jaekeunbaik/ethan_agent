import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface PostResult {
    threadsPostId?: string;
    instagramPostId?: string;
}

/**
 * Page Access Token 또는 User Access Token 획득 헬퍼
 */
async function getEffectiveAccessToken(instagramAccountId: string, userToken: string): Promise<string> {
    try {
        const res = await axios.get(`https://graph.facebook.com/v21.0/me/accounts`, {
            params: {
                fields: 'access_token,instagram_business_account',
                access_token: userToken
            }
        });

        const pages = res.data?.data || [];
        for (const page of pages) {
            if (page.instagram_business_account?.id === instagramAccountId && page.access_token) {
                console.log(`[Instagram] 연결된 페이스북 페이지 토큰(Page Token) 자동 적용 완료!`);
                return page.access_token;
            }
        }
    } catch (e: any) {
        console.warn(`[Instagram] Page Token 자동 조회 건너뜀, User Token 사용:`, e.message || e);
    }
    return userToken;
}

/**
 * 1. Threads API: 스레드 숏폼 포스팅 자동 게시
 */
export async function postToThreads(threadText: string): Promise<string> {
    const threadsUserId = process.env.THREADS_USER_ID;
    const accessToken = process.env.THREADS_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;

    if (!threadsUserId || !accessToken) {
        throw new Error('THREADS_USER_ID 또는 THREADS_ACCESS_TOKEN이 설정되지 않았습니다.');
    }

    console.log('[Threads] 스레드 포스팅 컨테이너 생성 중...');

    // Step 1: Create Threads Media Container
    const createContainerUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads`;
    const containerRes = await axios.post(createContainerUrl, null, {
        params: {
            media_type: 'TEXT',
            text: threadText,
            access_token: accessToken
        }
    });

    const creationId = containerRes.data?.id;
    if (!creationId) {
        throw new Error(`스레드 컨테이너 생성 실패: ${JSON.stringify(containerRes.data)}`);
    }

    console.log(`[Threads] 스레드 컨테이너 생성 완료 (ID: ${creationId}). 게재(Publish) 진행 중...`);

    // Step 2: Publish Threads Container
    const publishUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`;
    const publishRes = await axios.post(publishUrl, null, {
        params: {
            creation_id: creationId,
            access_token: accessToken
        }
    });

    const threadsPostId = publishRes.data?.id;
    if (!threadsPostId) {
        throw new Error(`스레드 포스팅 게시 실패: ${JSON.stringify(publishRes.data)}`);
    }

    console.log(`[Threads] 스레드 포스팅 게시 성공! (Post ID: ${threadsPostId})`);
    return threadsPostId;
}

/**
 * 2. Instagram Graph API: 카드뉴스 이미지 퍼블릭 URL 배열 및 캡션을 캐러셀(슬라이드) 게시물로 포스팅
 */
export async function postCarouselToInstagram(
    imagePublicUrls: string[],
    instaCaption: string
): Promise<string> {
    const instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
    const userAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;

    if (!instagramAccountId || !userAccessToken) {
        throw new Error('INSTAGRAM_ACCOUNT_ID 또는 INSTAGRAM_ACCESS_TOKEN이 설정되지 않았습니다.');
    }

    if (imagePublicUrls.length === 0) {
        throw new Error('인스타그램 캐러셀 포스팅을 위한 이미지 URL이 존재하지 않습니다.');
    }

    // 최적 권한을 가진 Access Token 준비
    const isInstagramLogin = userAccessToken.startsWith('IG');
    const apiBase = isInstagramLogin ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
    const accessToken = isInstagramLogin ? userAccessToken : await getEffectiveAccessToken(instagramAccountId, userAccessToken);

    console.log(`[Instagram] 총 ${imagePublicUrls.length}장의 개별 아이템 컨테이너 생성 중...`);

    // Step 1: Create Item Containers for each image URL
    const itemContainerIds: string[] = [];
    for (let i = 0; i < imagePublicUrls.length; i++) {
        const imageUrl = imagePublicUrls[i];
        const itemUrl = `${apiBase}/${instagramAccountId}/media`;

        const itemRes = await axios.post(itemUrl, null, {
            params: {
                image_url: imageUrl,
                is_carousel_item: true,
                access_token: accessToken
            }
        });

        const itemId = itemRes.data?.id;
        if (!itemId) {
            throw new Error(`인스타그램 아이템 ${i + 1} 슬라이드 컨테이너 생성 실패: ${JSON.stringify(itemRes.data)}`);
        }
        itemContainerIds.push(itemId);
        console.log(`[Instagram] 슬라이드 ${i + 1} 아이템 컨테이너 생성 완료 (ID: ${itemId})`);
    }

    // Step 2: Create Carousel Parent Container
    console.log('[Instagram] 캐러셀 부모 컨테이너 생성 중...');
    const carouselUrl = `${apiBase}/${instagramAccountId}/media`;
    const carouselRes = await axios.post(carouselUrl, null, {
        params: {
            media_type: 'CAROUSEL',
            children: JSON.stringify(itemContainerIds),
            caption: instaCaption,
            access_token: accessToken
        }
    });

    const carouselContainerId = carouselRes.data?.id;
    if (!carouselContainerId) {
        throw new Error(`인스타그램 캐러셀 컨테이너 생성 실패: ${JSON.stringify(carouselRes.data)}`);
    }

    console.log(`[Instagram] 캐러셀 컨테이너 생성 완료 (ID: ${carouselContainerId}). 처리 완료 대기 중 (5초)...`);

    // Meta 서버 미디어 업로드 처리 대기
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 3: Publish Carousel Container
    console.log('[Instagram] 캐러셀 게시물 최종 게시(Publish) 진행 중...');
    const publishUrl = `${apiBase}/${instagramAccountId}/media_publish`;
    const publishRes = await axios.post(publishUrl, null, {
        params: {
            creation_id: carouselContainerId,
            access_token: accessToken
        }
    });

    const instagramPostId = publishRes.data?.id;
    if (!instagramPostId) {
        throw new Error(`인스타그램 게시물 최종 게재 실패: ${JSON.stringify(publishRes.data)}`);
    }

    console.log(`[Instagram] 인스타그램 캐러셀 포스팅 게시 성공! (Post ID: ${instagramPostId})`);
    return instagramPostId;
}
