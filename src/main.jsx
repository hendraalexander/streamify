import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Heart,
  Home,
  Library,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Repeat2,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  User,
  Volume2,
} from "lucide-react";
import "./styles.css";

const fallbackTracks = [
  {
    id: "JGwWNGJdvx8",
    title: "Shape of You",
    artist: "Ed Sheeran",
    duration: "4:24",
    thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
  },
  {
    id: "kJQP7kiw5Fk",
    title: "Despacito",
    artist: "Luis Fonsi ft. Daddy Yankee",
    duration: "4:41",
    thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
  },
  {
    id: "OPf0YbXqDm0",
    title: "Uptown Funk",
    artist: "Mark Ronson ft. Bruno Mars",
    duration: "4:30",
    thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg",
  },
];

const shelves = [
  "Daily Mix",
  "Made For You",
  "Charts",
  "New Releases",
  "Discover",
  "Radio",
];

const SAVED_PLAYLISTS_KEY = "streamify:saved-playlists";

function formatViews(views) {
  if (!views) return "YouTube";
  if (views > 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B plays`;
  if (views > 1_000_000) return `${(views / 1_000_000).toFixed(1)}M plays`;
  if (views > 1_000) return `${Math.round(views / 1_000)}K plays`;
  return `${views} plays`;
}

function formatSeconds(value) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function thumbnailFor(track) {
  return track?.thumbnail || `https://i.ytimg.com/vi/${track?.id}/hqdefault.jpg`;
}

function handleImageError(event, track) {
  if (event.currentTarget.dataset.fallbackApplied === "true") return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = `https://i.ytimg.com/vi/${track?.id}/mqdefault.jpg`;
}

function App() {
  const [tracks, setTracks] = useState(fallbackTracks);
  const [activeTrack, setActiveTrack] = useState(fallbackTracks[0]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready to play");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(72);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [playerMessage, setPlayerMessage] = useState("Preparing player");
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  const [playlistMessage, setPlaylistMessage] = useState("Paste a public Spotify playlist link");
  const [showPlaylistImporter, setShowPlaylistImporter] = useState(false);
  const [showMobileLibrary, setShowMobileLibrary] = useState(false);
  const [playQueue, setPlayQueue] = useState(fallbackTracks);
  const [queueLabel, setQueueLabel] = useState("Home");
  const searchInputRef = useRef(null);
  const playerHostRef = useRef(null);
  const playerRef = useRef(null);
  const tracksRef = useRef(tracks);
  const queueRef = useRef(playQueue);
  const repeatRef = useRef(isRepeat);
  const shuffleRef = useRef(isShuffle);
  const activeTrackRef = useRef(activeTrack);
  const loadedVideoRef = useRef(null);
  const playbackStartedRef = useRef(false);

  const heroTrack = activeTrack || tracks[0];
  const topTracks = useMemo(() => tracks.slice(0, 6), [tracks]);
  const radioTracks = useMemo(() => tracks.slice(6, 14), [tracks]);
  const viewTitle = currentPlaylist ? currentPlaylist.title : "Good evening";
  const activeTrackIsInView = tracks.some((track) => track.id === activeTrack?.id);
  const heroIsPlaying = isPlaying && (!currentPlaylist || activeTrackIsInView);
  const queueTracks = playQueue.length ? playQueue : tracks;
  const activeQueueIndex = Math.max(0, queueTracks.findIndex((track) => track.id === activeTrack?.id));
  const upcomingQueue = queueTracks
    .filter((track) => track.id !== activeTrack?.id)
    .slice(0, 4);

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_PLAYLISTS_KEY);
    if (saved) {
      try {
        setSavedPlaylists(JSON.parse(saved));
      } catch {
        localStorage.removeItem(SAVED_PLAYLISTS_KEY);
      }
    }
    loadFeatured();
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_PLAYLISTS_KEY, JSON.stringify(savedPlaylists));
  }, [savedPlaylists]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    queueRef.current = playQueue;
  }, [playQueue]);

  useEffect(() => {
    repeatRef.current = isRepeat;
  }, [isRepeat]);

  useEffect(() => {
    shuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    activeTrackRef.current = activeTrack;
  }, [activeTrack]);

  useEffect(() => {
    const createPlayer = () => {
      if (!window.YT?.Player || !playerHostRef.current || playerRef.current) return;

      playerRef.current = new window.YT.Player(playerHostRef.current, {
        height: "120",
        width: "220",
        videoId: activeTrack?.id || fallbackTracks[0].id,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          modestbranding: 1,
          origin: window.location.origin,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            event.target
              .getIframe()
              ?.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
            event.target.setVolume(volume);
            setDuration(event.target.getDuration() || 0);
            setIsPlayerReady(true);
            setPlayerMessage("Click play to start");
          },
          onStateChange: (event) => {
            const state = window.YT?.PlayerState || {};
            setIsPlaying(event.data === state.PLAYING);
            setDuration(event.target.getDuration() || 0);
            if (event.data === state.PLAYING) setPlayerMessage("Playing from YouTube");
            if (event.data === state.PAUSED) setPlayerMessage("Paused");
            if (event.data === state.BUFFERING) setPlayerMessage("Buffering");

            if (event.data === state.ENDED) {
              if (repeatRef.current) {
                event.target.seekTo(0, true);
                event.target.playVideo();
              } else {
                setActiveTrack((previousTrack) => {
                  const list = queueRef.current.length ? queueRef.current : tracksRef.current;
                  if (!list.length) return previousTrack;
                  return getNextTrackFromList(list, previousTrack, 1, shuffleRef.current);
                });
                setShouldAutoplay(true);
              }
            }
          },
          onError: () => {
            setIsPlaying(false);
            setPlayerMessage("Track unavailable. Skipping...");
            window.setTimeout(() => {
              setActiveTrack((previousTrack) => {
                const list = queueRef.current.length ? queueRef.current : tracksRef.current;
                if (!list.length) return previousTrack;
                return getNextTrackFromList(list, previousTrack, 1, false);
              });
              setShouldAutoplay(true);
            }, 600);
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
      return;
    }

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      createPlayer();
    };

    if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isPlayerReady || !activeTrack?.id) return;

    setCurrentTime(0);
    player.setVolume(volume);

    if (shouldAutoplay) {
      setPlayerMessage("Loading track");
      if (loadedVideoRef.current !== activeTrack.id) {
        player.loadVideoById(activeTrack.id);
        loadedVideoRef.current = activeTrack.id;
      }
      player.playVideo();
    } else {
      player.cueVideoById(activeTrack.id);
      loadedVideoRef.current = activeTrack.id;
      setIsPlaying(false);
      setPlayerMessage("Click play to start");
    }
  }, [activeTrack?.id, isPlayerReady]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !isPlayerReady) return;

      setCurrentTime(player.getCurrentTime?.() || 0);
      setDuration(player.getDuration?.() || 0);
    }, 500);

    return () => window.clearInterval(timer);
  }, [isPlayerReady]);

  async function loadFeatured() {
    setLoading(true);
    try {
      const response = await fetch("/api/featured");
      const data = await response.json();
      if (data.tracks?.length) {
        setTracks(data.tracks);
        setCurrentPlaylist(null);
        setShowMobileLibrary(false);
        if (!playbackStartedRef.current) {
          setActiveTrack(data.tracks[0]);
          setPlayQueue(data.tracks);
          setQueueLabel("Home");
        }
        setStatus("Fresh picks from YouTube");
      }
    } catch {
      setStatus("Using offline demo tracks");
    } finally {
      setLoading(false);
    }
  }

  async function searchTracks(event) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return loadFeatured();

    setLoading(true);
    setStatus(`Searching "${term}"`);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const data = await response.json();
      if (data.tracks?.length) {
        setTracks(data.tracks);
        setCurrentPlaylist(null);
        setShowMobileLibrary(false);
        if (!playbackStartedRef.current) {
          setActiveTrack(data.tracks[0]);
          setPlayQueue(data.tracks);
          setQueueLabel(`Search: ${term}`);
        }
        setStatus(`${data.tracks.length} results from YouTube`);
      } else {
        setStatus("No tracks found");
      }
    } catch {
      setStatus("Search failed. Check the local API server.");
    } finally {
      setLoading(false);
    }
  }

  async function importSpotifyPlaylist(event) {
    event.preventDefault();
    const url = playlistUrl.trim();
    if (!url) return;

    setImportingPlaylist(true);
    setPlaylistMessage("Reading Spotify playlist...");

    try {
      const response = await fetch("/api/import-spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();

      if (!response.ok) {
        setPlaylistMessage(data.error || "Could not import playlist");
        return;
      }

      const playlist = {
        ...data.playlist,
        savedAt: Date.now(),
      };

      if (!playlist.tracks?.length) {
        setPlaylistMessage("Spotify was read, but no YouTube matches were found.");
        return;
      }

      setSavedPlaylists((existing) => [
        playlist,
        ...existing.filter((item) => item.id !== playlist.id),
      ]);
      setTracks(playlist.tracks);
      setCurrentPlaylist(playlist);
      setShowMobileLibrary(false);
      if (!playbackStartedRef.current) {
        setActiveTrack(playlist.tracks[0]);
        setPlayQueue(playlist.tracks);
        setQueueLabel(playlist.title);
      }
      setStatus(`${playlist.tracks.length}/${playlist.totalSpotifyTracks || playlist.tracks.length} songs imported from ${playlist.title}`);
      setPlaylistMessage(`Saved ${playlist.tracks.length} songs`);
      setPlaylistUrl("");
      setShowPlaylistImporter(false);
    } catch {
      setPlaylistMessage("Import failed. Check the server and try again.");
    } finally {
      setImportingPlaylist(false);
    }
  }

  function openSavedPlaylist(playlist) {
    if (!playlist.tracks?.length) return;
    setTracks(playlist.tracks);
    setCurrentPlaylist(playlist);
    setShowMobileLibrary(false);
    setStatus(`${playlist.tracks.length} songs from ${playlist.title}`);
  }

  function deleteSavedPlaylist(playlistId) {
    setSavedPlaylists((existing) => existing.filter((playlist) => playlist.id !== playlistId));
  }

  function startTrack(track, queue = null, sourceLabel = null) {
    playbackStartedRef.current = true;
    if (queue?.length) {
      setPlayQueue(queue);
      queueRef.current = queue;
    }
    if (sourceLabel) setQueueLabel(sourceLabel);
    setActiveTrack(track);
    setShouldAutoplay(true);
    setPlayerMessage("Loading track");
    if (isPlayerReady && playerRef.current) {
      playerRef.current.setVolume(volume);
      if (loadedVideoRef.current !== track.id) {
        playerRef.current.loadVideoById(track.id);
        loadedVideoRef.current = track.id;
      }
      playerRef.current.playVideo();
    }
  }

  function playTrack(track) {
    startTrack(track, tracks, currentPlaylist?.title || "Home");
  }

  function togglePlayback() {
    if (!isPlayerReady) return;

    if (isPlaying) {
      playerRef.current?.pauseVideo();
      setPlayerMessage("Paused");
    } else {
      playbackStartedRef.current = true;
      setShouldAutoplay(true);
      setPlayerMessage("Loading track");
      if (activeTrack?.id && loadedVideoRef.current !== activeTrack.id) {
        playerRef.current?.loadVideoById(activeTrack.id);
        loadedVideoRef.current = activeTrack.id;
      }
      playerRef.current?.playVideo();
    }
  }

  function playAdjacentTrack(offset) {
    const queue = queueRef.current.length ? queueRef.current : tracks;
    if (!queue.length) return;
    startTrack(getNextTrackFromList(queue, activeTrack, offset, offset > 0 && isShuffle));
  }

  function toggleShuffle() {
    setIsShuffle((value) => !value);
  }

  function playPlaylistFromStart() {
    if (!tracks.length) return;
    startTrack(
      isShuffle ? getNextTrackFromList(tracks, activeTrack, 1, true) : tracks[0],
      tracks,
      currentPlaylist?.title || "Home"
    );
  }

  function playRandomTrack() {
    if (tracks.length < 2) return;
    const choices = tracks.filter((track) => track.id !== activeTrack?.id);
    startTrack(choices[Math.floor(Math.random() * choices.length)], tracks, currentPlaylist?.title || "Home");
  }

  function seekTo(event) {
    const value = Number(event.target.value);
    setCurrentTime(value);
    playerRef.current?.seekTo(value, true);
  }

  function updateVolume(event) {
    const value = Number(event.target.value);
    setVolume(value);
    playerRef.current?.setVolume(value);
  }

  function focusSearch() {
    setShowMobileLibrary(false);
    searchInputRef.current?.focus();
  }

  function togglePlaylistHeroPlayback() {
    if (currentPlaylist && isPlaying && activeTrackIsInView) {
      togglePlayback();
      return;
    }

    currentPlaylist ? playPlaylistFromStart() : playTrack(heroTrack);
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <span>Streamify</span>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          <button className="nav-item active" onClick={loadFeatured}><Home size={21} /> Home</button>
          <button className="nav-item" onClick={focusSearch}><Search size={21} /> Search</button>
          <button className="nav-item" onClick={() => setShowMobileLibrary((value) => !value)}><Library size={21} /> Your Library</button>
        </nav>

        <div className="playlist-actions">
          <button className="soft-button" onClick={() => setShowPlaylistImporter((value) => !value)}>
            <span><Plus size={16} /></span> Create Playlist
          </button>
          <button className="soft-button liked"><Heart size={18} /> Liked Songs</button>
        </div>

        <div className="library-list">
          {savedPlaylists.map((playlist) => (
            <div className="saved-playlist" key={playlist.id}>
              <button onClick={() => openSavedPlaylist(playlist)}>
                {playlist.image ? <img src={playlist.image} alt="" /> : <Library size={18} />}
                <span>{playlist.title}</span>
              </button>
              <button aria-label={`Delete ${playlist.title}`} onClick={() => deleteSavedPlaylist(playlist.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!savedPlaylists.length && shelves.map((shelf) => (
            <button key={shelf}>{shelf}</button>
          ))}
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="history">
            <button aria-label="Back"><ChevronLeft size={22} /></button>
            <button aria-label="Forward"><ChevronRight size={22} /></button>
          </div>
          <form className="search-box" onSubmit={searchTracks}>
            <Search size={19} />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What do you want to listen to?"
              aria-label="Search songs"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              name="streamify-search"
            />
          </form>
          <div className="profile">
            <button aria-label="Notifications"><Bell size={18} /></button>
            <button aria-label="Profile"><User size={18} /></button>
          </div>
        </header>

        <section className={currentPlaylist ? "hero playlist-hero" : "hero"}>
          <img src={currentPlaylist?.image || thumbnailFor(heroTrack)} alt="" onError={(event) => handleImageError(event, heroTrack)} />
          <div className="hero-copy">
            <span className="eyebrow">{currentPlaylist ? "Public playlist" : "YouTube stream"}</span>
            <h1>{currentPlaylist?.title || heroTrack.title}</h1>
            <p>
              {currentPlaylist ? (
                <><strong>Spotify import</strong> • {tracks.length} songs</>
              ) : (
                <><strong>{heroTrack.artist}</strong> • {formatViews(heroTrack.views)}</>
              )}
            </p>
            <div className="hero-actions">
              <button
                className="play-primary"
                onClick={togglePlaylistHeroPlayback}
                disabled={!isPlayerReady}
              >
                {heroIsPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} />}
                {heroIsPlaying ? "Pause" : "Play"}
              </button>
              <button className="circle-button" aria-label="More options"><MoreHorizontal size={24} /></button>
            </div>
          </div>
        </section>

        {showPlaylistImporter && (
          <section className="playlist-importer">
            <div>
              <h2>Add Spotify Playlist</h2>
              <p>{playlistMessage}</p>
            </div>
            <form onSubmit={importSpotifyPlaylist}>
              <input
                value={playlistUrl}
                onChange={(event) => setPlaylistUrl(event.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
                aria-label="Spotify playlist link"
                autoComplete="off"
              />
              <button disabled={importingPlaylist}>{importingPlaylist ? "Importing" : "Save Playlist"}</button>
            </form>
          </section>
        )}

        {showMobileLibrary && (
          <section className="mobile-library-sheet">
            <div className="section-heading compact">
              <h2>Your Library</h2>
              <button onClick={() => setShowPlaylistImporter((value) => !value)}>Add</button>
            </div>
            <div className="mobile-library-list">
              {savedPlaylists.map((playlist) => (
                <button key={playlist.id} onClick={() => openSavedPlaylist(playlist)}>
                    {playlist.image ? <img src={playlist.image} alt="" /> : <Library size={20} />}
                  <span>
                    <strong>{playlist.title}</strong>
                    <small>{playlist.tracks.length} songs</small>
                  </span>
                </button>
              ))}
              {!savedPlaylists.length && <p>No saved playlist yet</p>}
            </div>
          </section>
        )}

        <div className="section-heading">
          <h2>{viewTitle}</h2>
          <span>{loading ? "Loading..." : status}</span>
        </div>

        {currentPlaylist ? (
          <section className="playlist-table" aria-label={`${currentPlaylist.title} songs`}>
            <div className="playlist-table-head">
              <span>#</span>
              <span>Title</span>
              <span>Album</span>
              <span>Time</span>
            </div>
            {tracks.map((track, index) => (
              <button
                className={track.id === activeTrack?.id ? "playlist-row active" : "playlist-row"}
                key={`${track.spotifyId || track.id}-${index}`}
                onClick={() => playTrack(track)}
              >
                <span className="track-number">{index + 1}</span>
                <span className="playlist-title-cell">
                  <img src={thumbnailFor(track)} alt="" onError={(event) => handleImageError(event, track)} />
                  <span>
                    <strong>{track.spotifyTitle || track.title}</strong>
                    <small>{track.spotifyArtist || track.artist}</small>
                  </span>
                </span>
                <span>{currentPlaylist.title}</span>
                <span>{track.duration || "0:00"}</span>
              </button>
            ))}
          </section>
        ) : (
          <>
            <section className="quick-grid">
              {topTracks.map((track) => (
                <button
                  className={track.id === activeTrack?.id ? "quick-card playing" : "quick-card"}
                  key={track.id}
                  onClick={() => playTrack(track)}
                >
                  <img src={thumbnailFor(track)} alt="" onError={(event) => handleImageError(event, track)} />
                  <span>{track.title}</span>
                  <Play className="quick-play" fill="currentColor" size={18} />
                </button>
              ))}
            </section>

            <div className="section-heading second">
              <h2>Popular on YouTube</h2>
              <button onClick={loadFeatured}>Show all</button>
            </div>

            <section className="track-row">
              {(radioTracks.length ? radioTracks : tracks).map((track) => (
                <article className="track-card" key={track.id}>
                  <button className="cover-button" onClick={() => playTrack(track)}>
                    <img src={thumbnailFor(track)} alt="" onError={(event) => handleImageError(event, track)} />
                    <span><Play fill="currentColor" size={22} /></span>
                  </button>
                  <h3>{track.title}</h3>
                  <p>{track.artist}</p>
                </article>
              ))}
            </section>
          </>
        )}
      </section>

      <aside className="player-panel">
        <div className="player-heading">
          <ListMusic size={20} />
          <span>Now Playing</span>
        </div>
        <img className="now-cover" src={thumbnailFor(activeTrack)} alt="" onError={(event) => handleImageError(event, activeTrack)} />
        <div className="now-title">
          <div>
            <h2>{activeTrack?.spotifyTitle || activeTrack?.title}</h2>
            <p>{activeTrack?.spotifyArtist || activeTrack?.artist}</p>
          </div>
          <button aria-label="Save track"><Heart size={19} /></button>
        </div>
        <div className="audio-only-card">
          <div className="audio-bars" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p>{playerMessage}</p>
        </div>
        <div className="controls">
          <button className={isShuffle ? "enabled" : ""} aria-label="Shuffle" onClick={toggleShuffle}><Shuffle size={18} /></button>
          <button aria-label="Previous" onClick={() => playAdjacentTrack(-1)}><SkipBack size={20} /></button>
          <button className="big-control" aria-label={isPlaying ? "Pause current track" : "Play current track"} onClick={togglePlayback} disabled={!isPlayerReady}>
            {isPlaying ? <Pause fill="currentColor" size={22} /> : <Play fill="currentColor" size={22} />}
          </button>
          <button aria-label="Next" onClick={() => playAdjacentTrack(1)}><SkipForward size={20} /></button>
          <button className={isRepeat ? "enabled" : ""} aria-label="Repeat" onClick={() => setIsRepeat((value) => !value)}><Repeat2 size={18} /></button>
        </div>
        <div className="progress">
          <span>{formatSeconds(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={Math.max(1, Math.floor(duration))}
            value={Math.min(Math.floor(currentTime), Math.max(1, Math.floor(duration)))}
            onChange={seekTo}
            aria-label="Seek"
          />
          <span>{duration ? formatSeconds(duration) : activeTrack?.duration || "0:00"}</span>
        </div>
        <div className="volume">
          <Volume2 size={18} />
          <input type="range" min="0" max="100" value={volume} onChange={updateVolume} aria-label="Volume" />
        </div>
        <div className="queue-card" aria-label="Play queue">
          <div className="queue-heading">
            <span>Next in queue</span>
            <small>{queueLabel} • {activeQueueIndex + 1}/{queueTracks.length}</small>
          </div>
          {upcomingQueue.length ? (
            upcomingQueue.map((track) => (
              <button key={`${track.spotifyId || track.id}-queue`} onClick={() => startTrack(track)}>
                <img src={thumbnailFor(track)} alt="" onError={(event) => handleImageError(event, track)} />
                <span>
                  <strong>{track.spotifyTitle || track.title}</strong>
                  <small>{track.spotifyArtist || track.artist}</small>
                </span>
              </button>
            ))
          ) : (
            <p>No more songs in this queue</p>
          )}
        </div>
      </aside>
      <footer className="mobile-player">
        <button className="mobile-now" onClick={togglePlayback} disabled={!isPlayerReady}>
          <img src={thumbnailFor(activeTrack)} alt="" onError={(event) => handleImageError(event, activeTrack)} />
          <span>
            <strong>{activeTrack?.spotifyTitle || activeTrack?.title}</strong>
            <small>{activeTrack?.spotifyArtist || activeTrack?.artist}</small>
          </span>
        </button>
        <div className="mobile-controls">
          <button className={isShuffle ? "mobile-icon enabled" : "mobile-icon"} aria-label="Shuffle" onClick={toggleShuffle}>
            <Shuffle size={18} />
          </button>
          <button className="mobile-icon" aria-label="Previous" onClick={() => playAdjacentTrack(-1)}>
            <SkipBack size={20} />
          </button>
          <button className="mobile-icon mobile-play" aria-label={isPlaying ? "Pause current track" : "Play current track"} onClick={togglePlayback} disabled={!isPlayerReady}>
            {isPlaying ? <Pause fill="currentColor" size={21} /> : <Play fill="currentColor" size={21} />}
          </button>
          <button className="mobile-icon" aria-label="Next" onClick={() => playAdjacentTrack(1)}>
            <SkipForward size={20} />
          </button>
          <button className={isRepeat ? "mobile-icon enabled" : "mobile-icon"} aria-label="Repeat" onClick={() => setIsRepeat((value) => !value)}>
            <Repeat2 size={18} />
          </button>
        </div>
        <input
          className="mobile-progress"
          type="range"
          min="0"
          max={Math.max(1, Math.floor(duration))}
          value={Math.min(Math.floor(currentTime), Math.max(1, Math.floor(duration)))}
          onChange={seekTo}
          aria-label="Mobile seek"
        />
      </footer>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button onClick={loadFeatured}><Home size={21} />Home</button>
        <button onClick={focusSearch}><Search size={21} />Search</button>
        <button onClick={() => setShowMobileLibrary((value) => !value)}><Library size={21} />Library</button>
      </nav>
      <div className="global-youtube-engine" ref={playerHostRef} />
    </main>
  );
}

function getNextTrackFromList(list, activeTrack, offset, shuffle) {
  if (!list.length) return activeTrack;
  if (shuffle && list.length > 1) {
    const choices = list.filter((track) => track.id !== activeTrack?.id);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  const activeIndex = Math.max(0, list.findIndex((track) => track.id === activeTrack?.id));
  return list[(activeIndex + offset + list.length) % list.length];
}

const rootElement = document.getElementById("root");
const root = window.__streamifyRoot || createRoot(rootElement);
window.__streamifyRoot = root;
root.render(<App />);
