import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!url || !key) {
        return null;
    }

    if (!supabase) {
        supabase = createClient(url, key);
    }
    return supabase;
}

/**
 * 렌더링된 카드뉴스 이미지 파일들을 Supabase Storage 또는 퍼블릭 호스팅에 업로드하고 퍼블릭 URL 배열 반환
 */
export async function uploadImagesToSupabaseStorage(imagePaths: string[]): Promise<string[]> {
    const client = getSupabaseClient();
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'marketing-cardnews';

    const publicUrls: string[] = [];
    const timestamp = Date.now();

    // 1차 시도: Supabase Storage 업로드
    if (client) {
        try {
            // 버킷 존재 여부 확인 및 자동 생성 시도
            try {
                await client.storage.createBucket(bucketName, { public: true });
            } catch (bErr) {
                // 이미 존재하거나 생성 오류 무시
            }

            for (let i = 0; i < imagePaths.length; i++) {
                const filePath = imagePaths[i];
                const fileBuffer = fs.readFileSync(filePath);
                const fileName = `cardnews_${timestamp}/slide_${i + 1}.png`;

                const { data, error } = await client.storage
                    .from(bucketName)
                    .upload(fileName, fileBuffer, {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (error) {
                    throw error;
                }

                const { data: urlData } = client.storage.from(bucketName).getPublicUrl(fileName);
                publicUrls.push(urlData.publicUrl);
            }

            console.log(`[SupabaseStorage] Supabase 버킷에 ${publicUrls.length}장의 이미지가 성공적으로 업로드되었습니다.`);
            return publicUrls;
        } catch (supabaseErr: any) {
            console.warn(`[SupabaseStorage] Supabase Storage 업로드 실패 (${supabaseErr.message}). 퍼블릭 이미지 호스트 폴백을 사용합니다.`);
            publicUrls.length = 0;
        }
    }

    // 2차 폴백: tmpfiles.org 무료 퍼블릭 이미지 호스트 (Instagram Graph API 직접 전송 가능)
    console.log('[ImageUploader] Instagram API 전달용 퍼블릭 이미지 URL 생성 중...');
    for (let i = 0; i < imagePaths.length; i++) {
        const filePath = imagePaths[i];
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));

        const response = await axios.post('https://tmpfiles.org/api/v1/upload', formData, {
            headers: formData.getHeaders()
        });

        const pageUrl = response.data?.data?.url;
        if (pageUrl) {
            // https://tmpfiles.org/12345/slide_1.png -> https://tmpfiles.org/dl/12345/slide_1.png
            const directUrl = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            publicUrls.push(directUrl);
        } else {
            throw new Error(`슬라이드 ${i + 1} 퍼블릭 이미지 URL 생성 실패`);
        }
    }

    console.log(`[ImageUploader] 총 ${publicUrls.length}장의 퍼블릭 이미지 URL이 생성되었습니다.`);
    return publicUrls;
}

/**
 * 마케팅 실행 결과를 Supabase `marketing_logs` 테이블에 기록
 */
export async function logMarketingResult(payload: MarketingLogPayload): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        const { error } = await client.from('marketing_logs').insert([
            {
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
            }
        ]);

        if (error) {
            console.warn('[SupabaseLogger] marketing_logs 테이블 미생성 또는 기록 실패:', error.message);
        } else {
            console.log('[SupabaseLogger] marketing_logs 테이블에 실행 결과가 성공적으로 기록되었습니다.');
        }
    } catch (err: any) {
        console.warn('[SupabaseLogger] 기록 중 예외 발생:', err.message || err);
    }
}
