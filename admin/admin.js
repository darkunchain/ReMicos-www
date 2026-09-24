const loginView = document.querySelector('#login-view');
const editorView = document.querySelector('#editor-view');
const loginForm = document.querySelector('#login-form');
const newsForm = document.querySelector('#news-form');
const newsList = document.querySelector('#news-list');
const loginFeedback = document.querySelector('#login-feedback');
const editorFeedback = document.querySelector('#editor-feedback');
const photoPreview = document.querySelector('#photo-preview');
const photoInput = document.querySelector('#news-photo');
const removePhoto = document.querySelector('#remove-photo');
const videoInput = document.querySelector('#news-video');
const videoUrlInput = document.querySelector('#news-video-url');
const videoPreview = document.querySelector('#video-preview');
const removeVideo = document.querySelector('#remove-video');
const logoutButton = document.querySelector('#logout');
let csrf = null;
let items = [];
let editingId = null;
let imageId = null;
let videoId = null;
let previewObjectUrl = null;
let videoObjectUrl = null;

function feedback(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle('success', success);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: { ...(options.body && !(options.body instanceof File) ? { 'Content-Type': 'application/json' } : {}), ...(csrf && options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}), ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'No fue posible completar la operación.');
  return result;
}

function showAuthenticated(authenticated) {
  loginView.hidden = authenticated;
  editorView.hidden = !authenticated;
  logoutButton.hidden = !authenticated;
}

function resetForm() {
  newsForm.reset();
  document.querySelector('#news-date').value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  document.querySelector('#editor-title').textContent = 'Nueva noticia';
  editingId = null;
  imageId = null;
  videoId = null;
  photoPreview.hidden = true;
  removePhoto.hidden = true;
  photoPreview.removeAttribute('src');
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl = null;
  videoPreview.pause();
  videoPreview.removeAttribute('src');
  videoPreview.hidden = true;
  removeVideo.hidden = true;
  feedback(editorFeedback, '');
}

function renderList() {
  newsList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Aún no hay noticias. Crea la primera con el editor.';
    newsList.append(empty);
    return;
  }
  for (const item of items) {
    const button = document.createElement('button');
    const state = document.createElement('span');
    const title = document.createElement('h3');
    const date = document.createElement('p');
    button.type = 'button';
    button.className = 'news-item';
    state.textContent = item.status === 'published' ? 'Publicada' : 'Borrador';
    title.textContent = item.title;
    date.textContent = item.date;
    button.append(state, title, date);
    button.addEventListener('click', () => editItem(item));
    newsList.append(button);
  }
}

function editItem(item) {
  editingId = item.id;
  imageId = item.imageId;
  videoId = item.videoId ?? null;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  newsForm.elements.title.value = item.title;
  newsForm.elements.date.value = item.date;
  newsForm.elements.message.value = item.message;
  newsForm.elements.status.value = item.status;
  photoInput.value = '';
  videoInput.value = '';
  videoUrlInput.value = item.videoUrl ?? '';
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl = null;
  videoPreview.pause();
  videoPreview.hidden = !videoId;
  removeVideo.hidden = !videoId && !item.videoUrl;
  if (videoId) videoPreview.src = `/admin/api/video/${videoId}`;
  else videoPreview.removeAttribute('src');
  document.querySelector('#editor-title').textContent = 'Editar noticia';
  photoPreview.hidden = !imageId;
  removePhoto.hidden = !imageId;
  if (imageId) photoPreview.src = `/admin/api/media/${imageId}`;
  else photoPreview.removeAttribute('src');
  feedback(editorFeedback, '');
  document.querySelector('#news-title').focus();
}

async function loadItems() {
  items = await request('/admin/api/news');
  renderList();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type=submit]');
  button.disabled = true;
  feedback(loginFeedback, '');
  try {
    const result = await request('/admin/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: loginForm.elements.username.value, password: loginForm.elements.password.value }),
    });
    csrf = result.csrf;
    loginForm.elements.password.value = '';
    showAuthenticated(true);
    resetForm();
    await loadItems();
  } catch (error) { feedback(loginFeedback, error.message); }
  finally { button.disabled = false; }
});

photoInput.addEventListener('change', () => {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  const file = photoInput.files?.[0];
  if (!file) return;
  if (videoInput.files?.length || videoId || videoUrlInput.value.trim()) { feedback(editorFeedback, 'Elige solo una foto o un video.'); photoInput.value = ''; return; }
  if (file.size > 5 * 1024 * 1024) { feedback(editorFeedback, 'La foto no puede superar 5 MB.'); photoInput.value = ''; return; }
  previewObjectUrl = URL.createObjectURL(file);
  photoPreview.src = previewObjectUrl;
  photoPreview.hidden = false;
  removePhoto.hidden = false;
});

videoInput.addEventListener('change', () => {
  const file = videoInput.files?.[0];
  if (!file) return;
  if (file.type !== 'video/mp4' || file.size > 25 * 1024 * 1024) { feedback(editorFeedback, 'Usa un MP4 de máximo 25 MB.'); videoInput.value = ''; return; }
  if (photoInput.files?.length || imageId || videoUrlInput.value.trim()) { feedback(editorFeedback, 'Elige solo una foto o un video.'); videoInput.value = ''; return; }
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl = URL.createObjectURL(file);
  videoPreview.src = videoObjectUrl;
  videoPreview.hidden = false;
  removeVideo.hidden = false;
});

removeVideo.addEventListener('click', () => {
  videoId = null;
  videoInput.value = '';
  videoUrlInput.value = '';
  videoPreview.pause();
  videoPreview.removeAttribute('src');
  videoPreview.hidden = true;
  removeVideo.hidden = true;
  if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl = null;
});
videoUrlInput.addEventListener('input', () => { removeVideo.hidden = !videoUrlInput.value.trim() && !videoId && !videoInput.files?.length; });

removePhoto.addEventListener('click', () => {
  imageId = null;
  photoInput.value = '';
  photoPreview.hidden = true;
  photoPreview.removeAttribute('src');
  removePhoto.hidden = true;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
});

newsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = newsForm.querySelector('button[type=submit]');
  button.disabled = true;
  feedback(editorFeedback, 'Guardando…');
  try {
    const videoUrl = videoUrlInput.value.trim() || null;
    if ([Boolean(photoInput.files?.length || imageId), Boolean(videoInput.files?.length || videoId), Boolean(videoUrl)].filter(Boolean).length > 1) throw new Error('Elige solo una foto o un video.');
    let nextImageId = imageId;
    let nextVideoId = videoId;
    const file = photoInput.files?.[0];
    if (file) {
      const uploaded = await request('/admin/api/media', { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
      nextImageId = uploaded.imageId;
    }
    const videoFile = videoInput.files?.[0];
    if (videoFile) {
      feedback(editorFeedback, 'Procesando video…');
      const uploaded = await request('/admin/api/video', { method: 'POST', body: videoFile, headers: { 'Content-Type': 'video/mp4' } });
      nextVideoId = uploaded.videoId;
    }
    await request(editingId ? `/admin/api/news/${editingId}` : '/admin/api/news', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({
        title: newsForm.elements.title.value,
        date: newsForm.elements.date.value,
        message: newsForm.elements.message.value,
        status: newsForm.elements.status.value,
        imageId: nextImageId,
        videoId: nextVideoId,
        videoUrl,
      }),
    });
    await loadItems();
    resetForm();
    feedback(editorFeedback, 'Noticia guardada correctamente.', true);
  } catch (error) { feedback(editorFeedback, error.message); }
  finally { button.disabled = false; }
});

document.querySelector('#reset-form').addEventListener('click', resetForm);
logoutButton.addEventListener('click', async () => {
  try { await request('/admin/api/logout', { method: 'POST' }); }
  finally { csrf = null; items = []; showAuthenticated(false); loginForm.elements.username.focus(); }
});

resetForm();
try {
  const session = await request('/admin/api/session');
  csrf = session.csrf ?? null;
  showAuthenticated(session.authenticated);
  if (session.authenticated) await loadItems();
  else loginForm.elements.username.focus();
} catch { showAuthenticated(false); feedback(loginFeedback, 'No se pudo conectar con el gestor.'); }
