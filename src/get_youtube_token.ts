import { google } from 'googleapis';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * YouTube Data API v3 Refresh Token 획득 헬퍼 스크립트
 */
async function getYouTubeRefreshToken() {
    console.log('==================================================');
    console.log('🎬 YouTube Data API v3 Refresh Token 발급 헬퍼');
    console.log('==================================================\n');

    let clientId = process.env.YOUTUBE_CLIENT_ID;
    let clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (query: string): Promise<string> => {
        return new Promise(resolve => rl.question(query, resolve));
    };

    if (!clientId) {
        clientId = await askQuestion('🔑 Google Cloud Console의 [Client ID]를 입력하세요: ');
    }
    if (!clientSecret) {
        clientSecret = await askQuestion('🔑 Google Cloud Console의 [Client Secret]을 입력하세요: ');
    }

    if (!clientId || !clientSecret) {
        console.error('❌ Client ID 및 Client Secret이 필요합니다.');
        rl.close();
        return;
    }

    // OAuth Playground 또는 로컬 콜백 주소
    const redirectUri = 'https://developers.google.com/oauthplayground';
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes
    });

    console.log('\n==================================================');
    console.log('👉 아래 URL을 웹 브라우저 주소창에 복사하여 접속하세요:\n');
    console.log(authUrl);
    console.log('\n==================================================');
    console.log('1. 브라우저에서 유튜브 계정으로 로그인 후 [허용/동의]를 누르세요.');
    console.log('2. 화면에 표시되는 [Authorization Code / 승인 코드]를 아래에 붙여넣으세요.');
    console.log('--------------------------------------------------\n');

    const authCode = await askQuestion('📥 승인 코드를 여기에 입력하세요: ');

    try {
        const { tokens } = await oauth2Client.getToken(authCode.trim());
        console.log('\n🎉 발급 성공!');
        console.log('- Access Token:', tokens.access_token ? 'OK' : 'N/A');
        console.log('- Refresh Token:', tokens.refresh_token || 'N/A');

        if (tokens.refresh_token) {
            const envPath = path.join(process.cwd(), '.env');
            let envContent = fs.readFileSync(envPath, 'utf8');

            if (!envContent.includes('YOUTUBE_CLIENT_ID=')) {
                envContent += `\n\n# 5. YouTube Data API v3 OAuth Settings\nYOUTUBE_CLIENT_ID="${clientId}"`;
            }
            if (!envContent.includes('YOUTUBE_CLIENT_SECRET=')) {
                envContent += `\nYOUTUBE_CLIENT_SECRET="${clientSecret}"`;
            }
            if (!envContent.includes('YOUTUBE_REFRESH_TOKEN=')) {
                envContent += `\nYOUTUBE_REFRESH_TOKEN="${tokens.refresh_token}"\n`;
            } else {
                envContent = envContent.replace(/YOUTUBE_REFRESH_TOKEN=.* /g, `YOUTUBE_REFRESH_TOKEN="${tokens.refresh_token}"`);
            }

            fs.writeFileSync(envPath, envContent, 'utf8');
            console.log('✅ .env 파일에 YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN 자동 저장 완료!');
        } else {
            console.warn('⚠️ Refresh Token이 발급되지 않았습니다. (이미 발급된 경우 prompt: consent 필요)');
        }
    } catch (err: any) {
        console.error('❌ 토큰 교환 실패:', err.message || err);
    } finally {
        rl.close();
    }
}

getYouTubeRefreshToken();
