import Parser          from 'rss-parser';
import TurndownService from 'turndown';
import fs              from 'fs';
import path            from 'path';
import fetch           from 'node-fetch';
import { Dropbox }     from 'dropbox';
import { fileURLToPath } from 'url';

// ESM用 dirname 定義
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// 設定ファイル読み込み
const configPath = path.resolve(__dirname, 'feeds.json');
if (!fs.existsSync(configPath)) {
  console.error('Error: feeds.json がありません');
  process.exit(1);
}
const { feeds } = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

(async () => {
  const dropboxToken = process.env.DROPBOX_TOKEN;
  if (!dropboxToken) {
    console.error('Error: DROPBOX_TOKEN が設定されていません');
    process.exit(1);
  }
  const dbx = new Dropbox({ accessToken: dropboxToken, fetch });

  const td     = new TurndownService();
  const outDir = path.resolve(__dirname, '_posts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const rssUrl of feeds) {
    const feedName = new URL(rssUrl).hostname.replace(/\./g,'-');
    const parser   = new Parser();
    const feed     = await parser.parseURL(rssUrl);
    console.log(`Fetched ${feed.items.length} items from ${rssUrl}`);

    for (const item of feed.items) {
      const date = new Date(item.pubDate||item.isoDate||Date.now()).toISOString().slice(0,10);
      const slug = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g,'-')
        .replace(/(^-|-$)/g,'');
      const filename = `${date}-${feedName}-${slug}.md`;
      const filepath = path.join(outDir, filename);
      const frontMatter = [
        '---',
        `title: "${item.title.replace(/"/g,'\\"')}"`,
        `date:  ${date}`,
        `link:  "${item.link}"`,
        '---',''
      ].join('\n');
      const body    = td.turndown(item.content||item.contentSnippet||'');
      const content = frontMatter + body;

      // ローカル書き出し
      if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, content);
        console.log(`Created local: ${filename}`);
      } else {
        console.log(`Skip local (exists): ${filename}`);
      }

      // Dropbox アップロード
      try {
        await dbx.filesUpload({
          path: `/ObsidianVault/Clipping/${filename}`, // Full Dropbox ならこのまま
          contents: content,
          mode: { '.tag': 'add' }
        });
        console.log(`Uploaded to Dropbox: ${filename}`);
      } catch (e) {
        if (e.error?.error_summary?.includes('path/conflict')) {
          console.log(`Skip Dropbox (exists): ${filename}`);
        } else {
          console.error('Dropbox upload error:', e);
        }
      }
    }
  }
})();
