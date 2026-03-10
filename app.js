const providerCatalog = {
  openai: {
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/responses",
    models: ["gpt-4o", "gpt-5.2"]
  },
  anthropic: {
    label: "Anthropic",
    endpoint: "/api/anthropic/messages",
    models: ["claude-sonnet-4-20250514", "claude-sonnet-4-6"]
  }
};

const els = {
  providerChecklist: document.getElementById("providerChecklist"),
  modelChecklist: document.getElementById("modelChecklist"),
  providerAllBtn: document.getElementById("providerAllBtn"),
  providerNoneBtn: document.getElementById("providerNoneBtn"),
  modelAllBtn: document.getElementById("modelAllBtn"),
  modelNoneBtn: document.getElementById("modelNoneBtn"),
  temperature: document.getElementById("temperatureInput"),
  runCount: document.getElementById("runCountInput"),
  structuredOutputToggle: document.getElementById("structuredOutputToggle"),
  openaiApiKey: document.getElementById("openaiApiKeyInput"),
  anthropicApiKey: document.getElementById("anthropicApiKeyInput"),
  showApiKeysToggle: document.getElementById("showApiKeysToggle"),
  prompt: document.getElementById("promptInput"),
  imageInput: document.getElementById("imageInput"),
  imageList: document.getElementById("imageList"),
  imagePreview: document.getElementById("imagePreview"),
  jsonlFiles: document.getElementById("jsonlFileInput"),
  jsonlFileList: document.getElementById("jsonlFileList"),
  batchImageBase: document.getElementById("batchImageBaseInput"),
  singleModeBtn: document.getElementById("singleModeBtn"),
  batchModeBtn: document.getElementById("batchModeBtn"),
  singleInputSection: document.getElementById("singleInputSection"),
  batchInputSection: document.getElementById("batchInputSection"),
  batchPreview: document.getElementById("batchPreview"),
  requestExample: document.getElementById("requestExample"),
  submit: document.getElementById("submitBtn"),
  runBatch: document.getElementById("runBatchBtn"),
  save: document.getElementById("saveBtn"),
  stop: document.getElementById("stopBtn"),
  reset: document.getElementById("resetBtn"),
  status: document.getElementById("status"),
  progress: document.getElementById("batchProgress"),
  progressText: document.getElementById("batchProgressText"),
  output: document.getElementById("outputBox"),
  meta: document.getElementById("meta"),
  resultTableBody: document.getElementById("resultTableBody")
};

let lastRunData = null;
let previewUrls = [];
let selectedFiles = [];
let selectedJsonlFiles = [];
let inputMode = "single";
const openAiUploadedFileCache = new Map();
let stopRequested = false;
let activeRequestController = null;

init();

function init() {
  renderProviderChecklist();
  els.temperature.addEventListener("input", renderRequestExample);
  els.structuredOutputToggle.addEventListener("change", renderRequestExample);
  els.showApiKeysToggle.addEventListener("change", applyApiKeyVisibility);
  els.providerAllBtn.addEventListener("click", () => setChecklistSelection(els.providerChecklist, true, "provider"));
  els.providerNoneBtn.addEventListener("click", () => setChecklistSelection(els.providerChecklist, false, "provider"));
  els.modelAllBtn.addEventListener("click", () => setChecklistSelection(els.modelChecklist, true, "model"));
  els.modelNoneBtn.addEventListener("click", () => setChecklistSelection(els.modelChecklist, false, "model"));
  els.singleModeBtn.addEventListener("click", () => setInputMode("single"));
  els.batchModeBtn.addEventListener("click", () => setInputMode("batch"));
  els.imageInput.addEventListener("change", renderSelectedImages);
  els.jsonlFiles.addEventListener("change", handleJsonlFileSelection);
  els.batchImageBase.addEventListener("input", previewBatchFiles);
  els.submit.addEventListener("click", handleSubmitSingle);
  els.runBatch.addEventListener("click", handleSubmitBatch);
  els.stop.addEventListener("click", handleStop);
  els.save.addEventListener("click", saveRunToFile);
  els.reset.addEventListener("click", resetUI);
  onProviderChange();
  resetUI();
}

function setInputMode(mode) {
  inputMode = mode;
  const single = mode === "single";
  els.singleInputSection.classList.toggle("hidden", !single);
  els.batchInputSection.classList.toggle("hidden", single);
  els.singleModeBtn.classList.toggle("active", single);
  els.batchModeBtn.classList.toggle("active", !single);
  els.singleModeBtn.setAttribute("aria-pressed", single ? "true" : "false");
  els.batchModeBtn.setAttribute("aria-pressed", single ? "false" : "true");
}

function renderProviderChecklist() {
  els.providerChecklist.innerHTML = "";
  for (const [key, info] of Object.entries(providerCatalog)) {
    const row = document.createElement("label");
    row.className = "check-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = key;
    cb.checked = true;
    cb.dataset.kind = "provider";
    cb.addEventListener("change", onProviderChange);
    const text = document.createElement("span");
    text.textContent = info.label;
    row.appendChild(cb);
    row.appendChild(text);
    els.providerChecklist.appendChild(row);
  }
  populateModelsForSelectedProviders();
}

function onProviderChange() {
  populateModelsForSelectedProviders();
  renderRequestExample();
}

function populateModelsForSelectedProviders() {
  const selectedProviders = getSelectedProviders();
  const previouslySelected = new Set(
    Array.from(els.modelChecklist.querySelectorAll('input[data-kind="model"]:checked')).map((cb) => cb.value)
  );
  els.modelChecklist.innerHTML = "";

  for (const providerKey of selectedProviders) {
    const info = providerCatalog[providerKey];
    for (const model of info.models) {
      const value = `${providerKey}::${model}`;
      const row = document.createElement("label");
      row.className = "check-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = value;
      cb.dataset.kind = "model";
      cb.checked = previouslySelected.size ? previouslySelected.has(value) : true;
      cb.addEventListener("change", renderRequestExample);
      const text = document.createElement("span");
      text.textContent = getModelDisplayName(providerKey, model);
      row.appendChild(cb);
      row.appendChild(text);
      els.modelChecklist.appendChild(row);
    }
  }
}

function setChecklistSelection(container, checked, kind) {
  const nodes = container.querySelectorAll(`input[data-kind="${kind}"]`);
  for (const cb of nodes) {
    cb.checked = checked;
  }
  if (kind === "provider") {
    onProviderChange();
  } else {
    renderRequestExample();
  }
}

function getSelectedProviders() {
  return Array.from(els.providerChecklist.querySelectorAll('input[data-kind="provider"]:checked')).map((cb) => cb.value);
}

function getSelectedCombos() {
  return Array.from(els.modelChecklist.querySelectorAll('input[data-kind="model"]:checked')).map((cb) => {
    const [providerKey, model] = cb.value.split("::");
    return { providerKey, model, label: cb.parentElement?.textContent || cb.value };
  });
}

function getModelDisplayName(providerKey, model) {
  if (providerKey === "anthropic" && model === "claude-sonnet-4-20250514") {
    return "claude-sonnet-4";
  }
  return model;
}

function applyApiKeyVisibility() {
  const type = els.showApiKeysToggle.checked ? "text" : "password";
  els.openaiApiKey.type = type;
  els.anthropicApiKey.type = type;
}

function renderSelectedImages() {
  selectedFiles = Array.from(els.imageInput.files || []);
  els.imageInput.value = "";
  refreshSelectedImagesUI();
}

function handleJsonlFileSelection() {
  const incoming = Array.from(els.jsonlFiles.files || []);
  for (const file of incoming) {
    const exists = selectedJsonlFiles.some(
      (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
    );
    if (!exists) {
      selectedJsonlFiles.push(file);
    }
  }
  els.jsonlFiles.value = "";
  renderSelectedJsonlFiles();
  previewBatchFiles();
}

function renderSelectedJsonlFiles() {
  els.jsonlFileList.innerHTML = "";
  if (!selectedJsonlFiles.length) {
    els.jsonlFileList.textContent = "No JSONL files selected.";
    return;
  }

  selectedJsonlFiles.forEach((file, idx) => {
    const row = document.createElement("div");
    row.className = "jsonl-item";

    const name = document.createElement("span");
    name.className = "jsonl-name";
    name.textContent = file.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "mini secondary";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      selectedJsonlFiles.splice(idx, 1);
      renderSelectedJsonlFiles();
      previewBatchFiles();
    });

    row.appendChild(name);
    row.appendChild(remove);
    els.jsonlFileList.appendChild(row);
  });
}

function refreshSelectedImagesUI() {
  els.imageList.textContent = selectedFiles.length
    ? `${selectedFiles.length} image(s): ${selectedFiles.map((f) => f.name).join(", ")}`
    : "No images selected.";
  renderImagePreview(selectedFiles);
}

function renderImagePreview(files) {
  for (const url of previewUrls) {
    URL.revokeObjectURL(url);
  }
  previewUrls = [];
  els.imagePreview.innerHTML = "";

  files.forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const wrapper = document.createElement("div");
    wrapper.className = "thumb-wrap";

    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name;
    img.title = file.name;
    img.className = "thumb";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thumb-remove";
    btn.textContent = "x";
    btn.title = `Remove ${file.name}`;
    btn.addEventListener("click", () => removeSelectedImage(idx));

    wrapper.appendChild(img);
    wrapper.appendChild(btn);
    els.imagePreview.appendChild(wrapper);
  });
}

function removeSelectedImage(index) {
  selectedFiles.splice(index, 1);
  refreshSelectedImagesUI();
}

function renderRequestExample() {
  const combos = getSelectedCombos();
  if (!combos.length) {
    els.requestExample.textContent = "{\n  \"error\": \"Select at least one model\"\n}";
    return;
  }
  const first = combos[0];
  const userPrompt = buildUserPrompt("What is shown in the image?");
  const payload = buildExamplePayload(first.providerKey, first.model, userPrompt, getTemperature());
  els.requestExample.textContent = JSON.stringify(payload, null, 2);
}

async function handleSubmitSingle() {
  const combos = getSelectedCombos();
  const prompt = els.prompt.value.trim();
  const temperature = getTemperature();
  const runCount = getRunCount();

  if (!combos.length) {
    setStatus("Select at least one provider/model.", true);
    return;
  }
  if (!prompt) {
    setStatus("Please enter a prompt.", true);
    return;
  }
  for (const combo of combos) {
    if (!getApiKeyForProvider(combo.providerKey)) {
      setStatus(`Please enter the API key for ${providerCatalog[combo.providerKey].label}.`, true);
      return;
    }
  }

  setLoading(true);
  stopRequested = false;
  els.output.textContent = "";
  els.meta.textContent = "";
  clearResultTable();
  setProgress(0, 100);

  try {
    const encodedImages = await Promise.all(selectedFiles.map(fileToBase64));
    const userPrompt = buildUserPrompt(prompt);
    const runResults = [];
    const totalSteps = combos.length * runCount;
    let completed = 0;

    for (const combo of combos) {
      if (stopRequested) break;
      const apiKey = getApiKeyForProvider(combo.providerKey);
      const openAiContentParts =
        combo.providerKey === "openai" ? await prepareOpenAiContentParts(apiKey, encodedImages) : null;
      for (let i = 0; i < runCount; i += 1) {
        if (stopRequested) break;
        setStatus(`Running ${combo.label} (${i + 1}/${runCount})...`, false);
        const startedAt = performance.now();
        const payload = buildPayload(combo.providerKey, combo.model, userPrompt, encodedImages, temperature, openAiContentParts);
        const result = await sendRequest(combo.providerKey, apiKey, payload);
        const elapsedMs = Math.round(performance.now() - startedAt);

        const run = {
          provider: combo.providerKey,
          model: getModelDisplayName(combo.providerKey, combo.model),
          modelId: combo.model,
          runIndex: i + 1,
          elapsedMs,
          text: result.text || "(No text in response)",
          usage: result.usage || null
        };
        runResults.push(run);
        appendOutput(`[${combo.label}] Run ${run.runIndex}/${runCount} (${elapsedMs} ms)\n${run.text}\n\n`);
        appendResultRow({
          sourceFile: "single",
          questionId: "-",
          provider: run.provider,
          model: run.model,
          runIndex: run.runIndex,
          elapsedMs: run.elapsedMs,
          expectedAnswer: "",
          modelOutput: run.text
        });
        completed += 1;
        setProgress(completed, totalSteps);
      }
    }

    const totalMs = runResults.reduce((sum, r) => sum + r.elapsedMs, 0);
    const avgMs = runResults.length ? Math.round(totalMs / runResults.length) : 0;
    els.meta.textContent = `Combos: ${combos.length} | Runs: ${runResults.length} | Total time: ${totalMs} ms | Avg/run: ${avgMs} ms | Temperature: ${temperature}`;
    setStatus(stopRequested ? "Stopped by user." : "Completed.", false);

    lastRunData = {
      mode: "single",
      savedAt: new Date().toISOString(),
      settings: {
        combos,
        temperature,
        runCount,
        structuredOutput: !!els.structuredOutputToggle.checked
      },
      input: { prompt, userPrompt },
      images: encodedImages.map((img, idx) => ({
        name: selectedFiles[idx]?.name || `image-${idx + 1}`,
        mimeType: img.mimeType,
        base64: img.base64
      })),
      output: runResults
    };
  } catch (error) {
    if (stopRequested && error?.name === "AbortError") {
      setStatus("Stopped by user.", false);
    } else {
      setStatus(`Error: ${error.message}`, true);
    }
  } finally {
    activeRequestController = null;
    setLoading(false);
  }
}

async function handleSubmitBatch() {
  const combos = getSelectedCombos();
  const temperature = getTemperature();
  const runCount = getRunCount();

  if (!combos.length) {
    setStatus("Select at least one provider/model.", true);
    return;
  }
  for (const combo of combos) {
    if (!getApiKeyForProvider(combo.providerKey)) {
      setStatus(`Please enter the API key for ${providerCatalog[combo.providerKey].label}.`, true);
      return;
    }
  }

  setLoading(true);
  stopRequested = false;
  els.output.textContent = "";
  els.meta.textContent = "";
  clearResultTable();
  setProgress(0, 100);

  try {
    const baseUrlForBatch = getBatchImageBaseUrl();
    const batchSources = await loadBatchSources(baseUrlForBatch);
    if (!batchSources.length) {
      throw new Error("Upload one or more JSONL files.");
    }

    const questions = [];
    for (const source of batchSources) {
      const parsed = parseJsonlText(source.text, source.name);
      questions.push(...parsed.map((item) => ({ ...item, __source: source })));
    }
    if (!questions.length) {
      throw new Error("No valid questions found in uploaded JSONL files.");
    }

    await previewBatchFiles();

    const diagnostics = await diagnoseQuestionImageUris(questions, baseUrlForBatch);
    if (diagnostics.unresolved.length) {
      appendOutput("Image path diagnostics (unresolved before run):\n");
      for (const item of diagnostics.unresolved.slice(0, 50)) {
        appendOutput(`- [${item.questionId}] ${item.uri}\n`);
      }
      if (diagnostics.unresolved.length > 50) {
        appendOutput(`... and ${diagnostics.unresolved.length - 50} more unresolved image paths\n`);
      }
      appendOutput("\n");
    } else {
      appendOutput("Image path diagnostics: no unresolved image paths.\n\n");
    }

    const totalSteps = questions.length * combos.length * runCount;
    let completed = 0;
    const records = [];
    appendOutput(`Loaded ${questions.length} questions from ${batchSources.length} file(s).\n\n`);

    for (let qIdx = 0; qIdx < questions.length; qIdx += 1) {
      if (stopRequested) break;
      const q = questions[qIdx];
      const qPrompt = buildQuestionPrompt(q);
      const userPrompt = buildUserPrompt(qPrompt);
      const encodedImages = await loadQuestionImages(q, q.__source.baseUrl);

      for (const combo of combos) {
        if (stopRequested) break;
        const apiKey = getApiKeyForProvider(combo.providerKey);
        const openAiContentParts =
          combo.providerKey === "openai" ? await prepareOpenAiContentParts(apiKey, encodedImages) : null;
        for (let runIdx = 0; runIdx < runCount; runIdx += 1) {
          if (stopRequested) break;
          setStatus(`Q${qIdx + 1}/${questions.length} | ${combo.label} | ${runIdx + 1}/${runCount}`, false);
          const startedAt = performance.now();

          const payload = buildPayload(combo.providerKey, combo.model, userPrompt, encodedImages, temperature, openAiContentParts);
          const result = await sendRequest(combo.providerKey, apiKey, payload);
          const elapsedMs = Math.round(performance.now() - startedAt);
          const text = result.text || "(No text in response)";

          const record = {
            sourceFile: q.__source.name,
            questionId: q.id || `row-${qIdx + 1}`,
            questionIndex: qIdx + 1,
            provider: combo.providerKey,
            model: getModelDisplayName(combo.providerKey, combo.model),
            modelId: combo.model,
            runIndex: runIdx + 1,
            elapsedMs,
            expectedAnswer: q.answer || null,
            modelOutput: text,
            usage: result.usage || null,
            imageCount: encodedImages.length
          };
          records.push(record);
          appendResultRow(record);

          appendOutput(
            `[${q.__source.name}] Q${qIdx + 1}/${questions.length} (${record.questionId}) | ${combo.label} | Run ${runIdx + 1}/${runCount} | ${elapsedMs} ms\n${text}\n\n`
          );
          completed += 1;
          setProgress(completed, totalSteps);
        }
      }
    }

    const totalTime = records.reduce((sum, r) => sum + r.elapsedMs, 0);
    const avgTime = records.length ? Math.round(totalTime / records.length) : 0;
    els.meta.textContent = `Batch done | Questions: ${questions.length} | Combos: ${combos.length} | Runs: ${records.length} | Total time: ${totalTime} ms | Avg/run: ${avgTime} ms | Temperature: ${temperature}`;
    setStatus(stopRequested ? "Stopped by user." : "Batch completed.", false);

    lastRunData = {
      mode: "batch",
      savedAt: new Date().toISOString(),
      settings: {
        combos,
        temperature,
        runCount,
        structuredOutput: !!els.structuredOutputToggle.checked
      },
      sources: batchSources.map((s) => s.name),
      output: records
    };
  } catch (error) {
    if (stopRequested && error?.name === "AbortError") {
      setStatus("Stopped by user.", false);
    } else {
      setStatus(`Error: ${error.message}`, true);
    }
  } finally {
    activeRequestController = null;
    setLoading(false);
  }
}

async function loadBatchSources(baseUrlOverride = null) {
  const uploaded = [...selectedJsonlFiles];
  if (!uploaded.length) return [];

  const sources = [];
  for (const file of uploaded) {
    const text = await file.text();
    sources.push({ name: file.name, text, baseUrl: baseUrlOverride });
  }
  return sources;
}

async function previewBatchFiles() {
  const uploaded = [...selectedJsonlFiles];
  if (!uploaded.length) {
    els.batchPreview.textContent = "No JSONL file loaded.";
    return;
  }

  const baseUrl = getBatchImageBaseUrl();
  let totalQuestions = 0;
  let totalImageRefs = 0;
  let resolvableImageRefs = 0;
  let missingImageRefs = 0;
  const perFileLines = [];
  const checkedCache = new Map();
  const missingItems = [];

  for (const file of uploaded) {
    const text = await file.text();
    const rows = parseJsonlText(text, file.name, { silent: true });
    totalQuestions += rows.length;

    let fileImageRefs = 0;
    let fileResolvable = 0;
    let fileMissing = 0;

    for (const row of rows) {
      const images = Array.isArray(row.images) ? row.images : [];
      for (const img of images) {
        const uri = img && typeof img === "object" ? String(img.uri || "").trim() : "";
        if (!uri) continue;
        fileImageRefs += 1;
        const ok = await canResolveImageUri(uri, baseUrl, checkedCache);
        if (ok) {
          fileResolvable += 1;
        } else {
          fileMissing += 1;
          missingItems.push({
            file: file.name,
            questionId: row.id || "unknown",
            uri
          });
        }
      }
    }

    totalImageRefs += fileImageRefs;
    resolvableImageRefs += fileResolvable;
    missingImageRefs += fileMissing;
    perFileLines.push(`${file.name}: questions=${rows.length}, images=${fileImageRefs}, resolvable=${fileResolvable}, missing=${fileMissing}`);
  }

  const header =
    `Files: ${uploaded.length}\n` +
    `Total questions: ${totalQuestions}\n` +
    `Image refs: ${totalImageRefs} | Resolvable: ${resolvableImageRefs} | Missing: ${missingImageRefs}\n`;
  let missingBlock = "";
  if (missingItems.length) {
    const top = missingItems.slice(0, 30);
    const lines = top.map((m) => `- [${m.file}] ${m.questionId}: ${m.uri}`);
    const more = missingItems.length > top.length ? `\n... and ${missingItems.length - top.length} more` : "";
    missingBlock = `\n\nMissing image references:\n${lines.join("\n")}${more}`;
  }

  els.batchPreview.textContent = `${header}\n${perFileLines.join("\n")}${missingBlock}`;
}

function parseJsonlText(text, sourceName, options = {}) {
  const silent = !!options.silent;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    try {
      out.push(JSON.parse(lines[i]));
    } catch {
      if (!silent) {
        appendOutput(`Skipping invalid JSONL line ${i + 1} in ${sourceName}.\n`);
      }
    }
  }
  return out;
}

function getBatchImageBaseUrl() {
  const raw = String(els.batchImageBase.value || "").trim();
  if (!raw) return null;
  try {
    const normalized = raw.endsWith("/") ? raw : `${raw}/`;
    return new URL(normalized, window.location.href).href;
  } catch {
    return null;
  }
}

function buildQuestionPrompt(q) {
  const parts = [];
  if (q.question) parts.push(q.question);
  if (q.choices && typeof q.choices === "object") {
    parts.push("");
    parts.push("Choices:");
    for (const key of ["A", "B", "C", "D"]) {
      if (q.choices[key] != null) parts.push(`${key}. ${q.choices[key]}`);
    }
  }
  if (q.table_markdown) {
    parts.push("");
    parts.push("Table:");
    parts.push(String(q.table_markdown));
  }
  return parts.join("\n").trim();
}

async function loadQuestionImages(question, baseUrl) {
  if (!Array.isArray(question.images) || question.images.length === 0) return [];
  const encoded = [];
  for (const img of question.images) {
    const uri = img && typeof img === "object" ? img.uri : null;
    if (!uri) continue;
    const loaded = await tryLoadImageFromUri(uri, baseUrl);
    if (loaded) encoded.push(loaded);
  }
  return encoded;
}

async function tryLoadImageFromUri(uri, baseUrl) {
  const candidates = resolveImageUriCandidates(uri, baseUrl);
  for (const fullUrl of candidates) {
    try {
      const resp = await fetch(fullUrl, { method: "GET", cache: "no-store" });
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const base64 = await blobToBase64(blob);
      return { mimeType: blob.type || "image/png", base64 };
    } catch {
      // try next candidate
    }
  }
  return null;
}

function resolveImageUri(uri, baseUrl) {
  const candidates = resolveImageUriCandidates(uri, baseUrl);
  return candidates.length ? candidates[0] : null;
}

function resolveImageUriCandidates(uri, baseUrl) {
  const raw = String(uri || "").trim();
  if (!raw) return [];
  if (/^data:/i.test(raw) || /^https?:\/\//i.test(raw)) return [raw];

  const out = [];
  const pushUnique = (value) => {
    if (value && !out.includes(value)) out.push(value);
  };
  const tryResolve = (value, base) => {
    try {
      return new URL(value, base).href;
    } catch {
      return null;
    }
  };

  // Primary: user-specified image base.
  if (baseUrl) {
    pushUnique(tryResolve(raw, baseUrl));
    // If baseUrl already points to data/, and uri starts with data/, avoid data/data.
    if (raw.toLowerCase().startsWith("data/")) {
      pushUnique(tryResolve(raw.slice(5), baseUrl));
    }
  }

  // Fallbacks relative to current page.
  pushUnique(tryResolve(raw, window.location.href));
  pushUnique(tryResolve(raw, window.location.origin));

  return out;
}

async function canResolveImageUri(uri, baseUrl, cache) {
  const candidates = resolveImageUriCandidates(uri, baseUrl);
  if (!candidates.length) return false;

  for (const resolved of candidates) {
    if (/^data:/i.test(resolved)) return true;
    if (cache.has(resolved)) {
      if (cache.get(resolved)) return true;
      continue;
    }
    try {
      // Some local/static servers fail HEAD even when GET works.
      let resp = await fetch(resolved, { method: "HEAD", cache: "no-store" });
      if (!resp.ok) {
        resp = await fetch(resolved, { method: "GET", cache: "no-store" });
      }
      const ok = resp.ok;
      cache.set(resolved, ok);
      if (ok) return true;
    } catch {
      cache.set(resolved, false);
    }
  }
  return false;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Failed to encode image blob"));
    reader.readAsDataURL(blob);
  });
}

function buildPayload(providerKey, model, userPrompt, encodedImages, temperature, openAiContentParts = null) {
  if (providerKey === "openai") {
    const contentParts = Array.isArray(openAiContentParts)
      ? openAiContentParts
      : encodedImages.map((img) => ({
          type: "input_image",
          image_url: `data:${img.mimeType};base64,${img.base64}`
        }));
    return {
      model,
      temperature,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
            ...contentParts
          ]
        }
      ]
    };
  }

  if (providerKey === "anthropic") {
    const anthropicContent = [{ type: "text", text: userPrompt }];
    for (const img of encodedImages || []) {
      const mime = String(img?.mimeType || "").toLowerCase();
      if (mime === "application/pdf") {
        anthropicContent.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: img.base64
          }
        });
        continue;
      }
      if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)) {
        anthropicContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mime,
            data: img.base64
          }
        });
      }
    }

    return {
      model,
      temperature,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: anthropicContent
        }
      ]
    };
  }
  throw new Error(`Unsupported provider: ${providerKey}`);
}

async function sendRequest(providerKey, apiKey, payload) {
  const provider = providerCatalog[providerKey];
  const headers = { "Content-Type": "application/json" };
  if (providerKey === "openai") {
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (providerKey === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }

  let response;
  activeRequestController = new AbortController();
  try {
    response = await fetch(provider.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: activeRequestController.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    throw new Error(`Network error calling ${provider.label}: ${error.message}`);
  } finally {
    activeRequestController = null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `HTTP ${response.status}`);
  }
  return parseProviderResponse(providerKey, data);
}

function parseProviderResponse(providerKey, data) {
  if (providerKey === "openai") {
    let text = "";
    if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
      text = data.output_text;
    } else {
      const chunks = [];
      for (const item of data.output || []) {
        for (const part of item.content || []) {
          if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
            chunks.push(part.text);
          }
        }
      }
      text = chunks.join("\n").trim();
    }
    return { text, usage: data.usage };
  }
  if (providerKey === "anthropic") {
    const text = (data.content || [])
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    return { text, usage: data.usage };
  }
  return { text: "", usage: null };
}

function buildExamplePayload(providerKey, model, userPrompt, temperature) {
  return buildPayload(providerKey, model, userPrompt, [{ mimeType: "image/png", base64: "<base64-image>" }], temperature);
}

function isPdfMimeType(mimeType) {
  return String(mimeType || "").toLowerCase() === "application/pdf";
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

function cacheKeyForEncodedAsset(asset) {
  const mime = String(asset?.mimeType || "").toLowerCase();
  const b64 = String(asset?.base64 || "");
  return `${mime}|${b64.length}|${b64.slice(0, 64)}|${b64.slice(-64)}`;
}

async function uploadOpenAiFile(apiKey, encoded, filename = "upload.pdf") {
  const body = new FormData();
  const blob = base64ToBlob(encoded.base64, encoded.mimeType);
  body.append("file", blob, filename);
  body.append("purpose", "user_data");

  const req = {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body
  };

  let response = await fetch("https://api.openai.com/v1/files", req);
  if (!response.ok) {
    // Backward compatibility fallback.
    body.set("purpose", "assistants");
    response = await fetch("https://api.openai.com/v1/files", req);
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI Files upload failed (HTTP ${response.status})`);
  }
  if (!data?.id) {
    throw new Error("OpenAI Files upload succeeded without file id.");
  }
  return data.id;
}

async function prepareOpenAiContentParts(apiKey, encodedImages) {
  const parts = [];
  for (const encoded of encodedImages || []) {
    if (isPdfMimeType(encoded?.mimeType)) {
      const cacheKey = cacheKeyForEncodedAsset(encoded);
      let fileId = openAiUploadedFileCache.get(cacheKey);
      if (!fileId) {
        fileId = await uploadOpenAiFile(apiKey, encoded, "attachment.pdf");
        openAiUploadedFileCache.set(cacheKey, fileId);
      }
      parts.push({ type: "input_file", file_id: fileId });
    } else {
      parts.push({
        type: "input_image",
        image_url: `data:${encoded.mimeType};base64,${encoded.base64}`
      });
    }
  }
  return parts;
}

function buildUserPrompt(promptText) {
  const parts = [promptText.trim()];
  if (els.structuredOutputToggle.checked) {
    parts.push("");
    parts.push('Return JSON only with keys: "answer", "explanation".');
    parts.push('Where "answer" is one of "A","B","C","D".');
  }
  return parts.join("\n").trim();
}

function saveRunToFile() {
  if (!lastRunData) {
    setStatus("No run data available to save. Run single or batch first.", true);
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `construction-benchmark-${lastRunData.mode}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(lastRunData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`Saved file: ${filename}`, false);
}

function getTemperature() {
  const value = Number.parseFloat(els.temperature.value);
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const rounded = Math.round(normalized * 100) / 100;
  els.temperature.value = String(rounded);
  return rounded;
}

function getRunCount() {
  const value = Number.parseInt(els.runCount.value, 10);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(20, value));
}

function setLoading(isLoading) {
  els.submit.disabled = isLoading;
  els.runBatch.disabled = isLoading;
  els.stop.disabled = !isLoading;
  els.reset.disabled = isLoading;
  els.save.disabled = isLoading;
}

function handleStop() {
  stopRequested = true;
  if (activeRequestController) {
    activeRequestController.abort();
  }
  setStatus("Stopping after current request...", false);
}

function setStatus(message, isError) {
  els.status.textContent = message;
  els.status.classList.toggle("error", !!isError);
}

function setProgress(completed, total) {
  const safeTotal = Math.max(1, total);
  const pct = Math.round((completed / safeTotal) * 100);
  els.progress.value = pct;
  els.progressText.textContent = `${pct}%`;
}

function appendOutput(text) {
  els.output.textContent += text;
  els.output.scrollTop = els.output.scrollHeight;
}

function resetUI() {
  for (const cb of els.providerChecklist.querySelectorAll('input[data-kind="provider"]')) {
    cb.checked = true;
  }
  onProviderChange();
  for (const cb of els.modelChecklist.querySelectorAll('input[data-kind="model"]')) {
    cb.checked = true;
  }

  els.prompt.value = "";
  els.openaiApiKey.value = "";
  els.anthropicApiKey.value = "";
  els.showApiKeysToggle.checked = false;
  applyApiKeyVisibility();
  els.temperature.value = "0";
  els.runCount.value = "1";
  els.structuredOutputToggle.checked = false;
  els.imageInput.value = "";
  els.jsonlFiles.value = "";
  selectedJsonlFiles = [];
  renderSelectedJsonlFiles();
  els.batchImageBase.value = "/cert_eval/";
  els.batchPreview.textContent = "No JSONL file loaded.";
  selectedFiles = [];
  els.output.textContent = "";
  els.meta.textContent = "";
  clearResultTable();
  refreshSelectedImagesUI();
  els.imagePreview.innerHTML = "";
  for (const url of previewUrls) {
    URL.revokeObjectURL(url);
  }
  previewUrls = [];
  lastRunData = null;
  setStatus("Idle", false);
  setProgress(0, 100);
  renderRequestExample();
  setInputMode("single");
}

async function diagnoseQuestionImageUris(questions, baseUrlOverride = null) {
  const unresolved = [];
  const cache = new Map();
  for (const q of questions) {
    if (!Array.isArray(q.images)) continue;
    for (const img of q.images) {
      const uri = img && typeof img === "object" ? String(img.uri || "").trim() : "";
      if (!uri) continue;
      const baseUrl = q.__source?.baseUrl || baseUrlOverride || null;
      const ok = await canResolveImageUri(uri, baseUrl, cache);
      if (!ok) {
        unresolved.push({ questionId: q.id || "unknown", uri });
      }
    }
  }
  return { unresolved };
}

function appendResultRow(record) {
  const tr = document.createElement("tr");
  const predicted = extractAnswer(record.modelOutput || record.text || "");
  const cells = [
    record.sourceFile || "single",
    record.questionId || "-",
    record.provider || "-",
    record.model || "-",
    String(record.runIndex || "-"),
    String(record.elapsedMs ?? "-"),
    record.expectedAnswer || "",
    predicted
  ];
  for (const cell of cells) {
    const td = document.createElement("td");
    td.textContent = cell;
    tr.appendChild(td);
  }
  els.resultTableBody.appendChild(tr);
}

function clearResultTable() {
  els.resultTableBody.innerHTML = "";
}

function extractAnswer(text) {
  const raw = String(text || "");

  // 1) Strict JSON response
  try {
    const parsed = JSON.parse(raw);
    const a = String(parsed.answer || "").trim().toUpperCase();
    if (/^[ABCD]$/.test(a)) return a;
  } catch {
    // ignore parse error
  }

  // 2) JSON in fenced code block or mixed text
  const jsonAnswerMatch = raw.match(/"answer"\s*:\s*"?([ABCD])"?/i);
  if (jsonAnswerMatch) return jsonAnswerMatch[1].toUpperCase();

  // 3) Explicit textual answer formats only
  const explicitPatterns = [
    /\bfinal\s+answer\s*[:\-]\s*([ABCD])\b/i,
    /\banswer\s*[:\-]\s*([ABCD])\b/i,
    /\bchoice\s*[:\-]\s*([ABCD])\b/i,
    /^\s*([ABCD])\s*$/im
  ];
  for (const re of explicitPatterns) {
    const m = raw.match(re);
    if (m) return m[1].toUpperCase();
  }

  // No explicit answer found.
  return "";
}

function getApiKeyForProvider(providerKey) {
  if (providerKey === "openai") return els.openaiApiKey.value.trim();
  if (providerKey === "anthropic") return els.anthropicApiKey.value.trim();
  return "";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ mimeType: file.type || "image/png", base64 });
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}
