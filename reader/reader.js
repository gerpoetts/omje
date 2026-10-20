// PDF.js is loaded only inside the on-demand reader, not with the website.
import { getDocument, GlobalWorkerOptions, TextLayer } from "./vendor/pdf.js";

GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.js", import.meta.url).href;
const copy = {
  es: { page: "Página", previous: "Páginas anteriores", next: "Páginas siguientes", less: "Reducir", more: "Ampliar", reset: "Restablecer ampliación", layout: "Vista de lectura", auto: "Auto", single: "1 página", double: "2 páginas", download: "Descargar PDF", language: "Documento original en portugués", hint: "← → para pasar páginas · Esc para cerrar", loading: "Preparando la lectura…", error: "No pudimos cargar la publicación. Puedes abrir el PDF directamente.", fallback: "Abrir PDF", footer: "Lectura en línea · OMJE", document: "Documento", progress: "Progreso de lectura", title: "Lector de publicaciones" },
  pt: { page: "Página", previous: "Páginas anteriores", next: "Próximas páginas", less: "Reduzir", more: "Ampliar", reset: "Restaurar ampliação", layout: "Visualização", auto: "Auto", single: "1 página", double: "2 páginas", download: "Baixar PDF", language: "Documento original em português", hint: "← → para virar páginas · Esc para fechar", loading: "Preparando a leitura…", error: "Não foi possível carregar a publicação. Você pode abrir o PDF diretamente.", fallback: "Abrir PDF", footer: "Leitura on-line · OMJE", document: "Documento", progress: "Progresso da leitura", title: "Leitor de publicações" },
  en: { page: "Page", previous: "Previous pages", next: "Next pages", less: "Zoom out", more: "Zoom in", reset: "Reset zoom", layout: "Reading layout", auto: "Auto", single: "1 page", double: "2 pages", download: "Download PDF", language: "Original document in Portuguese", hint: "← → to turn pages · Esc to close", loading: "Preparing your reading…", error: "We could not load the publication. You can open the PDF directly.", fallback: "Open PDF", footer: "Read online · OMJE", document: "Document", progress: "Reading progress", title: "Publication reader" },
};
const files = { regional: "juventudes-e-democracia-na-ibero-america.pdf", gpm: "relatorio-de-atividades-omje-gpm.pdf" };
const params = new URLSearchParams(location.search);
const lang = Object.hasOwn(copy, params.get("lang")) ? params.get("lang") : "es";
const report = Object.hasOwn(files, params.get("report")) ? params.get("report") : "regional";
const t = copy[lang];
const $ = id => document.getElementById(id);
document.documentElement.lang = lang;
document.title = `OMJE · ${t.title}`;
document.querySelector(".toolbar").setAttribute("aria-label", { es: "Controles del lector", pt: "Controles do leitor", en: "Reader controls" }[lang]);
$("page-label").textContent = t.page;
$("page").setAttribute("aria-label", t.page);
$("language").textContent = t.language;
$("hint").textContent = t.hint;
$("notice-text").textContent = t.loading;
$("fallback").textContent = t.fallback;
$("footer-label").textContent = t.footer;
$("stage").setAttribute("aria-label", t.document);
$("reading-progress").setAttribute("aria-label", t.progress);
for (const [id, label] of [["previous",t.previous],["next",t.next],["zoom-out",t.less],["zoom-in",t.more],["zoom-reset",t.reset],["layout",t.layout]]) $(id).setAttribute("aria-label",label);
for (const [index, text] of [t.auto,t.single,t.double].entries()) $("layout").options[index].textContent = text;
const pdfUrl = new URL(`../reports/${files[report]}`, import.meta.url).href;
$("download").href = pdfUrl;
$("download").querySelector("span").textContent = t.download;
$("fallback").href = pdfUrl;
const stage = $("stage");
const spread = $("spread");
let pdf, page = 1, zoom = 1, generation = 0, renderTasks = [];
const mobile = matchMedia("(max-width: 700px)");
const columns = () => $("layout").value === "auto" ? (mobile.matches ? 1 : 2) : Number($("layout").value);

function updateControls() {
  $("page").value = page;
  $("total").textContent = `/ ${pdf.numPages}`;
  $("previous").disabled = page === 1;
  $("next").disabled = page + columns() > pdf.numPages;
  $("zoom-out").disabled = zoom <= .75;
  $("zoom-in").disabled = zoom >= 2;
  $("zoom-reset").textContent = `${Math.round(zoom * 100)}%`;
  $("reading-progress").max = pdf.numPages;
  $("reading-progress").value = Math.min(page + columns() - 1, pdf.numPages);
  $("page-status").textContent = `${t.page} ${page}${columns() === 2 && page < pdf.numPages ? `–${page + 1}` : ""} / ${pdf.numPages}`;
  try { sessionStorage.setItem(`omje-reading-${report}`, String(page)); } catch { /* Reading works without storage. */ }
}

async function render() {
  if (!pdf) return;
  const run = ++generation;
  renderTasks.forEach(task => task.cancel());
  renderTasks = [];
  spread.replaceChildren();
  spread.setAttribute("aria-busy", "true");
  updateControls();
  const count = columns();
  // Fit the complete spread to the viewport; zoom then enlarges it for close reading.
  const availableWidth = stage.clientWidth - (mobile.matches ? 20 : 48);
  const availableHeight = Math.max(240, stage.clientHeight - 60);
  try {
    for (let number = page; number <= Math.min(page + count - 1, pdf.numPages); number++) {
      const pdfPage = await pdf.getPage(number);
      if (run !== generation) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min((availableWidth - (count - 1) * 12) / count / natural.width, availableHeight / natural.height) * zoom;
      const viewport = pdfPage.getViewport({ scale });
      const wrapper = document.createElement("div");
      wrapper.className = "page";
      wrapper.style.width = `${viewport.width}px`;
      wrapper.style.height = `${viewport.height}px`;
      wrapper.style.setProperty("--scale-factor", scale);
      wrapper.style.setProperty("--total-scale-factor", scale);
      wrapper.style.setProperty("--scale-round-x", "1px");
      wrapper.style.setProperty("--scale-round-y", "1px");
      wrapper.lang = "pt";
      wrapper.setAttribute("role", "group");
      wrapper.setAttribute("aria-label", `${t.page} ${number}`);
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * dpr);
      canvas.height = Math.ceil(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const text = document.createElement("div");
      text.className = "textLayer";
      const badge = document.createElement("span");
      badge.className = "page-number";
      badge.textContent = number;
      badge.setAttribute("aria-hidden", "true");
      wrapper.append(canvas, text, badge);
      spread.append(wrapper);
      const task = pdfPage.render({ canvasContext: canvas.getContext("2d"), canvas, viewport, transform: [dpr,0,0,dpr,0,0] });
      renderTasks.push(task);
      await task.promise;
      if (run !== generation) return;
      const textLayer = new TextLayer({ textContentSource: pdfPage.streamTextContent(), container: text, viewport });
      renderTasks.push(textLayer);
      await textLayer.render();
    }
    if (run === generation) {
      spread.setAttribute("aria-busy", "false");
      $("notice").hidden = true;
    }
  } catch (error) {
    if (run === generation && error.name !== "RenderingCancelledException" && error.name !== "AbortException") showError();
  }
}

function showError() {
  $("notice").hidden = false;
  $("notice-text").textContent = t.error;
  $("notice").querySelector(".spinner").hidden = true;
  $("fallback").hidden = false;
  spread.setAttribute("aria-busy", "false");
}
function goTo(number) {
  if (!pdf) return;
  page = Math.max(1, Math.min(pdf.numPages, number));
  stage.scrollTop = 0;
  stage.scrollLeft = 0;
  render();
}
$("previous").addEventListener("click", () => goTo(page - columns()));
$("next").addEventListener("click", () => goTo(page + columns()));
$("page-form").addEventListener("submit", event => { event.preventDefault(); const value = Number($("page").value); if (Number.isInteger(value)) goTo(value); });
$("layout").addEventListener("change", () => render());
for (const [id, step] of [["zoom-out", -.25], ["zoom-in", .25], ["zoom-reset", 0]]) $(id).addEventListener("click", () => { zoom = step ? Math.max(.75,Math.min(2, zoom + step)) : 1; render(); });
window.addEventListener("keydown", event => {
  if (event.key === "Escape") { parent.postMessage({type:"omje-reader-close"}, location.origin); return; }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "ArrowLeft") { event.preventDefault(); goTo(page - columns()); }
  if (event.key === "ArrowRight") { event.preventDefault(); goTo(page + columns()); }
});
let resizeTimer;
new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => render(), 120); }).observe(stage);

try {
  const loading = getDocument({ url: pdfUrl, standardFontDataUrl: new URL("./vendor/standard_fonts/", import.meta.url).href, wasmUrl: new URL("./vendor/wasm/", import.meta.url).href, isEvalSupported: false });
  pdf = await loading.promise;
  $("page").max = pdf.numPages;
  for (const node of document.querySelectorAll("button, select, input")) node.disabled = false;
  try { page = Math.max(1, Math.min(pdf.numPages, Number(sessionStorage.getItem(`omje-reading-${report}`)) || 1)); } catch { /* Optional resume. */ }
  await render();
} catch { showError(); }
