const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\dirce\\Desktop\\BatCheckout Admin';

function walk(d) {
    fs.readdirSync(d).forEach(f => {
        const full = path.join(d, f);
        if (fs.statSync(full).isDirectory()) {
            walk(full);
        } else if (/\.(html|js|json)$/.test(full)) {
            let txt = fs.readFileSync(full, 'utf8');
            let orig = txt;
            txt = txt.replace(/\.\.\/assets\/img\/logo\.svg/g, '../assets/logo.png');
            txt = txt.replace(/\.\/assets\/img\/logo\.svg/g, './assets/logo.png');
            txt = txt.replace(/type="image\/svg\+xml"/g, 'type="image/png"');
            if (orig !== txt) {
                fs.writeFileSync(full, txt, 'utf8');
                console.log('Updated: ' + full);
            }
        }
    });
}

walk(dir);
console.log('Logo update completed successfully.');
