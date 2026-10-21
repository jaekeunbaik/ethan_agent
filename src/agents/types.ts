export interface FeedbackMemory {
    lastAnalyzedAt: string;
    channelStatus: string;
    successfulPatterns: string[];
    weaknessesToAvoid: string[];
    viralHookRules: string[];
    recommendedCategories: string[];
    avgViewCount: number;
}

export interface ContentPlan {
    id: string;
    title: string;
    category: '직장/알바' | '당근/중고거래' | '연애/소개팅' | '가족/친구' | '황당실수';
    hookIdea: string;
    synopsis: string;
    twistPoint: string;
    coupangProductCategory: string;
    coupangKeyword: string;
    appliedFeedbackRules: string[];
}

export interface KatalkMessage {
    sender: 'me' | 'other';
    name: string;
    text: string;
}

export interface ScriptOutput {
    planId: string;
    title: string;
    hookHeadline: string; // 상단 배너에 크게 띄울 자극적인 한 줄
    messages: KatalkMessage[];
    ctaQuiz: string; // 댓글 유도 질문
    coupangComment: string; // 고정 댓글 문구 (쿠팡 파트너스 링크 포함)
    youtubeDescription: string;
    tags: string[];
}

export interface RenderOutput {
    videoPath: string;
    durationSeconds: number;
    thumbnailPath?: string;
}

export interface PublishResult {
    success: boolean;
    videoId?: string;
    videoUrl?: string;
    pinnedCommentSuccess?: boolean;
    error?: string;
}
