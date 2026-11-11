import * as fs from 'fs';
import { runDesignerAgent } from './agents/designerAgent';

// 렌더 미리보기(Gemini/업로드 없음): node render_only.js <큐폴더> -> <큐폴더>/video.mp4 (script.json 필요)
(async () => {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(`${dir}/script.json`)) throw new Error('사용법: render_only <폴더(script.json 포함)>');
  const r = await runDesignerAgent(JSON.parse(fs.readFileSync(`${dir}/script.json`, 'utf8')));
  fs.copyFileSync(r.videoPath, `${dir}/video.mp4`);
  console.log(`RENDERED ${dir}/video.mp4 (${Math.round(r.durationSeconds)}s)`);
})().catch(e => { console.error(e); process.exit(1); });
