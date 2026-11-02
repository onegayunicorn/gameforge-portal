import { CreateMLCEngine } from '@mlc-ai/web-llm';
import modelCatalog from './models.json';

const modelIds = new Set(modelCatalog.models.map((model) => model.id));
const systemPrompt = `You are GameForge Studio's local game-design assistant. Return exactly one valid JSON object with keys "sim" and "typescript"; do not add markdown fences or any text outside the JSON object.

The sim value must follow this shape:
{"title":"1-100 characters","description":"short description","world":{"width":960,"height":540,"gravityY":number,"restitution":0-1,"background":"#RRGGBB"},"entities":[{"type":"circle","x":number,"y":number,"vx":number,"vy":number,"radius":number,"color":"#RRGGBB"} or {"type":"rect","x":number,"y":number,"vx":number,"vy":number,"width":number,"height":number,"color":"#RRGGBB"}],"rope":null or {"anchorX":number,"anchorY":number,"segments":integer 2-48,"length":number,"stiffness":number 0-1,"color":"#RRGGBB"}}

Use at most 32 entities, world width 240-1600 and height 180-1000, finite numeric values, and only six-digit hex colors. Use "rope": null if no rope is requested. Keep the scene suitable for the supplied Canvas2D preview.

The typescript value must be a plain TypeScript source string for a future GameForge Canvas2D update function. It is shown as text and is not executed by this Studio. Do not import packages, reference external CDNs, use network APIs, filesystem APIs, eval, or require. Do not claim that you have compiled or run code. The GameForge context API may use only ctx.drawLine, ctx.drawCircle, ctx.drawRect, ctx.integrateBodies, and ctx.resolvePlatformContacts.`;

let engine = null;
let loadedModelId = '';
let busy = false;

function send(message) {
  self.postMessage(message);
}

function progressReporter(requestId) {
  return (progress = {}) => {
    const raw = Number(progress.progress);
    const normalized = Number.isFinite(raw) ? (raw > 1 ? raw / 100 : raw) : 0;
    send({
      type: 'progress',
      requestId,
      progress: Math.max(0, Math.min(1, normalized)),
      text: String(progress.text || progress.message || 'Preparing local model'),
    });
  };
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 6) {
    throw new Error('Conversation is too long. Clear the conversation and try again.');
  }
  return messages.map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 8000) {
      throw new Error('The conversation contains an unsupported message.');
    }
    return { role: message.role, content: message.content };
  });
}

async function handle(message) {
  if (!message || typeof message !== 'object') return;
  if (busy) {
    send({ type: 'error', requestId: message.requestId, error: 'The local model is already processing a request.' });
    return;
  }
  try {
    if (message.type === 'load') {
      if (!modelIds.has(message.modelId)) throw new Error('That model is not in the approved local model list.');
      if (engine && loadedModelId !== message.modelId) throw new Error('Restart the local model worker before switching models.');
      if (!engine) {
        busy = true;
        engine = await CreateMLCEngine(message.modelId, {
          initProgressCallback: progressReporter(message.requestId),
        });
        loadedModelId = message.modelId;
        busy = false;
      }
      send({ type: 'ready', requestId: message.requestId, modelId: loadedModelId });
      return;
    }

    if (message.type === 'chat') {
      if (!engine) throw new Error('Load a local model first.');
      const messages = validateMessages(message.messages);
      busy = true;
      let output = '';
      const stream = await engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.35,
        max_tokens: 2600,
        stream: true,
        response_format: { type: 'json_object' },
      });
      for await (const chunk of stream) {
        const delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
        const text = delta && typeof delta.content === 'string' ? delta.content : '';
        if (text) {
          output += text;
          send({ type: 'token', requestId: message.requestId, text });
        }
      }
      busy = false;
      send({ type: 'complete', requestId: message.requestId, text: output });
      return;
    }

    if (message.type === 'ping') {
      send({ type: 'pong', requestId: message.requestId, modelId: loadedModelId });
    }
  } catch (error) {
    busy = false;
    send({ type: 'error', requestId: message.requestId, error: String(error && error.message || error) });
  }
}

self.addEventListener('message', (event) => { void handle(event.data); });
