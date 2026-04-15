// ===== THEME TOGGLE =====
function initTheme() {
  const saved = localStorage.getItem('rahab_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('rahab_theme', next);
}
initTheme();

// ===== HEADER =====
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('mainHeader');
  if (!header) return;

  window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 40));

  const toggle = document.querySelector('.menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      header.classList.toggle('open');
      toggle.setAttribute('aria-expanded', header.classList.contains('open'));
    });
    document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => header.classList.remove('open')));
  }

  // Theme button
  const themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // ===== AYAH OF DAY =====
  const ayahs = [
    { text: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ", ref: "الرعد: ٢٨" },
    { text: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ", ref: "الطلاق: ٣" },
    { text: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", ref: "الشرح: ٦" },
    { text: "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ", ref: "البقرة: ١٨٦" },
    { text: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ", ref: "الضحى: ٥" },
    { text: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ", ref: "آل عمران: ١٧٣" },
    { text: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", ref: "البقرة: ١٥٣" },
    { text: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ", ref: "الحديد: ٤" },
    { text: "اللَّهُ لَطِيفٌ بِعِبَادِهِ يَرْزُقُ مَن يَشَاءُ", ref: "الشورى: ١٩" },
    { text: "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي", ref: "طه: ٢٥-٢٦" },
    { text: "وَقُل رَّبِّ زِدْنِي عِلْمًا", ref: "طه: ١١٤" },
    { text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا", ref: "الشرح: ٥" },
  ];
  const dailyEl = document.getElementById('dailyAyah');
  if (dailyEl) {
    const day = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
    const a = ayahs[day % ayahs.length];
    dailyEl.innerHTML = `<span class="ayah-text">﴿ ${a.text} ﴾</span><span class="ayah-ref">${a.ref}</span>`;
  }

  // ===== CHECKLIST =====
  ['c1','c2','c3','c4'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const today = new Date().toDateString();
    if (localStorage.getItem(id + '_d') !== today) localStorage.removeItem(id);
    el.checked = localStorage.getItem(id) === '1';
    el.closest('label').classList.toggle('done', el.checked);
    el.addEventListener('change', () => {
      localStorage.setItem(id, el.checked ? '1' : '0');
      localStorage.setItem(id + '_d', today);
      el.closest('label').classList.toggle('done', el.checked);
    });
  });
});

// ===== TOAST =====
function showToast(msg, dur = 3000) {
  let t = document.getElementById('globalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'globalToast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), dur);
}

// ===== PWA: Service Worker, Install Prompt, Notifications =====
let deferredPrompt = null;
let swRegistration = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(reg => { swRegistration = reg; })
    .catch(() => console.warn('Service worker registration failed'));
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) { banner.classList.remove('hidden'); banner.setAttribute('aria-hidden','false'); }
});

document.addEventListener('click', (ev) => {
  if (!ev.target) return;
  if (ev.target.id === 'installBtn') {
    if (!deferredPrompt) return showToast('غير متاح الآن.');
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') showToast('شكرًا! تم تثبيت التطبيق.');
      else showToast('تم إلغاء التثبيت.');
      deferredPrompt = null;
      const banner = document.getElementById('installBanner');
      if (banner) { banner.classList.add('hidden'); banner.setAttribute('aria-hidden','true'); }
    });
  }
  if (ev.target.id === 'dismissInstall') {
    const banner = document.getElementById('installBanner');
    if (banner) { banner.classList.add('hidden'); banner.setAttribute('aria-hidden','true'); }
  }
  if (ev.target.id === 'enableNotif') {
    if (!('Notification' in window)) return showToast('الإشعارات غير مدعومة في متصفحك');
    Notification.requestPermission().then(p => {
      if (p === 'granted') {
        showToast('تم تفعيل الإشعارات');
        if (swRegistration && swRegistration.showNotification) {
          swRegistration.showNotification('مرحبًا بك في رحاب الحق', {
            body: 'تم تفعيل الإشعارات وسيصلك الجديد من التطبيق.',
            icon: './preview.webp',
            tag: 'welcome-notif'
          });
        } else if (Notification) {
          new Notification('مرحبًا بك في رحاب الحق', { body: 'تم تفعيل الإشعارات.' });
        }
      } else {
        showToast('لم تقم بالسماح بالإشعارات');
      }
    });
  }
});

// Optional: hide banner after a while if not used
setTimeout(() => {
  const b = document.getElementById('installBanner');
  if (b && !b.classList.contains('hidden')) { /* keep shown until user acts */ }
}, 7000);

