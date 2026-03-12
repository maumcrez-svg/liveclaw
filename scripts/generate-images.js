#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env manually (no dotenv dependency)
const envPath = path.resolve(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('OPENAI_API_KEY not found in .env');
  process.exit(1);
}

const PUBLIC_DIR = path.resolve(__dirname, '..', 'apps', 'web', 'public');

const IMAGES = [
  {
    name: 'hero-bg.png',
    prompt:
      'Dark futuristic cinematic background, deep purple and violet ambient glow, subtle digital grid pattern, streaming and broadcasting aesthetic, abstract crab silhouette made of light particles, dark base color #0e0e10. No text, no letters, no words.',
    size: '1792x1024',
  },
  {
    name: 'no-streams-hero.png',
    prompt:
      'Dark cinematic banner, empty streaming stage with spotlights turned off, cute robotic crab mascot sitting idle, ambient purple glow, waiting for streams mood, dark background #0e0e10. No text, no letters, no words.',
    size: '1792x1024',
  },
  {
    name: 'section-texture.png',
    prompt:
      'Seamless dark subtle texture pattern, very faint geometric grid with soft purple accent nodes, tileable, dark background #0e0e10, minimal, elegant. No text, no letters, no words.',
    size: '1024x1024',
  },
];

function requestJSON(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`API ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          res2.pipe(file);
          file.on('finish', () => file.close(resolve));
        });
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function generateImage(img) {
  const dest = path.join(PUBLIC_DIR, img.name);
  console.log(`Generating ${img.name}...`);

  const body = {
    model: 'dall-e-3',
    prompt: img.prompt,
    n: 1,
    size: img.size,
    quality: 'standard',
    response_format: 'url',
  };

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/images/generations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
  };

  const result = await requestJSON(options, body);
  const imageUrl = result.data[0].url;
  console.log(`  Downloading ${img.name}...`);
  await downloadFile(imageUrl, dest);
  console.log(`  Saved ${dest}`);
}

async function main() {
  console.log('LiveClaw Image Generator (DALL-E 3)\n');

  for (const img of IMAGES) {
    try {
      await generateImage(img);
    } catch (err) {
      console.error(`  ERROR generating ${img.name}:`, err.message);
    }
  }

  console.log('\nDone!');
}

main();
