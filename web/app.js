// app.js

// 兼容路径：既支持 /index.html 也支持 /web/index.html
const EXAMPLE_MP4_URL = new URL("./data/example_mp4.json", import.meta.url).href;

// --- 配置区域 ---
const ROW_CASES = ["1", "2", "3", "4", "5"];
const COL_MODELS = [
  "GroundTruth", "Ours", "CMT", "Diff_bgm", "GVMGen", "M2UGen", "VeM", "VidMuse",
];
const MODEL_LABELS = {
  Diff_bgm: "Diff-BGM",
  M2UGen: "M²UGen",
};
const SEPARATOR_COL_INDICES = [0];
const SPECIAL_FILE_MAP = {
  Ours: {
    "1": "1_bgm.mp4", "2": "2_bgm_2.mp4", "3": "3_bgm_2.mp4", "4": "4_bgm.mp4", "5": "5_bgm.mp4",
  },
};

function getCompareBasePath() {
  const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "";
  const normalized = base.replace(/\/$/, "");
  return normalized.endsWith("/web") ? "../demo_io/demo_compare" : "demo_io/demo_compare";
}

function getCompareVideoPath(model, caseId) {
  const base = getCompareBasePath();
  if (SPECIAL_FILE_MAP[model] && SPECIAL_FILE_MAP[model][caseId]) {
    return `${base}/${model}/${caseId}/${SPECIAL_FILE_MAP[model][caseId]}`;
  }
  return `${base}/${model}/${caseId}/${caseId}.mp4`;
}

// --- DOM 辅助函数 ---
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === undefined || child === null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function setStatus(msg) {
  const status = document.getElementById("status");
  if (status) status.textContent = msg || "";
}

function resolveMediaSrc(src) {
  if (!src) return "";
  try {
    // 兼容根目录与 /web/ 子目录：demo_io 路径需从站点根解析
    const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "";
    const normalized = base.replace(/\/$/, "");
    const baseForDemo = normalized.endsWith("/web") ? new URL("../", base) : new URL(base);
    const resolved = new URL(src, baseForDemo.href);
    return resolved.href;
  } catch {
    return src;
  }
}

const allVideos = [];
const allAudios = [];

function mediaNode(src, label, isSimple = false, options = {}) {
  const resolved = resolveMediaSrc(src);
  const video = el("video", {
    src: resolved,
    preload: "metadata",
    playsinline: "",
    "webkit-playsinline": "",
    muted: "",
    loop: "", // 循环播放会让展示更顺滑
  });

  const btnPlay = el("div", { class: "grid-play-icon" });
  const wrapper = el("div", { class: "grid-video-wrap" }, [video, btnPlay]);

  // Comparison Results：根据视频真实比例设置容器，避免黑边
  if (options.syncAspectRatio) {
    video.addEventListener("loadedmetadata", () => {
      if (video.videoWidth && video.videoHeight) {
        wrapper.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      }
    });
  }

  allVideos.push(video);

  const updateIcon = () => {
    if (video.paused) {
      btnPlay.classList.add("is-paused");
      btnPlay.classList.remove("is-playing");
    } else {
      btnPlay.classList.add("is-playing");
      btnPlay.classList.remove("is-paused");
    }
  };
  updateIcon();

  video.addEventListener("play", updateIcon);
  video.addEventListener("pause", updateIcon);

  wrapper.addEventListener("click", () => {
    const willPlay = video.paused;
    allVideos.forEach((v) => { if (!v.paused) v.pause(); });
    if (willPlay) video.play().catch(() => {});
    else video.pause();
  });

  // Simple 模式用于 Example 区域，不需要底部文字标签，鼠标悬停显示 Title 即可
  if (isSimple) {
    wrapper.title = label; // Tooltip
    return wrapper;
  }

  return el("div", { class: "grid-card" }, [
    wrapper,
    el("div", { class: "grid-label", text: label }),
  ]);
}

// --- 比较矩阵 ---
function renderCompareMatrix(container) {
  container.innerHTML = "";
  container.appendChild(
    el("div", { class: "section-head" }, [
      el("h2", { class: "page-title", text: "Comparison Results" }),
      el("p", { class: "page-subtitle", text: "点击视频播放/暂停。每一列代表一种方法。" }),
    ]),
  );

  const grid = el("div", { class: "compare-grid-container" });
  grid.style.setProperty("--cols", String(COL_MODELS.length));

  for (const caseId of ROW_CASES) {
    const rowDiv = el("div", { class: "compare-grid-row" });
    COL_MODELS.forEach((model, index) => {
      const path = getCompareVideoPath(model, caseId);
      const cell = el("div", { class: "compare-cell" });
      if (SEPARATOR_COL_INDICES.includes(index)) cell.classList.add("has-separator");
      
      const label = MODEL_LABELS[model] || model;
      cell.appendChild(mediaNode(path, label, false, { syncAspectRatio: true }));
      rowDiv.appendChild(cell);
    });
    grid.appendChild(rowDiv);
  }
  container.appendChild(grid);
}

// 需求3/5：对比区首格尺寸写入 CSS 变量，并计算竖屏/横屏统一面积 S 的宽高
function syncCompareCellSizeToCssVars() {
  const tbEl = document.getElementById("tbCompare");
  const firstWrap = tbEl?.querySelector(".compare-cell .grid-video-wrap");
  if (!firstWrap) return;
  const rect = firstWrap.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const root = document.documentElement;
  root.style.setProperty("--compare-cell-width", `${w}px`);
  root.style.setProperty("--compare-cell-height", `${h}px`);
  const S = w * h;
  root.style.setProperty("--example-cell-area", String(S));
  const portraitW = Math.sqrt(S * 9 / 16);
  const portraitH = Math.sqrt(S * 16 / 9);
  const landscapeW = Math.sqrt(S * 16 / 9);
  const landscapeH = Math.sqrt(S * 9 / 16);
  root.style.setProperty("--example-portrait-width", `${portraitW}px`);
  root.style.setProperty("--example-portrait-height", `${portraitH}px`);
  root.style.setProperty("--example-landscape-width", `${landscapeW}px`);
  root.style.setProperty("--example-landscape-height", `${landscapeH}px`);
}

// --- Example 区域：新布局（视频、图片、音频、文本、Ours双列）---

// 展示顺序：从上到下 全模态(视、图、音、文) → 缺失音频(视、图、文) → 缺失视频(音、图、文) → 缺失视频+音频(图、文)
const ROW_ORDER = ["video_audio_image_text", "video_image_text", "audio_image_text", "image_text"];

// 创建图片节点
// 默认：根据真实宽高设置 wrapper 的 aspect-ratio；可通过 options.syncAspectRatio = false 关闭
function imageNode(src, label, options = {}) {
  const resolved = resolveMediaSrc(src);
  const img = el("img", {
    src: resolved,
    alt: label || "",
    loading: "lazy",
  });
  const wrapper = el("div", { class: "grid-image-wrap" }, [img]);
  wrapper.title = label; // Tooltip
  const { syncAspectRatio = true } = options;
  if (syncAspectRatio) {
    img.addEventListener("load", () => {
      if (img.naturalWidth && img.naturalHeight) {
        wrapper.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      }
    });
  }
  return wrapper;
}

// 创建音频节点
function audioNode(src, label) {
  const resolved = resolveMediaSrc(src);
  const audio = el("audio", {
    src: resolved,
    preload: "metadata",
  });
  const btn = el("button", { class: "audio-btn", type: "button" });
  const wrapper = el("div", { class: "grid-audio-wrap" }, [btn, audio]);
  wrapper.title = label; // Tooltip

  allAudios.push(audio);

  const updateLabel = () => {
    btn.textContent = audio.paused ? "播放" : "暂停";
  };
  updateLabel();

  audio.addEventListener("play", updateLabel);
  audio.addEventListener("pause", updateLabel);

  btn.addEventListener("click", () => {
    const willPlay = audio.paused;
    allAudios.forEach((a) => { if (!a.paused) a.pause(); });
    if (willPlay) audio.play().catch(() => {});
    else audio.pause();
  });

  return wrapper;
}

// 创建文本节点
function textNode(text) {
  return el("div", { class: "grid-text-wrap" }, [
    el("div", { class: "grid-text-content", text: text || "" })
  ]);
}

// 缺失模态占位：文字说明 + 简洁图标
const PLACEHOLDER_LABELS = {
  video: "此处无视频模态",
  image: "此处无图片模态",
  audio: "此处无音频模态",
};
function placeholderNode(modality) {
  const label = PLACEHOLDER_LABELS[modality] || "此处无该模态";
  const icon = el("span", { class: "ex-placeholder-icon", "aria-hidden": "true", text: "—" });
  const text = el("span", { class: "ex-placeholder-text", text: label });
  return el("div", { class: "ex-placeholder ex-placeholder-missing-modality" }, [
    icon,
    text,
  ]);
}

// 需求7：同一行内媒体格等面积，用 .example-media-cell 包裹并统一尺寸
function wrapMediaCell(content) {
  const cell = el("div", { class: "example-media-cell" });
  cell.appendChild(content);
  return cell;
}

// 根据行类型渲染一行内容（orientation 用于 mode-portrait / mode-landscape 行高与列宽）
function renderExampleRow(original, rowData, orientation = "landscape") {
  const row = el("div", { class: "example-row" });
  const cells = el("div", { class: `example-row-cells mode-${orientation}` });

  const type = rowData.type;
  // Example 区：输入/输出视频的可见尺寸交给 CSS 控制，这里不再按元数据同步外层容器宽高比
  const mediaOpts = { syncAspectRatio: false };

  if (type === "video_audio_image_text") {
    if (original.video) cells.appendChild(wrapMediaCell(mediaNode(original.video, "输入视频", true, mediaOpts)));
    else cells.appendChild(wrapMediaCell(placeholderNode("video")));

    if (original.image) cells.appendChild(wrapMediaCell(imageNode(original.image, "输入图片", { syncAspectRatio: false })));
    else cells.appendChild(wrapMediaCell(placeholderNode("image")));

    // 音频也放入 example-media-cell，使播放按钮在单元格中心，与输入视频对齐
    cells.appendChild(wrapMediaCell(audioNode(original.audio, "输入音频")));
    // 文本放入 example-media-cell，使整块文本在单元格中居中（内部仍左对齐）
    cells.appendChild(wrapMediaCell(textNode(original.text || "")));
  } else if (type === "audio_image_text") {
    cells.appendChild(wrapMediaCell(placeholderNode("video")));

    if (original.image) cells.appendChild(wrapMediaCell(imageNode(original.image, "输入图片", { syncAspectRatio: false })));
    else cells.appendChild(wrapMediaCell(placeholderNode("image")));

    cells.appendChild(wrapMediaCell(audioNode(original.audio, "输入音频")));
    cells.appendChild(wrapMediaCell(textNode(original.text || "")));
  } else if (type === "video_image_text") {
    if (original.video) cells.appendChild(wrapMediaCell(mediaNode(original.video, "输入视频", true, mediaOpts)));
    else cells.appendChild(wrapMediaCell(placeholderNode("video")));

    if (original.image) cells.appendChild(wrapMediaCell(imageNode(original.image, "输入图片", { syncAspectRatio: false })));
    else cells.appendChild(wrapMediaCell(placeholderNode("image")));

    cells.appendChild(wrapMediaCell(placeholderNode("audio")));
    cells.appendChild(wrapMediaCell(textNode(original.text || "")));
  } else if (type === "image_text") {
    cells.appendChild(wrapMediaCell(placeholderNode("video")));

    if (original.image) cells.appendChild(wrapMediaCell(imageNode(original.image, "输入图片", { syncAspectRatio: false })));
    else cells.appendChild(wrapMediaCell(placeholderNode("image")));

    cells.appendChild(wrapMediaCell(placeholderNode("audio")));
    cells.appendChild(wrapMediaCell(textNode(original.text || "")));
  }

  const oursWrapper = el("div", { class: "example-ours-wrapper" });
  if (rowData.output?.bgm) {
    oursWrapper.appendChild(wrapMediaCell(mediaNode(rowData.output.bgm, "Ours BGM", true, mediaOpts)));
  } else {
    oursWrapper.appendChild(wrapMediaCell(placeholderNode("video")));
  }
  if (rowData.output?.vocal) {
    oursWrapper.appendChild(wrapMediaCell(mediaNode(rowData.output.vocal, "Ours Vocal", true, mediaOpts)));
  } else {
    oursWrapper.appendChild(wrapMediaCell(placeholderNode("video")));
  }
  cells.appendChild(oursWrapper);

  row.appendChild(cells);
  return row;
}

// 渲染单个分类（需求4：竖屏在上由 sort 保证；需求5/7：为媒体格统一面积加 orientation 类）
function renderCategory(category) {
  const orientation = category.orientation || "landscape";
  const categorySection = el("div", { class: `example-category ${orientation}` });

  // 分类标题
  const categoryTitle = el("h3", { class: "category-title", text: category.name });
  categorySection.appendChild(categoryTitle);
  
  // 表头行（与数据行同 mode，保证列对齐）
  const headerRow = el("div", { class: "example-header-row" });
  const headerCells = el("div", { class: `example-row-cells mode-${orientation}` });
  headerCells.appendChild(el("div", { class: "ex-header-cell", text: "输入视频" }));
  headerCells.appendChild(el("div", { class: "ex-header-cell", text: "输入图片" }));
  headerCells.appendChild(el("div", { class: "ex-header-cell", text: "输入音频" }));
  headerCells.appendChild(el("div", { class: "ex-header-cell", text: "输入文本" }));
  const oursHeader = el("div", { class: "example-ours-wrapper" });
  oursHeader.appendChild(el("div", { class: "ex-header-cell", text: "Ours BGM" }));
  oursHeader.appendChild(el("div", { class: "ex-header-cell", text: "Ours Vocal" }));
  headerCells.appendChild(oursHeader);
  headerRow.appendChild(headerCells);
  categorySection.appendChild(headerRow);
  
  // 按固定顺序排序后渲染 4 行
  const sortedRows = (category.rows || []).slice().sort(
    (a, b) => ROW_ORDER.indexOf(a.type) - ROW_ORDER.indexOf(b.type)
  );
  sortedRows.forEach(rowData => {
    const row = renderExampleRow(category.original, rowData, orientation);
    categorySection.appendChild(row);
  });
  
  return categorySection;
}

async function renderExampleGallery(container) {
  container.innerHTML = "";
  try {
    const resp = await fetch(EXAMPLE_MP4_URL);
    const data = await resp.json();
    
    // 顶部大标题
    container.appendChild(el("div", { class: "section-head" }, [
      el("h2", { class: "page-title", text: data.title || "Example Videos" }),
    ]));

    const categories = (data.categories || [])
      .slice()
      .sort((a, b) => {
        // 排序规则：
        // 1）默认：竖屏(portrait) 在前，横屏(landscape) 在后
        // 2）特殊需求：id === "live" 的“生活”分类永远排在最后
        const weight = (cat) => {
          if (cat.id === "live") return 999; // 强制排到所有分类之后
          return (cat.orientation || "landscape") === "portrait" ? 0 : 1;
        };
        return weight(a) - weight(b);
      });
    
    // 渲染每个分类
    categories.forEach(category => {
      const categorySection = renderCategory(category);
      container.appendChild(categorySection);
    });

  } catch (err) {
    console.error(err);
    container.innerText = "加载失败";
  }
}

// --- 初始化 ---
function init() {
  const btn = document.getElementById("reloadBtn");
  if (btn) btn.addEventListener("click", () => renderAll());
  renderAll();
}

async function renderAll() {
  const tbEl = document.getElementById("tbCompare");
  if (tbEl) renderCompareMatrix(tbEl);

  await new Promise((r) => requestAnimationFrame(r));
  syncCompareCellSizeToCssVars();

  const galleryEl = document.getElementById("videoGallery");
  if (galleryEl) await renderExampleGallery(galleryEl);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();