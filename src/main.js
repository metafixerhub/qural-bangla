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
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.repeatMode = 'all'; // 'off' | 'one' | 'all'
    this.playbackRate = 1.0;
    this.favorites = new Set(JSON.parse(localStorage.getItem('quran_favorites') || '[]'));
    
    this.initElements();
    this.initAudioEvents();
    this.initDomEvents();
    this.initNetworkStatus();
    this.renderSurahList();
  }

  initElements() {
    this.surahsContainer = document.getElementById('surahsContainer');
    this.searchInput = document.getElementById('searchInput');
    this.filterButtons = document.querySelectorAll('.filter-btn');
    this.networkStatusBadge = document.getElementById('networkStatusBadge');

    // Mini player
    this.miniPlayerBar = document.getElementById('miniPlayerBar');
    this.miniProgressBar = document.getElementById('miniProgressBar');
    this.miniSurahInfo = document.getElementById('miniSurahInfo');
    this.miniAvatar = document.getElementById('miniAvatar');
    this.miniTitle = document.getElementById('miniTitle');
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
  }

  initAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayStateUI();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.audio.duration) return;
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      this.miniProgressBar.style.width = `${progress}%`;
      
      if (!this.isUserDraggingSeek) {
        this.seekSlider.value = progress;
        this.currentTimeDisplay.textContent = formatTime(this.audio.currentTime);
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.totalDurationDisplay.textContent = formatTime(this.audio.duration);
      this.seekSlider.value = 0;
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
    });

    // Fallback if local file fails: try fallback streaming URL
    this.audio.addEventListener('error', (e) => {
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
    this.miniSurahInfo.addEventListener('click', () => {
      this.openPlayerModal();
    });

    // Full Player Modal
    this.btnClosePlayer.addEventListener('click', () => {
      this.closePlayerModal();
    });
    this.btnMainPlay.addEventListener('click', () => this.togglePlay());
    this.btnMainPrev.addEventListener('click', () => this.playPrev());
    this.btnMainNext.addEventListener('click', () => this.playNext());

    this.btnRewind.addEventListener('click', () => {
      this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
    });
    this.btnForward.addEventListener('click', () => {
      if (this.audio.duration) {
        this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 10);
      }
    });

    // Seek slider
    this.isUserDraggingSeek = false;
    this.seekSlider.addEventListener('input', () => {
      this.isUserDraggingSeek = true;
      if (this.audio.duration) {
        const time = (this.seekSlider.value / 100) * this.audio.duration;
        this.currentTimeDisplay.textContent = formatTime(time);
      }
    });
    this.seekSlider.addEventListener('change', () => {
      if (this.audio.duration) {
        this.audio.currentTime = (this.seekSlider.value / 100) * this.audio.duration;
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
      this.btnSpeed.textContent = `${this.playbackRate}x`;
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
    });

    // Jump to Ayahs from player
    this.btnReadFromPlayer.addEventListener('click', () => {
      if (this.currentIndex >= 0) {
        this.closePlayerModal();
        this.openAyahModal(this.surahs[this.currentIndex]);
      }
    });

    // Ayah modal close
    this.btnCloseAyah.addEventListener('click', () => {
      this.closeAyahModal();
    });
  }

  initNetworkStatus() {
    const update = () => {
      const isOnline = navigator.onLine;
      const dot = this.networkStatusBadge.querySelector('.status-dot');
      const text = this.networkStatusBadge.querySelector('span');
      if (isOnline) {
        dot.style.backgroundColor = 'var(--accent-green)';
        dot.style.boxShadow = '0 0 8px var(--accent-green)';
        text.textContent = 'অনলাইন (API সচল)';
      } else {
        dot.style.backgroundColor = '#f59e0b';
        dot.style.boxShadow = '0 0 8px #f59e0b';
        text.textContent = 'অফলাইন মোড';
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
      const isCurrentPlaying = this.currentIndex >= 0 && this.surahs[this.currentIndex].number === s.number;
      const playIcon = (isCurrentPlaying && this.isPlaying) ? '⏸' : '▶';
      const revText = s.revelationType === 'Meccan' ? 'মাক্কী' : 'মাদানীয়';

      return `
        <div class="surah-card ${isCurrentPlaying ? 'playing' : ''}" data-number="${s.number}">
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
              </div>
            </div>
          </div>
          <div class="surah-card-right">
            <div class="surah-arabic-name">${s.nameArabic}</div>
            <div class="card-actions">
              <button class="btn-read" data-action="read" data-number="${s.number}">📖 আয়াত</button>
              <button class="btn-play-card" data-action="play" data-number="${s.number}">${playIcon}</button>
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
      this.togglePlay();
    } else {
      this.playSurahIndex(idx);
    }
  }

  playSurahIndex(index) {
    if (index < 0 || index >= this.surahs.length) return;
    this.currentIndex = index;
    const surah = this.surahs[index];

    // Priority: local audio file (works totally offline), fallback to online url
    this.audio.src = surah.audioFile;
    this.audio.playbackRate = this.playbackRate;
    this.audio.play().catch(e => {
      console.warn('Playing local failed, attempting stream fallback:', e);
      this.audio.src = surah.fallbackAudio;
      this.audio.play().catch(err => console.error(err));
    });

    this.updatePlayerUI(surah);
    this.renderSurahList();
    this.updateMediaSession(surah);
  }

  togglePlay() {
    if (this.currentIndex === -1) {
      this.playSurahIndex(0);
      return;
    }
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(e => console.error(e));
    }
  }

  playPrev() {
    if (this.currentIndex > 0) {
      this.playSurahIndex(this.currentIndex - 1);
    } else {
      this.playSurahIndex(this.surahs.length - 1);
    }
  }

  playNext() {
    if (this.currentIndex < this.surahs.length - 1) {
      this.playSurahIndex(this.currentIndex + 1);
    } else {
      this.playSurahIndex(0);
    }
  }

  updatePlayerUI(surah) {
    this.miniPlayerBar.classList.add('active');

    // Mini Player
    this.miniAvatar.textContent = surah.nameArabic;
    this.miniTitle.textContent = `${toBanglaNumber(surah.number)}. ${surah.nameBangla} (${surah.nameArabic})`;
    this.miniArtist.textContent = `সূরা ${surah.nameBangla} • ${surah.meaningBangla}`;

    // Full Player Modal
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

    this.renderSurahList();
  }

  updateMediaSession(surah) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${toBanglaNumber(surah.number)}. ${surah.nameBangla} (${surah.nameArabic})`,
        artist: 'কুরআনুল কারীম (বাংলা অডিও)',
        album: 'আল-কুরআন',
        artwork: [
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && this.audio.duration) {
          this.audio.currentTime = details.seekTime;
        }
      });
    }
  }

  openPlayerModal() {
    this.playerModal.classList.add('open');
  }

  closePlayerModal() {
    this.playerModal.classList.remove('open');
  }

  async openAyahModal(surah) {
    this.ayahModal.classList.add('open');
    this.ayahModalTitle.textContent = `${surah.nameBangla} (${surah.nameArabic})`;
    this.ayahModalSubtitle.textContent = `সূরা নম্বর: ${toBanglaNumber(surah.number)} • ${toBanglaNumber(surah.numberOfAyahs)} আয়াত • ${surah.meaningBangla}`;

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
        <p style="font-weight: 600; color: var(--gold-light); font-size: 1.1rem; margin-bottom: 8px;">📡 আপনি অফলাইনে আছেন</p>
        <p>এই সূরার লিখিত আয়াত এখনো আপনার ডিভাইসে সংরক্ষিত হয়নি।</p>
        <p style="margin-top: 6px; color: var(--text-muted); font-size: 0.85rem;">ইন্টারনেট সংযুক্ত হলে একবার লোড করলেই এটি চিরতরে অফলাইনে সংরক্ষিত হয়ে যাবে।</p>
        <p style="margin-top: 14px; color: var(--accent-green); font-weight: 500;">✓ তবে সম্পূর্ণ সূরার বাংলা অডিও অফলাইনে বাজানো যাচ্ছে!</p>
      </div>
    `;
  }

  renderAyahs(surah, arabicList, banglaList, isFromCache) {
    this.ayahCacheBadge.textContent = isFromCache ? '💾 অফলাইন সংরক্ষিত' : '🌐 অনলাইন থেকে সংগৃহীত ও সংরক্ষিত';
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

      return `
        <div class="ayah-card">
          <div class="ayah-card-top">
            <span class="ayah-number-badge">আয়াত ${toBanglaNumber(a.numberInSurah)}</span>
          </div>
          <div class="ayah-arabic-text">${cleanArabic} ۝</div>
          <div class="ayah-bangla-text">${banglaObj.text || ''}</div>
        </div>
      `;
    }).join('');

    this.ayahModalBody.innerHTML = bismillahHtml + ayahsHtml;
  }

  closeAyahModal() {
    this.ayahModal.classList.remove('open');
  }
}

// Boot up app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.quranApp = new QuranApp();
});
