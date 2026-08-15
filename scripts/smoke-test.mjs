import { chromium } from "playwright";

const appUrl = "http://127.0.0.1:5173/";

const samplePlaylist = {
  id: "smoke-playlist",
  title: "Smoke Test Playlist",
  image: "https://i.scdn.co/image/ab67706f00000002ca5a7517156021292e5663a6",
  totalSpotifyTracks: 3,
  tracks: [
    {
      id: "jfKfPfyJRdk",
      title: "lofi hip hop radio",
      artist: "Lofi Girl",
      spotifyId: "one",
      spotifyTitle: "Smoke One",
      spotifyArtist: "Artist One",
      duration: "3:10",
      thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault_live.jpg",
    },
    {
      id: "DWcJFNfaw9c",
      title: "Top Hits Pop Music Playlist",
      artist: "YouTube Mix",
      spotifyId: "two",
      spotifyTitle: "Smoke Two",
      spotifyArtist: "Artist Two",
      duration: "3:20",
      thumbnail: "https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg",
    },
    {
      id: "5qap5aO4i9A",
      title: "Chillhop Radio",
      artist: "ChilledCow",
      spotifyId: "three",
      spotifyTitle: "Smoke Three",
      spotifyArtist: "Artist Three",
      duration: "3:30",
      thumbnail: "https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg",
    },
  ],
};

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function seedPlaylist(page) {
  await page.addInitScript((playlist) => {
    localStorage.setItem("streamify:saved-playlists", JSON.stringify([playlist]));

    window.YT = {
      PlayerState: {
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
      },
      Player: class MockPlayer {
        constructor(_element, config) {
          this.config = config;
          this.videoId = config.videoId;
          this.volume = 72;
          this.currentTime = 0;
          this.duration = 244;
          this.calls = { cue: 0, load: 0, play: 0, pause: 0, seek: 0 };
          window.__mockPlayer = this;
          setTimeout(() => config.events?.onReady?.({ target: this }), 0);
        }

        getIframe() {
          return { setAttribute() {} };
        }

        setVolume(value) {
          this.volume = value;
        }

        getDuration() {
          return this.duration;
        }

        getCurrentTime() {
          return this.currentTime;
        }

        getVideoData() {
          return { video_id: this.videoId };
        }

        cueVideoById(videoId) {
          this.videoId = videoId;
          this.currentTime = 0;
          this.calls.cue += 1;
        }

        loadVideoById(videoId) {
          this.videoId = videoId;
          this.currentTime = 0;
          this.calls.load += 1;
        }

        playVideo() {
          this.calls.play += 1;
          this.config.events?.onStateChange?.({ target: this, data: window.YT.PlayerState.PLAYING });
        }

        pauseVideo() {
          this.calls.pause += 1;
          this.config.events?.onStateChange?.({ target: this, data: window.YT.PlayerState.PAUSED });
        }

        seekTo(value) {
          this.currentTime = value;
          this.calls.seek += 1;
        }
      },
    };
  }, samplePlaylist);
}

async function runDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  await seedPlaylist(page);
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".quick-card", { timeout: 20000 });

  expect(await page.locator(".player-panel").isVisible(), "Desktop player panel should be visible");
  expect(await page.locator(".mobile-player").isHidden(), "Mobile player should be hidden on desktop");
  expect((await page.locator(".audio-only-card p").textContent()) !== "Playing from YouTube", "App should not autoplay on first load");

  await page.getByRole("button", { name: "Smoke Test Playlist", exact: true }).click();
  await page.waitForSelector(".playlist-row", { timeout: 10000 });
  expect(await page.locator(".playlist-row").count() === 3, "Saved playlist should render 3 rows");

  const beforePlayTitle = await page.locator(".now-title h2").textContent();
  await page.locator(".playlist-row").nth(0).click();
  await page.waitForTimeout(500);
  const afterPlayTitle = await page.locator(".now-title h2").textContent();
  expect(afterPlayTitle?.includes("Smoke One"), "Clicking playlist row should select first playlist track");

  await page.locator(".sidebar .nav-item").first().click();
  await page.waitForSelector(".quick-card", { timeout: 10000 });
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(500);
  const afterQueueNextTitle = await page.locator(".now-title h2").textContent();
  expect(afterQueueNextTitle?.includes("Smoke Two"), "Next should continue the playlist queue after navigating back Home");

  const loadCountAfterQueueNext = await page.evaluate(() => window.__mockPlayer.calls.load);
  await page.locator(".big-control").click();
  await page.waitForTimeout(100);
  await page.locator(".big-control").click();
  await page.waitForTimeout(100);
  const loadCountAfterResume = await page.evaluate(() => window.__mockPlayer.calls.load);
  expect(loadCountAfterResume === loadCountAfterQueueNext, "Resume after pause should not reload the track from the beginning");

  await page.getByRole("button", { name: "Shuffle" }).click();
  const afterShuffleTitle = await page.locator(".now-title h2").textContent();
  expect(afterShuffleTitle === afterQueueNextTitle, "Shuffle toggle should not immediately change current track");

  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(500);
  const afterNextTitle = await page.locator(".now-title h2").textContent();
  expect(afterNextTitle !== beforePlayTitle, "Next should keep a valid now-playing title");

  await page.getByRole("button", { name: "Search" }).click();
  expect(await page.locator(".search-box input").evaluate((el) => document.activeElement === el), "Desktop search button should focus search input");

  await page.close();
}

async function runMobile(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await seedPlaylist(page);
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mobile-player", { timeout: 20000 });

  expect(await page.locator(".sidebar").isHidden(), "Sidebar should be hidden on mobile");
  expect(await page.locator(".mobile-player").isVisible(), "Mobile mini player should be visible");
  expect(await page.locator(".mobile-nav").isVisible(), "Mobile bottom nav should be visible");
  expect(await page.locator(".player-panel").isHidden(), "Desktop player panel should be hidden on mobile");
  expect(await page.locator(".mobile-controls .mobile-icon").count() === 5, "Mobile player should expose shuffle, previous, play, next, and repeat");
  expect(await page.locator(".mobile-progress").isVisible(), "Mobile player should expose a progress slider");

  await page.locator(".mobile-nav").getByRole("button", { name: /Library/i }).click();
  await page.waitForSelector(".mobile-library-sheet", { timeout: 10000 });
  expect(await page.getByRole("button", { name: /Smoke Test Playlist/i }).isVisible(), "Mobile library should show saved playlist");

  await page.getByRole("button", { name: /Smoke Test Playlist/i }).click();
  await page.waitForSelector(".playlist-row", { timeout: 10000 });
  expect(await page.locator(".playlist-row").count() === 3, "Mobile playlist rows should render");

  await page.locator(".mobile-nav").getByRole("button", { name: /Search/i }).click();
  expect(await page.locator(".search-box input").evaluate((el) => document.activeElement === el), "Mobile search should focus search input");

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(!horizontalOverflow, "Mobile layout should not horizontally overflow");

  await page.close();
}

async function runApiChecks() {
  const searchResponse = await fetch("http://127.0.0.1:4177/api/search?q=dekat%20di%20hati");
  expect(searchResponse.ok, "Search API should respond OK");
  const searchJson = await searchResponse.json();
  expect(searchJson.tracks?.length > 0, "Search API should return tracks");

  const invalidImport = await fetch("http://127.0.0.1:4177/api/import-spotify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "not-a-spotify-link" }),
  });
  expect(invalidImport.status === 400, "Invalid Spotify links should return 400");
}

async function main() {
  await runApiChecks();
  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktop(browser);
    await runMobile(browser);
  } finally {
    await browser.close();
  }

  console.log("Smoke tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
