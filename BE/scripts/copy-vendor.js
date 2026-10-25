const fs = require('fs');
const path = require('path');

const beDir = process.cwd(); // C:\Users\User\PROJECT\vibeCoded\BE
const workspaceRoot = path.resolve(beDir, '..'); // C:\Users\User\PROJECT\vibeCoded

const targets = [
  {
    name: 'leaflet',
    files: [
      { src: path.join(beDir, 'node_modules/leaflet/dist/leaflet.css'), dest: path.join(beDir, 'FE/vendor/leaflet/leaflet.css') },
      { src: path.join(beDir, 'node_modules/leaflet/dist/leaflet.js'), dest: path.join(beDir, 'FE/vendor/leaflet/leaflet.js') },
      { src: path.join(beDir, 'node_modules/leaflet/dist/leaflet.css'), dest: path.join(workspaceRoot, 'FE/vendor/leaflet/leaflet.css') },
      { src: path.join(beDir, 'node_modules/leaflet/dist/leaflet.js'), dest: path.join(workspaceRoot, 'FE/vendor/leaflet/leaflet.js') }
    ],
    dirs: [
      { src: path.join(beDir, 'node_modules/leaflet/dist/images'), destBE: path.join(beDir, 'FE/vendor/leaflet/images'), destFE: path.join(workspaceRoot, 'FE/vendor/leaflet/images') }
    ]
  },
  {
    name: 'aos',
    files: [
      { src: path.join(beDir, 'node_modules/aos/dist/aos.css'), dest: path.join(beDir, 'FE/vendor/aos/aos.css') },
      { src: path.join(beDir, 'node_modules/aos/dist/aos.js'), dest: path.join(beDir, 'FE/vendor/aos/aos.js') },
      { src: path.join(beDir, 'node_modules/aos/dist/aos.css'), dest: path.join(workspaceRoot, 'FE/vendor/aos/aos.css') },
      { src: path.join(beDir, 'node_modules/aos/dist/aos.js'), dest: path.join(workspaceRoot, 'FE/vendor/aos/aos.js') }
    ]
  },
  {
    name: 'lenis',
    files: [
      { src: path.join(beDir, 'node_modules/lenis/dist/lenis.js'), dest: path.join(beDir, 'FE/vendor/lenis/lenis.min.js') },
      { src: path.join(beDir, 'node_modules/lenis/dist/lenis.js'), dest: path.join(workspaceRoot, 'FE/vendor/lenis/lenis.min.js') }
    ]
  },
  {
    name: 'axios',
    files: [
      { src: path.join(beDir, 'node_modules/axios/dist/axios.min.js'), dest: path.join(beDir, 'FE/vendor/axios/axios.min.js') },
      { src: path.join(beDir, 'node_modules/axios/dist/axios.min.js'), dest: path.join(workspaceRoot, 'FE/vendor/axios/axios.min.js') }
    ]
  }
];

function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

targets.forEach(t => {
  if (t.files) {
    t.files.forEach(f => {
      if (fs.existsSync(f.src)) {
        fs.mkdirSync(path.dirname(f.dest), { recursive: true });
        fs.copyFileSync(f.src, f.dest);
        console.log(`Copied ${path.basename(f.src)} -> ${f.dest}`);
      } else {
        console.warn(`Source not found: ${f.src}`);
      }
    });
  }
  if (t.dirs) {
    t.dirs.forEach(d => {
      copyRecursive(d.src, d.destBE);
      copyRecursive(d.src, d.destFE);
      console.log(`Copied directory ${d.src} -> vendor images`);
    });
  }
});
console.log('Vendor assets sync completed successfully!');
