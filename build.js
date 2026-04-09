const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { Marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');

// ===== Config =====
const SITE_TITLE = 'MMonster的小窝';
const SITE_TAGLINE = 'Security · Code · Life';
const BASE_PATH = process.argv.includes('--local') ? '' : '/blog';
const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const BG_SRC = path.join(SRC_DIR, 'img', 'bg.jpg');

// ===== Marked setup =====
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  })
);

// ===== Math pre-processing =====
// Protect LaTeX blocks from marked's processing
function preprocessMath(md) {
  const placeholders = [];
  let idx = 0;
  // Display math $$...$$
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const ph = `%%MATH_DISPLAY_${idx}%%`;
    placeholders.push({ ph, html: `<div class="math-display">$$${tex}$$</div>` });
    idx++;
    return ph;
  });
  // Inline math $...$  (not preceded/followed by $)
  md = md.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_, tex) => {
    const ph = `%%MATH_INLINE_${idx}%%`;
    placeholders.push({ ph, html: `<span class="math-inline">$${tex}$</span>` });
    idx++;
    return ph;
  });
  return { md, placeholders };
}

function restoreMath(html, placeholders) {
  for (const { ph, html: replacement } of placeholders) {
    html = html.replace(ph, replacement);
  }
  return html;
}

// ===== Image path rewriting =====
function rewriteImagePaths(html) {
  return html
    // Absolute URLs to old deployment
    .replace(/src="https:\/\/mm0n5ter\.github\.io\/(img\/[^"]+)"/g, `src="${BASE_PATH}/$1"`)
    // Windows absolute paths
    .replace(/src="[A-Za-z]:[\\\/][^"]*[\\\/](img[\\\/][^"]+)"/g, (_, p) =>
      `src="${BASE_PATH}/${p.replace(/\\/g, '/')}"`)
    // Markdown-rendered relative img paths (bare img/...)
    .replace(/src="(img\/[^"]+)"/g, `src="${BASE_PATH}/$1"`)
    // Lazy loading
    .replace(/<img(?!\s+loading)/g, '<img loading="lazy"');
}

// ===== Read & parse posts =====
function readPosts() {
  const postsDir = path.join(SRC_DIR, 'posts');
  if (!fs.existsSync(postsDir)) return [];
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  const posts = files.map(file => {
    const raw = fs.readFileSync(path.join(postsDir, file), 'utf-8');
    const { data, content } = matter(raw);
    const slug = path.basename(file, '.md');
    // Normalize tags to array
    let tags = data.tags || [];
    if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    // Normalize date
    const date = data.date ? new Date(data.date) : new Date(0);
    return {
      slug,
      title: data.title || slug,
      date,
      dateStr: date.toISOString().slice(0, 10),
      tags,
      categories: data.categories || '',
      description: data.description || '',
      mathjax: data.mathjax === true || data.mathjax === 'ture', // handle typo
      private: data.private === true,
      content
    };
  });
  posts.sort((a, b) => b.date - a.date);
  return posts;
}

// ===== Render a post's markdown to HTML =====
function renderPost(post) {
  let md = post.content;
  let placeholders = [];
  if (post.mathjax) {
    const result = preprocessMath(md);
    md = result.md;
    placeholders = result.placeholders;
  }
  let html = marked.parse(md);
  if (post.mathjax) {
    html = restoreMath(html, placeholders);
  }
  html = rewriteImagePaths(html);
  return html;
}

// ===== HTML Templates =====
function topNavHTML() {
  return `
  <nav class="top-nav" id="topNav">
    <a href="${BASE_PATH}/">Home</a>
    <a href="${BASE_PATH}/archives/">Archives</a>
    <a href="${BASE_PATH}/tags/">Tags</a>
    <a href="https://github.com/MM0n5Ter">GitHub</a>
  </nav>`;
}

function sidebarSectionsHTML(publicPosts) {
  // Recent archives: group by year-month, show latest 6 months
  const archiveMap = {};
  for (const p of publicPosts) {
    const ym = p.dateStr.slice(0, 7);
    if (!archiveMap[ym]) archiveMap[ym] = 0;
    archiveMap[ym]++;
  }
  const archiveEntries = Object.entries(archiveMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const archiveListHTML = archiveEntries.map(([ym, count]) =>
    `<li><a href="${BASE_PATH}/archives/#${ym}">${ym}<span class="count">(${count})</span></a></li>`
  ).join('\n          ');

  // Tags: sorted by count
  const tagMap = {};
  for (const p of publicPosts) {
    for (const t of p.tags) {
      if (!tagMap[t]) tagMap[t] = 0;
      tagMap[t]++;
    }
  }
  const tagEntries = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const tagListHTML = tagEntries.map(([tag, count]) =>
    `<li><a href="${BASE_PATH}/tags/#${encodeURIComponent(tag)}">${tag}<span class="count">(${count})</span></a></li>`
  ).join('\n          ');

  return `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Archives</div>
          <ul class="sidebar-list">
          ${archiveListHTML}
          </ul>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-title">Tags</div>
          <ul class="sidebar-list">
          ${tagListHTML}
          </ul>
        </div>`;
}

function sidebarHTML(publicPosts, options = {}) {
  const { showAuthor = true } = options;
  const authorHTML = showAuthor ? `
        <img src="${BASE_PATH}/img/avatar.png" alt="avatar" class="sidebar-avatar">
        <div class="sidebar-name">MMonster</div>
        <div class="sidebar-bio">Security · Code · Life</div>
` : '';
  return authorHTML + sidebarSectionsHTML(publicPosts);
}

// Global: set during build so sidebar can access it
let _publicPosts = [];

function layout(title, bodyHTML, options = {}) {
  const { showHero = false, mathjax = false, activeNav = '', isPostPage = false } = options;
  const mathjaxScripts = mathjax ? `
    <script>
      MathJax = {
        tex: { inlineMath: [['$','$'], ['\\\\(','\\\\)']], displayMath: [['$$','$$'], ['\\\\[','\\\\]']] },
        svg: { fontCache: 'global' }
      };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>` : '';

  const heroHTML = showHero ? `
  <section class="hero">
    <h1>${SITE_TITLE}</h1>
    <p class="tagline">${SITE_TAGLINE}</p>
    <div class="scroll-hint">↓</div>
  </section>` : '';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title === SITE_TITLE ? title : title + ' - ' + SITE_TITLE}</title>
  <link rel="icon" type="image/png" sizes="32x32" href="${BASE_PATH}/favicon/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="${BASE_PATH}/favicon/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="${BASE_PATH}/favicon/apple-touch-icon.png">
  <link rel="stylesheet" href="${BASE_PATH}/css/style.css">
  <link rel="stylesheet" href="${BASE_PATH}/css/hljs.css">${mathjaxScripts}
</head>
<body>
  <div class="bg-layer" style="background-image:url('${BASE_PATH}/bg/002.jpg')"></div>
  ${topNavHTML()}
  ${heroHTML}
  <button class="hamburger" onclick="toggleSidebar()" aria-label="Menu">☰</button>
  <div class="sidebar-overlay" onclick="toggleSidebar()"></div>

  <div class="glass-container">
    <div class="layout-flex">
      <aside class="sidebar">
        ${sidebarHTML(_publicPosts)}
      </aside>
      <main class="content">
        ${bodyHTML}
      </main>
    </div>
  </div>

  <footer class="site-footer">
    © ${new Date().getFullYear()} MMonster
  </footer>

  <script>
    function toggleSidebar() {
      document.querySelector('.sidebar').classList.toggle('sidebar-open');
      document.querySelector('.sidebar-overlay').classList.toggle('active');
    }
    // Top nav: scrolled style + hide on scroll down, show on scroll up
    (function() {
      var nav = document.getElementById('topNav');
      if (!nav) return;
      var lastY = 0;
      window.addEventListener('scroll', function() {
        var y = window.scrollY;
        nav.classList.toggle('scrolled', y > 100);
        if (y > window.innerHeight * 0.8) {
          nav.classList.toggle('nav-hidden', y > lastY);
        } else {
          nav.classList.remove('nav-hidden');
        }
        lastY = y;
      });
    })();
  </script>
</body>
</html>`;
}

// ===== Page generators =====
function generateHomepage(publicPosts) {
  const items = publicPosts.map(p => `
        <li>
          <div class="post-date">${p.dateStr}</div>
          <div class="post-title"><a href="${BASE_PATH}/posts/${encodeURIComponent(p.slug)}/">${p.title}</a></div>
          ${p.description ? `<div class="post-desc">${p.description}</div>` : ''}
        </li>`).join('');
  const body = `<h2 class="page-title">文章</h2>\n<ul class="post-list">${items}\n</ul>`;
  return layout(SITE_TITLE, body, { showHero: true, activeNav: 'home' });
}

function generatePostPage(post, html) {
  const tagsHTML = post.tags.length
    ? `<div style="margin-top:4px">${post.tags.map(t => `<span class="tag">${t}</span>`).join(' ')}</div>`
    : '';
  const body = `
        <article>
          <header class="post-header">
            <h1>${post.title}</h1>
            <div class="post-meta">
              <time>${post.dateStr}</time>
              ${post.categories ? ` · ${post.categories}` : ''}
              ${tagsHTML}
            </div>
          </header>
          <div class="post-body">
            ${html}
          </div>
        </article>`;
  return layout(post.title, body, { mathjax: post.mathjax, isPostPage: true });
}

function generateArchives(publicPosts) {
  const byYear = {};
  for (const p of publicPosts) {
    const year = p.date.getFullYear();
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(p);
  }
  const years = Object.keys(byYear).sort((a, b) => b - a);
  let body = '<h2 class="page-title">归档</h2>\n';
  for (const year of years) {
    body += `<h3 class="archive-year">${year}</h3>\n<ul class="archive-list">\n`;
    for (const p of byYear[year]) {
      body += `  <li><span class="date">${p.dateStr.slice(5)}</span> <a href="${BASE_PATH}/posts/${encodeURIComponent(p.slug)}/">${p.title}</a></li>\n`;
    }
    body += '</ul>\n';
  }
  return layout('归档', body, { activeNav: 'archives' });
}

function generateTags(publicPosts) {
  const tagMap = {};
  for (const p of publicPosts) {
    for (const t of p.tags) {
      if (!tagMap[t]) tagMap[t] = [];
      tagMap[t].push(p);
    }
  }
  const sortedTags = Object.keys(tagMap).sort();
  const cloudHTML = sortedTags.map(t =>
    `<a href="#${encodeURIComponent(t)}" data-tag="${t}">${t}<span class="count">(${tagMap[t].length})</span></a>`
  ).join('\n    ');

  let listHTML = '';
  for (const t of sortedTags) {
    listHTML += `<div class="tag-section" data-tag="${t}">
      <h3 style="margin-top:1.5em;margin-bottom:0.5em">${t}</h3>
      <ul class="archive-list">\n`;
    for (const p of tagMap[t]) {
      listHTML += `    <li><span class="date">${p.dateStr}</span> <a href="${BASE_PATH}/posts/${encodeURIComponent(p.slug)}/">${p.title}</a></li>\n`;
    }
    listHTML += '  </ul></div>\n';
  }

  const body = `<h2 class="page-title">标签</h2>
<div class="tag-cloud">${cloudHTML}</div>
${listHTML}`;

  const page = layout('标签', body, { activeNav: 'tags' });
  // Inject tag filter script before </body>
  const filterScript = `
  <script>
    (function() {
      function filter() {
        var hash = decodeURIComponent(location.hash.slice(1));
        var sections = document.querySelectorAll('.tag-section');
        var links = document.querySelectorAll('.tag-cloud a');
        links.forEach(function(a) { a.classList.toggle('active', a.dataset.tag === hash); });
        sections.forEach(function(s) {
          s.style.display = (!hash || s.dataset.tag === hash) ? '' : 'none';
        });
      }
      window.addEventListener('hashchange', filter);
      filter();
    })();
  </script>`;
  return page.replace('</body>', filterScript + '\n</body>');
}

// ===== File helpers =====
function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

// ===== Build =====
function build() {
  const startTime = Date.now();
  console.log('Building...');

  // Clean dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  mkdirp(DIST_DIR);

  // Read posts
  const allPosts = readPosts();
  const publicPosts = allPosts.filter(p => !p.private);
  _publicPosts = publicPosts;
  console.log(`  ${allPosts.length} posts (${publicPosts.length} public, ${allPosts.length - publicPosts.length} private)`);

  // Render all posts
  const rendered = allPosts.map(p => ({ post: p, html: renderPost(p) }));
  // Generate pages
  writeFile(path.join(DIST_DIR, 'index.html'), generateHomepage(publicPosts));
  writeFile(path.join(DIST_DIR, 'archives', 'index.html'), generateArchives(publicPosts));
  writeFile(path.join(DIST_DIR, 'tags', 'index.html'), generateTags(publicPosts));

  for (const { post, html } of rendered) {
    writeFile(path.join(DIST_DIR, 'posts', post.slug, 'index.html'), generatePostPage(post, html));
  }

  // Copy static assets
  copyDir(path.join(SRC_DIR, 'css'), path.join(DIST_DIR, 'css'));
  copyDir(path.join(SRC_DIR, 'img'), path.join(DIST_DIR, 'img'));

  // Copy highlight.js theme
  const hljsTheme = path.join(__dirname, 'node_modules', 'highlight.js', 'styles', 'github.css');
  if (fs.existsSync(hljsTheme)) {
    writeFile(path.join(DIST_DIR, 'css', 'hljs.css'), fs.readFileSync(hljsTheme, 'utf-8'));
  }

  // Copy background image
  if (fs.existsSync(BG_SRC)) {
    mkdirp(path.join(DIST_DIR, 'bg'));
    fs.copyFileSync(BG_SRC, path.join(DIST_DIR, 'bg', '002.jpg'));
  }

  // Copy favicons
  copyDir(path.join(SRC_DIR, 'favicon'), path.join(DIST_DIR, 'favicon'));

  const elapsed = Date.now() - startTime;
  console.log(`  Done in ${elapsed}ms → ${DIST_DIR}`);
}

// ===== Watch mode =====
if (process.argv.includes('--watch')) {
  build();
  console.log('\nWatching for changes...');
  let timer = null;
  fs.watch(SRC_DIR, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('\nFile changed, rebuilding...');
      build();
    }, 200);
  });
} else {
  build();
}
