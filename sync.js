require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const POSTS_DIR = path.join(__dirname, 'src', 'posts');
const IMG_DIR = path.join(__dirname, 'src', 'img', 'notion');

const notion = new Client({ auth: NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

// ===== Download image to local =====
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filepath);
    fs.mkdirSync(dir, { recursive: true });
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const ws = fs.createWriteStream(filepath);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(); });
      ws.on('error', reject);
    }).on('error', reject);
  });
}

// ===== Extract property values =====
function getTitle(props) {
  const p = props.Title;
  if (!p || !p.title) return 'Untitled';
  return p.title.map(t => t.plain_text).join('');
}

function getDate(props) {
  const p = props.Date;
  if (!p || !p.date || !p.date.start) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  return p.date.start;
}

function getTags(props) {
  const p = props.Tags;
  if (!p || !p.multi_select) return [];
  return p.multi_select.map(t => t.name);
}

function getCategory(props) {
  const p = props.Category;
  if (!p || !p.select) return '';
  return p.select.name || '';
}

function getCheckbox(props, name) {
  const p = props[name];
  if (!p || p.type !== 'checkbox') return false;
  return p.checkbox === true;
}

function getSlug(props) {
  const p = props.Slug;
  if (!p || !p.rich_text) return '';
  return p.rich_text.map(t => t.plain_text).join('').trim();
}

// ===== Build frontmatter =====
function buildFrontmatter(data) {
  let fm = '---\n';
  fm += `title: "${data.title.replace(/"/g, '\\"')}"\n`;
  fm += `date: ${data.date}\n`;
  if (data.tags.length) fm += `tags: [${data.tags.join(', ')}]\n`;
  if (data.categories) fm += `categories: ${data.categories}\n`;
  if (data.private) fm += `private: true\n`;
  if (data.mathjax) fm += `mathjax: true\n`;
  fm += `notion_id: ${data.notionId}\n`;
  fm += '---\n';
  return fm;
}

// ===== Process images in markdown =====
async function processImages(markdown, pageId) {
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  const matches = [...markdown.matchAll(imgRegex)];
  let result = markdown;

  for (const match of matches) {
    const [full, alt, url] = match;
    // Generate a filename from the URL
    const urlObj = new URL(url);
    let ext = path.extname(urlObj.pathname) || '.png';
    if (ext.length > 5) ext = '.png'; // fallback for weird extensions
    const imgName = `${pageId.slice(0, 8)}-${matches.indexOf(match)}${ext}`;
    const localPath = path.join(IMG_DIR, imgName);
    const relativePath = `img/notion/${imgName}`;

    try {
      await downloadImage(url, localPath);
      result = result.replace(full, `![${alt}](${relativePath})`);
      console.log(`    ↓ ${imgName}`);
    } catch (e) {
      console.warn(`    ⚠ Failed to download image: ${e.message}`);
      // Keep original URL as fallback
    }
  }

  return result;
}

// ===== Detect if post uses math =====
function hasMath(markdown) {
  return /\$\$.+?\$\$/s.test(markdown) || /(?<!\$)\$(?!\$).+?(?<!\$)\$(?!\$)/.test(markdown);
}

// ===== Main sync =====
async function sync() {
  console.log('Syncing from Notion...\n');

  // Query all published pages
  const pages = [];
  let cursor;
  do {
    const resp = await notion.search({
      query: '',
      filter: { property: 'object', value: 'data_source' },
      start_cursor: cursor,
      page_size: 100
    });
    // Filter to our database and get pages from it
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  // Query published pages from the database
  let hasMore = true;
  let startCursor;
  while (hasMore) {
    const opts = {
      data_source_id: DATABASE_ID,
      filter: { property: 'Publish', checkbox: { equals: true } },
      page_size: 100,
    };
    if (startCursor) opts.start_cursor = startCursor;

    let resp;
    try {
      resp = await notion.dataSources.query(opts);
    } catch (e) {
      console.error('Failed to query database:', e.message);
      return;
    }

    pages.push(...resp.results);
    hasMore = resp.has_more;
    startCursor = resp.next_cursor;
  }

  console.log(`Found ${pages.length} published page(s)\n`);

  if (pages.length === 0) {
    console.log('Nothing to sync. Make sure posts have "Publish" checked.');
    return;
  }

  // Track synced files
  const syncedFiles = [];

  for (const page of pages) {
    const props = page.properties;
    const title = getTitle(props);
    const slug = getSlug(props) || title.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-');
    const notionId = page.id;

    console.log(`  → ${title} (${slug})`);

    // Convert page content to markdown
    const mdBlocks = await n2m.pageToMarkdown(notionId);
    let markdown = n2m.toMarkdownString(mdBlocks).parent || '';

    // Download and localize images
    markdown = await processImages(markdown, notionId);

    // Build the file
    const data = {
      title,
      date: getDate(props),
      tags: getTags(props),
      categories: getCategory(props),
      private: getCheckbox(props, 'Private'),
      mathjax: hasMath(markdown),
      notionId,
    };

    const fileContent = buildFrontmatter(data) + '\n' + markdown;
    const filePath = path.join(POSTS_DIR, `${slug}.md`);

    fs.mkdirSync(POSTS_DIR, { recursive: true });
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    syncedFiles.push(slug);
    console.log(`    ✓ Written to src/posts/${slug}.md`);
  }

  console.log(`\nSynced ${syncedFiles.length} post(s). Run \`npm run build\` to rebuild.`);
}

sync().catch(e => {
  console.error('Sync failed:', e);
  process.exit(1);
});
