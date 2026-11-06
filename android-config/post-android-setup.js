#!/usr/bin/env node
/**
 * post-android-setup.js
 *
 * Run this after `cap add android` to patch the Android project for:
 *  1. HTTP cleartext traffic to the backend IP (52.64.91.185)
 *  2. Disabling auto-backup to prevent token leaks
 *  3. Necessary permissions for GPS and notifications
 *
 * Usage:  node android-config/post-android-setup.js
 */
const fs   = require('fs');
const path = require('path');

const ANDROID_DIR = path.join(__dirname, '..', 'android');
const MANIFEST    = path.join(ANDROID_DIR, 'app', 'src', 'main', 'AndroidManifest.xml');
const XML_RES_DIR = path.join(ANDROID_DIR, 'app', 'src', 'main', 'res', 'xml');
const NET_CFG     = path.join(XML_RES_DIR, 'network_security_config.xml');
const NET_CFG_SRC = path.join(__dirname, 'network_security_config.xml');

// ─── 1. Copy network security config ───────────────────────────────────────
if (!fs.existsSync(XML_RES_DIR)) fs.mkdirSync(XML_RES_DIR, { recursive: true });
fs.copyFileSync(NET_CFG_SRC, NET_CFG);
console.log('✅  Copied network_security_config.xml');

// ─── 2. Patch AndroidManifest.xml ──────────────────────────────────────────
if (!fs.existsSync(MANIFEST)) {
  console.error('❌  AndroidManifest.xml not found. Run `cap add android` first.');
  process.exit(1);
}

let manifest = fs.readFileSync(MANIFEST, 'utf-8');

// Ensure allowBackup="false"
manifest = manifest.replace(/android:allowBackup="true"/g, 'android:allowBackup="false"');

// Add usesCleartextTraffic + networkSecurityConfig to <application> tag
if (!manifest.includes('networkSecurityConfig')) {
  manifest = manifest.replace(
    /(<application\b[^>]*?)>/,
    '$1\n        android:usesCleartextTraffic="true"\n        android:networkSecurityConfig="@xml/network_security_config">',
  );
  console.log('✅  Patched AndroidManifest.xml — cleartext + network security config');
}

// Add required permissions if missing
const PERMS = [
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
];

for (const perm of PERMS) {
  if (!manifest.includes(perm)) {
    manifest = manifest.replace('</manifest>', `    ${perm}\n</manifest>`);
    console.log(`✅  Added permission: ${perm}`);
  }
}

fs.writeFileSync(MANIFEST, manifest, 'utf-8');
console.log('\n🎉  Android project verified and configured!\n');
