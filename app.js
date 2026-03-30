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
  exposureModeBtn: document.getElementById("exposureModeBtn"),
  singleInputSection: document.getElementById("singleInputSection"),
  batchInputSection: document.getElementById("batchInputSection"),
  exposureInputSection: document.getElementById("exposureInputSection"),
  batchPreview: document.getElementById("batchPreview"),
  requestExample: document.getElementById("requestExample"),
  submit: document.getElementById("submitBtn"),
  runBatch: document.getElementById("runBatchBtn"),
  runExposure: document.getElementById("runExposureBtn"),
  save: document.getElementById("saveBtn"),
  stop: document.getElementById("stopBtn"),
  reset: document.getElementById("resetBtn"),
  status: document.getElementById("status"),
  progress: document.getElementById("batchProgress"),
  progressText: document.getElementById("batchProgressText"),
  output: document.getElementById("outputBox"),
  meta: document.getElementById("meta"),
  resultTableBody: document.getElementById("resultTableBody"),
  // Exposure search
  exposureSampleSize: document.getElementById("exposureSampleSize"),
  exposureSeed: document.getElementById("exposureSeed"),
  exposureQueryLen: document.getElementById("exposureQueryLen"),
  exposureNgramN: document.getElementById("exposureNgramN"),
  useDDGSearch: document.getElementById("useDDGSearch"),
  useBingSearch: document.getElementById("useBingSearch"),
  bingApiKeyInput: document.getElementById("bingApiKeyInput"),
  bingKeyRow: document.getElementById("bingKeyRow"),
  exposureResultsSection: document.getElementById("exposureResultsSection"),
  exposureStatus: document.getElementById("exposureStatus"),
  exposureProgress: document.getElementById("exposureProgress"),
  exposureProgressText: document.getElementById("exposureProgressText"),
  exposureSummary: document.getElementById("exposureSummary"),
  exposureTableBody: document.getElementById("exposureTableBody"),
  saveExposureBtn: document.getElementById("saveExposureBtn"),
  saveExposureFullBtn: document.getElementById("saveExposureFullBtn"),
  // Memorization test
  memorModeBtn:       document.getElementById("memorModeBtn"),
  memorInputSection:  document.getElementById("memorInputSection"),
  memorSampleSize:    document.getElementById("memorSampleSize"),
  memorSeed:          document.getElementById("memorSeed"),
  runTSGuessing:      document.getElementById("runTSGuessing"),
  runOptionShuffle:   document.getElementById("runOptionShuffle"),
  runMemor:           document.getElementById("runMemorBtn"),
  memorResultsSection:document.getElementById("memorResultsSection"),
  memorStatus:        document.getElementById("memorStatus"),
  memorProgress:      document.getElementById("memorProgress"),
  memorProgressText:  document.getElementById("memorProgressText"),
  memorSummary:       document.getElementById("memorSummary"),
  memorTSBody:        document.getElementById("memorTSBody"),
  memorShuffleBody:   document.getElementById("memorShuffleBody"),
  saveMemorBtn:       document.getElementById("saveMemorBtn")
};

let lastRunData = null;
let previewUrls = [];
let selectedFiles = [];
let selectedJsonlFiles = [];
let inputMode = "single";
const openAiUploadedFileCache = new Map();
let stopRequested = false;
let activeRequestController = null;

// Exposure search state
let exposureResults = [];
let exposureStopRequested = false;

// Memorization test state
let memorResults = [];
let memorStopRequested = false;
let lastMemorMeta = null;

const CERT_DATASETS = {
  CAC:  "/cert_eval/data/CAC.jsonl",
  CACM: "/cert_eval/data/CACM.jsonl",
  CCM:  "/cert_eval/data/CCM.jsonl",
  CPC:  "/cert_eval/data/CPC.jsonl"
};

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
  els.exposureModeBtn.addEventListener("click", () => setInputMode("exposure"));
  els.memorModeBtn.addEventListener("click",    () => setInputMode("memor"));
  els.imageInput.addEventListener("change", renderSelectedImages);
  els.jsonlFiles.addEventListener("change", handleJsonlFileSelection);
  els.batchImageBase.addEventListener("input", previewBatchFiles);
  els.submit.addEventListener("click", handleSubmitSingle);
  els.runBatch.addEventListener("click", handleSubmitBatch);
  els.runExposure.addEventListener("click", runExposureSearch);
  els.runMemor.addEventListener("click",    runMemorizationTest);
  els.saveMemorBtn.addEventListener("click", saveMemorResults);
  els.stop.addEventListener("click", handleStop);
  els.save.addEventListener("click", saveRunToFile);
  els.reset.addEventListener("click", resetUI);
  els.useBingSearch.addEventListener("change", () => {
    els.bingKeyRow.classList.toggle("hidden", !els.useBingSearch.checked);
  });
  els.saveExposureBtn.addEventListener("click", saveExposureResults);
  els.saveExposureFullBtn.addEventListener("click", saveExposureResultsFull);
  onProviderChange();
  resetUI();
}

function setInputMode(mode) {
  inputMode = mode;
  const single   = mode === "single";
  const batch    = mode === "batch";
  const exposure = mode === "exposure";
  const memor    = mode === "memor";

  els.singleInputSection.classList.toggle("hidden", !single);
  els.batchInputSection.classList.toggle("hidden", !batch);
  els.exposureInputSection.classList.toggle("hidden", !exposure);
  els.memorInputSection.classList.toggle("hidden", !memor);

  els.singleModeBtn.classList.toggle("active", single);
  els.batchModeBtn.classList.toggle("active", batch);
  els.exposureModeBtn.classList.toggle("active", exposure);
  els.memorModeBtn.classList.toggle("active", memor);

  els.singleModeBtn.setAttribute("aria-pressed", String(single));
  els.batchModeBtn.setAttribute("aria-pressed", String(batch));
  els.exposureModeBtn.setAttribute("aria-pressed", String(exposure));
  els.memorModeBtn.setAttribute("aria-pressed", String(memor));

  els.submit.classList.toggle("hidden", !single);
  els.runBatch.classList.toggle("hidden", !batch);
  els.runExposure.classList.toggle("hidden", !exposure);
  els.runMemor.classList.toggle("hidden", !memor);

  if (!exposure) els.exposureResultsSection.classList.add("hidden");
  if (!memor)    els.memorResultsSection.classList.add("hidden");
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
    parts.push('Answer the question and return JSON with keys: "explanations", "answer".');
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
  els.runExposure.disabled = isLoading;
  els.runMemor.disabled = isLoading;
  els.stop.disabled = !isLoading;
  els.reset.disabled = isLoading;
  els.save.disabled = isLoading;
}

function setExposureLoading(isLoading) {
  els.runExposure.disabled = isLoading;
  els.stop.disabled = !isLoading;
  els.reset.disabled = isLoading;
}

function handleStop() {
  stopRequested = true;
  exposureStopRequested = true;
  memorStopRequested = true;
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
  // Ensure exposure section stays hidden on reset
  els.exposureResultsSection.classList.add("hidden");
  clearExposureTable();
  els.memorResultsSection.classList.add("hidden");
  if (els.memorTSBody) els.memorTSBody.innerHTML = "";
  if (els.memorShuffleBody) els.memorShuffleBody.innerHTML = "";
  els.memorStatus.textContent = "Ready.";
  els.memorProgress.value = 0;
  els.memorProgressText.textContent = "0%";
  els.memorSummary.textContent = "";
  memorResults = [];
  els.exposureStatus.textContent = "Ready.";
  els.exposureProgress.value = 0;
  els.exposureProgressText.textContent = "0%";
  els.exposureSummary.textContent = "";
  exposureResults = [];
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

// ── Exposure Search ───────────────────────────────────────────────────────────

function getSelectedCerts() {
  return Array.from(document.querySelectorAll(".cert-check:checked")).map((cb) => cb.value);
}

function getSelectedModels() {
  return getSelectedCombos().map(({ providerKey, model }) => ({ provider: providerKey, model }));
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getExposureSampleSize() {
  const v = Number.parseInt(els.exposureSampleSize.value, 10);
  return Number.isFinite(v) ? Math.max(1, Math.min(500, v)) : 100;
}

function getExposureQueryLen() {
  const v = Number.parseInt(els.exposureQueryLen.value, 10);
  return Number.isFinite(v) ? Math.max(30, Math.min(200, v)) : 120;
}

function getExposureNgramN() {
  const v = Number.parseInt(els.exposureNgramN.value, 10);
  return Number.isFinite(v) ? Math.max(3, Math.min(13, v)) : 8;
}

function getExposureSeed() {
  const v = Number.parseInt(els.exposureSeed.value, 10);
  return Number.isFinite(v) ? Math.max(0, v) : 42;
}

/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * Returns a function that produces values in [0, 1) deterministically from seed.
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildExposureQuery(q, maxLen) {
  const text = (q.question || "").trim();
  if (!text) return "";
  let query = text.length > maxLen ? text.slice(0, maxLen).replace(/\s+\S*$/, "") : text;
  query = query.replace(/[?.,:;!]+$/, "").trim();
  return query;
}

/**
 * Fisher-Yates shuffle using a supplied PRNG so sampling is reproducible.
 * @param {object[]} questions - full question pool
 * @param {number}   n         - how many to sample
 * @param {function} rng       - PRNG returning [0,1); defaults to Math.random
 */
function sampleQuestions(questions, n, rng = Math.random) {
  if (n >= questions.length) return [...questions];
  const arr = [...questions];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr.slice(0, n);
}

async function searchDDG(query) {
  try {
    const url = `/api/search?q=${encodeURIComponent(query)}&engine=duckduckgo`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.error) return null;
    const abstract = (data.AbstractText || "").trim();
    const abstractUrl = (data.AbstractURL || "").trim();
    const results = Array.isArray(data.Results) ? data.Results : [];

    // RelatedTopics can be nested (subcategory groups with Topics[] array)
    const flatRelated = [];
    for (const t of (Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [])) {
      if (t && t.Text) flatRelated.push(t);
      if (t && Array.isArray(t.Topics)) {
        for (const sub of t.Topics) { if (sub && sub.Text) flatRelated.push(sub); }
      }
    }

    // Collect ALL text DDG returns — abstract, definition, answer, results, related topics
    const snippets = [];
    if (abstract) snippets.push(abstract);
    const definition = (data.Definition || "").trim();
    if (definition) snippets.push(definition);
    const answer = (data.Answer || "").trim();
    if (answer) snippets.push(answer);
    for (const r of results)    { if (r.Text) snippets.push(r.Text); }
    for (const r of flatRelated) { if (r.Text) snippets.push(r.Text); }

    return { abstract, abstractUrl, resultCount: results.length, relatedCount: flatRelated.length, snippets };
  } catch {
    return null;
  }
}

async function searchBing(query, apiKey) {
  try {
    // Unquoted query: returns actual web page snippets for N-gram overlap computation.
    // A quoted query ("exact phrase") returns 0 results for most niche exam questions
    // (the exact phrasing isn't verbatim on the web), which would leave snippets empty
    // and produce 0% overlap even when topically related content exists online.
    // totalEstimatedMatches from an unquoted search reflects how broadly the topic/
    // terminology appears on the web — a valid web-presence indicator.
    const url = `/api/search?q=${encodeURIComponent(query)}&engine=bing&count=10`;
    const resp = await fetch(url, { headers: { "x-bing-key": apiKey } });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.error) return null;
    const webPages = data.webPages || {};
    const totalEstimated = webPages.totalEstimatedMatches || 0;
    const items = (webPages.value || []).map((item) => ({
      url: item.url || "",
      name: item.name || "",
      snippet: item.snippet || ""
    }));
    return { totalEstimated, itemCount: items.length, topItems: items.slice(0, 5) };
  } catch {
    return null;
  }
}

/**
 * Compute the fraction of question N-grams that appear in web search result snippets.
 *
 * IMPORTANT DISTINCTION from classic contamination detection:
 *   Brown et al. (2020) NeurIPS (GPT-3) and Wei et al. NAACL 2024 (arXiv:2311.09783)
 *   use N-gram overlap to compare benchmark questions against a *training corpus* —
 *   that approach REQUIRES access to training data (see Table 1 in "Rethinking Benchmark
 *   and Contamination for Language Models with Rephrased Samples").
 *
 *   This implementation serves a DIFFERENT purpose: web exposure analysis.
 *   We compare question text against *public web search result snippets* (DuckDuckGo /
 *   Bing) to assess whether exam questions are publicly accessible online.
 *   No training data or model access is required.
 *
 * The N-gram similarity metric used here is a standard text similarity measure;
 * the overlap ratio indicates how much of the question phrasing appears verbatim in
 * publicly available web content retrieved for that query.
 *
 * @param {string}   questionText  - the full question string
 * @param {string[]} snippets      - web search result snippets
 * @param {number}   N             - n-gram window size (default 8)
 * @returns {{ overlap: number, questionGramCount: number, matchCount: number, hasSnippets: boolean }}
 */
function computeNgramOverlap(questionText, snippets, N = 8) {
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const toNgrams = (text) => {
    const words = normalize(text).split(" ").filter(Boolean);
    const grams = new Set();
    for (let i = 0; i <= words.length - N; i++) {
      grams.add(words.slice(i, i + N).join(" "));
    }
    return grams;
  };

  const questionGrams = toNgrams(questionText);
  if (questionGrams.size === 0 || !snippets.length) {
    return { overlap: 0, questionGramCount: questionGrams.size, matchCount: 0, hasSnippets: snippets.length > 0 };
  }

  const corpusGrams = toNgrams(snippets.join(" "));
  let matchCount = 0;
  for (const gram of questionGrams) {
    if (corpusGrams.has(gram)) matchCount++;
  }
  return { overlap: matchCount / questionGrams.size, questionGramCount: questionGrams.size, matchCount, hasSnippets: true };
}

/**
 * Compute exposure metrics for a single question against search results.
 *
 * Web Exposure Analysis — two independent signals (no training data required):
 *
 *  1. ngram_overlap — fraction of question N-grams found in *web search snippets*.
 *     This is a web-based text similarity measure, distinct from training-data
 *     contamination detection (which requires corpus access; see "Rethinking Benchmark
 *     and Contamination for Language Models with Rephrased Samples", Table 1).
 *     N-gram similarity as a metric: Papineni et al. (2002) BLEU; Manning & Schütze (1999).
 *
 *  2. bing_est_results — Bing estimated total results for the quoted query phrase.
 *     Serves as a retrieval-based web presence indicator.
 *     Conceptually related to BM25 retrieval confidence: Robertson & Zaragoza (2009).
 *
 * Neither signal requires training data or model access.
 * This method falls outside the four categories in Table 1 of "Rethinking Benchmark
 * and Contamination..." — it is a search-engine-based web exposure analysis, not a
 * training data contamination detection method.
 *
 * Classification: Exposed ≥ 0.10, Borderline ≥ 0.02, Not Exposed < 0.02.
 * When no snippets are available the overlap is 0 and result is "Not Exposed"
 * (snippet_count = 0 is recorded so readers can see no comparison was possible).
 */
function computeExposureRiskForQuestion(questionText, ddgResult, bingResult, N = 8) {
  if (!ddgResult && !bingResult) {
    return {
      risk: "unknown",
      ngram_overlap: null,
      ngram_match_count: null,
      ngram_gram_count: null,
      snippet_count: 0,
      bing_est_results: null,
      ddg_has_abstract: null,
      N
    };
  }

  // Gather all text snippets from both engines
  const snippets = [];
  if (ddgResult) {
    for (const s of (ddgResult.snippets || [])) { if (s) snippets.push(s); }
  }
  if (bingResult) {
    for (const item of (bingResult.topItems || [])) {
      if (item.snippet) snippets.push(item.snippet);
      if (item.name)    snippets.push(item.name);
    }
  }

  // Signal 1: n-gram overlap (Brown et al. 2020; Wei et al. NAACL 2024)
  const ngramResult = computeNgramOverlap(questionText, snippets, N);

  // Signal 2: Bing estimated results — null when Bing not used (show "—" in UI)
  const bing_est_results = bingResult ? bingResult.totalEstimated : null;

  // Supplementary: DDG abstract — null when DDG not used
  const ddg_has_abstract = ddgResult ? (ddgResult.abstract ? 1 : 0) : null;

  // Classification
  let risk;
  if (ngramResult.overlap >= 0.10) {
    risk = "high";
  } else if (ngramResult.overlap >= 0.02 && ngramResult.hasSnippets) {
    risk = "medium";
  } else {
    risk = "low";
  }

  return {
    risk,
    ngram_overlap:     parseFloat(ngramResult.overlap.toFixed(4)),
    ngram_match_count: ngramResult.matchCount,
    ngram_gram_count:  ngramResult.questionGramCount,
    snippet_count:     snippets.length,
    bing_est_results,
    ddg_has_abstract,
    N
  };
}

function setExposureStatus(message, isError = false) {
  els.exposureStatus.textContent = message;
  els.exposureStatus.classList.toggle("error", isError);
}

function setExposureProgress(completed, total) {
  const pct = Math.round((completed / Math.max(1, total)) * 100);
  els.exposureProgress.value = pct;
  els.exposureProgressText.textContent = `${pct}%`;
}

function clearExposureTable() {
  if (els.exposureTableBody) els.exposureTableBody.innerHTML = "";
}

function appendExposureRow(record) {
  const tr = document.createElement("tr");
  tr.className = `risk-${record.risk}`;

  const truncQ = record.question.length > 80
    ? record.question.slice(0, 80) + "\u2026"
    : record.question;

  // N-gram overlap (Brown et al. 2020; Wei et al. NAACL 2024)
  const N = record.N || 8;
  let overlapText, overlapTitle;
  if (record.ngram_overlap === null) {
    overlapText  = "\u2014";
    overlapTitle = "No data (both engines failed)";
  } else if (record.snippet_count === 0) {
    overlapText  = "0% (no snippets)";
    overlapTitle = `No snippets returned — overlap cannot be computed\nIncrease DDG coverage or enable Bing for richer results`;
  } else {
    overlapText  = (record.ngram_overlap * 100).toFixed(1) + "%";
    overlapTitle =
      `${record.ngram_match_count}/${record.ngram_gram_count} ${N}-grams matched across ${record.snippet_count} snippet(s)\n` +
      `Threshold: ≥10% = Exposed, 2–10% = Borderline, <2% = Not Exposed\n` +
      `Method: Brown et al. (2020) NeurIPS; Wei et al. NAACL 2024`;
  }

  // Bing estimated results (Wei et al. NAACL 2024) — "—" when Bing not enabled
  const bingEstText  = record.bing_est_results !== null ? record.bing_est_results.toLocaleString() : "\u2014";
  const bingEstTitle = record.bing_est_results !== null
    ? "Bing estimated total results for the query (unquoted) — web topic presence indicator"
    : "Bing not enabled for this run";

  // DDG abstract
  const ddg = record.ddgResult;
  const ddgAbstractFull = ddg ? (ddg.abstract || "") : "";
  let ddgText, ddgTitle;
  if (record.ddg_has_abstract === null) {
    ddgText  = "\u2014"; ddgTitle = "DDG not enabled";
  } else if (record.ddg_has_abstract === 1) {
    ddgText  = ddgAbstractFull.slice(0, 50) + (ddgAbstractFull.length > 50 ? "\u2026" : "");
    ddgTitle = ddgAbstractFull;
  } else {
    ddgText = "No abstract"; ddgTitle = "DDG returned no AbstractText for this query";
  }

  // Snippet count
  const snippetText  = String(record.snippet_count);
  const snippetTitle = `${record.snippet_count} text snippet(s) collected from search results\nOverlap is only meaningful when snippets > 0`;

  const cells = [
    { text: record.cert },
    { text: record.id },
    { text: truncQ,       title: record.question },
    { text: overlapText,  title: overlapTitle },
    { text: bingEstText,  title: bingEstTitle },
    { text: ddgText,      title: ddgTitle },
    { text: snippetText,  title: snippetTitle }
  ];
  for (const cell of cells) {
    const td = document.createElement("td");
    td.textContent = cell.text;
    if (cell.title) td.title = cell.title;
    tr.appendChild(td);
  }

  // Exposure label
  const tdRisk = document.createElement("td");
  const badge = document.createElement("span");
  badge.className = `risk-badge risk-${record.risk}`;
  const riskLabel = { high: "Exposed", medium: "Borderline", low: "Not Exposed", unknown: "No Data" };
  badge.textContent = riskLabel[record.risk] || record.risk;
  tdRisk.appendChild(badge);
  tr.appendChild(tdRisk);

  // Search links
  const tdLinks = document.createElement("td");
  const q = encodeURIComponent(record.query);
  const searchLinks = [
    { label: "G",   url: `https://www.google.com/search?q=${q}`,  title: "Google" },
    { label: "B",   url: `https://www.bing.com/search?q=${q}`,    title: "Bing" },
    { label: "DDG", url: `https://duckduckgo.com/?q=${q}`,        title: "DuckDuckGo" }
  ];
  for (const link of searchLinks) {
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = link.title;
    a.className = "search-link";
    a.textContent = link.label;
    tdLinks.appendChild(a);
  }
  tr.appendChild(tdLinks);

  els.exposureTableBody.appendChild(tr);
  const wrap = document.querySelector(".exposure-table-wrap");
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

function renderExposureSummaryStats(results, counts, withSnippetsCount, meanOverlap, N, seed) {
  const el = document.getElementById("exposureStats");
  if (!el) return;

  const total = results.length;
  if (!total) { el.classList.add("hidden"); return; }

  // Per-cert breakdown
  const byCert = {};
  for (const r of results) {
    if (!byCert[r.cert]) byCert[r.cert] = { high: 0, medium: 0, low: 0, unknown: 0, total: 0 };
    byCert[r.cert][r.risk]++;
    byCert[r.cert].total++;
  }

  const pct = (n) => `${n} (${((n / total) * 100).toFixed(1)}%)`;

  let certRows = "";
  for (const [cert, c] of Object.entries(byCert)) {
    certRows += `<tr>
      <td>${cert}</td><td>${c.total}</td>
      <td class="risk-high-cell">${c.high}</td>
      <td class="risk-medium-cell">${c.medium}</td>
      <td class="risk-low-cell">${c.low}</td>
      <td>${c.unknown}</td>
    </tr>`;
  }

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Questions Searched</div>
        <div class="stat-value">${total}</div>
        <div class="stat-sub">Seed ${seed} &middot; ${N}-gram</div>
      </div>
      <div class="stat-card stat-exposed">
        <div class="stat-label">Exposed</div>
        <div class="stat-value">${counts.high}</div>
        <div class="stat-sub">${((counts.high / total) * 100).toFixed(1)}% &mdash; overlap &ge; 10%</div>
      </div>
      <div class="stat-card stat-borderline">
        <div class="stat-label">Borderline</div>
        <div class="stat-value">${counts.medium}</div>
        <div class="stat-sub">${((counts.medium / total) * 100).toFixed(1)}% &mdash; overlap 2&ndash;10%</div>
      </div>
      <div class="stat-card stat-not-exposed">
        <div class="stat-label">Not Exposed</div>
        <div class="stat-value">${counts.low}</div>
        <div class="stat-sub">${((counts.low / total) * 100).toFixed(1)}% &mdash; overlap &lt; 2%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mean ${N}-gram Overlap</div>
        <div class="stat-value">${(meanOverlap * 100).toFixed(2)}%</div>
        <div class="stat-sub">over ${withSnippetsCount} questions with snippets</div>
      </div>
    </div>
    <table class="result-table stats-cert-table" style="margin-top:10px">
      <thead><tr><th>Cert</th><th>n</th><th>Exposed</th><th>Borderline</th><th>Not Exposed</th><th>No Data</th></tr></thead>
      <tbody>${certRows}</tbody>
    </table>`;
  el.classList.remove("hidden");
}

// Stores run metadata so saveExposureResults can include it
let lastExposureMeta = null;

function saveExposureResults() {
  if (!exposureResults.length) {
    setExposureStatus("No results to save. Run the search first.", true);
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `exposure-search-${stamp}.json`;

  const output = {
    metadata: lastExposureMeta || {},
    scoring_criteria: {
      method_name: "Web Exposure Analysis (search-engine-based public availability check)",
      method_note: "This is NOT training-data contamination detection. N-gram overlap for contamination detection (Brown et al. 2020 NeurIPS; Wei et al. NAACL 2024) requires access to the training corpus — see 'Rethinking Benchmark and Contamination for Language Models with Rephrased Samples' Table 1. This method requires NO training data and NO model access. It compares question text against public web search result snippets to assess whether exam questions are publicly accessible online.",
      signals: {
        ngram_overlap: {
          description: "Fraction of question N-grams found verbatim in web search result snippets. N-gram text similarity metric (Papineni et al. 2002 BLEU; Manning & Schütze 1999). snippet_count=0 means no web text was retrieved so overlap could not be computed.",
          range: "[0, 1]",
          N: lastExposureMeta ? lastExposureMeta.ngram_N : null
        },
        bing_est_results: {
          description: "Bing estimated total results for the unquoted query — indicates how broadly the topic/terminology is discussed on the public web.",
          range: "non-negative integer; null = Bing not enabled"
        },
        ddg_has_abstract: {
          description: "Binary: 1 if DuckDuckGo Instant Answers returned a non-empty AbstractText for the query (topic recognized in a public knowledge base).",
          range: "{0, 1, null}; null = DDG not enabled"
        }
      },
      classification: {
        "Exposed":     "ngram_overlap >= 0.10",
        "Borderline":  "0.02 <= ngram_overlap < 0.10",
        "Not Exposed": "ngram_overlap < 0.02 (or no snippets retrieved)",
        "No Data":     "both API calls failed"
      }
    },
    // Strip private fields (_choices, _answer) from public export
    results: exposureResults.map(({ _choices, _answer, ...pub }) => pub)
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setExposureStatus(`Saved: ${filename}`);
}

/**
 * Export results WITH the raw question data (choices, answer, images).
 * For private/appendix use only — do not publish if dataset is not public.
 * The standard saveExposureResults() omits raw question fields.
 */
function saveExposureResultsFull() {
  if (!exposureResults.length) {
    setExposureStatus("No results to save. Run the search first.", true);
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `exposure-search-FULL-${stamp}.json`;

  // Re-attach raw question fields from the live JSONL cache if available
  const output = {
    metadata: lastExposureMeta || {},
    warning: "This file contains raw exam questions. Do NOT publish or share publicly if the dataset is not public.",
    results: exposureResults.map((r) => ({
      cert:             r.cert,
      id:               r.id,
      question:         r.question,
      choices:          r._choices  || null,
      answer:           r._answer   || null,
      query:            r.query,
      risk:             r.risk,
      ngram_overlap:    r.ngram_overlap,
      ngram_match_count: r.ngram_match_count,
      ngram_gram_count:  r.ngram_gram_count,
      snippet_count:    r.snippet_count,
      bing_est_results: r.bing_est_results,
      ddg_has_abstract: r.ddg_has_abstract,
      N:                r.N,
      snippets_used:    [
        ...((r.ddgResult && r.ddgResult.snippets) || []),
        ...((r.bingResult && r.bingResult.topItems || []).flatMap((i) => [i.snippet, i.name].filter(Boolean)))
      ]
    }))
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setExposureStatus(`Saved: ${filename}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runExposureSearch() {
  const selectedCerts = getSelectedCerts();
  const sampleSize = getExposureSampleSize();
  const seed = getExposureSeed();
  const useDDG = els.useDDGSearch.checked;
  const useBing = els.useBingSearch.checked;
  const bingKey = (els.bingApiKeyInput.value || "").trim();
  const queryLen = getExposureQueryLen();
  const ngramN = getExposureNgramN();
  // Update the column header to reflect the current N
  const overlapHeader = document.getElementById("overlapHeader");
  if (overlapHeader) overlapHeader.textContent = `${ngramN}-gram Overlap`;

  if (!selectedCerts.length) {
    setExposureStatus("Select at least one certification dataset.", true);
    return;
  }
  if (!useDDG && !useBing) {
    setExposureStatus("Select at least one search engine.", true);
    return;
  }
  if (useBing && !bingKey) {
    setExposureStatus("Enter a Bing Search API key or uncheck Bing.", true);
    return;
  }

  exposureStopRequested = false;
  setExposureLoading(true);
  clearExposureTable();
  exposureResults = [];
  lastExposureMeta = null;
  els.exposureResultsSection.classList.remove("hidden");
  els.exposureSummary.textContent = "";
  setExposureProgress(0, 1);
  setExposureStatus("Loading datasets\u2026");

  try {
    // Load selected JSONL datasets from static server
    const allQuestions = [];
    for (const cert of selectedCerts) {
      try {
        const resp = await fetch(CERT_DATASETS[cert]);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const rows = parseJsonlText(text, cert, { silent: true });
        for (const q of rows) q.__cert = cert;
        allQuestions.push(...rows);
        setExposureStatus(`Loaded ${cert} (${rows.length} questions)\u2026`);
      } catch (err) {
        setExposureStatus(`Warning: could not load ${cert}: ${err.message}`, true);
        await delay(800);
      }
    }

    if (!allQuestions.length) {
      setExposureStatus("No questions loaded. Check that the server is running.", true);
      setExposureLoading(false);
      return;
    }

    // Seeded sampling — same seed always produces the same subset
    const rng = mulberry32(seed);
    const sampled = sampleQuestions(allQuestions, sampleSize, rng);
    setExposureStatus(
      `Loaded ${allQuestions.length} questions. Sampled ${sampled.length} (seed=${seed}). Starting search\u2026`
    );
    setExposureProgress(0, sampled.length);

    const startedAt = new Date().toISOString();
    let completed = 0;

    for (const q of sampled) {
      if (exposureStopRequested) break;

      const query = buildExposureQuery(q, queryLen);
      let ddgResult = null;
      let bingResult = null;

      if (useDDG && !exposureStopRequested) {
        setExposureStatus(`[${completed + 1}/${sampled.length}] ${q.__cert} \u2022 ${q.id || "?"} \u2014 DuckDuckGo\u2026`);
        ddgResult = await searchDDG(query);
        await delay(450);
      }

      if (useBing && !exposureStopRequested) {
        setExposureStatus(`[${completed + 1}/${sampled.length}] ${q.__cert} \u2022 ${q.id || "?"} \u2014 Bing\u2026`);
        bingResult = await searchBing(query, bingKey);
        await delay(250);
      }

      const metrics = computeExposureRiskForQuestion(q.question || "", ddgResult, bingResult, ngramN);
      const record = {
        cert: q.__cert,
        id: q.id || `row-${completed + 1}`,
        question: q.question || "",
        // _choices / _answer: stored for "Save with Raw Questions" export; not shown in public save
        _choices: q.choices || null,
        _answer:  q.answer  || null,
        query,
        // Primary citable metrics
        ngram_overlap:     metrics.ngram_overlap,
        ngram_match_count: metrics.ngram_match_count,
        ngram_gram_count:  metrics.ngram_gram_count,
        bing_est_results:  metrics.bing_est_results,
        ddg_has_abstract:  metrics.ddg_has_abstract,
        snippet_count:     metrics.snippet_count,
        risk:              metrics.risk,
        N:                 metrics.N,
        ddgResult,
        bingResult
      };
      exposureResults.push(record);
      appendExposureRow(record);
      completed++;
      setExposureProgress(completed, sampled.length);
    }

    // Summary counts
    const counts = { high: 0, medium: 0, low: 0, unknown: 0 };
    for (const r of exposureResults) counts[r.risk] = (counts[r.risk] || 0) + 1;

    // Mean overlap (only over questions that had at least one snippet)
    const withSnippets = exposureResults.filter((r) => r.snippet_count > 0);
    const meanOverlap = withSnippets.length
      ? (withSnippets.reduce((s, r) => s + r.ngram_overlap, 0) / withSnippets.length)
      : 0;

    // Store metadata for export
    lastExposureMeta = {
      run_date: startedAt,
      seed,
      ngram_N: ngramN,
      sample_size: sampled.length,
      total_pool: allQuestions.length,
      datasets: selectedCerts,
      query_length: queryLen,
      engines_used: { duckduckgo: useDDG, bing: useBing },
      counts,
      questions_with_snippets: withSnippets.length,
      mean_ngram_overlap_over_snippeted: parseFloat(meanOverlap.toFixed(4))
    };

    els.exposureSummary.textContent =
      `Seed: ${seed} | N=${ngramN} | Searched: ${completed}/${sampled.length} | ` +
      `Exposed: ${counts.high} | Borderline: ${counts.medium} | Not Exposed: ${counts.low} | No Data: ${counts.unknown}`;

    renderExposureSummaryStats(exposureResults, counts, withSnippets.length, meanOverlap, ngramN, seed);
    setExposureStatus(exposureStopRequested ? "Stopped by user." : "Exposure search complete.");
  } catch (err) {
    setExposureStatus(`Error: ${err.message}`, true);
  } finally {
    setExposureLoading(false);
  }
}

// ── Memorization Test ─────────────────────────────────────────────────────────

function getSelectedMemorCerts() {
  return Array.from(document.querySelectorAll(".memor-cert-check:checked")).map((cb) => cb.value);
}

function getMemorSampleSize() {
  const v = Number.parseInt(els.memorSampleSize.value, 10);
  return Number.isFinite(v) ? Math.max(1, Math.min(200, v)) : 50;
}

function getMemorSeed() {
  const v = Number.parseInt(els.memorSeed.value, 10);
  return Number.isFinite(v) ? Math.max(0, v) : 42;
}

function setMemorLoading(isLoading) {
  els.runMemor.disabled = isLoading;
  els.stop.disabled = !isLoading;
  els.reset.disabled = isLoading;
}

function setMemorStatus(message, isError = false) {
  els.memorStatus.textContent = message;
  els.memorStatus.classList.toggle("error", !!isError);
}

function setMemorProgress(completed, total) {
  const safeTotal = Math.max(1, total);
  const pct = Math.round((completed / safeTotal) * 100);
  els.memorProgress.value = pct;
  els.memorProgressText.textContent = `${pct}%`;
}

/**
 * TS-Guessing (Deng et al., NAACL 2024, arXiv:2311.09783)
 * Mask the correct answer option text with [BLANK]; ask model to fill it in.
 * High exact-match rate (>25% random baseline) suggests the model has memorized the content.
 */
function buildTSGuessingPrompt(q) {
  const choices = q.choices || {};
  const answerLabel = (q.answer || "").trim().toUpperCase();
  if (!answerLabel || !choices[answerLabel]) return null;

  const maskedText = choices[answerLabel];
  const modifiedChoices = { ...choices, [answerLabel]: "[BLANK]" };

  const choiceLines = Object.entries(modifiedChoices)
    .map(([k, v]) => `${k}. ${v}`)
    .join("\n");

  const prompt =
    `The following is a multiple-choice question. One of the answer options has been replaced with [BLANK].\n` +
    `Please fill in the [BLANK] with the exact missing option text (do not choose a letter — write out the answer text).\n\n` +
    `Question: ${q.question}\n\n${choiceLines}\n\n` +
    `Respond with only the text that should replace [BLANK], nothing else.`;

  return { prompt, maskLabel: answerLabel, maskedText };
}

/**
 * Normalizes text for comparison: lowercase, collapse whitespace, strip punctuation.
 */
function normalizeText(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if model output matches the expected (masked) answer text.
 * Returns { exact, normalized } booleans.
 */
function checkTSMatch(modelOutput, expectedText) {
  const raw = String(modelOutput || "").trim();
  const exp = String(expectedText || "").trim();
  const exact = raw === exp;
  const normalized = normalizeText(raw) === normalizeText(exp);
  return { exact, normalized };
}

/**
 * Option Shuffling (Zhou et al., 2024, arXiv:2404.18824)
 * Permute A/B/C/D labels using seeded RNG.
 * A model that memorizes answers (not reasoning) will anchor to the original label and be inconsistent.
 */
function buildShuffledQuestion(q, rng) {
  const choices = q.choices || {};
  const labels = Object.keys(choices);
  if (labels.length < 2) return null;

  // Fisher-Yates shuffle of labels
  const shuffled = [...labels];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Build new choices: new label → original option text
  const newChoices = {};
  const shuffleMap = {}; // newLabel -> originalLabel
  for (let i = 0; i < labels.length; i++) {
    newChoices[labels[i]] = choices[shuffled[i]];
    shuffleMap[labels[i]] = shuffled[i];
  }

  // The original correct answer text is now under a (possibly) different label
  const origCorrectLabel = (q.answer || "").trim().toUpperCase();
  const correctNewLabel = Object.keys(shuffleMap).find(
    (newLbl) => shuffleMap[newLbl] === origCorrectLabel
  ) || "";

  return { newChoices, correctNewLabel, shuffleMap };
}

/**
 * Build a standard MCQ prompt for a question (used by both original and shuffled variants).
 */
function buildMCQPrompt(question, choices) {
  const choiceLines = Object.entries(choices)
    .map(([k, v]) => `${k}. ${v}`)
    .join("\n");
  return (
    `Answer the following multiple-choice question. Respond with only the letter of the correct answer (A, B, C, or D).\n\n` +
    `Question: ${question}\n\n${choiceLines}\n\nAnswer:`
  );
}

/**
 * Extract the first letter A/B/C/D from model output.
 */
function extractMCQAnswer(modelOutput) {
  const m = String(modelOutput || "").match(/\b([A-Da-d])\b/);
  return m ? m[1].toUpperCase() : null;
}

function appendMemorTSRow(record) {
  const tr = document.createElement("tr");
  const matchExact = record.match?.exact;
  const matchNorm = record.match?.normalized;
  const matchClass = matchExact ? "match-yes" : matchNorm ? "match-partial" : "match-no";
  tr.innerHTML = `
    <td>${record.cert}</td>
    <td>${record.id}</td>
    <td title="${escHtml(record.question)}">${escHtml(record.question.slice(0, 60))}${record.question.length > 60 ? "…" : ""}</td>
    <td>${record.model}</td>
    <td>${record.maskLabel}</td>
    <td title="${escHtml(record.maskedText)}">${escHtml(record.maskedText.slice(0, 60))}${record.maskedText.length > 60 ? "…" : ""}</td>
    <td title="${escHtml(record.modelResponse)}">${escHtml((record.modelResponse || "").slice(0, 80))}${(record.modelResponse || "").length > 80 ? "…" : ""}</td>
    <td class="${matchClass}">${matchExact ? "Yes" : "No"}</td>
    <td class="${matchClass}">${matchNorm ? "Yes" : "No"}</td>
  `;
  els.memorTSBody.appendChild(tr);
}

function appendMemorShuffleRow(record) {
  const tr = document.createElement("tr");
  const consistent = record.origCorrect !== undefined && record.shuffleCorrect !== undefined
    ? (record.origCorrect === record.shuffleCorrect ? "Yes" : "No")
    : "—";
  const consistentClass = consistent === "Yes" ? "match-yes" : consistent === "No" ? "match-no" : "";
  const origCorrectClass = record.origCorrect ? "match-yes" : "match-no";
  const shuffleCorrectClass = record.shuffleCorrect ? "match-yes" : "match-no";
  tr.innerHTML = `
    <td>${record.cert}</td>
    <td>${record.id}</td>
    <td title="${escHtml(record.question)}">${escHtml(record.question.slice(0, 60))}${record.question.length > 60 ? "…" : ""}</td>
    <td>${record.model}</td>
    <td>${record.correctAnswer}</td>
    <td>${record.origPred || "—"}</td>
    <td class="${origCorrectClass}">${record.origCorrect ? "Yes" : "No"}</td>
    <td>${record.correctNewLabel}</td>
    <td>${record.shufflePred || "—"}</td>
    <td class="${shuffleCorrectClass}">${record.shuffleCorrect ? "Yes" : "No"}</td>
    <td class="${consistentClass}">${consistent}</td>
  `;
  els.memorShuffleBody.appendChild(tr);
}

function renderMemorSummaryStats(tsRecords, shuffleRecords, models, seed) {
  const statsDiv = document.getElementById("memorStats");
  if (!statsDiv) return;

  // TS-Guessing stats per model
  const tsModels = [...new Set(tsRecords.map((r) => r.model))];
  let tsHtml = "";
  if (tsRecords.length > 0) {
    const tsRows = tsModels.map((m) => {
      const recs = tsRecords.filter((r) => r.model === m);
      const exactN = recs.filter((r) => r.match?.exact).length;
      const normN = recs.filter((r) => r.match?.normalized).length;
      const exactPct = ((exactN / recs.length) * 100).toFixed(1);
      const normPct = ((normN / recs.length) * 100).toFixed(1);
      const exactClass = exactN / recs.length > 0.25 ? "risk-high-cell" : exactN / recs.length > 0.05 ? "risk-medium-cell" : "risk-low-cell";
      return `<tr><td>${m}</td><td>${recs.length}</td>
        <td class="${exactClass}">${exactN} (${exactPct}%)</td>
        <td>${normN} (${normPct}%)</td></tr>`;
    }).join("");
    tsHtml = `
      <h4 style="margin:8px 0 4px">TS-Guessing Summary <span class="method-note">Random baseline = 25% for 4-choice</span></h4>
      <table class="result-table stats-cert-table">
        <thead><tr><th>Model</th><th>Tested</th><th>Exact Match</th><th>Norm. Match</th></tr></thead>
        <tbody>${tsRows}</tbody>
      </table>`;
  }

  // Option Shuffling stats per model
  const shuffleModels = [...new Set(shuffleRecords.map((r) => r.model))];
  let shuffleHtml = "";
  if (shuffleRecords.length > 0) {
    const shuffleRows = shuffleModels.map((m) => {
      const recs = shuffleRecords.filter((r) => r.model === m);
      const origN = recs.filter((r) => r.origCorrect).length;
      const shuffleN = recs.filter((r) => r.shuffleCorrect).length;
      const consistN = recs.filter((r) => r.origCorrect === r.shuffleCorrect).length;
      const origPct = ((origN / recs.length) * 100).toFixed(1);
      const shufflePct = ((shuffleN / recs.length) * 100).toFixed(1);
      const consistPct = ((consistN / recs.length) * 100).toFixed(1);
      const drop = (origN - shuffleN) / recs.length;
      const dropClass = drop > 0.1 ? "risk-high-cell" : drop > 0.03 ? "risk-medium-cell" : "risk-low-cell";
      return `<tr><td>${m}</td><td>${recs.length}</td>
        <td>${origN} (${origPct}%)</td>
        <td>${shuffleN} (${shufflePct}%)</td>
        <td class="${dropClass}">${(drop * 100).toFixed(1)}%</td>
        <td>${consistN} (${consistPct}%)</td></tr>`;
    }).join("");
    shuffleHtml = `
      <h4 style="margin:8px 0 4px">Option Shuffling Summary</h4>
      <table class="result-table stats-cert-table">
        <thead><tr><th>Model</th><th>Tested</th><th>Orig. Acc.</th><th>Shuffle Acc.</th><th>Acc. Drop</th><th>Consistent</th></tr></thead>
        <tbody>${shuffleRows}</tbody>
      </table>`;
  }

  statsDiv.innerHTML = `
    <p style="color:var(--muted);font-size:0.85rem;margin:0 0 8px">
      Seed: ${seed} | Questions tested: ${[...new Set(tsRecords.map((r) => r.id))].length || [...new Set(shuffleRecords.map((r) => r.id))].length}
    </p>
    ${tsHtml}${shuffleHtml}`;
  statsDiv.classList.remove("hidden");
}

function saveMemorResults() {
  if (!memorResults.length && !lastMemorMeta) {
    alert("No memorization results to save.");
    return;
  }
  const payload = {
    meta: lastMemorMeta || {},
    methodology: {
      ts_guessing: {
        reference: "Deng et al., NAACL 2024 (arXiv:2311.09783)",
        description: "Mask correct answer option with [BLANK]; model fills in blank text. Exact-match rate above 25% random baseline suggests memorization.",
        random_baseline: 0.25
      },
      option_shuffling: {
        reference: "Zhou et al., 2024 (arXiv:2404.18824)",
        description: "Permute A/B/C/D labels; compare original vs shuffled accuracy. Reasoning models adapt; memorizing models anchor to original label.",
        interpretation: "Large accuracy drop after shuffling suggests label-anchoring (memorization artifact)."
      }
    },
    ts_guessing_results: memorResults.filter((r) => r.type === "ts"),
    option_shuffling_results: memorResults.filter((r) => r.type === "shuffle")
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `memorization_results_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function runMemorizationTest() {
  const selectedCerts = getSelectedMemorCerts();
  if (!selectedCerts.length) {
    alert("Select at least one certification dataset.");
    return;
  }
  const runTS = els.runTSGuessing.checked;
  const runShuffle = els.runOptionShuffle.checked;
  if (!runTS && !runShuffle) {
    alert("Select at least one test to run (TS-Guessing or Option Shuffling).");
    return;
  }

  // Get selected models
  const selectedModels = getSelectedModels();
  if (!selectedModels.length) {
    alert("Select at least one model in Model Settings.");
    return;
  }

  const sampleSize = getMemorSampleSize();
  const seed = getMemorSeed();
  const temperature = parseFloat(els.temperature.value) || 0;

  // Validate API keys
  for (const { provider } of selectedModels) {
    const key = getApiKeyForProvider(provider);
    if (!key) {
      alert(`Missing API key for ${providerCatalog[provider]?.label || provider}.`);
      return;
    }
  }

  memorResults = [];
  lastMemorMeta = null;
  memorStopRequested = false;
  if (els.memorTSBody) els.memorTSBody.innerHTML = "";
  if (els.memorShuffleBody) els.memorShuffleBody.innerHTML = "";
  const statsDiv = document.getElementById("memorStats");
  if (statsDiv) { statsDiv.innerHTML = ""; statsDiv.classList.add("hidden"); }
  els.memorSummary.textContent = "";

  els.memorResultsSection.classList.remove("hidden");
  setMemorLoading(true);
  setMemorStatus("Loading datasets…");
  setMemorProgress(0, 1);

  try {
    // Load questions from selected certs
    const allQuestions = [];
    for (const cert of selectedCerts) {
      if (memorStopRequested) break;
      const url = CERT_DATASETS[cert];
      if (!url) continue;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const rows = text.trim().split("\n")
          .filter((l) => l.trim())
          .map((l) => { const o = JSON.parse(l); o.__cert = cert; return o; })
          .filter((o) => o.question && o.choices && o.answer); // only testable questions
        allQuestions.push(...rows);
        setMemorStatus(`Loaded ${cert} (${rows.length} testable questions)…`);
      } catch (err) {
        setMemorStatus(`Warning: could not load ${cert}: ${err.message}`, true);
        await delay(600);
      }
    }

    if (!allQuestions.length) {
      setMemorStatus("No testable questions found (need question + choices + answer).", true);
      setMemorLoading(false);
      return;
    }

    const rng = mulberry32(seed);
    const sampled = sampleQuestions(allQuestions, sampleSize, rng);
    setMemorStatus(`Sampled ${sampled.length} questions (seed=${seed}). Running tests…`);

    const totalSteps = sampled.length * selectedModels.length * (runTS && runShuffle ? 2 : 1);
    let completed = 0;
    setMemorProgress(0, totalSteps);
    const startedAt = new Date().toISOString();

    for (const q of sampled) {
      if (memorStopRequested) break;

      for (const { provider, model } of selectedModels) {
        if (memorStopRequested) break;
        const apiKey = getApiKeyForProvider(provider);

        // ── TS-Guessing ────────────────────────────────────────────
        if (runTS && !memorStopRequested) {
          const tsPromptData = buildTSGuessingPrompt(q);
          if (tsPromptData) {
            setMemorStatus(
              `TS-Guessing [${completed + 1}/${totalSteps}] ${q.__cert} • ${q.id || "?"} — ${model}`
            );
            let modelResponse = "";
            let errorMsg = "";
            try {
              const payload = buildPayload(provider, model, tsPromptData.prompt, [], temperature);
              modelResponse = await sendRequest(provider, apiKey, payload);
            } catch (err) {
              errorMsg = err.message;
              modelResponse = `[ERROR: ${err.message}]`;
            }
            const match = errorMsg ? { exact: false, normalized: false } : checkTSMatch(modelResponse, tsPromptData.maskedText);
            const record = {
              type: "ts",
              cert: q.__cert,
              id: q.id || `row-${completed}`,
              question: q.question,
              model,
              maskLabel: tsPromptData.maskLabel,
              maskedText: tsPromptData.maskedText,
              modelResponse,
              match,
              error: errorMsg || null
            };
            memorResults.push(record);
            appendMemorTSRow(record);
          }
          completed++;
          setMemorProgress(completed, totalSteps);
        }

        // ── Option Shuffling ───────────────────────────────────────
        if (runShuffle && !memorStopRequested) {
          // Use a per-question RNG derived from seed + question index for reproducibility
          const qIdx = sampled.indexOf(q);
          const shuffleRng = mulberry32(seed + qIdx * 1000 + 1);
          const shuffled = buildShuffledQuestion(q, shuffleRng);

          if (shuffled) {
            setMemorStatus(
              `Option Shuffling [${completed + 1}/${totalSteps}] ${q.__cert} • ${q.id || "?"} — ${model}`
            );

            // Run original question
            const origPrompt = buildMCQPrompt(q.question, q.choices);
            let origResponse = "";
            let origError = "";
            try {
              const payload = buildPayload(provider, model, origPrompt, [], temperature);
              origResponse = await sendRequest(provider, apiKey, payload);
            } catch (err) {
              origError = err.message;
              origResponse = `[ERROR: ${err.message}]`;
            }
            const origPred = origError ? null : extractMCQAnswer(origResponse);
            const correctAnswer = (q.answer || "").trim().toUpperCase();
            const origCorrect = origPred === correctAnswer;

            await delay(300);
            if (memorStopRequested) break;

            // Run shuffled question
            const shufflePrompt = buildMCQPrompt(q.question, shuffled.newChoices);
            let shuffleResponse = "";
            let shuffleError = "";
            try {
              const payload = buildPayload(provider, model, shufflePrompt, [], temperature);
              shuffleResponse = await sendRequest(provider, apiKey, payload);
            } catch (err) {
              shuffleError = err.message;
              shuffleResponse = `[ERROR: ${err.message}]`;
            }
            const shufflePred = shuffleError ? null : extractMCQAnswer(shuffleResponse);
            const shuffleCorrect = shufflePred === shuffled.correctNewLabel;

            const record = {
              type: "shuffle",
              cert: q.__cert,
              id: q.id || `row-${completed}`,
              question: q.question,
              model,
              correctAnswer,
              correctNewLabel: shuffled.correctNewLabel,
              shuffleMap: shuffled.shuffleMap,
              origResponse,
              origPred,
              origCorrect,
              shuffleResponse,
              shufflePred,
              shuffleCorrect,
              error: origError || shuffleError || null
            };
            memorResults.push(record);
            appendMemorShuffleRow(record);
          }
          completed++;
          setMemorProgress(completed, totalSteps);
          await delay(300);
        }
      }
    }

    // Store metadata
    const tsRecs = memorResults.filter((r) => r.type === "ts");
    const shuffleRecs = memorResults.filter((r) => r.type === "shuffle");
    lastMemorMeta = {
      run_date: startedAt,
      seed,
      sample_size: sampled.length,
      datasets: selectedCerts,
      models: selectedModels.map((m) => `${m.provider}/${m.model}`),
      temperature,
      tests_run: { ts_guessing: runTS, option_shuffling: runShuffle },
      ts_guessing_count: tsRecs.length,
      option_shuffling_count: shuffleRecs.length
    };

    els.memorSummary.textContent =
      `Seed: ${seed} | Tested: ${sampled.length} questions | ` +
      `TS-Guessing: ${tsRecs.length} records | Shuffling: ${shuffleRecs.length} records`;

    renderMemorSummaryStats(tsRecs, shuffleRecs, selectedModels, seed);
    setMemorStatus(memorStopRequested ? "Stopped by user." : "Memorization test complete.");
  } catch (err) {
    setMemorStatus(`Error: ${err.message}`, true);
  } finally {
    setMemorLoading(false);
  }
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
