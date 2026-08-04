const googleTTS = require('google-tts-api');
const fs = require('fs');

async function main() {
    const text = '야 너 이번에 한화에서 20조 부어서 채용 시작했거든? 당장 드래프트 이든 AI에서 3초 만에 팩폭 교정받아봐!';
    console.log('TTS 요청 시작...');
    const url = googleTTS.getAudioUrl(text, {
        lang: 'ko',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
    });
    console.log('음성 재생 URL:', url);
}

main().catch(console.error);
