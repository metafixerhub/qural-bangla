import { SURAHS } from './surahs.js';

// Bengali numerals helper
const BANGLA_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export function toBanglaNumber(num) {
  if (num === null || num === undefined) return '';
  return num.toString().split('').map(d => BANGLA_NUMERALS[parseInt(d)] !== undefined ? BANGLA_NUMERALS[parseInt(d)] : d).join('');
}

// Format seconds into MM:SS
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '০০:০০';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const mStr = m < 10 ? '0' + m : '' + m;
  const sStr = s < 10 ? '0' + s : '' + s;
  return `${toBanglaNumber(mStr)}:${toBanglaNumber(sStr)}`;
}

class QuranApp {
  constructor() {
    this.surahs = SURAHS;
    this.currentIndex = -1;
    this.isPlaying = false;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.repeatMode = 'all'; // 'off' | 'one' | 'all'
    this.playbackRate = 1.0;
    this.favorites = new Set(JSON.parse(localStorage.getItem('quran_favorites') || '[]'));
    
    this.readingSurah = null;
    this.savedSession = null;
    this.lastSavedTime = 0;
    this.fontScale = parseFloat(localStorage.getItem('quran_font_scale') || '1.0');
    
    this.initElements();
    this.initFontScale();
    this.initAudioEvents();
    this.initDomEvents();
    this.initMobileNavEvents();
    this.initNetworkStatus();
    this.initPlaybackSession();
    this.renderSurahList();
  }

  initElements() {
    this.surahsContainer = document.getElementById('surahsContainer');
    this.searchInput = document.getElementById('searchInput');
    this.filterButtons = document.querySelectorAll('.filter-btn');
    this.networkStatusBadge = document.getElementById('networkStatusBadge');

    // Resume Session Banner
    this.resumeSessionBanner = document.getElementById('resumeSessionBanner');
    this.resumeSurahName = document.getElementById('resumeSurahName');
    this.resumeTimeInfo = document.getElementById('resumeTimeInfo');
    this.resumeProgressBar = document.getElementById('resumeProgressBar');
    this.btnResumePlay = document.getElementById('btnResumePlay');
    this.btnResumeDismiss = document.getElementById('btnResumeDismiss');

    // Mini player
    this.miniPlayerBar = document.getElementById('miniPlayerBar');
    this.miniProgressBar = document.getElementById('miniProgressBar');
    this.miniPlayerProgressTrack = document.getElementById('miniPlayerProgressTrack');
    this.miniSurahInfo = document.getElementById('miniSurahInfo');
    this.miniAvatar = document.getElementById('miniAvatar');
    this.miniTitle = document.getElementById('miniTitle');
    this.miniTimeDisplay = document.getElementById('miniTimeDisplay');
    this.miniArtist = document.getElementById('miniArtist');
    this.miniBtnPlay = document.getElementById('miniBtnPlay');
    this.miniBtnPrev = document.getElementById('miniBtnPrev');
    this.miniBtnNext = document.getElementById('miniBtnNext');

    // Full Player Modal
    this.playerModal = document.getElementById('playerModal');
    this.btnClosePlayer = document.getElementById('btnClosePlayer');
    this.medallionContainer = document.getElementById('medallionContainer');
    this.medallionNumber = document.getElementById('medallionNumber');
    this.medallionArabic = document.getElementById('medallionArabic');
    this.medallionBadge = document.getElementById('medallionBadge');
    this.playerSurahTitle = document.getElementById('playerSurahTitle');
    this.playerSurahSub = document.getElementById('playerSurahSub');
    this.playerOfflineTag = document.getElementById('playerOfflineTag');
    this.seekSlider = document.getElementById('seekSlider');
    this.currentTimeDisplay = document.getElementById('currentTimeDisplay');
    this.totalDurationDisplay = document.getElementById('totalDurationDisplay');
    this.timeRemainingDisplay = document.getElementById('timeRemainingDisplay');
    this.btnMainPlay = document.getElementById('btnMainPlay');
    this.btnMainPrev = document.getElementById('btnMainPrev');
    this.btnMainNext = document.getElementById('btnMainNext');
    this.btnRewind = document.getElementById('btnRewind');
    this.btnForward = document.getElementById('btnForward');
    this.btnSpeed = document.getElementById('btnSpeed');
    this.btnRepeat = document.getElementById('btnRepeat');
    this.btnReadFromPlayer = document.getElementById('btnReadFromPlayer');

    // Ayah Reader Modal
    this.ayahModal = document.getElementById('ayahModal');
    this.btnCloseAyah = document.getElementById('btnCloseAyah');
    this.ayahModalTitle = document.getElementById('ayahModalTitle');
    this.ayahModalSubtitle = document.getElementById('ayahModalSubtitle');
    this.ayahCacheBadge = document.getElementById('ayahCacheBadge');
    this.ayahModalBody = document.getElementById('ayahModalBody');
    this.btnFontDec = document.getElementById('btnFontDec');
    this.btnFontInc = document.getElementById('btnFontInc');
    this.btnReaderAudio = document.getElementById('btnReaderAudio');
    this.readerAudioIcon = document.getElementById('readerAudioIcon');
    this.readerAudioText = document.getElementById('readerAudioText');
  }

  initFontScale() {
    this.applyFontScale(this.fontScale);
  }

  applyFontScale(scale) {
    this.fontScale = Math.min(1.5, Math.max(0.85, scale));
    const arabicRem = (1.75 * this.fontScale).toFixed(2);
    const banglaRem = (1.05 * this.fontScale).toFixed(2);
    document.documentElement.style.setProperty('--ayah-arabic-size', `${arabicRem}rem`);
    document.documentElement.style.setProperty('--ayah-bangla-size', `${banglaRem}rem`);
    localStorage.setItem('quran_font_scale', this.fontScale.toString());
  }

  initAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayStateUI();
      this.savePlaybackSession();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
      this.savePlaybackSession();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.audio.duration) return;
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      this.miniProgressBar.style.width = `${progress}%`;

      // Live Timings in Mini Player
      if (this.miniTimeDisplay) {
        this.miniTimeDisplay.textContent = `${formatTime(this.audio.currentTime)} / ${formatTime(this.audio.duration)}`;
      }

      // Live Timings in Full Player
      if (!this.isUserDraggingSeek) {
        this.seekSlider.value = progress;
        this.currentTimeDisplay.textContent = formatTime(this.audio.currentTime);
        const remaining = Math.max(0, this.audio.duration - this.audio.currentTime);
        if (this.timeRemainingDisplay) {
          this.timeRemainingDisplay.textContent = `-${formatTime(remaining)}`;
        }
      }

      // Media Session Position State (lockscreen scrubber sync)
      if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && this.audio.duration) {
        try {
          navigator.mediaSession.setPositionState({
            duration: this.audio.duration,
            playbackRate: this.playbackRate,
            position: this.audio.currentTime
          });
        } catch (e) {}
      }

      // Throttled auto-save session state (every ~1.5 seconds)
      const now = Date.now();
      if (now - this.lastSavedTime > 1500) {
        this.lastSavedTime = now;
        this.savePlaybackSession();
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.totalDurationDisplay.textContent = formatTime(this.audio.duration);
      if (this.miniTimeDisplay) {
        this.miniTimeDisplay.textContent = `${formatTime(this.audio.currentTime)} / ${formatTime(this.audio.duration)}`;
      }
      const remaining = Math.max(0, this.audio.duration - this.audio.currentTime);
      if (this.timeRemainingDisplay) {
        this.timeRemainingDisplay.textContent = `-${formatTime(remaining)}`;
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.repeatMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play();
      } else if (this.repeatMode === 'all') {
        this.playNext();
      } else {
        this.isPlaying = false;
        this.updatePlayStateUI();
      }
      this.savePlaybackSession();
    });

    // Fallback if local file fails: try fallback streaming URL
    this.audio.addEventListener('error', () => {
      const current = this.surahs[this.currentIndex];
      if (current && this.audio.src.includes('audio/') && !this.audio.src.startsWith('https:')) {
        console.warn(`Local audio not found for ${current.nameBangla}. Falling back to online URL.`);
        this.audio.src = current.fallbackAudio;
        this.audio.play().catch(err => console.error('Audio play error:', err));
      }
    });
  }

  initDomEvents() {
    // Search
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderSurahList();
    });

    // Filter Buttons
    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this.renderSurahList();
      });
    });

    // Resume Session Banner Events
    if (this.btnResumePlay) {
      this.btnResumePlay.addEventListener('click', () => {
        this.resumeSavedSession();
      });
    }

    if (this.btnResumeDismiss) {
      this.btnResumeDismiss.addEventListener('click', () => {
        this.resumeSessionBanner.style.display = 'none';
        localStorage.removeItem('quran_playback_session');
        this.savedSession = null;
        this.renderSurahList();
      });
    }

    // Mini Player actions
    this.miniBtnPlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlay();
    });
    this.miniBtnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      this.playPrev();
    });
    this.miniBtnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      this.playNext();
    });

    // Tap Mini Player content to open Full Player Option
    this.miniSurahInfo.addEventListener('click', () => {
      this.openPlayerModal();
    });

    // Mini Player seekbar scrubber click
    if (this.miniPlayerProgressTrack) {
      this.miniPlayerProgressTrack.addEventListener('click', (e) => {
        const rect = this.miniPlayerProgressTrack.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        if (this.audio.duration) {
          this.audio.currentTime = ratio * this.audio.duration;
          this.savePlaybackSession();
        }
      });
    }

    // Full Player Modal Close
    this.btnClosePlayer.addEventListener('click', () => {
      this.closePlayerModal();
    });
    this.btnMainPlay.addEventListener('click', () => this.togglePlay());
    this.btnMainPrev.addEventListener('click', () => this.playPrev());
    this.btnMainNext.addEventListener('click', () => this.playNext());

    this.btnRewind.addEventListener('click', () => {
      this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
      this.savePlaybackSession();
    });
    this.btnForward.addEventListener('click', () => {
      if (this.audio.duration) {
        this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 10);
        this.savePlaybackSession();
      }
    });

    // Seek slider
    this.isUserDraggingSeek = false;
    this.seekSlider.addEventListener('input', () => {
      this.isUserDraggingSeek = true;
      if (this.audio.duration) {
        const time = (this.seekSlider.value / 100) * this.audio.duration;
        this.currentTimeDisplay.textContent = formatTime(time);
        const remaining = Math.max(0, this.audio.duration - time);
        if (this.timeRemainingDisplay) {
          this.timeRemainingDisplay.textContent = `-${formatTime(remaining)}`;
        }
      }
    });
    this.seekSlider.addEventListener('change', () => {
      if (this.audio.duration) {
        this.audio.currentTime = (this.seekSlider.value / 100) * this.audio.duration;
        this.savePlaybackSession();
      }
      this.isUserDraggingSeek = false;
    });

    // Speed button
    const rates = [1.0, 1.25, 1.5, 0.75];
    let rateIdx = 0;
    this.btnSpeed.addEventListener('click', () => {
      rateIdx = (rateIdx + 1) % rates.length;
      this.playbackRate = rates[rateIdx];
      this.audio.playbackRate = this.playbackRate;
      this.btnSpeed.textContent = `গতি: ${this.playbackRate}x`;
      this.savePlaybackSession();
    });

    // Repeat button
    this.btnRepeat.addEventListener('click', () => {
      if (this.repeatMode === 'all') {
        this.repeatMode = 'one';
        this.btnRepeat.textContent = '🔂 পুনরাবৃত্তি ১';
        this.btnRepeat.classList.add('active');
      } else if (this.repeatMode === 'one') {
        this.repeatMode = 'off';
        this.btnRepeat.textContent = '➡️ সাধারণ';
        this.btnRepeat.classList.remove('active');
      } else {
        this.repeatMode = 'all';
        this.btnRepeat.textContent = '🔁 সকল সূরা';
        this.btnRepeat.classList.add('active');
      }
      this.savePlaybackSession();
    });

    // Jump to Ayahs from player
    this.btnReadFromPlayer.addEventListener('click', () => {
      if (this.currentIndex >= 0) {
        this.closePlayerModal();
        this.openAyahModal(this.surahs[this.currentIndex]);
      }
    });

    // Ayah modal close button
    this.btnCloseAyah.addEventListener('click', () => {
      this.closeAyahModal();
    });

    // Font size controls in Ayah Reader
    if (this.btnFontDec) {
      this.btnFontDec.addEventListener('click', () => {
        this.applyFontScale(this.fontScale - 0.1);
      });
    }
    if (this.btnFontInc) {
      this.btnFontInc.addEventListener('click', () => {
        this.applyFontScale(this.fontScale + 0.1);
      });
    }

    // Quick Play/Pause button from inside Reader
    if (this.btnReaderAudio) {
      this.btnReaderAudio.addEventListener('click', () => {
        if (!this.readingSurah) return;
        const readerIdx = this.surahs.findIndex(s => s.number === this.readingSurah.number);
        if (readerIdx === -1) return;

        if (this.currentIndex === readerIdx) {
          this.togglePlay();
        } else {
          this.playSurahIndex(readerIdx, false); // Play without force opening full player over reader
        }
        this.updateReaderAudioButton();
      });
    }

    // Lifecycle events for background/leaving session preservation
    window.addEventListener('beforeunload', () => this.savePlaybackSession());
    window.addEventListener('pagehide', () => this.savePlaybackSession());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.savePlaybackSession();
      }
    });
  }

  // Mobile Back Button / Gesture handling
  initMobileNavEvents() {
    window.addEventListener('popstate', (e) => {
      // If Ayah reader is open, close it cleanly on mobile back
      if (this.ayahModal.classList.contains('open')) {
        this.ayahModal.classList.remove('open');
        this.readingSurah = null;
        return;
      }
      // If Player modal is open, close it cleanly on mobile back
      if (this.playerModal.classList.contains('open')) {
        this.playerModal.classList.remove('open');
        return;
      }
    });
  }

  // Save playback session to localStorage
  savePlaybackSession() {
    if (this.currentIndex < 0) return;
    const surah = this.surahs[this.currentIndex];
    if (!surah) return;

    const currentTime = this.audio.currentTime || 0;
    const duration = this.audio.duration || 0;

    // Only save if meaningful
    const session = {
      surahNumber: surah.number,
      surahIndex: this.currentIndex,
      currentTime: currentTime,
      duration: duration,
      playbackRate: this.playbackRate,
      repeatMode: this.repeatMode,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('quran_playback_session', JSON.stringify(session));
      this.savedSession = session;
    } catch (e) {
      console.warn('Could not save session:', e);
    }
  }

  // Restore session from localStorage if user re-enters the app
  initPlaybackSession() {
    try {
      const raw = localStorage.getItem('quran_playback_session');
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session || typeof session.surahNumber !== 'number') return;

      const surahIdx = this.surahs.findIndex(s => s.number === session.surahNumber);
      if (surahIdx === -1) return;

      const surah = this.surahs[surahIdx];
      this.savedSession = session;
      this.currentIndex = surahIdx;

      // Pre-load audio to the saved position
      this.audio.src = surah.audioFile;
      this.audio.currentTime = session.currentTime || 0;
      this.playbackRate = session.playbackRate || 1.0;
      this.audio.playbackRate = this.playbackRate;
      this.repeatMode = session.repeatMode || 'all';

      // Update UI elements for the saved session
      this.updatePlayerUI(surah);
      this.updatePlayStateUI();

      // Show the Resume Session Banner if they were listening in the middle (> 3 seconds)
      if (session.currentTime > 3) {
        if (this.resumeSessionBanner) {
          this.resumeSurahName.textContent = `${toBanglaNumber(surah.number)}. ${surah.nameBangla} (${surah.nameArabic})`;
          const durStr = session.duration > 0 ? ` (মোট ${formatTime(session.duration)})` : '';
          this.resumeTimeInfo.textContent = `${formatTime(session.currentTime)} মিনিটে থেমেছিলেন${durStr}`;
          const pct = session.duration > 0 ? (session.currentTime / session.duration) * 100 : 0;
          this.resumeProgressBar.style.width = `${pct}%`;
          this.resumeSessionBanner.style.display = 'block';
        }
      }

      // Display live timing in mini-player immediately
      if (this.miniTimeDisplay) {
        this.miniTimeDisplay.textContent = `${formatTime(session.currentTime)} / ${formatTime(session.duration || 0)}`;
      }
      this.currentTimeDisplay.textContent = formatTime(session.currentTime);
      this.totalDurationDisplay.textContent = formatTime(session.duration || 0);

    } catch (err) {
      console.warn('Failed restoring playback session:', err);
    }
  }

  resumeSavedSession() {
    if (!this.savedSession) return;
    const surahIdx = this.savedSession.surahIndex;
    const targetTime = this.savedSession.currentTime;

    if (this.currentIndex !== surahIdx) {
      this.currentIndex = surahIdx;
      const surah = this.surahs[surahIdx];
      this.audio.src = surah.audioFile;
    }

    if (targetTime) {
      this.audio.currentTime = targetTime;
    }

    this.audio.play().catch(e => {
      console.warn('Playback error on resume:', e);
      const surah = this.surahs[this.currentIndex];
      this.audio.src = surah.fallbackAudio;
      this.audio.currentTime = targetTime;
      this.audio.play().catch(err => console.error(err));
    });

    if (this.resumeSessionBanner) {
      this.resumeSessionBanner.style.display = 'none';
    }

    // User requirement: When playing, open the player option with timings!
    this.openPlayerModal();
    this.updatePlayStateUI();
  }

  initNetworkStatus() {
    const update = () => {
      const isOnline = navigator.onLine;
      const dot = this.networkStatusBadge.querySelector('.status-dot');
      const text = this.networkStatusBadge.querySelector('span');
      if (isOnline) {
        dot.style.backgroundColor = 'var(--accent-green)';
        dot.style.boxShadow = '0 0 8px var(--accent-green)';
        text.textContent = 'অনলাইন (সব সূরা সচল)';
      } else {
        dot.style.backgroundColor = '#f59e0b';
        dot.style.boxShadow = '0 0 8px #f59e0b';
        text.textContent = 'অফলাইন মোড (সংরক্ষিত)';
      }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  renderSurahList() {
    const filtered = this.surahs.filter(s => {
      // Filter by category
      if (this.activeFilter === 'Meccan' && s.revelationType !== 'Meccan') return false;
      if (this.activeFilter === 'Medinan' && s.revelationType !== 'Medinan') return false;
      if (this.activeFilter === 'favorites' && !this.favorites.has(s.number)) return false;

      // Filter by search
      if (this.searchQuery) {
        const q = this.searchQuery;
        const matchesNum = s.number.toString().includes(q) || toBanglaNumber(s.number).includes(q);
        const matchesBangla = s.nameBangla.toLowerCase().includes(q) || s.meaningBangla.toLowerCase().includes(q);
        const matchesEnglish = s.nameEnglish.toLowerCase().includes(q);
        const matchesArabic = s.nameArabic.includes(q);
        return matchesNum || matchesBangla || matchesEnglish || matchesArabic;
      }
      return true;
    });

    if (filtered.length === 0) {
      this.surahsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          <p style="font-size: 1.2rem;">কোনো সূরা পাওয়া যায়নি</p>
        </div>
      `;
      return;
    }

    this.surahsContainer.innerHTML = filtered.map(s => {
      const isCurrent = this.currentIndex >= 0 && this.surahs[this.currentIndex].number === s.number;
      const isCurrentPlaying = isCurrent && this.isPlaying;
      const playIcon = isCurrentPlaying ? '⏸' : '▶';
      const revText = s.revelationType === 'Meccan' ? 'মাক্কী' : 'মাদানীয়';
      
      const isSavedSurah = this.savedSession && this.savedSession.surahNumber === s.number;
      const savedBadge = (isSavedSurah && !isCurrentPlaying && this.savedSession.currentTime > 5)
        ? `<span class="badge-saved-position">পূর্বের অবস্থান: ${formatTime(this.savedSession.currentTime)}</span>`
        : '';

      return `
        <div class="surah-card ${isCurrentPlaying ? 'playing' : ''} ${isSavedSurah ? 'has-saved-session' : ''}" data-number="${s.number}">
          <div class="surah-card-left">
            <div class="surah-number-badge">${toBanglaNumber(s.number)}</div>
            <div class="surah-info">
              <span class="surah-bangla-title">${s.nameBangla} (${s.nameEnglish})</span>
              <div class="surah-sub-info">
                <span>${s.meaningBangla}</span>
                <span>•</span>
                <span class="badge-revelation">${revText}</span>
                <span>•</span>
                <span>${toBanglaNumber(s.numberOfAyahs)} আয়াত</span>
                ${savedBadge}
              </div>
            </div>
          </div>
          <div class="surah-card-right">
            <div class="surah-arabic-name">${s.nameArabic}</div>
            <div class="card-actions">
              <button class="btn-read" data-action="read" data-number="${s.number}" title="আয়াত পড়ুন">📖 আয়াত</button>
              <button class="btn-play-card" data-action="play" data-number="${s.number}" title="তেলাওয়াত শুনুন">${playIcon}</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    this.surahsContainer.querySelectorAll('.surah-card').forEach(card => {
      const num = parseInt(card.dataset.number);
      card.querySelector('[data-action="play"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCardPlay(num);
      });
      card.querySelector('[data-action="read"]').addEventListener('click', (e) => {
        e.stopPropagation();
        const s = this.surahs.find(item => item.number === num);
        this.openAyahModal(s);
      });
    });
  }

  handleCardPlay(number) {
    const idx = this.surahs.findIndex(s => s.number === number);
    if (idx === -1) return;

    if (this.currentIndex === idx) {
      if (!this.isPlaying) {
        this.audio.play().catch(e => console.error(e));
        // Requirement: When playing, open the player option with timings!
        this.openPlayerModal();
      } else {
        this.togglePlay();
      }
    } else {
      // Requirement: When playing a new surah, play and open the player option!
      this.playSurahIndex(idx, true);
    }
  }

  playSurahIndex(index, autoOpenPlayer = true) {
    if (index < 0 || index >= this.surahs.length) return;
    this.currentIndex = index;
    const surah = this.surahs[index];

    // Priority: local audio file, fallback to online stream URL
    this.audio.src = surah.audioFile;
    this.audio.playbackRate = this.playbackRate;
    
    // Check if resuming from saved session on this same surah
    if (this.savedSession && this.savedSession.surahNumber === surah.number && this.savedSession.currentTime > 0) {
      this.audio.currentTime = this.savedSession.currentTime;
    } else {
      this.audio.currentTime = 0;
    }

    this.audio.play().catch(e => {
      console.warn('Playing local failed, attempting stream fallback:', e);
      this.audio.src = surah.fallbackAudio;
      this.audio.play().catch(err => console.error(err));
    });

    this.updatePlayerUI(surah);
    this.renderSurahList();
    this.updateMediaSession(surah);
    this.updateReaderAudioButton();

    // User requirement: When we are playing the Quran, open the player option with timings
    if (autoOpenPlayer) {
      this.openPlayerModal();
    }
  }

  togglePlay() {
    if (this.currentIndex === -1) {
      this.playSurahIndex(0, true);
      return;
    }
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(e => console.error(e));
      // Ensure player option is open when listening
      this.openPlayerModal();
    }
  }

  playPrev() {
    if (this.currentIndex > 0) {
      this.playSurahIndex(this.currentIndex - 1, false);
    } else {
      this.playSurahIndex(this.surahs.length - 1, false);
    }
  }

  playNext() {
    if (this.currentIndex < this.surahs.length - 1) {
      this.playSurahIndex(this.currentIndex + 1, false);
    } else {
      this.playSurahIndex(0, false);
    }
  }

  updatePlayerUI(surah) {
    this.miniPlayerBar.classList.add('active');

    // Mini Player Details
    this.miniTitle.textContent = `${toBanglaNumber(surah.number)}. ${surah.nameBangla} (${surah.nameArabic})`;
    this.miniArtist.textContent = `সূরা ${surah.nameBangla} • ${surah.meaningBangla}`;
    if (this.miniTimeDisplay) {
      this.miniTimeDisplay.textContent = `${formatTime(this.audio.currentTime)} / ${formatTime(this.audio.duration || 0)}`;
    }

    // Full Player Modal Details
    this.medallionNumber.textContent = `সূরা ${toBanglaNumber(surah.number)}`;
    this.medallionArabic.textContent = surah.nameArabic;
    this.medallionBadge.textContent = `${surah.revelationType === 'Meccan' ? 'মাক্কী' : 'মাদানীয়'} • ${toBanglaNumber(surah.numberOfAyahs)} আয়াত`;
    this.playerSurahTitle.textContent = surah.nameBangla;
    this.playerSurahSub.textContent = `${surah.meaningBangla} • ${surah.nameEnglish}`;
    this.playerOfflineTag.textContent = `⚡ অফলাইন অডিও সক্রিয়`;
  }

  updatePlayStateUI() {
    const icon = this.isPlaying ? '⏸' : '▶';
    this.miniBtnPlay.textContent = icon;
    this.btnMainPlay.textContent = icon;

    if (this.isPlaying) {
      this.medallionContainer.classList.add('rotating');
    } else {
      this.medallionContainer.classList.remove('rotating');
    }

    // Media Session playback state for lockscreen
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }

    // Native Android Background Audio Service integration
    if (window.NativeAudioService && this.currentIndex >= 0) {
      const surah = this.surahs[this.currentIndex];
      if (this.isPlaying) {
        window.NativeAudioService.startBackgroundAudio(
          `${toBanglaNumber(surah.number)}. ${surah.nameBangla} (${surah.nameArabic})`,
          `সূরা ${surah.nameBangla} • ${surah.meaningBangla}`
        );
      } else {
        window.NativeAudioService.stopBackgroundAudio();
      }
    }

    this.updateReaderAudioButton();
    this.renderSurahList();
  }

  updateReaderAudioButton() {
    if (!this.btnReaderAudio || !this.readingSurah) return;
    const isThisSurah = this.currentIndex >= 0 && this.surahs[this.currentIndex].number === this.readingSurah.number;
    if (isThisSurah && this.isPlaying) {
      this.readerAudioIcon.textContent = '⏸';
      this.readerAudioText.textContent = 'থামান';
    } else {
      this.readerAudioIcon.textContent = '▶';
      this.readerAudioText.textContent = 'শুনুন';
    }
  }

  updateMediaSession(surah) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${toBanglaNumber(surah.number)}. ${surah.nameBangla} (${surah.nameArabic})`,
        artist: 'কুরআনুল কারীম (বাংলা অডিও)',
        album: 'আল-কুরআনুল কারীম',
        artwork: [
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        this.audio.currentTime = Math.max(0, this.audio.currentTime - skip);
        this.savePlaybackSession();
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skip = details.seekOffset || 10;
        if (this.audio.duration) {
          this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + skip);
          this.savePlaybackSession();
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && this.audio.duration) {
          this.audio.currentTime = details.seekTime;
          this.savePlaybackSession();
        }
      });
    }

    if (window.NativeAudioService) {
      window.NativeAudioService.startBackgroundAudio(
        `${toBanglaNumber(surah.number)}. ${surah.nameBangla} (${surah.nameArabic})`,
        `সূরা ${surah.nameBangla} • ${surah.meaningBangla}`
      );
    }
  }

  openPlayerModal() {
    this.playerModal.classList.add('open');
    // Push history state on mobile to handle device back button smoothly
    history.pushState({ modal: 'player' }, '');
  }

  closePlayerModal() {
    this.playerModal.classList.remove('open');
  }

  async openAyahModal(surah) {
    this.readingSurah = surah;
    this.ayahModal.classList.add('open');
    this.ayahModalTitle.textContent = `${surah.nameBangla} (${surah.nameArabic})`;
    this.ayahModalSubtitle.textContent = `সূরা নম্বর: ${toBanglaNumber(surah.number)} • ${toBanglaNumber(surah.numberOfAyahs)} আয়াত • ${surah.meaningBangla}`;

    this.updateReaderAudioButton();

    // Push history state so mobile back gesture closes modal without leaving app
    history.pushState({ modal: 'ayah', surahNumber: surah.number }, '');

    // Render loading state
    this.ayahCacheBadge.textContent = 'লোড হচ্ছে...';
    this.ayahCacheBadge.style.color = 'var(--gold-light)';
    this.ayahModalBody.innerHTML = `<div class="loading-spinner">✨ আয়াত ও বাংলা অনুবাদ লোড করা হচ্ছে...</div>`;

    const cacheKey = `quran_ayah_v1_${surah.number}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        this.renderAyahs(surah, parsed.arabicAyahs, parsed.banglaAyahs, true);
        return;
      } catch (e) {
        console.error('Cache read error:', e);
      }
    }

    // If online, fetch from API
    if (navigator.onLine) {
      try {
        const url = `https://api.alquran.cloud/v1/surah/${surah.number}/editions/quran-uthmani,bn.bengali`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.code === 200 && json.data.length >= 2) {
          const arabicAyahs = json.data[0].ayahs;
          const banglaAyahs = json.data[1].ayahs;

          // Save to localStorage for permanent offline use
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ arabicAyahs, banglaAyahs }));
          } catch (storageErr) {
            console.warn('LocalStorage quota limit reached:', storageErr);
          }

          this.renderAyahs(surah, arabicAyahs, banglaAyahs, false);
          return;
        }
      } catch (err) {
        console.warn('API fetch failed:', err);
      }
    }

    // Offline and not cached
    this.ayahCacheBadge.textContent = 'অফলাইন';
    this.ayahCacheBadge.style.color = '#f59e0b';
    this.ayahModalBody.innerHTML = `
      <div class="offline-notice-box">
        <p style="font-weight: 700; color: var(--gold-light); font-size: 1.15rem; margin-bottom: 8px;">📡 আপনি অফলাইনে আছেন</p>
        <p>এই সূরার লিখিত আয়াত এখনো আপনার ডিভাইসে সংরক্ষিত হয়নি।</p>
        <p style="margin-top: 6px; color: var(--text-muted); font-size: 0.88rem;">ইন্টারনেট সংযুক্ত হলে একবার লোড করলেই এটি অফলাইনে স্থায়ীভাবে সংরক্ষিত হয়ে যাবে।</p>
        <p style="margin-top: 14px; color: var(--accent-green); font-weight: 600;">✓ তবে সম্পূর্ণ সূরার বাংলা অডিও অফলাইনে শোনা যাচ্ছে!</p>
      </div>
    `;
  }

  renderAyahs(surah, arabicList, banglaList, isFromCache) {
    this.ayahCacheBadge.textContent = isFromCache ? '💾 অফলাইন সংরক্ষিত' : '🌐 সংরক্ষিত হয়েছে';
    this.ayahCacheBadge.style.color = isFromCache ? 'var(--accent-green)' : 'var(--gold-light)';

    let bismillahHtml = '';
    // Surah At-Tawbah (9) does not have Bismillah
    if (surah.number !== 9) {
      bismillahHtml = `
        <div class="bismillah-card">
          <div class="bismillah-arabic">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
          <div class="bismillah-bangla">পরম করুণাময় ও অসীম দয়ালু আল্লাহর নামে শুরু করছি</div>
        </div>
      `;
    }

    const ayahsHtml = arabicList.map((a, idx) => {
      const banglaObj = banglaList[idx] || {};
      let cleanArabic = a.text;
      // Strip initial bismillah for surahs other than Fatihah if returned by API
      if (surah.number !== 1 && surah.number !== 9 && cleanArabic.startsWith('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ')) {
        cleanArabic = cleanArabic.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ', '').trim();
      }

      const ayahNumBn = toBanglaNumber(a.numberInSurah);

      return `
        <div class="ayah-card" id="ayah-${a.numberInSurah}">
          <div class="ayah-card-top">
            <span class="ayah-number-badge">আয়াত ${ayahNumBn}</span>
            <div class="ayah-actions">
              <button class="btn-copy-ayah" data-ayah="${a.numberInSurah}" title="আয়াত কপি করুন">📋 কপি</button>
            </div>
          </div>
          <div class="ayah-arabic-text">${cleanArabic} ۝</div>
          <div class="ayah-bangla-text">${banglaObj.text || ''}</div>
        </div>
      `;
    }).join('');

    this.ayahModalBody.innerHTML = bismillahHtml + ayahsHtml;

    // Attach copy button listeners
    this.ayahModalBody.querySelectorAll('.btn-copy-ayah').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.ayah-card');
        const arabic = card.querySelector('.ayah-arabic-text').textContent;
        const bangla = card.querySelector('.ayah-bangla-text').textContent;
        const textToCopy = `${surah.nameBangla} - আয়াত ${btn.dataset.ayah}\n${arabic}\n${bangla}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓ কপি হয়েছে!';
          btn.style.color = 'var(--accent-green)';
          setTimeout(() => {
            btn.textContent = orig;
            btn.style.color = '';
          }, 2000);
        }).catch(err => console.error('Copy failed:', err));
      });
    });
  }

  closeAyahModal() {
    this.ayahModal.classList.remove('open');
    this.readingSurah = null;
    // Pop history if state is modal
    if (history.state && history.state.modal === 'ayah') {
      history.back();
    }
  }
}

// Boot up app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.quranApp = new QuranApp();
});
