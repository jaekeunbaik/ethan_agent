import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface YouTubeUploadParams {
    videoPath: string;
    title: string;
    description: string;
    tags?: string[];
}

export interface YouTubeUploadResult {
    success: boolean;
    videoId?: string;
    videoUrl?: string;
    error?: string;
}

/**
 * YouTube Data API v3를 활용하여 YouTube Shorts 동영상을 브랜드 채널로 업로드하는 모듈
 */
export async function uploadToYouTubeShorts(params: YouTubeUploadParams): Promise<YouTubeUploadResult> {
    console.log('[YouTubeUploader] 🚀 유튜브 쇼츠 업로드 프로세스 시작...');

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        const err = '❌ YouTube API 환경 변수(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN)가 설정되지 않았습니다.';
        console.error(`[YouTubeUploader] ${err}`);
        return { success: false, error: err };
    }

    if (!fs.existsSync(params.videoPath)) {
        const err = `❌ 비디오 파일을 찾을 수 없습니다: ${params.videoPath}`;
        console.error(`[YouTubeUploader] ${err}`);
        return { success: false, error: err };
    }

    try {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // 줄바꿈(\n, \r) 및 연속 공백 제거하여 유튜브 API 호환 한 줄 타이틀 생성
        let finalTitle = params.title.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!finalTitle.toLowerCase().includes('#shorts')) {
            finalTitle += ' #Shorts';
        }

        const tags = params.tags || ['Shorts', '자소서', '취업', 'dethan', '디든', 'AI교정'];
        console.log(`[YouTubeUploader] 🎬 업로드할 태그 (${tags.length}개):`, tags.join(', '));

        const response = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: params.title.substring(0, 100),
                    description: `${params.description}\n\n👉 dethan (디든) 무료 자소서 AI 팩폭 받으러 가기: https://draft-ethan.vercel.app/`,
                    tags: tags,
                    categoryId: '27', // Education (교육)
                    defaultLanguage: 'ko',
                    defaultAudioLanguage: 'ko'
                },
                status: {
                    privacyStatus: 'public', // 공개
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(params.videoPath)
            }
        });

        const videoId = response.data.id;
        if (!videoId) {
            throw new Error('유튜브 API에서 Video ID를 반환받지 못했습니다.');
        }

        const videoUrl = `https://youtube.com/shorts/${videoId}`;
        console.log(`[YouTubeUploader] ✅ 유튜브 쇼츠 업로드 성공! URL: ${videoUrl}`);

        return {
            success: true,
            videoId,
            videoUrl
        };
    } catch (err: any) {
        const errorMessage = err.response?.data?.error?.message || err.message || JSON.stringify(err);
        console.error('[YouTubeUploader] ❌ 업로드 실패:', errorMessage);
        return {
            success: false,
            error: errorMessage
        };
    }
}
