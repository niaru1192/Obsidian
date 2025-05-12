import Parser from 'rss-parser';
import TurndownService from 'turndown';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { Dropbox } from 'dropbox';
import { fileURLToPath } from 'url';

// ESM: define __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

(async () => {
  // 環境変数から設定を取得
  const rssUrl = process.env.RSS_URL;
  const dropboxToken = process.env.DROPBOX_TOKEN;
  if (!rssUrl) {
    console.error('Error: 環境変数 RSS_URL が設定されていません');
    process.exit(1);
  }
  if (!dropboxToken) {
    console.error('Error: 環境変数 DROPBOX_TOKEN が設定されていません');
    process.exit(1);
  }

  // Dropbox クライアント初期化
  const dbx = new Dropbox({ accessToken: dropboxToken, fetch });

  // RSS フィード取得
  const parser = new Parser();
  const feed = await parser.parseURL(rssUrl);
  console.log(`Fetched ${feed.items.length} items from ${rssUrl}`);

  // 出力ディレクトリを準備
  const outDir = path.resolve(__dirname, '_posts');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const td = new TurndownService();
  for (const item of feed.items) {
    // ファイル名用の日付とスラッグを生成
    const date = new Date(item.pubDate || item.isoDate || Date.now())
      .toISOString().slice(0, 10);
    const slug = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const filename = `${date}-${slug}.md`;
    const filepath = path.join(outDir, filename);

    // Markdown コンテンツを組み立て
    const frontMatter = [
      '---',
      `title: "${item.title.replace(/"/g, '\"')}"`,
      `date: ${date}`,
      `link: "${item.link}"`,
      '---',
      ''
    ].join('\n');
    const body = td.turndown(item.content || item.contentSnippet || '');
    const content = frontMatter + body;

    // ローカルに書き出し
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, content);
      console.log(`Created local: ${filename}`);
    } else {
      console.log(`Skip local (exists): ${filename}`);
    }

    // Dropbox にアップロード
    try {
      await dbx.filesUpload({
        path: `/ObsidianVault/Clipping/${filename}`,
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
})();
