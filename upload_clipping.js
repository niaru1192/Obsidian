   import Parser from 'rss-parser';
   import TurndownService from 'turndown';
   import fetch from 'node-fetch';
   import { Dropbox } from 'dropbox';
   import fs from 'fs';

   const RSS_URL = process.env.RSS_URL;
   const ACCESS_TOKEN = process.env.DROPBOX_TOKEN;
   const dbx = new Dropbox({ accessToken: ACCESS_TOKEN, fetch });

   (async () => {
     const parser = new Parser();
     const td = new TurndownService();
     const feed = await parser.parseURL(RSS_URL);

     for (const item of feed.items) {
       const title = item.title.replace(/[\/\\?%*:|"<>]/g,'');
       const filename = `clipping-${item.guid||item.link}.md`;
       const md = td.turndown(item.content || item.contentSnippet || '');
       const content = `---\ntitle: "${item.title}"\ndate: ${item.pubDate}\nsource: ${item.link}\n---\n\n${md}`;

       // Dropbox にアップロード（上書きはせず重複を防止）
       try {
         await dbx.filesUpload({
           path: `/ObsidianVault/Clipping/${filename}`,
           contents: content,
           mode: { ".tag": "add" },
         });
         console.log(`Uploaded: ${filename}`);
       } catch (e) {
         if (e.error && e.error[".tag"] === "path") {
           console.log(`Already exists, skip: ${filename}`);
         } else {
           console.error(e);
         }
       }
     }
   })();
