require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(cors());

// ─── CLOUDINARY CONFIG ─────────────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

// ─── API: GET LIBRARY ──────────────────────────────────────
app.get("/library", async (req, res) => {
    try {
        let allResources = [];
        let nextCursor = null;

        do {
            let query = cloudinary.search
                .expression('resource_type:video AND asset_folder:Our_Escape/*')
                .sort_by("filename", "asc")
                .max_results(100);

            if (nextCursor) {
                query = query.next_cursor(nextCursor);
            }

            const result = await query.execute();

            allResources = allResources.concat(result.resources);
            nextCursor = result.next_cursor;

        } while (nextCursor);

        let library = {};

        allResources.forEach((file) => {
            const parts = file.asset_folder.split("/");
            const category = parts.slice(1).join("/") || "Others";

            const title = file.filename
                .replace(/\.[^/.]+$/, "")
                .replace(/_/g, " ")
                .trim();

            const artwork = file.secure_url
                .replace("/video/upload/", "/video/upload/so_5,w_400,h_400,c_fill,q_auto,f_jpg/")
                .replace(/\.[^/.]+$/, ".jpg");

            if (!library[category]) library[category] = [];

            library[category].push({
                id: file.public_id,
                title,
                artist: category,
                url: file.secure_url,
                artwork,
                duration: file.duration || 0,
            });
        });

        res.json(library);

    } catch (err) {
        console.error("Library error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── WEB PLAYER UI ─────────────────────────────────────────
app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Our Escape 🎧</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --accent: #C8F04A;
    --accent-dim: rgba(200, 240, 74, 0.15);
    --accent-glow: rgba(200, 240, 74, 0.35);
    --bg: #0a0a0a;
    --surface: #111111;
    --surface2: #181818;
    --surface3: #202020;
    --border: rgba(255,255,255,0.06);
    --border-accent: rgba(200,240,74,0.3);
    --text: #F2F2F2;
    --text-muted: #666;
    --text-dim: #999;
    --player-h: 88px;
    --sidebar-w: 260px;
    --radius: 14px;
    --radius-sm: 8px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Syne', sans-serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── GRAIN OVERLAY ── */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9999;
    opacity: 0.4;
  }

  /* ── LAYOUT ── */
  .app-shell {
    display: flex;
    flex: 1;
    overflow: hidden;
    gap: 6px;
    padding: 6px 6px 0;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: var(--sidebar-w);
    flex-shrink: 0;
    background: var(--surface);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .sidebar-logo {
    padding: 22px 20px 18px;
    display: flex;
    align-items: center;
    gap: 11px;
    border-bottom: 1px solid var(--border);
  }

  .logo-mark {
    width: 34px;
    height: 34px;
    background: var(--accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }

  .logo-mark::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--bg);
    border-radius: 50%;
  }

  .logo-text {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.3px;
    line-height: 1.1;
  }

  .logo-sub {
    font-size: 10px;
    font-weight: 400;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .sidebar-nav {
    padding: 12px 10px 0;
  }

  .sidebar-nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    text-decoration: none;
    font-weight: 600;
    font-size: 13px;
    transition: all 0.2s;
    cursor: pointer;
    letter-spacing: 0.2px;
  }

  .sidebar-nav a svg { flex-shrink: 0; }

  .sidebar-nav a:hover { color: var(--text); background: rgba(255,255,255,0.04); }
  .sidebar-nav a.active { color: var(--accent); background: var(--accent-dim); }

  .sidebar-section {
    padding: 20px 20px 6px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 2px;
    color: var(--text-muted);
    text-transform: uppercase;
    font-family: 'DM Mono', monospace;
  }

  .playlist-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 10px 10px;
  }

  .playlist-list::-webkit-scrollbar { width: 3px; }
  .playlist-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  .playlist-item {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 7px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
  }

  .playlist-item:hover { background: rgba(255,255,255,0.04); }
  .playlist-item.active { background: var(--accent-dim); }
  .playlist-item.active .playlist-item-name { color: var(--accent); }

  .playlist-item .pl-thumb {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    object-fit: cover;
    background: var(--surface3);
    flex-shrink: 0;
  }

  .playlist-item-name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s;
  }

  .playlist-item-meta {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
    font-family: 'DM Mono', monospace;
  }

  /* ── MAIN ── */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .main-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }

  .nav-arrows {
    display: flex;
    gap: 6px;
  }

  .nav-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .nav-btn:hover { background: var(--surface3); color: var(--text); border-color: rgba(255,255,255,0.12); }

  .main-scroll {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 24px;
  }

  .main-scroll::-webkit-scrollbar { width: 4px; }
  .main-scroll::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }

  /* ── HOME VIEW ── */
  .home-header {
    padding: 28px 24px 4px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .home-header span {
    color: var(--accent);
  }

  .section-title {
    padding: 24px 24px 14px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.2px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
    margin-left: 8px;
  }

  .album-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
    padding: 0 24px;
  }

  .album-card {
    background: var(--surface2);
    border-radius: var(--radius);
    padding: 14px;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
    position: relative;
    border: 1px solid var(--border);
  }

  .album-card:hover {
    background: var(--surface3);
    transform: translateY(-2px);
    border-color: rgba(255,255,255,0.1);
  }

  .album-card:hover .play-btn-overlay {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .album-cover-wrap {
    position: relative;
    margin-bottom: 12px;
  }

  .album-cover-wrap img {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    object-fit: cover;
    display: block;
    background: var(--surface3);
    box-shadow: 0 6px 20px rgba(0,0,0,0.5);
  }

  .play-btn-overlay {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 44px;
    height: 44px;
    background: var(--accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #000;
    opacity: 0;
    transform: translateY(6px) scale(0.9);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 20px var(--accent-glow);
  }

  .play-btn-overlay:hover { filter: brightness(1.1); }

  .album-card-title {
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.1px;
  }

  .album-card-meta {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 3px;
    font-family: 'DM Mono', monospace;
  }

  /* ── ALBUM HERO ── */
  .album-hero {
    display: flex;
    align-items: flex-end;
    gap: 24px;
    padding: 36px 24px 24px;
    position: relative;
    overflow: hidden;
  }

  .album-hero-bg {
    position: absolute;
    inset: 0;
    background: var(--hero-color, #1a1a1a);
    opacity: 0.25;
  }

  .album-hero-bg-blur {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 0%, var(--surface) 100%);
  }

  .album-hero > * { position: relative; z-index: 1; }

  .album-hero img {
    width: 180px;
    height: 180px;
    border-radius: var(--radius);
    object-fit: cover;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    background: var(--surface3);
    flex-shrink: 0;
  }

  .album-hero-info { flex: 1; min-width: 0; }

  .album-type {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
    margin-bottom: 8px;
  }

  .album-title {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1.5px;
    line-height: 1;
    margin-bottom: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album-meta {
    font-size: 13px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
  }

  .album-meta span { color: var(--text); font-weight: 600; font-family: 'Syne', sans-serif; }

  /* ACTIONS */
  .album-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px 24px 14px;
  }

  .btn-play-all {
    width: 52px;
    height: 52px;
    background: var(--accent);
    border: none;
    border-radius: 50%;
    font-size: 20px;
    color: #000;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    flex-shrink: 0;
    box-shadow: 0 4px 20px var(--accent-glow);
  }

  .btn-play-all:hover { transform: scale(1.07); filter: brightness(1.1); }

  .btn-shuffle {
    width: 34px;
    height: 34px;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.15s;
  }

  .btn-shuffle:hover { color: var(--accent); border-color: var(--border-accent); background: var(--accent-dim); }
  .btn-shuffle.active { color: var(--accent); border-color: var(--border-accent); background: var(--accent-dim); }

  .btn-more {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Syne', sans-serif;
    letter-spacing: 0.5px;
  }

  .btn-more:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }

  /* ── SONG TABLE ── */
  .song-table { padding: 0 16px; }

  .song-table-header {
    display: grid;
    grid-template-columns: 44px 1fr 72px;
    padding: 0 12px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 10px;
    letter-spacing: 1.5px;
    font-weight: 600;
    text-transform: uppercase;
    font-family: 'DM Mono', monospace;
    margin-bottom: 6px;
  }

  .song-row {
    display: grid;
    grid-template-columns: 44px 1fr 72px;
    align-items: center;
    padding: 7px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
  }

  .song-row:hover { background: rgba(255,255,255,0.04); }
  .song-row.playing { background: var(--accent-dim); }
  .song-row.playing .song-name { color: var(--accent); }

  .song-num {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'DM Mono', monospace;
  }

  .song-row.playing .song-num { color: var(--accent); }

  .song-info {
    display: flex;
    align-items: center;
    gap: 12px;
    overflow: hidden;
  }

  .song-info img {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    object-fit: cover;
    background: var(--surface3);
    flex-shrink: 0;
  }

  .song-name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s;
  }

  .song-dur {
    font-size: 12px;
    color: var(--text-muted);
    text-align: right;
    font-family: 'DM Mono', monospace;
  }

  /* ── PLAYER BAR ── */
  .player-bar {
    height: var(--player-h);
    background: rgba(10,10,10,0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 16px;
    flex-shrink: 0;
  }

  .player-left {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 260px;
    flex-shrink: 0;
  }

  .player-cover-wrap {
    position: relative;
    flex-shrink: 0;
    cursor: pointer;
  }

  .player-cover-wrap img {
    width: 52px;
    height: 52px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--surface2);
    display: block;
  }

  .player-track-info { overflow: hidden; }

  .player-track-name {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: color 0.15s;
  }

  .player-track-name:hover { color: var(--accent); }
  .player-track-artist { font-size: 11px; color: var(--text-muted); margin-top: 2px; font-family: 'DM Mono', monospace; }

  .player-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .player-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ctrl-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: color 0.15s, background 0.15s;
  }

  .ctrl-btn:hover { color: var(--text); background: rgba(255,255,255,0.06); }
  .ctrl-btn.active { color: var(--accent); }

  .ctrl-btn-play {
    background: var(--accent);
    color: #000;
    font-size: 14px;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 0 16px var(--accent-glow);
  }

  .ctrl-btn-play:hover { transform: scale(1.1); box-shadow: 0 0 24px var(--accent-glow); }

  .progress-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 520px;
  }

  .time-label {
    font-size: 10px;
    color: var(--text-muted);
    width: 32px;
    text-align: center;
    font-family: 'DM Mono', monospace;
  }

  input[type=range] {
    -webkit-appearance: none;
    flex: 1;
    height: 3px;
    background: rgba(255,255,255,0.12);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    transition: height 0.15s;
  }

  input[type=range]:hover { height: 5px; }

  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: var(--accent);
    border-radius: 50%;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    box-shadow: 0 0 6px var(--accent-glow);
  }

  input[type=range]:hover::-webkit-slider-thumb { opacity: 1; }

  .player-right {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 160px;
    justify-content: flex-end;
  }

  .vol-icon { color: var(--text-muted); flex-shrink: 0; }
  .vol-wrap { display: flex; align-items: center; gap: 8px; }
  .vol-wrap input { width: 80px; }

  /* ── FULL PLAYER ── */
  .full-player {
    position: fixed;
    inset: 0;
    background: #050505;
    z-index: 100;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    gap: 20px;
  }

  .full-player.open { display: flex; }

  .full-player-close {
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border);
    color: var(--text-muted);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .full-player-close:hover { color: var(--text); background: rgba(255,255,255,0.1); }

  .full-cover-wrap img {
    width: min(280px, 70vw);
    height: min(280px, 70vw);
    border-radius: var(--radius);
    object-fit: cover;
    box-shadow: 0 30px 80px rgba(0,0,0,0.8);
    background: var(--surface2);
  }

  .full-track-info { text-align: center; width: 100%; max-width: 380px; }

  .full-track-name {
    font-size: 22px;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.5px;
  }

  .full-track-artist { font-size: 12px; color: var(--text-muted); margin-top: 4px; font-family: 'DM Mono', monospace; letter-spacing: 0.5px; }

  .full-progress {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .full-progress input { width: 100%; }

  .full-progress-times {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
  }

  .full-controls { display: flex; align-items: center; gap: 16px; }

  /* ── EQ BARS ── */
  .eq-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
  }

  .eq-bars span {
    width: 3px;
    background: var(--accent);
    border-radius: 1px;
    animation: eq 0.7s infinite alternate ease-in-out;
  }

  .eq-bars span:nth-child(1) { height: 6px; animation-delay: 0s; }
  .eq-bars span:nth-child(2) { height: 12px; animation-delay: 0.2s; }
  .eq-bars span:nth-child(3) { height: 9px; animation-delay: 0.1s; }

  @keyframes eq {
    from { transform: scaleY(0.25); }
    to { transform: scaleY(1); }
  }

  /* ── FADE IN ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .album-grid .album-card {
    animation: fadeUp 0.35s ease both;
  }

  .album-grid .album-card:nth-child(1) { animation-delay: 0.05s; }
  .album-grid .album-card:nth-child(2) { animation-delay: 0.1s; }
  .album-grid .album-card:nth-child(3) { animation-delay: 0.15s; }
  .album-grid .album-card:nth-child(4) { animation-delay: 0.2s; }
  .album-grid .album-card:nth-child(5) { animation-delay: 0.25s; }
  .album-grid .album-card:nth-child(6) { animation-delay: 0.3s; }

  /* ── MOBILE ── */
  @media (max-width: 768px) {
    .sidebar { display: none; }
    .album-title { font-size: 26px; }
    .album-hero img { width: 120px; height: 120px; }
    .player-left { width: 160px; }
    .player-right { display: none; }
    .album-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 0 16px; }
    .home-header { padding: 20px 16px 4px; }
    .section-title { padding: 18px 16px 10px; }
  }
</style>
</head>
<body>

<div class="app-shell">
  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark"></div>
      <div>
        <div class="logo-text">Our Escape</div>
        <div class="logo-sub">Music</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <a class="active" onclick="showHome()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 9v13h7v-7h6v7h7V9L12 2z"/></svg>
        Home
      </a>
    </nav>

    <div class="sidebar-section">Playlists</div>
    <div class="playlist-list" id="sidebar-playlists"></div>
  </div>

  <!-- MAIN -->
  <div class="main">
    <div class="main-topbar">
      <div class="nav-arrows">
        <button class="nav-btn" onclick="goBack()">&#8592;</button>
        <button class="nav-btn" onclick="showHome()">&#8593;</button>
      </div>
    </div>
    <div class="main-scroll" id="main-content"></div>
  </div>
</div>

<!-- PLAYER BAR -->
<div class="player-bar">
  <div class="player-left">
    <div class="player-cover-wrap" onclick="openFull()">
      <img id="bar-cover" src=""/>
    </div>
    <div class="player-track-info">
      <div class="player-track-name" id="bar-title" onclick="openFull()">—</div>
      <div class="player-track-artist" id="bar-artist">—</div>
    </div>
  </div>

  <div class="player-center">
    <div class="player-controls">
      <button class="ctrl-btn" id="btn-shuffle" title="Shuffle" onclick="toggleShuffle()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
      </button>
      <button class="ctrl-btn" onclick="prev()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>
      </button>
      <button class="ctrl-btn-play" id="btn-play-pause" onclick="toggle()">&#9654;</button>
      <button class="ctrl-btn" onclick="next()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>
      </button>
      <button class="ctrl-btn" id="btn-repeat" title="Repeat" onclick="toggleRepeat()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      </button>
    </div>
    <div class="progress-wrap">
      <span class="time-label" id="cur-time">0:00</span>
      <input type="range" id="seek" value="0" step="0.1"/>
      <span class="time-label" id="tot-time">0:00</span>
    </div>
  </div>

  <div class="player-right">
    <div class="vol-wrap">
      <svg class="vol-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      <input type="range" id="vol" value="100" min="0" max="100"/>
    </div>
  </div>
</div>

<!-- FULL SCREEN PLAYER -->
<div class="full-player" id="full-player">
  <button class="full-player-close" onclick="closeFull()">&#8595;</button>
  <div class="full-cover-wrap">
    <img id="full-cover" src=""/>
  </div>
  <div class="full-track-info">
    <div class="full-track-name" id="full-title">—</div>
    <div class="full-track-artist" id="full-artist">—</div>
  </div>
  <div class="full-progress">
    <input type="range" id="seek2" value="0" step="0.1"/>
    <div class="full-progress-times">
      <span id="cur-time2">0:00</span>
      <span id="tot-time2">0:00</span>
    </div>
  </div>
  <div class="full-controls">
    <button class="ctrl-btn" id="full-btn-shuffle" onclick="toggleShuffle()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
    </button>
    <button class="ctrl-btn" onclick="prev()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>
    </button>
    <button class="ctrl-btn-play" style="width:52px;height:52px;font-size:20px" onclick="toggle()">&#9654;</button>
    <button class="ctrl-btn" onclick="next()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>
    </button>
    <button class="ctrl-btn" id="full-btn-repeat" onclick="toggleRepeat()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
    </button>
  </div>
</div>

<script>
let library = {};
let queue = [];
let shuffledQueue = [];
let index = 0;
let audio = new Audio();
let isShuffled = false;
let repeatMode = 0;
let currentFolder = null;
let historyStack = [];

function fmt(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function cover(song, i) {
  if (song && song.artwork && song.artwork.includes('cloudinary')) return song.artwork;
  return 'https://picsum.photos/300?random=' + (i || 0);
}

fetch('/library').then(r => r.json()).then(data => {
  library = data;
  buildSidebar();
  showHome();
});

function buildSidebar() {
  const el = document.getElementById('sidebar-playlists');
  let html = '';
  Object.keys(library).forEach((f, i) => {
    const songs = library[f];
    html += \`
    <div class="playlist-item" id="pl-\${i}" onclick="openFolder('\${f}')">
      <img class="pl-thumb" src="\${cover(songs[0], i)}" onerror="this.src=''">
      <div class="playlist-item-info">
        <div class="playlist-item-name">\${f}</div>
        <div class="playlist-item-meta">\${songs.length} tracks</div>
      </div>
    </div>\`;
  });
  el.innerHTML = html;
}

function showHome() {
  currentFolder = null;
  historyStack = [];
  document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
  const mc = document.getElementById('main-content');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  let html = \`<div class="home-header">\${greet} <span>✦</span></div>\`;
  html += '<div class="section-title">Your Playlists</div>';
  html += '<div class="album-grid">';
  Object.keys(library).forEach((f, i) => {
    const songs = library[f];
    html += \`
    <div class="album-card" onclick="openFolder('\${f}')">
      <div class="album-cover-wrap">
        <img src="\${cover(songs[0], i)}" onerror="this.src=''">
        <div class="play-btn-overlay" onclick="event.stopPropagation();playFolder('\${f}', 0)">&#9654;</div>
      </div>
      <div class="album-card-title">\${f}</div>
      <div class="album-card-meta">\${songs.length} songs</div>
    </div>\`;
  });
  html += '</div>';
  mc.innerHTML = html;
  mc.scrollTop = 0;
}

function openFolder(folder) {
  currentFolder = folder;
  const songs = library[folder];
  Object.keys(library).forEach((f, i) => {
    const el = document.getElementById('pl-' + i);
    if (el) el.classList.toggle('active', f === folder);
  });

  const mc = document.getElementById('main-content');
  const heroImg = cover(songs[0], 0);

  let html = \`
  <div class="album-hero">
    <div class="album-hero-bg" id="album-hero-bg"></div>
    <div class="album-hero-bg-blur"></div>
    <img src="\${heroImg}" onerror="this.src=''" id="hero-img">
    <div class="album-hero-info">
      <div class="album-type">Playlist</div>
      <div class="album-title">\${folder}</div>
      <div class="album-meta"><span>Our Escape</span> &nbsp;·&nbsp; \${songs.length} songs</div>
    </div>
  </div>
  <div class="album-actions">
    <button class="btn-play-all" title="Play" onclick="playFolder('\${folder}', 0)">&#9654;</button>
    <button class="btn-shuffle" id="folder-shuffle" title="Shuffle" onclick="playFolderShuffle('\${folder}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
    </button>
    <button class="btn-more">• • •</button>
  </div>
  <div class="song-table">
    <div class="song-table-header">
      <div>#</div>
      <div>Title</div>
      <div style="text-align:right">Time</div>
    </div>\`;

  songs.forEach((s, i) => {
    const isPlaying = queue.length && queue[index] && queue[index].id === s.id && !audio.paused;
    html += \`
    <div class="song-row \${isPlaying ? 'playing' : ''}" id="song-row-\${i}" onclick="playFolder('\${folder}', \${i})">
      <div class="song-num">
        \${isPlaying
          ? '<div class="eq-bars"><span></span><span></span><span></span></div>'
          : (i + 1)
        }
      </div>
      <div class="song-info">
        <img src="\${cover(s, i)}" onerror="this.src=''">
        <div class="song-name">\${s.title}</div>
      </div>
      <div class="song-dur">\${fmt(s.duration)}</div>
    </div>\`;
  });

  html += '</div>';
  mc.innerHTML = html;
  mc.scrollTop = 0;
}

function playFolder(folder, i) {
  queue = library[folder];
  shuffledQueue = [...queue].sort(() => Math.random() - 0.5);
  isShuffled = false;
  document.getElementById('btn-shuffle').classList.remove('active');
  document.getElementById('full-btn-shuffle').classList.remove('active');
  play(i);
  if (currentFolder !== folder) openFolder(folder);
  else highlightSong(i);
}

function playFolderShuffle(folder) {
  queue = library[folder];
  shuffledQueue = [...queue].sort(() => Math.random() - 0.5);
  isShuffled = true;
  document.getElementById('btn-shuffle').classList.add('active');
  document.getElementById('full-btn-shuffle').classList.add('active');
  play(0, true);
  if (currentFolder !== folder) openFolder(folder);
}

function activeQueue() { return isShuffled ? shuffledQueue : queue; }

function play(i, fromShuffle) {
  index = i;
  const q = activeQueue();
  if (!q.length) return;
  const s = q[index];
  audio.src = s.url;
  audio.play();
  updatePlayerUI(s);
  highlightSong(i);
}

function updatePlayerUI(s) {
  const c = s.artwork && s.artwork.includes('cloudinary') ? s.artwork : '';
  document.getElementById('bar-cover').src = c;
  document.getElementById('bar-title').textContent = s.title;
  document.getElementById('bar-artist').textContent = s.artist || '—';
  document.getElementById('full-cover').src = c;
  document.getElementById('full-title').textContent = s.title;
  document.getElementById('full-artist').textContent = s.artist || '—';
  document.getElementById('btn-play-pause').innerHTML = '&#9646;&#9646;';
}

function highlightSong(activeIdx) {
  document.querySelectorAll('.song-row').forEach((el, i) => {
    el.classList.remove('playing');
    const numEl = el.querySelector('.song-num');
    if (i === activeIdx) {
      el.classList.add('playing');
      if (numEl) numEl.innerHTML = '<div class="eq-bars"><span></span><span></span><span></span></div>';
    } else {
      if (numEl) numEl.textContent = i + 1;
    }
  });
}

function toggle() {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
    document.getElementById('btn-play-pause').innerHTML = '&#9646;&#9646;';
  } else {
    audio.pause();
    document.getElementById('btn-play-pause').innerHTML = '&#9654;';
    document.querySelectorAll('.song-row.playing .song-num').forEach(el => { el.textContent = index + 1; });
  }
}

function next() {
  const q = activeQueue();
  if (!q.length) return;
  if (index < q.length - 1) play(index + 1);
  else if (repeatMode === 1) play(0);
}

function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (index > 0) play(index - 1);
}

function toggleShuffle() {
  isShuffled = !isShuffled;
  if (isShuffled) shuffledQueue = [...queue].sort(() => Math.random() - 0.5);
  ['btn-shuffle', 'full-btn-shuffle'].forEach(id => {
    document.getElementById(id).classList.toggle('active', isShuffled);
  });
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  const svgBase = (color) => \`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="\${color}" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>\`;
  const icons = [svgBase('currentColor'), svgBase('var(--accent)'), svgBase('var(--accent)')];
  ['btn-repeat','full-btn-repeat'].forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = icons[repeatMode];
    el.classList.toggle('active', repeatMode > 0);
  });
}

function goBack() {
  if (currentFolder) showHome();
}

function openFull() { document.getElementById('full-player').classList.add('open'); }
function closeFull() { document.getElementById('full-player').classList.remove('open'); }

const seek = document.getElementById('seek');
const seek2 = document.getElementById('seek2');

audio.addEventListener('timeupdate', () => {
  const cur = audio.currentTime;
  const dur = audio.duration || 0;
  seek.max = dur; seek.value = cur;
  seek2.max = dur; seek2.value = cur;
  document.getElementById('cur-time').textContent = fmt(cur);
  document.getElementById('tot-time').textContent = fmt(dur);
  document.getElementById('cur-time2').textContent = fmt(cur);
  document.getElementById('tot-time2').textContent = fmt(dur);
  const pct = dur ? (cur / dur) * 100 : 0;
  const grad = \`linear-gradient(to right, var(--accent) \${pct}%, rgba(255,255,255,0.12) \${pct}%)\`;
  seek.style.background = grad;
  seek2.style.background = grad;
});

seek.addEventListener('input', () => { audio.currentTime = seek.value; });
seek2.addEventListener('input', () => { audio.currentTime = seek2.value; });
document.getElementById('vol').addEventListener('input', e => { audio.volume = e.target.value / 100; });

audio.addEventListener('ended', () => {
  if (repeatMode === 2) { audio.currentTime = 0; audio.play(); }
  else next();
});

audio.addEventListener('play', () => { document.getElementById('btn-play-pause').innerHTML = '&#9646;&#9646;'; });
audio.addEventListener('pause', () => { document.getElementById('btn-play-pause').innerHTML = '&#9654;'; });
</script>
</body>
</html>
`);
});

// ─── START SERVER ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log("Server running on port " + PORT));
