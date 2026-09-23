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
