import * as fs from 'fs';
import { runPublisherAgent } from './agents/publisherAgent';

// upload_queue/<item>/{video.mp4,script.json,meta.json} 하나를 업로드 (Actions 전용).
// 사용: node publish_only.js [--item <slug>] [--privacy unlisted|public|private] [--dry-run]
//  env ITEM / PRIVACY도 인정(Actions inputs). 큐가 비었으면 아무것도 안 하고 성공 종료.
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const Q = 'upload_queue';

(async () => {
  const privacy = (arg('privacy') || process.env.PRIVACY || 'unlisted') as 'public' | 'unlisted' | 'private';
  if (!['public', 'unlisted', 'private'].includes(privacy)) throw new Error(`privacy 값 오류: ${privacy}`);
  const dry = process.argv.includes('--dry-run');
  const isItem = (d: string) => fs.existsSync(`${Q}/${d}/video.mp4`) && fs.existsSync(`${Q}/${d}/script.json`);
  const hasId = (d: string) => { try { return !!JSON.parse(fs.readFileSync(`${Q}/${d}/meta.json`, 'utf8')).videoId; } catch { return false; } };

  const wanted = arg('item') || process.env.ITEM;
  const item = wanted || (fs.existsSync(Q) ? fs.readdirSync(Q).sort().find(d => isItem(d) && !hasId(d)) : undefined);
  if (!item) { console.log('큐가 비어 있어 업로드할 항목이 없습니다.'); return; }
  if (!isItem(item)) throw new Error(`큐 항목 없음/불완전: ${Q}/${item}`);

  const dir = `${Q}/${item}`;
  const metaPath = `${dir}/meta.json`;
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  if (meta.videoId) { console.log(`이미 업로드됨(${meta.videoId}), 건너뜀: ${item}`); return; }

  const script = JSON.parse(fs.readFileSync(`${dir}/script.json`, 'utf8'));
  if (dry) { console.log(`[dry-run] 업로드 예정: ${item} | privacy=${privacy} | "${script.title}" | 출처 ${meta.sourceUrl ?? '-'}`); return; }

  const r = await runPublisherAgent(script, { videoPath: `${dir}/video.mp4`, durationSeconds: 35 } as any, privacy);
  console.log('PUB', JSON.stringify(r));
  if (!r.success) process.exit(1);

  // 업로드 성공 후에만 기록 (멱등: meta.videoId, 중복방지: used_sources.json)
  fs.writeFileSync(metaPath, JSON.stringify({ ...meta, videoId: r.videoId, privacy, publishedAt: new Date().toISOString() }, null, 1), 'utf8');
  if (meta.sourceId) {
    const used: string[] = fs.existsSync('used_sources.json') ? JSON.parse(fs.readFileSync('used_sources.json', 'utf8')) : [];
    fs.writeFileSync('used_sources.json', JSON.stringify([...used, meta.sourceId].slice(-200)), 'utf8');
  }
})().catch(e => { console.error(e); process.exit(1); });
