import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';
import { ScriptOutput, RenderOutput, PublishResult } from './types';

dotenv.config();

/**
 * 🛒 PublisherAgent (배포 & 쿠팡 수익화 에이전트)
 * - YouTube Data API v3로 쇼츠 영상 업로드
 * - 설명란 및 첫 번째 댓글(쿠팡 파트너스 링크 & 공정위 문구) 자동 게재
 */
export async function runPublisherAgent(
    script: ScriptOutput,
    render: RenderOutput
): Promise<PublishResult> {
    console.log(`\n[🛒 PublisherAgent] 유튜브 쇼츠 업로드 및 쿠팡 파트너스 링크 게시 중...`);

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        console.warn('⚠️ [PublisherAgent] YouTube API 환경 변수가 없어 로컬 렌더링 모드로 완료합니다.');
        return {
            success: false,
            error: 'YouTube API 인증 정보(Client ID, Secret, Refresh Token) 미설정'
        };
    }

    if (!fs.existsSync(render.videoPath)) {
        return {
            success: false,
            error: `비디오 파일을 찾을 수 없습니다: ${render.videoPath}`
        };
    }

    try {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // 1. 영상 업로드
        console.log(`[PublisherAgent] 📤 "${script.title}" 유튜브 업로드 중...`);
        const uploadRes = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: script.title.substring(0, 100),
                    description: script.youtubeDescription,
                    tags: script.tags,
                    categoryId: '23', // Comedy (코미디/유머)
                    defaultLanguage: 'ko',
                    defaultAudioLanguage: 'ko'
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(render.videoPath)
            }
        });

        const videoId = uploadRes.data.id;
        if (!videoId) {
            throw new Error('유튜브 API에서 Video ID를 반환하지 않았습니다.');
        }

        const videoUrl = `https://youtube.com/shorts/${videoId}`;
        console.log(`[PublisherAgent] ✅ 유튜브 쇼츠 업로드 성공! URL: ${videoUrl}`);

        // 2. 쿠팡 파트너스 고정 댓글 등록 시도
        let pinnedCommentSuccess = false;
        try {
            console.log('[PublisherAgent] 💬 쿠팡 파트너스 추천 링크 첫 댓글 자동 작성 중...');
            await youtube.commentThreads.insert({
                part: ['snippet'],
                requestBody: {
                    snippet: {
                        videoId: videoId,
                        topLevelComment: {
                            snippet: {
                                textOriginal: script.coupangComment
                            }
                        }
                    }
                }
            });
            pinnedCommentSuccess = true;
            console.log('[PublisherAgent] ✅ 쿠팡 파트너스 수익화 댓글 등록 완료!');
        } catch (commentErr: any) {
            console.warn('[PublisherAgent] ⚠️ 댓글 작성 경고 (채널 댓글 권한 확인 필요):', commentErr.message);
        }

        return {
            success: true,
            videoId,
            videoUrl,
            pinnedCommentSuccess
        };

    } catch (err: any) {
        const errMsg = err.response?.data?.error?.message || err.message || String(err);
        console.error('[PublisherAgent] ❌ 업로드 실패:', errMsg);
        return {
            success: false,
            error: errMsg
        };
    }
}
