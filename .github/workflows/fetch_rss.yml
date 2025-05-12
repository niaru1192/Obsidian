// fetch_rss.js
import Parser from 'rss-parser';
import TurndownService from 'turndown';
import fs from 'fs';
import path from 'path';

(async () => {
  // 1) 環境変数から URL を読む
  const rssUrl = process.env.RSS_URL;
  if (!rssUrl) {
    console.error('Error: 環境変数 RSS_URL が設定されていません');
    process.exit(1);
  }

  // 2) フィード取得
  const parser = new Parser();
  const feed   = await parser.parseURL(rssUrl);

  // 3) 出力フォルダ準備
  const outDir = path.resolve(__dirname, '_posts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  // 4) 各アイテムを Markdown 化して保存
  const td = new TurndownService();
  for (const item of feed.items) {
    const date = new Date(item.pubDate || item.isoDate).toISOString().slice(0,10);
    const slug = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/(^\-|\-$)/g,'');
    const filename = `${date}-${slug}.md`;
    const filepath = path.join(outDir, filename);
    if (fs.existsSync(filepath)) continue;

    const fm = [
      '---',
      `title: "${item.title.replace(/"/g,'\\"')}"`,
      `date:  ${date}`,
      `link:  "${item.link}"`,
      '---\n',
    ].join('\n');
    const body = td.turndown(item.content || item.contentSnippet || '');
    fs.writeFileSync(filepath, fm + body);
    console.log(`Created: ${filename}`);
  }
})();
