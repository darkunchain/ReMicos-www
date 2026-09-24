const statusCards = document.querySelectorAll('[data-open-status]');
const statusMessages = document.querySelectorAll('[data-status-message]');
const scheduleMessage = document.querySelector('[data-schedule-message]');

function updateHours() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const minutes = value('hour') * 60 + value('minute');
  const isOpen = minutes >= 10 * 60 && minutes < 19 * 60 + 30;

  statusCards.forEach((card) => card.classList.toggle('closed', !isOpen));
  statusMessages.forEach((message) => { message.textContent = isOpen ? 'Abierto ahora' : 'Cerrado por ahora'; });
  scheduleMessage.textContent = isOpen ? 'Hoy hasta las 7:30 p. m.' : 'Abrimos a las 10:00 a. m.';
}

updateHours();
setInterval(updateHours, 60_000);

const photoPanels = [...document.querySelectorAll('.photo-panel')];
photoPanels.forEach((panel) => panel.addEventListener('click', () => {
  photoPanels.forEach((item) => {
    const active = item === panel;
    item.classList.toggle('active', active);
    item.setAttribute('aria-expanded', String(active));
  });
}));

const chatWindow = document.querySelector('.chat-window');
const chatBackdrop = document.querySelector('.chat-backdrop');
const chatMessage = document.querySelector('#chat-message');
const chatSend = document.querySelector('#chat-send');
let previousFocus = null;

function updateChatLink() {
  const message = chatMessage.value.trim() || 'Hola ReMicos, quiero información sobre una visita.';
  chatSend.href = `https://wa.me/573175027179?text=${encodeURIComponent(message)}`;
}

function openChat() {
  previousFocus = document.activeElement;
  chatWindow.hidden = false;
  chatBackdrop.hidden = false;
  updateChatLink();
  chatMessage.focus();
}

function closeChat() {
  chatWindow.hidden = true;
  chatBackdrop.hidden = true;
  previousFocus?.focus();
}

document.querySelectorAll('[data-chat-open]').forEach((button) => button.addEventListener('click', openChat));
document.querySelectorAll('[data-chat-close]').forEach((button) => button.addEventListener('click', closeChat));
document.querySelectorAll('[data-message]').forEach((button) => button.addEventListener('click', () => {
  chatMessage.value = button.dataset.message;
  updateChatLink();
  chatMessage.focus();
}));
chatMessage.addEventListener('input', updateChatLink);
chatSend.addEventListener('click', closeChat);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !chatWindow.hidden) closeChat();
});

const newsGrid = document.querySelector('[data-news-grid]');

function newsElement(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function newsDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-CO', { ...options, timeZone: 'UTC' }).format(date).toUpperCase();
}

function newsMedia(item, className = '') {
  if (item.videoType === 'mp4' && item.videoUrl?.startsWith('/api/news/media/')) {
    const video = newsElement('video', className);
    video.src = item.videoUrl;
    video.controls = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.setAttribute('aria-label', `Video de la noticia: ${item.title}`);
    return video;
  }
  if (item.videoType === 'embed' && /^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\/embed\/|^https:\/\/player\.vimeo\.com\/video\//.test(item.videoUrl ?? '')) {
    const frame = newsElement('iframe', className);
    frame.src = item.videoUrl;
    frame.title = `Video de la noticia: ${item.title}`;
    frame.loading = 'lazy';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }
  const image = newsElement('img', className);
  image.src = item.imageUrl || 'assets/noticia-entrada.jpg';
  image.alt = item.imageUrl ? `Foto de la noticia: ${item.title}` : 'Entrada y zona de juegos de ReMicos';
  image.loading = 'lazy';
  return image;
}

function renderNews(items) {
  newsGrid.replaceChildren();
  newsGrid.classList.remove('single');
  if (!items.length) {
    newsGrid.append(newsElement('p', 'news-empty', 'Pronto compartiremos nuevas historias y actividades para disfrutar en familia.'));
    return;
  }

  const carouselItems = items.slice(0, 3);
  const archiveItems = items.slice(3);
  let currentIndex = 0;
  let carouselTimer = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const article = newsElement('article', 'featured-news');
  article.setAttribute('aria-label', 'Noticias recientes');
  article.setAttribute('aria-roledescription', 'carrusel');
  const imageWrapper = newsElement('div', 'news-image');
  const badge = newsElement('span', '', 'Destacado');
  imageWrapper.append(badge);
  const copy = newsElement('div', 'news-copy');
  const date = newsElement('time');
  const title = newsElement('h3');
  const message = newsElement('p');
  const link = newsElement('a', '', 'Planea tu visita ↗');
  link.href = '#visitanos';
  copy.append(date, title, message, link);

  const controls = newsElement('div', 'news-carousel-controls');
  const previous = newsElement('button', '', '←');
  const next = newsElement('button', '', '→');
  const counter = newsElement('span', 'news-carousel-counter');
  previous.type = next.type = 'button';
  previous.setAttribute('aria-label', 'Noticia anterior');
  next.setAttribute('aria-label', 'Siguiente noticia');
  controls.append(previous, counter, next);
  if (carouselItems.length > 1) copy.append(controls);
  article.append(imageWrapper, copy);

  const progress = newsElement('div', 'news-carousel-progress');
  progress.setAttribute('aria-hidden', 'true');
  progress.append(newsElement('span'));
  if (carouselItems.length > 1) article.append(progress);

  function restartProgress() {
    if (!progress.isConnected) return;
    const bar = progress.firstElementChild;
    bar.classList.remove('running');
    void bar.offsetWidth;
    bar.classList.add('running');
  }

  function showFeatured(index, animate = false) {
    imageWrapper.querySelector('video')?.pause();
    currentIndex = (index + carouselItems.length) % carouselItems.length;
    const featured = carouselItems[currentIndex];
    const media = newsMedia(featured);
    imageWrapper.replaceChildren(media, badge);
    media.addEventListener('play', pauseCarousel);
    media.addEventListener('pause', playCarousel);
    date.textContent = newsDate(featured.date);
    date.dateTime = featured.date;
    title.textContent = featured.title;
    message.textContent = featured.message;
    counter.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(carouselItems.length).padStart(2, '0')}`;
    if (animate && !reducedMotion.matches) {
      media.animate([{ opacity: 0.45, transform: 'scale(1.04)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 480, easing: 'ease-out' });
      copy.animate([{ opacity: 0.5, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 400, easing: 'ease-out' });
    }
    restartProgress();
  }

  function pauseCarousel() {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = null;
    article.classList.add('paused');
  }

  function playCarousel() {
    if (carouselItems.length < 2 || reducedMotion.matches || document.hidden || article.matches(':hover') || article.contains(document.activeElement) || [...article.querySelectorAll('video')].some((video) => !video.paused)) return;
    if (carouselTimer) return;
    article.classList.remove('paused');
    restartProgress();
    carouselTimer = setInterval(() => showFeatured(currentIndex + 1, true), 5000);
  }

  previous.addEventListener('click', () => showFeatured(currentIndex - 1, true));
  next.addEventListener('click', () => showFeatured(currentIndex + 1, true));
  article.addEventListener('mouseenter', pauseCarousel);
  article.addEventListener('mouseleave', playCarousel);
  article.addEventListener('focusin', pauseCarousel);
  article.addEventListener('focusout', () => setTimeout(playCarousel, 0));
  document.addEventListener('visibilitychange', () => document.hidden ? pauseCarousel() : playCarousel());
  reducedMotion.addEventListener('change', () => reducedMotion.matches ? pauseCarousel() : playCarousel());

  newsGrid.append(article);
  showFeatured(0);
  playCarousel();

  if (!archiveItems.length) {
    newsGrid.classList.add('single');
    return;
  }

  const history = newsElement('div', 'news-history');
  history.append(newsElement('p', 'news-history-label', 'HISTÓRICO DE NOTICIAS'));
  const list = newsElement('div', 'news-list');
  list.id = 'historico-noticias';
  history.append(list);
  let shown = 0;

  function archiveEntry(item) {
    const entry = newsElement('details', 'news-entry');
    const summary = newsElement('summary');
    const time = newsElement('time', '', newsDate(item.date, { day: 'numeric', month: 'short' }));
    time.dateTime = item.date;
    const heading = newsElement('div');
    heading.append(newsElement('p', '', 'Noticia'), newsElement('h3', '', item.title));
    summary.append(time, heading, newsElement('span', '', '+'));
    const message = newsElement('p', 'news-entry-message', item.message);
    entry.append(summary, message);
    if (item.imageUrl || item.videoUrl) entry.append(newsMedia(item, 'news-entry-image'));
    return entry;
  }

  const loadMore = newsElement('button', 'news-load-more', 'Cargar más noticias');
  loadMore.type = 'button';
  loadMore.setAttribute('aria-controls', list.id);
  loadMore.addEventListener('click', () => addArchiveBatch(true));
  history.append(loadMore);

  function addArchiveBatch(focusFirst = false) {
    const nextItems = archiveItems.slice(shown, shown + 3);
    const entries = nextItems.map(archiveEntry);
    list.append(...entries);
    shown += entries.length;
    loadMore.hidden = shown >= archiveItems.length;
    if (focusFirst) entries[0]?.querySelector('summary')?.focus();
  }

  newsGrid.append(history);
  addArchiveBatch();
}

fetch('/api/news', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error('No fue posible cargar noticias.');
    return response.json();
  })
  .then((items) => renderNews(Array.isArray(items) ? items : []))
  .catch(() => {
    newsGrid.replaceChildren(newsElement('p', 'news-empty', 'Por ahora no podemos mostrar las noticias. Inténtalo de nuevo más tarde.'));
  });
