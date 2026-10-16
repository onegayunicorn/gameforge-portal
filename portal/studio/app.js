'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const validation = window.GameForgeStudioValidation;
  const state = {
    models: [],
    worker: null,
    workerModelId: '',
    loadedModelId: '',
    history: [],
    current: null,
    bodies: [],
    running: true,
    lastFrame: 0,
    startedAt: performance.now(),
    seq: 0,
    loadRequestId: 0,
    generationRequestId: 0,
    gpuReady: false,
  };

  const nodes = {
    modelSelect: $('#model-select'), modelNote: $('#model-note'), loadModel: $('#load-model'),
    modelTag: $('#model-state-tag'), progress: $('#model-progress'), progressText: $('#model-progress-text'),
    progressPercent: $('#model-progress-percent'), runtimeNote: $('#runtime-note'), gpuPill: $('#gpu-pill'),
    gpuLabel: $('#gpu-label'), prompt: $('#prompt'), templateSelect: $('#template-select'),
    applyTemplate: $('#apply-template'), generate: $('#generate'), clearConversation: $('#clear-conversation'),
    status: $('#studio-status'), stream: $('#stream-output'), outputTag: $('#output-tag'),
    outputTitle: $('#output-title'), outputDescription: $('#output-description'),
    jsonOutput: $('#json-output'), tsOutput: $('#ts-output'), downloadJson: $('#download-json'),
    downloadTs: $('#download-ts'), canvas: $('#simulation-preview'), togglePreview: $('#toggle-preview'),
    resetPreview: $('#reset-preview'),
  };

  function setStatus(text, kind) {
    nodes.status.textContent = text;
    nodes.status.dataset.state = kind || 'info';
  }

  function setRuntime(text, kind) {
    nodes.runtimeNote.textContent = text;
    nodes.runtimeNote.dataset.state = kind || 'info';
  }

  function updateGenerateButton() {
    nodes.generate.disabled = !state.loadedModelId || !nodes.prompt.value.trim() || Boolean(state.generationRequestId);
  }

  function showModelDetails() {
    const model = state.models.find((entry) => entry.id === nodes.modelSelect.value);
    if (!model) return;
    const memory = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(model.vramRequiredMB);
    nodes.modelNote.textContent = `Registry VRAM estimate: about ${memory} MB · ${model.contextWindow.toLocaleString()}-token context. This is not a guaranteed device requirement or download size.`;
  }

  function setGpuPill(label, mode) {
    nodes.gpuLabel.textContent = label;
    nodes.gpuPill.dataset.mode = mode;
  }

  async function checkWebGpu() {
    if (!window.isSecureContext) {
      setGpuPill('Secure origin required', 'browser');
      setRuntime('Open the Studio over HTTPS or localhost. WebGPU is unavailable on an insecure origin.', 'error');
      return;
    }
    if (!navigator.gpu) {
      setGpuPill('WebGPU unavailable', 'browser');
      setRuntime('This browser does not expose WebGPU. You can still load offline templates and inspect the generated-output format.', 'error');
      return;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No compatible WebGPU adapter was returned.');
      state.gpuReady = true;
      setGpuPill('WebGPU ready', 'desktop');
      setRuntime('WebGPU adapter available. Choose a model and load it on this device.', 'ok');
    } catch (error) {
      setGpuPill('WebGPU unavailable', 'browser');
      setRuntime(String(error && error.message || error), 'error');
    }
    nodes.loadModel.disabled = !state.gpuReady || !state.models.length;
  }

  async function loadModels() {
    try {
      const response = await fetch('./models.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Model registry returned HTTP ${response.status}.`);
      const catalog = await response.json();
      state.models = Array.isArray(catalog.models) ? catalog.models : [];
      nodes.modelSelect.replaceChildren(...state.models.map((model) => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.label}${model.recommended ? ' · recommended' : ''}`;
        return option;
      }));
      const preferred = state.models.find((model) => model.recommended) || state.models[0];
      if (preferred) nodes.modelSelect.value = preferred.id;
      nodes.modelSelect.disabled = state.models.length === 0;
      showModelDetails();
      nodes.loadModel.disabled = !state.gpuReady;
    } catch (error) {
      setRuntime(`Could not read the bundled model list: ${String(error && error.message || error)}`, 'error');
    }
  }

  function ensureWorker(modelId) {
    if (state.worker && state.workerModelId !== modelId) {
      state.worker.terminate();
      state.worker = null;
      state.loadedModelId = '';
      state.history = [];
    }
    if (state.worker) return;
    state.worker = new Worker('./ai-worker.bundle.js', { type: 'module', name: 'gameforge-local-webgpu' });
    state.workerModelId = modelId;
    state.worker.addEventListener('message', onWorkerMessage);
    state.worker.addEventListener('error', (event) => {
      state.loadRequestId = 0;
      state.generationRequestId = 0;
      nodes.loadModel.disabled = !state.gpuReady;
      updateGenerateButton();
      setStatus(`Local worker failed: ${event.message || 'unknown error'}`, 'error');
      setRuntime('Check WebGPU support and available graphics memory, then reload the page to try again.', 'error');
    });
  }

  function requestLoad() {
    if (!state.gpuReady) return;
    const modelId = nodes.modelSelect.value;
    const model = state.models.find((entry) => entry.id === modelId);
    if (!model) return;
    if (state.loadedModelId === modelId) {
      setRuntime(`${model.label} is already loaded in this tab.`, 'ok');
      updateGenerateButton();
      return;
    }
    ensureWorker(modelId);
    state.loadedModelId = '';
    state.loadRequestId = ++state.seq;
    nodes.loadModel.disabled = true;
    nodes.modelSelect.disabled = true;
    nodes.modelTag.textContent = 'loading';
    nodes.progress.value = 0;
    nodes.progressText.textContent = 'Starting local model…';
    nodes.progressPercent.textContent = '0%';
    setRuntime('The first load downloads the selected model and WebGPU library. Download progress is shown here.', 'info');
    state.worker.postMessage({ type: 'load', modelId, requestId: state.loadRequestId });
  }

  function onWorkerMessage(event) {
    const message = event.data || {};
    if (message.type === 'progress' && message.requestId === state.loadRequestId) {
      const pct = Math.round(Math.max(0, Math.min(1, Number(message.progress) || 0)) * 100);
      nodes.progress.value = pct;
      nodes.progressPercent.textContent = `${pct}%`;
      nodes.progressText.textContent = String(message.text || 'Loading local model');
      return;
    }
    if (message.type === 'ready' && message.requestId === state.loadRequestId) {
      state.loadRequestId = 0;
      state.loadedModelId = message.modelId;
      nodes.modelSelect.disabled = false;
      nodes.loadModel.disabled = !state.gpuReady;
      nodes.modelTag.textContent = 'ready · local';
      nodes.progress.value = 100;
      nodes.progressPercent.textContent = '100%';
      nodes.progressText.textContent = 'Model ready in this tab';
      setRuntime('Model loaded. Prompts are processed in the browser worker and are not sent to an inference API.', 'ok');
      setStatus('Ready for a local generation. Output is only saved when you choose a download button.', 'ok');
      updateGenerateButton();
      return;
    }
    if (message.type === 'token' && message.requestId === state.generationRequestId) {
      nodes.stream.hidden = false;
      nodes.stream.textContent += message.text || '';
      nodes.stream.scrollTop = nodes.stream.scrollHeight;
      return;
    }
    if (message.type === 'complete' && message.requestId === state.generationRequestId) {
      finishGeneration(String(message.text || ''));
      return;
    }
    if (message.type === 'error') {
      if (message.requestId === state.loadRequestId) {
        state.loadRequestId = 0;
        state.loadedModelId = '';
        nodes.modelSelect.disabled = false;
        nodes.loadModel.disabled = !state.gpuReady;
        nodes.modelTag.textContent = 'load failed';
        setRuntime(`Model load failed: ${message.error}`, 'error');
      } else if (message.requestId === state.generationRequestId) {
        state.generationRequestId = 0;
        nodes.modelSelect.disabled = false;
        nodes.loadModel.disabled = !state.gpuReady;
        updateGenerateButton();
        setStatus(`Local generation failed: ${message.error}`, 'error');
      }
    }
  }

  function parseJson(text) {
    let source = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(source); } catch { /* try the outermost JSON object */ }
    const first = source.indexOf('{');
    const last = source.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(source.slice(first, last + 1));
    throw new Error('The model did not return a JSON object. Try a simpler brief or choose another model.');
  }

  function applyOutput(payload, sourceLabel) {
    const checked = validation.validateStudioPayload(payload);
    if (!checked.ok) {
      state.current = null;
      nodes.jsonOutput.textContent = JSON.stringify(payload, null, 2);
      nodes.tsOutput.textContent = typeof payload.typescript === 'string' ? payload.typescript : '';
      nodes.outputTag.textContent = 'validation failed';
      nodes.downloadJson.disabled = true;
      nodes.downloadTs.disabled = true;
      setStatus(`Output was not applied to the preview: ${checked.errors.join(' ')}`, 'error');
      return false;
    }
    state.current = { sim: checked.sim, typescript: checked.typescript };
    nodes.outputTitle.textContent = checked.sim.title;
    nodes.outputDescription.textContent = checked.sim.description || 'Validated local simulation scene.';
    nodes.jsonOutput.textContent = JSON.stringify(checked.sim, null, 2);
    nodes.tsOutput.textContent = checked.typescript;
    nodes.outputTag.textContent = sourceLabel;
    nodes.downloadJson.disabled = false;
    nodes.downloadTs.disabled = false;
    loadSimulation(checked.sim);
    setTab('preview');
    return true;
  }

  function finishGeneration(text) {
    state.generationRequestId = 0;
    nodes.modelSelect.disabled = false;
    nodes.loadModel.disabled = !state.gpuReady;
    updateGenerateButton();
    nodes.stream.hidden = true;
    try {
      const payload = parseJson(text);
      const applied = applyOutput(payload, 'locally generated');
      if (applied) {
        state.history.push({ role: 'assistant', content: JSON.stringify({ sim: payload.sim }) });
        state.history = state.history.slice(-6);
        setStatus('Generated and validated locally. The safe JSON preview hot-refreshed; TypeScript remains inert text.', 'ok');
      }
    } catch (error) {
      state.current = null;
      nodes.jsonOutput.textContent = text || 'No response text was produced.';
      nodes.outputTag.textContent = 'invalid response';
      nodes.downloadJson.disabled = true;
      nodes.downloadTs.disabled = true;
      setStatus(String(error && error.message || error), 'error');
      setTab('json');
    }
  }

  function generate() {
    const prompt = nodes.prompt.value.trim();
    if (!prompt || !state.worker || !state.loadedModelId || state.generationRequestId) return;
    const userContent = `Create a GameForge Canvas2D game or simulation from this brief:\n${prompt}\n\nReturn the exact JSON object specified in your system instructions.`;
    const messages = [...state.history.slice(-4), { role: 'user', content: userContent }];
    state.history.push({ role: 'user', content: userContent });
    state.history = state.history.slice(-5);
    state.generationRequestId = ++state.seq;
    nodes.modelSelect.disabled = true;
    nodes.loadModel.disabled = true;
    state.current = null;
    nodes.downloadJson.disabled = true;
    nodes.downloadTs.disabled = true;
    nodes.jsonOutput.textContent = '';
    nodes.tsOutput.textContent = '';
    nodes.outputTag.textContent = 'generating locally';
    nodes.stream.textContent = '';
    nodes.stream.hidden = false;
    nodes.generate.disabled = true;
    setStatus('Generating on this device. Keep this tab open until the response completes.', 'info');
    state.worker.postMessage({ type: 'chat', messages, requestId: state.generationRequestId });
  }

  function applyTemplate() {
    const payload = validation.starterScene(nodes.templateSelect.value);
    if (applyOutput(payload, 'offline template')) {
      nodes.stream.hidden = true;
      setStatus('Offline template loaded. This local preview does not need WebGPU or a model download.', 'ok');
    }
  }

  function download(name, value, type) {
    if (!state.current) return;
    const blob = new Blob([value], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setTab(name) {
    const tabs = [['preview', $('#tab-preview'), $('#pane-preview')], ['json', $('#tab-json'), $('#pane-json')], ['ts', $('#tab-ts'), $('#pane-ts')]];
    tabs.forEach(([key, button, pane]) => {
      const selected = key === name;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
      pane.hidden = !selected;
    });
  }

  function loadSimulation(sim) {
    state.sim = JSON.parse(JSON.stringify(sim));
    state.bodies = sim.entities.map((entity) => ({ ...entity }));
    state.startedAt = performance.now();
  }

  function drawFrame(now) {
    const canvas = nodes.canvas;
    const context = canvas.getContext('2d');
    const sim = state.sim;
    if (!context || !sim) {
      requestAnimationFrame(drawFrame);
      return;
    }
    const delta = state.lastFrame ? Math.min((now - state.lastFrame) / 1000, 0.035) : 0;
    state.lastFrame = now;
    const world = sim.world;
    if (state.running && delta > 0) {
      for (const body of state.bodies) {
        if (body.static === true) continue;
        body.vy = Math.max(-1000, Math.min(1000, body.vy + world.gravityY * delta));
        body.x += body.vx * delta;
        body.y += body.vy * delta;
        const halfW = body.type === 'circle' ? body.radius : body.width / 2;
        const halfH = body.type === 'circle' ? body.radius : body.height / 2;
        if (body.x - halfW < 0) { body.x = halfW; body.vx = Math.abs(body.vx) * world.restitution; }
        if (body.x + halfW > world.width) { body.x = world.width - halfW; body.vx = -Math.abs(body.vx) * world.restitution; }
        if (body.y - halfH < 0) { body.y = halfH; body.vy = Math.abs(body.vy) * world.restitution; }
        if (body.y + halfH > world.height) { body.y = world.height - halfH; body.vy = -Math.abs(body.vy) * world.restitution; }
      }
    }
    context.setTransform(canvas.width / world.width, 0, 0, canvas.height / world.height, 0, 0);
    context.fillStyle = world.background;
    context.fillRect(0, 0, world.width, world.height);
    context.strokeStyle = 'rgba(147,174,225,.08)';
    context.lineWidth = 1;
    for (let x = 0; x <= world.width; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, world.height); context.stroke(); }
    for (let y = 0; y <= world.height; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(world.width, y); context.stroke(); }

    if (sim.rope) {
      const rope = sim.rope;
      const bob = state.bodies.find((body) => body.type === 'circle');
      const endX = bob ? bob.x : rope.anchorX;
      const endY = bob ? bob.y : rope.anchorY + rope.length;
      context.beginPath();
      context.moveTo(rope.anchorX, rope.anchorY);
      const elapsed = (now - state.startedAt) / 1000;
      for (let i = 1; i <= rope.segments; i += 1) {
        const t = i / rope.segments;
        const swing = Math.sin(elapsed * (1.4 + rope.stiffness) + t * Math.PI) * rope.length * (1 - rope.stiffness) * 0.12 * t;
        context.lineTo(rope.anchorX + (endX - rope.anchorX) * t + swing, rope.anchorY + (endY - rope.anchorY) * t);
      }
      context.strokeStyle = rope.color;
      context.lineWidth = 4;
      context.lineCap = 'round';
      context.stroke();
      context.beginPath();
      context.arc(rope.anchorX, rope.anchorY, 7, 0, Math.PI * 2);
      context.fillStyle = '#e8edfb';
      context.fill();
    }

    for (const body of state.bodies) {
      context.fillStyle = body.color;
      context.shadowColor = body.color;
      context.shadowBlur = 12;
      if (body.type === 'circle') {
        context.beginPath();
        context.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(body.x - body.radius * 0.28, body.y - body.radius * 0.3, Math.max(2, body.radius * 0.17), 0, Math.PI * 2);
        context.fillStyle = 'rgba(255,255,255,.75)';
        context.fill();
      } else {
        context.beginPath();
        context.roundRect(body.x - body.width / 2, body.y - body.height / 2, body.width, body.height, 8);
        context.fill();
      }
      context.shadowBlur = 0;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    requestAnimationFrame(drawFrame);
  }

  function initTabs() {
    $('#tab-preview').addEventListener('click', () => setTab('preview'));
    $('#tab-json').addEventListener('click', () => setTab('json'));
    $('#tab-ts').addEventListener('click', () => setTab('ts'));
  }

  function init() {
    loadModels();
    void checkWebGpu();
    const example = validation.starterScene('rope');
    applyOutput(example, 'starter scene ready');
    nodes.prompt.value = 'Create an elastic rope simulation hanging from a fixed anchor point. Add a bob, gravity, gentle oscillation, and a concise Canvas2D update function.';
    nodes.modelSelect.addEventListener('change', showModelDetails);
    nodes.loadModel.addEventListener('click', requestLoad);
    nodes.prompt.addEventListener('input', updateGenerateButton);
    nodes.generate.addEventListener('click', generate);
    nodes.applyTemplate.addEventListener('click', applyTemplate);
    nodes.downloadJson.addEventListener('click', () => download('sim.json', JSON.stringify(state.current && state.current.sim, null, 2) + '\n', 'application/json'));
    nodes.downloadTs.addEventListener('click', () => download('game.ts', state.current && state.current.typescript || '', 'text/plain'));
    nodes.clearConversation.addEventListener('click', () => {
      state.history = [];
      state.current = null;
      nodes.jsonOutput.textContent = '';
      nodes.tsOutput.textContent = '';
      nodes.downloadJson.disabled = true;
      nodes.downloadTs.disabled = true;
      nodes.outputTag.textContent = 'conversation cleared';
      nodes.stream.hidden = true;
      setStatus('In-memory conversation and generated output cleared. The selected model remains loaded.', 'ok');
      applyTemplate();
    });
    nodes.togglePreview.addEventListener('click', () => {
      state.running = !state.running;
      nodes.togglePreview.textContent = state.running ? 'Pause' : 'Run';
      nodes.togglePreview.setAttribute('aria-pressed', String(!state.running));
    });
    nodes.resetPreview.addEventListener('click', () => { if (state.sim) loadSimulation(state.sim); });
    initTabs();
    updateGenerateButton();
    requestAnimationFrame(drawFrame);
    window.addEventListener('pagehide', () => { if (state.worker) state.worker.terminate(); });
  }

  init();
})();
