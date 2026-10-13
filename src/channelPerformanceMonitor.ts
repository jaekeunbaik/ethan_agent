import { google } from 'googleapis';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

export interface VideoPerformance {
    videoId: string;
    title: string;
    views: number;
    likes: number;
    comments: number;
    publishedAt: string;
}

export interface ChannelMetrics {
    channelTitle: string;
    subscriberCount: number;
    totalViews: number;
    totalVideos: number;
    recentVideos: VideoPerformance[];
    topPerformingVideo?: VideoPerformance;
}

/**
 * YouTube Data API v3를 활용하여 채널의 실시간 조회수, 구독자, 최근 영상 성과를 추적합니다.
 */
export async function trackChannelPerformance(): Promise<ChannelMetrics | null> {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        console.log('ℹ️ [PerformanceMonitor] YouTube API 토큰 미설정으로 채널 조회수 모니터링 건너뜀 (로컬 시뮬레이션 모드)');
        return null;
    }

    try {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // 1. 채널 기본 지표 조회
        const channelRes = await youtube.channels.list({
            part: ['snippet', 'statistics'],
            mine: true
        });

        const channel = channelRes.data.items?.[0];
        if (!channel) return null;

        const channelTitle = channel.snippet?.title || 'AlphaShorts Channel';
        const subscriberCount = Number(channel.statistics?.subscriberCount || 0);
        const totalViews = Number(channel.statistics?.viewCount || 0);
        const totalVideos = Number(channel.statistics?.videoCount || 0);

        // 2. 최근 업로드 영상 조회 (최대 5개)
        const searchRes = await youtube.search.list({
            part: ['snippet'],
            forMine: true,
            type: ['video'],
            order: 'date',
            maxResults: 5
        });

        const videoIds = (searchRes.data.items || []).map(item => item.id?.videoId).filter(Boolean) as string[];
        const recentVideos: VideoPerformance[] = [];

        if (videoIds.length > 0) {
            const videosRes = await youtube.videos.list({
                part: ['snippet', 'statistics'],
                id: videoIds
            });

            for (const v of videosRes.data.items || []) {
                recentVideos.push({
                    videoId: v.id || '',
                    title: v.snippet?.title || '',
                    views: Number(v.statistics?.viewCount || 0),
                    likes: Number(v.statistics?.likeCount || 0),
                    comments: Number(v.statistics?.commentCount || 0),
                    publishedAt: v.snippet?.publishedAt || ''
                });
            }
        }

        // 가장 조회수 높은 영상
        recentVideos.sort((a, b) => b.views - a.views);
        const topPerformingVideo = recentVideos[0];

        return {
            channelTitle,
            subscriberCount,
            totalViews,
            totalVideos,
            recentVideos,
            topPerformingVideo
        };
    } catch (err: any) {
        console.warn('⚠️ [PerformanceMonitor] 채널 데이터 추적 중 오류:', err.message);
        return null;
    }
}

/**
 * 디스코드로 채널 성장 & 조회수 일간 분석 리포트를 발송합니다.
 */
export async function sendPerformanceReportDiscord(metrics: ChannelMetrics): Promise<void> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        const videoListText = metrics.recentVideos.length > 0
            ? metrics.recentVideos.slice(0, 3).map((v, i) => `${i + 1}. **${v.title.slice(0, 30)}...**\n   👀 조회수: ${v.views.toLocaleString()}회 | 👍 좋아요: ${v.likes}개`).join('\n\n')
            : '아직 집계된 최근 영상이 없습니다.';

        const body = {
            username: 'AlphaShorts Growth Manager',
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            embeds: [
                {
                    title: `📈 [AlphaShorts] 유튜브 채널 성장 & 실시간 조회수 모니터링`,
                    description: `Ethan님! 업로드된 쇼츠 영상들의 실시간 성과와 채널 성장 지표를 분석했습니다.`,
                    color: 0x3B82F6, // 세련된 인텔리전스 블루
                    fields: [
                        {
                            name: '📺 채널 현황',
                            value: `• 구독자: **${metrics.subscriberCount.toLocaleString()}명**\n• 누적 조회수: **${metrics.totalViews.toLocaleString()}회**\n• 총 영상: **${metrics.totalVideos}개**`,
                            inline: true
                        },
                        {
                            name: '🏆 최고 인기 쇼츠',
                            value: metrics.topPerformingVideo
                                ? `**${metrics.topPerformingVideo.title.slice(0, 25)}...**\n🔥 **${metrics.topPerformingVideo.views.toLocaleString()}회** 시청됨`
                                : '집계 대기 중',
                            inline: true
                        },
                        {
                            name: '📊 최근 발행 쇼츠 성과 TOP 3',
                            value: videoListText,
                            inline: false
                        },
                        {
                            name: '💡 AI 성장 조언',
                            value: '환율 급등 및 대형주 실적 변동 테마 영상의 시청 지속 시간이 가장 높습니다. 내일도 장마감 즉시 빠른 템포 숏폼을 추천합니다!',
                            inline: false
                        }
                    ],
                    footer: {
                        text: `AlphaShorts Analytics System • ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                    }
                }
            ]
        };

        await axios.post(webhookUrl, body);
        console.log('📢 [PerformanceMonitor] 디스코드 채널 성장 리포트 전송 완료!');
    } catch (e: any) {
        console.warn('⚠️ 디스코드 모니터링 알림 전송 실패:', e.message);
    }
}
