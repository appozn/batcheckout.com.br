const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/dirce/Desktop/BatCheckout Admin';
const pagesDir = path.join(dir, 'pages');

if (!fs.existsSync(path.join(dir, 'assets/img'))) fs.mkdirSync(path.join(dir, 'assets/img'), { recursive: true });

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#8B004B" rx="100"/><path d="M256,128 L384,384 L128,384 Z" fill="#FF4FA3"/></svg>`;
fs.writeFileSync(path.join(dir, 'assets/img/logo.svg'), svgContent);

const manifestTags = `  <link rel="icon" type="image/svg+xml" href="../assets/img/logo.svg" />\n  <link rel="manifest" href="../manifest.json" />`;
const rootManifestTags = `  <link rel="icon" type="image/svg+xml" href="./assets/img/logo.svg" />\n  <link rel="manifest" href="./manifest.json" />`;

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
files.forEach(f => {
    let content = fs.readFileSync(path.join(pagesDir, f), 'utf-8');
    if (!content.includes('manifest.json')) {
        content = content.replace('</title>', '</title>\n' + manifestTags);
    }
    content = content.replace(/🚀/g, '');
    content = content.replace(/🛒/g, '');
    fs.writeFileSync(path.join(pagesDir, f), content);
});

let idxContent = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
if (!idxContent.includes('manifest.json')) {
    idxContent = idxContent.replace('</title>', '</title>\n' + rootManifestTags);
}
fs.writeFileSync(path.join(dir, 'index.html'), idxContent);

let layout = fs.readFileSync(path.join(dir, 'assets/js/layout.js'), 'utf-8');
layout = layout.replace(/🚀/g, '');
layout = layout.replace(/<img src="https:\/\/media\.canva[^"]+"/g, '<a href="dashboard.html"><img src="../assets/img/logo.svg"');
layout = layout.replace(/alt="BatCheckout Logo"[^>]+>/g, 'alt="BatCheckout Logo" style="height: 48px; object-fit: contain; transform: scale(1.3); margin-top: 8px; margin-bottom: 8px;" /></a>');
fs.writeFileSync(path.join(dir, 'assets/js/layout.js'), layout);

['login.html', 'register.html'].forEach(f => {
    let p = path.join(pagesDir, f);
    let c = fs.readFileSync(p, 'utf-8');
    c = c.replace(/<img src="https:\/\/media\.canva[^"]+"/g, '<a href="dashboard.html"><img src="../assets/img/logo.svg"');
    c = c.replace(/alt="BatCheckout Logo"[^>]+>/g, 'alt="BatCheckout Logo" style="height: 64px; object-fit: contain; transform: scale(1.4);" /></a>');
    fs.writeFileSync(p, c);
});

let adm = fs.readFileSync(path.join(pagesDir, 'admin.html'), 'utf-8');
if (!adm.includes('bat.adm@adm.com')) {
    adm = adm.replace("const uid = key.replace('bat_transactions_', '');", "const uid = key.replace('bat_transactions_', '');\n                    if(uid === 'bat.adm@adm.com') return; /* Excluindo vendas do admin */");
}
fs.writeFileSync(path.join(pagesDir, 'admin.html'), adm);

console.log('Update Complete!');
