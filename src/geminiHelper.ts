import { GoogleGenAI, GenerateContentConfig } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 2026 최신 고성능 Gemini 모델 우선순위 및 자동 폴백 목록
 */
export const GEMINI_FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest'
];

/**
 * Google GenAI 클라이언트 인스턴스 싱글톤 반환
 */
export function getGeminiClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    return new GoogleGenAI({
        apiKey,
        httpOptions: {
            headers: {
                'User-Agent': 'ethan-agent-marketing/1.0'
            }
        }
    });
}

export interface GenerateWithFallbackOptions {
    systemInstruction?: string;
    userPrompt: string;
    responseMimeType?: string;
    responseSchema?: any;
    temperature?: number;
    models?: string[];
    maxRetriesPerModel?: number;
}

/**
 * 503 과부하 및 일시적 네트워크 에러를 자동으로 극복하는 멀티 모델 폴백 + 지수 백오프 실행 엔진
 */
export async function generateContentWithFallback<T = any>(
    options: GenerateWithFallbackOptions
): Promise<T> {
    const ai = getGeminiClient();
    const modelsToTry = options.models || GEMINI_FALLBACK_MODELS;
    const maxRetries = options.maxRetriesPerModel ?? 2;

    let lastError: any = null;

    for (const model of modelsToTry) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[GeminiHelper] 🔄 [모델: ${model}] (시도 ${attempt}/${maxRetries}) API 호출 중...`);

                const config: GenerateContentConfig = {
                    temperature: options.temperature ?? 0.7
                };

                if (options.systemInstruction) {
                    config.systemInstruction = options.systemInstruction;
                }
                if (options.responseMimeType) {
                    config.responseMimeType = options.responseMimeType;
                }
                if (options.responseSchema) {
                    config.responseSchema = options.responseSchema;
                }

                const response = await ai.models.generateContent({
                    model,
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: options.userPrompt }]
                        }
                    ],
                    config
                });

                const responseText = response.text;
                if (!responseText || !responseText.trim()) {
                    throw new Error(`[${model}] API 응답 본문이 비어있습니다.`);
                }

                if (options.responseMimeType === 'application/json') {
                    try {
                        const parsed = JSON.parse(responseText.trim());
                        console.log(`[GeminiHelper] ✨ [모델: ${model}] JSON 파싱 및 콘텐츠 생성 성공!`);
                        return parsed as T;
                    } catch (parseErr: any) {
                        // JSON 마크다운 블록이 섞여 있는 경우 추출 시도
                        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                        if (jsonMatch && jsonMatch[1]) {
                            const parsed = JSON.parse(jsonMatch[1].trim());
                            console.log(`[GeminiHelper] ✨ [모델: ${model}] 마크다운 블록 JSON 파싱 성공!`);
                            return parsed as T;
                        }
                        throw new Error(`[${model}] JSON 파싱 실패: ${parseErr.message}`);
                    }
                }

                console.log(`[GeminiHelper] ✨ [모델: ${model}] 텍스트 생성 성공!`);
                return responseText as unknown as T;

            } catch (err: any) {
                lastError = err;
                const errMsg = err.message || String(err);
                const isOverloaded = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');

                console.warn(`[GeminiHelper] ⚠️ [모델: ${model}] 시도 ${attempt} 실패: ${errMsg.slice(0, 120)}...`);

                if (isOverloaded && attempt < maxRetries) {
                    const delayMs = attempt * 1500;
                    console.log(`[GeminiHelper] ⏳ 일시적 과부하(503/429) 감지. ${delayMs}ms 후 재시도합니다...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }

                // 현재 모델에서 재시도 모두 실패 시 다음 모델로 즉시 폴백
                break;
            }
        }
        console.log(`[GeminiHelper] 🔀 [모델: ${model}] 실패 ➔ 다음 대체 모델로 즉시 전환합니다.`);
    }

    console.error('[GeminiHelper] ❌ 모든 대체 모델 호출이 실패했습니다. 마지막 오류:', lastError);
    throw lastError || new Error('모든 Gemini 대체 모델 호출에 실패했습니다.');
}
