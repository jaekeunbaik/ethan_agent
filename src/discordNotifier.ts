import axios from 'axios';
import dotenv from 'dotenv';
import { MarketingContentResponse } from './contentGenerator';

dotenv.config();

export interface MarketingNotificationPayload {
    topic: string;
    threadsPostId?: string | null;
    mytiThreadsPostId?: string | null;
    instagramPostId?: string | null;
    youtubeShortsUrl?: string | null;
    publicImageUrls?: string[];
    status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
    errorMessage?: string | null;
}

/**
 * 디스코드 웹훅(draft_secretary)으로 마케팅 자동화 포스팅 결과 리포트 전송
 */
export async function sendDiscordReport(payload: MarketingNotificationPayload): Promise<void> {
    // 성공 시에는 디스코드 알림을 건너뛰고, 오직 업로드 실패/오류 발생 시에만 알림 발송
    if (payload.status === 'SUCCESS') {
        console.log('✨ [draft_secretary] 마케팅 자동화 성공 완료! (성공 시 디스코드 알림 생략, 실패 시에만 발송)');
        return;
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('⚠️ DISCORD_WEBHOOK_URL이 .env에 설정되어 있지 않습니다.');
        return;
    }

    try {
        console.log('🚨 [draft_secretary] 마케팅 자동화 실패/경고 감지 -> 디스코드로 실패 알림 전송 중...');

        const statusColor = 0xFF0055; // 실패/에러 빨간색
        const statusEmoji = payload.status === 'PARTIAL_SUCCESS' ? '⚠️ 일부 업로드 실패' : '❌ 전체 업로드 실패';

        const fields = [
            {
                name: '📌 오늘의 포스팅 주제/뉴스',
                value: `**${payload.topic}**`,
                inline: false
            },
            {
                name: '💬 dethan (디든) Threads',
                value: payload.threadsPostId !== undefined 
                    ? (payload.threadsPostId ? `✅ 업로드 완료 (\`ID: ${payload.threadsPostId}\`)` : '❌ 업로드 실패')
                    : '➖ 선택 실행 대상 제외',
                inline: true
            },
            {
                name: '🎯 MYTI Threads',
                value: payload.mytiThreadsPostId !== undefined 
                    ? (payload.mytiThreadsPostId ? `✅ 업로드 완료 (\`ID: ${payload.mytiThreadsPostId}\`)` : '❌ 업로드 실패')
                    : '➖ 이번 파이프라인 스킵',
                inline: true
            },
            {
                name: '📸 Instagram Carousel',
                value: payload.instagramPostId !== undefined 
                    ? (payload.instagramPostId ? `✅ 업로드 완료 (\`ID: ${payload.instagramPostId}\`)` : '❌ 업로드 실패')
                    : '➖ 이번 파이프라인 스킵',
                inline: true
            },
            {
                name: '🎬 YouTube Shorts (힐링 사운드)',
                value: payload.youtubeShortsUrl !== undefined 
                    ? (payload.youtubeShortsUrl ? `✅ [쇼츠 영상 보기](${payload.youtubeShortsUrl})` : '❌ 업로드 실패')
                    : '➖ 선택 실행 대상 제외',
                inline: false
            }
        ];

        if (payload.errorMessage) {
            fields.push({
                name: '⚠️ 에러 메시지',
                value: `\`\`\`${payload.errorMessage.substring(0, 300)}\`\`\``,
                inline: false
            });
        }

        const embedImage = (payload.publicImageUrls && payload.publicImageUrls.length > 0)
            ? { url: payload.publicImageUrls[0] }
            : undefined;

        const body = {
            username: 'draft_secretary',
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
            embeds: [
                {
                    title: `🚀 [Ethan Agent] SNS 마케팅 자동 포스팅 보고서 (${statusEmoji})`,
                    description: `주인님! 오늘자 SNS 마케팅 콘텐츠 생성 및 인스타/스레드 자동 포스팅이 실행되었습니다.`,
                    color: statusColor,
                    fields: fields,
                    image: embedImage,
                    footer: {
                        text: `Draft Ethan Marketing Secretary • ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                    }
                }
            ]
        };

        await axios.post(webhookUrl, body);
        console.log('✅ [draft_secretary] 디스코드 보고서 전송 완료!');

    } catch (error: any) {
        console.error('❌ [draft_secretary] 디스코드 웹훅 전송 실패:', error.message || error);
    }
}

/**
 * AlphaShorts 금융 쇼츠 제작/업로드 완료 디스코드 알림
 */
export async function sendAlphaShortsDiscordAlert(data: {
    topic: string;
    videoName: string;
    youtubeStatus: string;
    marketSummary: string;
    tags: string[];
    metrics?: {
        subscriberCount: number;
        totalViews: number;
        totalVideos: number;
    } | null;
}): Promise<void> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('⚠️ DISCORD_WEBHOOK_URL이 .env에 설정되지 않았습니다.');
        return;
    }

    try {
        const fields: any[] = [
            {
                name: '📌 영상 주제',
                value: `**${data.topic}**`,
                inline: false
            },
            {
                name: '📊 당일 시장 팩트 요약',
                value: data.marketSummary,
                inline: false
            },
            {
                name: '📁 완성된 비디오',
                value: `\`${data.videoName}\``,
                inline: true
            },
            {
                name: '📺 유튜브 업로드 상태',
                value: data.youtubeStatus,
                inline: true
            }
        ];

        if (data.metrics) {
            fields.push({
                name: '📈 실시간 채널 현황',
                value: `• 구독자: **${data.metrics.subscriberCount.toLocaleString()}명**\n• 누적 조회수: **${data.metrics.totalViews.toLocaleString()}회**\n• 총 영상: **${data.metrics.totalVideos}개**`,
                inline: false
            });
        }

        fields.push({
            name: '🏷️ 추천 태그',
            value: data.tags.join(', '),
            inline: false
        });

        const body = {
            username: 'AlphaShorts Manager',
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/2953/2953363.png',
            embeds: [
                {
                    title: `🎬 [AlphaShorts] 유튜브 쇼츠 자동 업로드 & 채널 리포트`,
                    description: `Ethan님! 오늘의 장마감 금융 쇼츠가 유튜브 채널에 성공적으로 게시되었습니다.`,
                    color: 0x10B981, // 산뜻한 에메랄드 그린
                    fields: fields,
                    footer: {
                        text: `AlphaShorts Autonomous Engine • ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                    }
                }
            ]
        };

        await axios.post(webhookUrl, body);
        console.log('📢 [AlphaShorts] 단일 통합 디스코드 알림 발송 성공!');
    } catch (err: any) {
        console.error('❌ [AlphaShorts] 디스코드 알림 발송 실패:', err.message || err);
    }
}

