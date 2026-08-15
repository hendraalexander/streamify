import express from "express";
import cors from "cors";

const app = express();

const featuredQueries = [
  "top global hits music",
  "indonesia top hits official music",
  "lofi chill playlist",
  "pop hits 2026 music",
];

app.use(cors());
app.use(express.json());

const textFromRuns = (node) => {
  if (!node) return "";
  if (typeof node.simpleText === "string") return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((run) => run.text || "").join("");
  return "";
};

const parseViews = (label) => {
  const normalized = label.toLowerCase().replace(/,/g, "");
  const number = Number.parseFloat(normalized);
  if (Number.isNaN(number)) return 0;
  if (normalized.includes("b")) return Math.round(number * 1_000_000_000);
  if (normalized.includes("m")) return Math.round(number * 1_000_000);
  if (normalized.includes("k")) return Math.round(number * 1_000);
  return Math.round(number);
};

const extractInitialData = (html) => {
  const marker = "ytInitialData";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = html.indexOf("{", markerIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return JSON.parse(html.slice(start, index + 1));
    }
  }

  return null;
};

const collectVideos = (node, videos = []) => {
  if (!node || typeof node !== "object") return videos;

  if (node.videoRenderer?.videoId) {
    const item = node.videoRenderer;
    const thumbnail = item.thumbnail?.thumbnails?.at(-1)?.url || "";
    const artist = textFromRuns(item.ownerText) || textFromRuns(item.longBylineText) || "YouTube";
    const viewsLabel = textFromRuns(item.viewCountText);

    videos.push({
      id: item.videoId,
      title: textFromRuns(item.title) || "Untitled video",
      artist,
      duration: textFromRuns(item.lengthText) || "LIVE",
      views: parseViews(viewsLabel),
      thumbnail,
      url: `https://youtube.com/watch?v=${item.videoId}`,
    });
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach((child) => collectVideos(child, videos));
    } else if (value && typeof value === "object") {
      collectVideos(value, videos);
    }
  }

  return videos;
};

const searchYouTube = async (query, limit = 18) => {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`YouTube responded with ${response.status}`);
  }

  const html = await response.text();
  const initialData = extractInitialData(html);
  if (!initialData) return [];

  const seen = new Set();
  return collectVideos(initialData)
    .filter((track) => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return track.thumbnail;
    })
    .slice(0, limit);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const searchYouTubeWithRetry = async (query, limit = 1, attempts = 2) => {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await searchYouTube(query, limit);
    } catch (error) {
      lastError = error;
      await delay(250 * (attempt + 1));
    }
  }

  throw lastError;
};

const decodeHtml = (value = "") =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const stripTags = (value = "") => decodeHtml(value.replace(/<[^>]*>/g, " "));

const extractMeta = (html, property) => {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"));
  return match ? decodeHtml(match[1]) : "";
};

const extractSpotifyPlaylistId = (url) => {
  const match = String(url).match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
  return match?.[1] || "";
};

const extractSpotifyTracks = (html) => {
  const rows = html.match(/<a[^>]+href="\/track\/[^"]+"[\s\S]*?(?=<a[^>]+href="\/track\/|<\/main>|<\/body>)/g) || [];
  const seen = new Set();

  return rows
    .map((row) => {
      const id = row.match(/href="\/track\/([^"?]+)"/)?.[1] || "";
      const title =
        row.match(/data-encore-id="listRowTitle"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ||
        row.match(/aria-label="([^"]+)"/)?.[1] ||
        "";
      const artists = [...row.matchAll(/data-testid="internal-artist-link"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g)]
        .map((match) => stripTags(match[1]))
        .filter(Boolean);

      return {
        id,
        title: stripTags(title),
        artist: artists.join(", "),
      };
    })
    .filter((track) => {
      if (!track.id || !track.title || seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
};

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
};

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const tracks = await searchYouTube(`${q} official audio music`);
    res.json({ query: q, tracks });
  } catch (error) {
    res.status(500).json({ error: "Failed to search YouTube", details: error.message });
  }
});

app.get("/api/featured", async (_req, res) => {
  try {
    const batches = await Promise.allSettled(featuredQueries.map((query) => searchYouTube(query, 5)));

    const seen = new Set();
    const tracks = batches
      .flatMap((batch) => (batch.status === "fulfilled" ? batch.value : []))
      .filter((track) => {
        if (seen.has(track.id)) return false;
        seen.add(track.id);
        return true;
      })
      .slice(0, 16);

    if (!tracks.length) {
      throw new Error("No featured tracks were returned");
    }

    res.json({ tracks });
  } catch (error) {
    res.status(500).json({ error: "Failed to load featured tracks", details: error.message });
  }
});

app.post("/api/import-spotify", async (req, res) => {
  const url = String(req.body?.url || "").trim();
  const playlistId = extractSpotifyPlaylistId(url);

  if (!playlistId) {
    return res.status(400).json({ error: "Paste a valid Spotify playlist link" });
  }

  const spotifyUrl = `https://open.spotify.com/playlist/${playlistId}`;

  try {
    const response = await fetch(spotifyUrl, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify responded with ${response.status}`);
    }

    const html = await response.text();
    const spotifyTracks = extractSpotifyTracks(html);
    const title = extractMeta(html, "og:title") || "Imported Spotify Playlist";
    const description = extractMeta(html, "og:description");
    const image = extractMeta(html, "og:image");

    if (!spotifyTracks.length) {
      return res.status(422).json({
        error: "Could not read tracks from this Spotify playlist. Make sure the playlist is public.",
        playlist: { id: playlistId, title, description, image, spotifyUrl, tracks: [] },
      });
    }

    const matchedTracks = await mapWithConcurrency(spotifyTracks, 4, async (track) => {
      try {
        const [match] = await searchYouTubeWithRetry(`${track.title} ${track.artist} official audio`, 1);
        if (!match) return null;

        return {
          ...match,
          spotifyId: track.id,
          spotifyTitle: track.title,
          spotifyArtist: track.artist,
        };
      } catch {
        return null;
      }
    });

    const tracks = matchedTracks.filter(Boolean);

    res.json({
      playlist: {
        id: playlistId,
        title,
        description,
        image,
        spotifyUrl,
        totalSpotifyTracks: spotifyTracks.length,
        tracks,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to import Spotify playlist", details: error.message });
  }
});

export default app;
