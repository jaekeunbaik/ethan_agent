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
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('⚠️ DISCORD_WEBHOOK_URL이 .env에 설정되어 있지 않습니다.');
        return;
    }

    try {
        console.log('🤖 [draft_secretary] 디스코드로 마케팅 보고서 전송 중...');

        const statusColor = payload.status === 'SUCCESS' 
            ? 0x00FF88 // 초록색
            : (payload.status === 'PARTIAL_SUCCESS' ? 0xFFB900 : 0xFF0055); // 주황색 / 빨간색

        const statusEmoji = payload.status === 'SUCCESS' ? '🎉 성공' : (payload.status === 'PARTIAL_SUCCESS' ? '⚠️ 일부 성공' : '❌ 실패');

        const fields = [
            {
                name: '📌 오늘의 포스팅 주제/뉴스',
                value: `**${payload.topic}**`,
                inline: false
            },
            {
                name: '💬 Draft Ethan Threads',
                value: payload.threadsPostId ? `✅ 업로드 완료 (\`ID: ${payload.threadsPostId}\`)` : '❌ 업로드 실패/건너뜀',
                inline: true
            },
            {
                name: '🎯 MYTI Threads',
                value: payload.mytiThreadsPostId ? `✅ 업로드 완료 (\`ID: ${payload.mytiThreadsPostId}\`)` : '❌ 업로드 실패/건너뜀',
                inline: true
            },
            {
                name: '📸 Instagram Carousel',
                value: payload.instagramPostId ? `✅ 업로드 완료 (\`ID: ${payload.instagramPostId}\`)` : '❌ 업로드 실패/건너뜀',
                inline: true
            },
            {
                name: '🎬 YouTube Shorts (힐링 사운드)',
                value: payload.youtubeShortsUrl ? `✅ [쇼츠 영상 보기](${payload.youtubeShortsUrl})` : '❌ 업로드 실패/건너뜀',
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
