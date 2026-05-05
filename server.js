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
                .expression(
                    'resource_type:video AND (asset_folder="Our_Escape/Fav" OR asset_folder="Our_Escape/Kuthu" OR asset_folder="Our_Escape/My Escape" OR asset_folder="Our_Escape/This Is The Weekend")'
                )
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
<link href="https://fonts.googleapis.com/css2?family=Circular+Std:wght@400;500;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --green: #1DB954;
    --green-hover: #1ed760;
    --bg: #0d0d0d;
    --sidebar-bg: #000000;
    --card-bg: #181818;
    --card-hover: #282828;
    --text: #FFFFFF;
    --text-muted: #b3b3b3;
    --player-bg: #181818;
    --border: #282828;
    --highlight: rgba(255,255,255,0.07);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
  }

  /* ── LAYOUT ── */
  .app-shell {
    display: flex;
    flex: 1;
    overflow: hidden;
    gap: 8px;
    padding: 8px 8px 0;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 240px;
    flex-shrink: 0;
    background: var(--sidebar-bg);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-logo {
    padding: 24px 20px 16px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sidebar-logo .logo-icon {
    width: 36px;
    height: 36px;
    background: var(--green);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .sidebar-nav {
    padding: 0 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sidebar-nav a {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    color: var(--text-muted);
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.15s;
    cursor: pointer;
  }

  .sidebar-nav a:hover,
  .sidebar-nav a.active {
    color: var(--text);
    background: var(--highlight);
  }

  .sidebar-nav a.active { color: var(--text); }

  .sidebar-section-title {
    padding: 20px 20px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .playlist-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 8px;
  }

  .playlist-list::-webkit-scrollbar { width: 4px; }
  .playlist-list::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }

  .playlist-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .playlist-item:hover { background: var(--highlight); }
  .playlist-item.active { background: var(--highlight); }

  .playlist-item img {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    object-fit: cover;
    background: #333;
  }

  .playlist-item-info { overflow: hidden; }
  .playlist-item-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .playlist-item-meta {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* ── MAIN ── */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border-radius: 12px;
    overflow: hidden;
  }

  .main-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: transparent;
    flex-shrink: 0;
  }

  .nav-arrows {
    display: flex;
    gap: 8px;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0,0,0,0.7);
    border: none;
    color: var(--text);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .nav-btn:hover { background: rgba(0,0,0,0.9); }

  .main-scroll {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 24px;
  }

  .main-scroll::-webkit-scrollbar { width: 6px; }
  .main-scroll::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }

  /* ── HOME VIEW ── */
  .home-header {
    padding: 24px 24px 8px;
    font-size: 26px;
    font-weight: 700;
  }

  .section-title {
    padding: 24px 24px 12px;
    font-size: 22px;
    font-weight: 700;
  }

  .album-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    padding: 0 24px;
  }

  .album-card {
    background: var(--card-bg);
    border-radius: 10px;
    padding: 16px;
    cursor: pointer;
    transition: background 0.25s;
    position: relative;
  }

  .album-card:hover { background: var(--card-hover); }

  .album-card:hover .play-btn-overlay {
    opacity: 1;
    transform: translateY(0);
  }

  .album-cover-wrap {
    position: relative;
    margin-bottom: 14px;
  }

  .album-cover-wrap img {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    object-fit: cover;
    display: block;
    background: #333;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }

  .play-btn-overlay {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 48px;
    height: 48px;
    background: var(--green);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    opacity: 0;
    transform: translateY(8px);
    transition: all 0.25s;
    box-shadow: 0 8px 16px rgba(0,0,0,0.5);
  }

  .play-btn-overlay:hover { background: var(--green-hover); transform: translateY(0) scale(1.05) !important; }

  .album-card-title {
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album-card-meta {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* ── ALBUM VIEW ── */
  .album-hero {
    display: flex;
    align-items: flex-end;
    gap: 24px;
    padding: 40px 24px 24px;
    background: linear-gradient(transparent, rgba(0,0,0,0.5));
    position: relative;
  }

  .album-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--hero-color, #333);
    opacity: 0.4;
    z-index: 0;
  }

  .album-hero > * { position: relative; z-index: 1; }

  .album-hero img {
    width: 220px;
    height: 220px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: 0 16px 48px rgba(0,0,0,0.6);
    background: #333;
    flex-shrink: 0;
  }

  .album-hero-info { flex: 1; }
  .album-type { font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .album-title { font-size: 48px; font-weight: 900; letter-spacing: -1px; line-height: 1.1; margin: 8px 0 12px; }
  .album-meta { color: var(--text-muted); font-size: 14px; }
  .album-meta span { color: var(--text); font-weight: 600; }

  .album-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px 24px 16px;
  }

  .btn-play-all {
    width: 56px;
    height: 56px;
    background: var(--green);
    border: none;
    border-radius: 50%;
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .btn-play-all:hover { background: var(--green-hover); transform: scale(1.05); }

  .btn-shuffle {
    width: 36px;
    height: 36px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
  }

  .btn-shuffle:hover, .btn-shuffle.active { color: var(--green); }

  .btn-more {
    background: none;
    border: 2px solid var(--text-muted);
    color: var(--text-muted);
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .btn-more:hover { border-color: var(--text); color: var(--text); }

  /* SONG TABLE */
  .song-table {
    padding: 0 24px;
    width: 100%;
  }

  .song-table-header {
    display: grid;
    grid-template-columns: 40px 1fr 80px;
    padding: 0 12px 8px;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 12px;
    letter-spacing: 0.5px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .song-row {
    display: grid;
    grid-template-columns: 40px 1fr 80px;
    align-items: center;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    group: true;
  }

  .song-row:hover { background: var(--highlight); }
  .song-row.playing { color: var(--green); }

  .song-num {
    font-size: 14px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .song-row.playing .song-num { color: var(--green); }

  .song-info {
    display: flex;
    align-items: center;
    gap: 12px;
    overflow: hidden;
  }

  .song-info img {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
    background: #333;
    flex-shrink: 0;
  }

  .song-name {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .song-dur {
    font-size: 13px;
    color: var(--text-muted);
    text-align: right;
  }

  /* ── PLAYER ── */
  .player-bar {
    height: 90px;
    background: var(--player-bg);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
    flex-shrink: 0;
  }

  .player-left {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 240px;
    flex-shrink: 0;
  }

  .player-left img {
    width: 56px;
    height: 56px;
    border-radius: 6px;
    object-fit: cover;
    background: #333;
    cursor: pointer;
  }

  .player-track-info { overflow: hidden; }
  .player-track-name {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .player-track-name:hover { text-decoration: underline; }
  .player-track-artist { font-size: 12px; color: var(--text-muted); }

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
    gap: 12px;
  }

  .ctrl-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: color 0.15s;
  }

  .ctrl-btn:hover { color: var(--text); }
  .ctrl-btn.active { color: var(--green); }

  .ctrl-btn-play {
    background: var(--text);
    color: #000;
    font-size: 16px;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s, background 0.15s;
  }

  .ctrl-btn-play:hover { transform: scale(1.08); background: #fff; }

  .progress-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 560px;
  }

  .time-label { font-size: 11px; color: var(--text-muted); width: 36px; text-align: center; }

  input[type=range] {
    -webkit-appearance: none;
    flex: 1;
    height: 4px;
    background: #535353;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    position: relative;
    transition: height 0.15s;
  }

  input[type=range]:hover { height: 6px; }

  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: var(--text);
    border-radius: 50%;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }

  input[type=range]:hover::-webkit-slider-thumb { opacity: 1; }

  .player-right {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 180px;
    justify-content: flex-end;
  }

  .vol-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .vol-wrap input {
    width: 80px;
  }

  /* ── FULL PLAYER MODAL ── */
  .full-player {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 100;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    gap: 24px;
  }

  .full-player.open { display: flex; }

  .full-player-close {
    position: absolute;
    top: 24px;
    left: 24px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 28px;
    cursor: pointer;
    transition: color 0.15s;
  }

  .full-player-close:hover { color: var(--text); }

  .full-cover-wrap {
    position: relative;
  }

  .full-cover-wrap img {
    width: min(300px, 70vw);
    height: min(300px, 70vw);
    border-radius: 12px;
    object-fit: cover;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7);
    background: #333;
  }

  .full-track-info {
    text-align: center;
    width: 100%;
    max-width: 400px;
  }

  .full-track-name {
    font-size: 22px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .full-track-artist { font-size: 14px; color: var(--text-muted); margin-top: 4px; }

  .full-progress {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .full-progress input {
    width: 100%;
  }

  .full-progress-times {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-muted);
  }

  .full-controls {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

  /* Eq bars animation */
  .eq-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
  }

  .eq-bars span {
    width: 3px;
    background: var(--green);
    border-radius: 1px;
    animation: eq 0.8s infinite alternate ease-in-out;
  }

  .eq-bars span:nth-child(1) { height: 6px; animation-delay: 0s; }
  .eq-bars span:nth-child(2) { height: 10px; animation-delay: 0.2s; }
  .eq-bars span:nth-child(3) { height: 14px; animation-delay: 0.1s; }

  @keyframes eq {
    from { transform: scaleY(0.3); }
    to { transform: scaleY(1); }
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .sidebar { display: none; }
    .album-title { font-size: 28px; }
    .album-hero img { width: 140px; height: 140px; }
    .player-left { width: 160px; }
    .player-right { display: none; }
    .album-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>

<div class="app-shell">
  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">🎧</div>
      Our Escape
    </div>

    <nav class="sidebar-nav">
      <a class="active" onclick="showHome()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 9v13h7v-7h6v7h7V9L12 2z"/></svg>
        Home
      </a>
    </nav>

    <div class="sidebar-section-title">Your Playlists</div>
    <div class="playlist-list" id="sidebar-playlists"></div>
  </div>

  <!-- MAIN CONTENT -->
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
    <img id="bar-cover" src="" onerror="this.src=''" onclick="openFull()"/>
    <div class="player-track-info">
      <div class="player-track-name" id="bar-title" onclick="openFull()">—</div>
      <div class="player-track-artist" id="bar-artist">—</div>
    </div>
  </div>

  <div class="player-center">
    <div class="player-controls">
      <button class="ctrl-btn" id="btn-shuffle" title="Shuffle" onclick="toggleShuffle()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
      </button>
      <button class="ctrl-btn" onclick="prev()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>
      </button>
      <button class="ctrl-btn-play" id="btn-play-pause" onclick="toggle()">&#9654;</button>
      <button class="ctrl-btn" onclick="next()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>
      </button>
      <button class="ctrl-btn" id="btn-repeat" title="Repeat" onclick="toggleRepeat()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color:var(--text-muted)"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      <input type="range" id="vol" value="100" min="0" max="100"/>
    </div>
  </div>
</div>

<!-- FULL SCREEN PLAYER -->
<div class="full-player" id="full-player">
  <button class="full-player-close" onclick="closeFull()">&#8595;</button>
  <img id="full-cover" src=""/>
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
    </button>
    <button class="ctrl-btn" onclick="prev()">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>
    </button>
    <button class="ctrl-btn-play" style="width:56px;height:56px;font-size:22px" onclick="toggle()">&#9654;</button>
    <button class="ctrl-btn" onclick="next()">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>
    </button>
    <button class="ctrl-btn" id="full-btn-repeat" onclick="toggleRepeat()">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
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
let repeatMode = 0; // 0=off, 1=all, 2=one
let currentFolder = null;
let historyStack = [];

// UTILS
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

// ── FETCH LIBRARY
fetch('/library').then(r => r.json()).then(data => {
  library = data;
  buildSidebar();
  showHome();
});

// ── SIDEBAR
function buildSidebar() {
  const el = document.getElementById('sidebar-playlists');
  let html = '';
  Object.keys(library).forEach((f, i) => {
    const songs = library[f];
    html += \`
    <div class="playlist-item" id="pl-\${i}" onclick="openFolder('\${f}')">
      <img src="\${cover(songs[0], i)}" onerror="this.src=''">
      <div class="playlist-item-info">
        <div class="playlist-item-name">\${f}</div>
        <div class="playlist-item-meta">Playlist · \${songs.length} songs</div>
      </div>
    </div>\`;
  });
  el.innerHTML = html;
}

// ── HOME
function showHome() {
  currentFolder = null;
  historyStack = [];
  document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
  const mc = document.getElementById('main-content');
  let html = '<div class="home-header">Good vibes ✨</div>';
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

// ── FOLDER / ALBUM VIEW
function openFolder(folder) {
  currentFolder = folder;
  const songs = library[folder];

  // highlight sidebar
  Object.keys(library).forEach((f, i) => {
    const el = document.getElementById('pl-' + i);
    if (el) el.classList.toggle('active', f === folder);
  });

  const mc = document.getElementById('main-content');

  const heroImg = cover(songs[0], 0);

  let html = \`
  <div class="album-hero" id="album-hero">
    <img src="\${heroImg}" onerror="this.src=''" id="hero-img">
    <div class="album-hero-info">
      <div class="album-type">Playlist</div>
      <div class="album-title">\${folder}</div>
      <div class="album-meta"><span>Our Escape</span> · \${songs.length} songs</div>
    </div>
  </div>
  <div class="album-actions">
    <button class="btn-play-all" title="Play" onclick="playFolder('\${folder}', 0)">&#9654;</button>
    <button class="btn-shuffle" id="folder-shuffle" title="Shuffle" onclick="playFolderShuffle('\${folder}')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
    </button>
    <button class="btn-more">• • •</button>
  </div>
  <div class="song-table">
    <div class="song-table-header">
      <div>#</div>
      <div>Title</div>
      <div style="text-align:right">&#9677;</div>
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

// ── PLAY
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

function activeQueue() {
  return isShuffled ? shuffledQueue : queue;
}

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

  const pp = document.getElementById('btn-play-pause');
  pp.innerHTML = '&#9646;&#9646;';
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

// ── CONTROLS
function toggle() {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
    document.getElementById('btn-play-pause').innerHTML = '&#9646;&#9646;';
  } else {
    audio.pause();
    document.getElementById('btn-play-pause').innerHTML = '&#9654;';
    document.querySelectorAll('.song-row.playing .song-num').forEach(el => {
      el.textContent = index + 1;
    });
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
  const icons = [
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--green)"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--green)"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="10" y="14" font-size="8" fill="var(--green)" stroke="none">1</text></svg>'
  ];
  ['btn-repeat','full-btn-repeat'].forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = icons[repeatMode];
    el.classList.toggle('active', repeatMode > 0);
  });
}

function goBack() {
  if (currentFolder) showHome();
}

// ── FULL PLAYER
function openFull() { document.getElementById('full-player').classList.add('open'); }
function closeFull() { document.getElementById('full-player').classList.remove('open'); }

// ── SEEK & VOLUME
const seek = document.getElementById('seek');
const seek2 = document.getElementById('seek2');

audio.addEventListener('timeupdate', () => {
  const cur = audio.currentTime;
  const dur = audio.duration || 0;

  seek.max = dur;
  seek.value = cur;
  seek2.max = dur;
  seek2.value = cur;

  document.getElementById('cur-time').textContent = fmt(cur);
  document.getElementById('tot-time').textContent = fmt(dur);
  document.getElementById('cur-time2').textContent = fmt(cur);
  document.getElementById('tot-time2').textContent = fmt(dur);

  // Update seek track fill
  const pct = dur ? (cur / dur) * 100 : 0;
  const grad = \`linear-gradient(to right, #fff \${pct}%, #535353 \${pct}%)\`;
  seek.style.background = grad;
  seek2.style.background = grad;
});

seek.addEventListener('input', () => { audio.currentTime = seek.value; });
seek2.addEventListener('input', () => { audio.currentTime = seek2.value; });

document.getElementById('vol').addEventListener('input', e => {
  audio.volume = e.target.value / 100;
});

audio.addEventListener('ended', () => {
  if (repeatMode === 2) { audio.currentTime = 0; audio.play(); }
  else next();
});

audio.addEventListener('play', () => {
  document.getElementById('btn-play-pause').innerHTML = '&#9646;&#9646;';
});

audio.addEventListener('pause', () => {
  document.getElementById('btn-play-pause').innerHTML = '&#9654;';
});
</script>

</body>
</html>
`);
});

// ─── START SERVER ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
