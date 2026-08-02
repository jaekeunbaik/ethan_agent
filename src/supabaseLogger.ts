import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

export interface MarketingLogPayload {
    topic: string;
    thread_text: string;
    insta_caption: string;
    card_news_slides: any[];
    card_news_urls?: string[];
    threads_post_id?: string | null;
    instagram_post_id?: string | null;
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL_SUCCESS';
    error_message?: string | null;
}

/**
 * 렌더링된 카드뉴스 이미지 파일들을 무료 퍼블릭 이미지 호스트에 업로드하고 퍼블릭 URL 배열 반환.
 * 1차: 0x0.st (완전 직접 링크, Meta 스크래퍼 차단 없음)
 * 2차: catbox.moe (로컬 예비용)
 */
export async function uploadImagesToSupabaseStorage(imagePaths: string[]): Promise<string[]> {
    const publicUrls: string[] = [];

    console.log('[ImageUploader] Instagram / Threads API 전달용 퍼블릭 임시 이미지 URL 생성 중...');
    for (let i = 0; i < imagePaths.length; i++) {
        const filePath = imagePaths[i];
        if (!fs.existsSync(filePath)) {
            throw new Error(`업로드 대상 파일이 존재하지 않습니다: ${filePath}`);
        }

        let uploadedUrl = '';

        // 1차 시도: 0x0.st — 완전 직접 파일 URL, Meta 스크래퍼를 차단하지 않음
        try {
            const formData0x0 = new FormData();
            formData0x0.append('file', fs.createReadStream(filePath));

            const response = await axios.post('https://0x0.st', formData0x0, {
                headers: {
                    ...formData0x0.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (compatible; SNS-Bot/1.0)'
                },
                timeout: 20000
            });

            const directUrl = typeof response.data === 'string' ? response.data.trim() : '';
            if (directUrl && directUrl.startsWith('http')) {
                uploadedUrl = directUrl;
                console.log(`[ImageUploader] 슬라이드 ${i + 1} 1차 업로드 성공 (0x0.st) -> ${uploadedUrl}`);
            }
        } catch (err0x0: any) {
            console.warn(`⚠️ [ImageUploader] 슬라이드 ${i + 1} 1차 업로드 실패 (0x0.st): ${err0x0.message || err0x0}`);
        }

        // 2차 시도 (Fallback): catbox.moe
        if (!uploadedUrl) {
            try {
                const formDataCat = new FormData();
                formDataCat.append('reqtype', 'fileupload');
                formDataCat.append('fileToUpload', fs.createReadStream(filePath));

                const response = await axios.post('https://catbox.moe/user/api.php', formDataCat, {
                    headers: {
                        ...formDataCat.getHeaders(),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 20000
                });

                const directUrl = typeof response.data === 'string' ? response.data.trim() : '';
                if (directUrl && directUrl.startsWith('http')) {
                    uploadedUrl = directUrl;
                    console.log(`[ImageUploader] 슬라이드 ${i + 1} 2차 업로드 성공 (catbox.moe) -> ${uploadedUrl}`);
                }
            } catch (catErr: any) {
                console.error(`❌ [ImageUploader] 슬라이드 ${i + 1} 2차 업로드 실패 (catbox.moe):`, catErr.message || catErr);
            }
        }

        if (!uploadedUrl) {
            throw new Error(`슬라이드 ${i + 1} 이미지의 퍼블릭 호스팅 업로드에 완전히 실패했습니다.`);
        }

        publicUrls.push(uploadedUrl);
    }

    console.log(`[ImageUploader] 총 ${publicUrls.length}장의 퍼블릭 이미지 임시 URL이 생성되었습니다.`);
    return publicUrls;
}

/**
 * 마케팅 실행 결과를 로컬 `marketing_logs.json` 파일에 기록
 */
export async function logMarketingResult(payload: MarketingLogPayload): Promise<void> {
    const logPath = path.join(process.cwd(), 'marketing_logs.json');
    try {
        let logs: any[] = [];
        if (fs.existsSync(logPath)) {
            try {
                const fileData = fs.readFileSync(logPath, 'utf8');
                logs = JSON.parse(fileData);
            } catch (jsonErr) {
                console.warn('[LocalLogger] 기존 로그 파일 파싱 실패(새로 생성합니다):', jsonErr);
            }
        }

        logs.push({
            topic: payload.topic,
            thread_text: payload.thread_text,
            insta_caption: payload.insta_caption,
            card_news_slides: payload.card_news_slides,
            card_news_urls: payload.card_news_urls || [],
            threads_post_id: payload.threads_post_id || null,
            instagram_post_id: payload.instagram_post_id || null,
            status: payload.status,
            error_message: payload.error_message || null,
            created_at: new Date().toISOString()
        });

        fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf8');
        console.log(`[LocalLogger] 실행 결과가 로컬 로그 파일에 기록되었습니다. (${logPath})`);
    } catch (err: any) {
        console.warn('[LocalLogger] 로컬 로그 기록 중 내부 오류 발생:', err.message || err);
    }
}
