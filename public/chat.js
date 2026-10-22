const form = document.getElementById('chat-form');
const input = document.getElementById('question');
const transcript = document.getElementById('transcript');
const send = document.getElementById('send');
const error = document.getElementById('error');
const suggestions = document.getElementById('suggestions');
let messages = [];
let busy = false;
function addMessage(role, text) {
  const item = document.createElement('div'); item.className = `msg ${role === 'assistant' ? 'bot' : 'user'}`;
  if (role === 'assistant') { const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.textContent = 'V'; item.appendChild(avatar); }
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text; item.appendChild(bubble);
  transcript.appendChild(item); transcript.scrollTop = transcript.scrollHeight;
}
async function ask(question) {
  if (busy || !question.trim()) return;
  busy = true; send.disabled = true; input.disabled = true; error.hidden = true; suggestions.hidden = true;
  const text = question.trim(); input.value = ''; addMessage('user', text);
  messages.push({ role: 'user', content: text });
  // Retain only a short conversation in browser memory. No localStorage or cookies.
  messages = messages.slice(-11);
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Service unavailable');
    addMessage('assistant', data.reply);
    messages.push({ role: 'assistant', content: data.reply });
    messages = messages.slice(-11);
  } catch (e) {
    error.textContent = e.message || 'Please try again.'; error.hidden = false;
    messages.pop();
  } finally { busy = false; send.disabled = false; input.disabled = false; input.focus(); }
}
form.addEventListener('submit', (event) => { event.preventDefault(); void ask(input.value); });
input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
suggestions.addEventListener('click', (event) => { const button = event.target.closest('button[data-prompt]'); if (button) void ask(button.dataset.prompt); });
