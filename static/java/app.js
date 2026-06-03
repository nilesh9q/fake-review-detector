// ── FakeShield Frontend Logic ──────────────────────

const reviewInput   = document.getElementById("reviewInput");
const analyzeBtn    = document.getElementById("analyzeBtn");
const clearBtn      = document.getElementById("clearBtn");
const charCount     = document.getElementById("charCount");
const resultCard    = document.getElementById("resultCard");
const historySection= document.getElementById("historySection");
const historyList   = document.getElementById("historyList");
const clearHistoryBtn=document.getElementById("clearHistory");
const modelBadge    = document.getElementById("modelBadge");

let analysisHistory = [];

// ── Char / word counter ─────────────────────────
reviewInput.addEventListener("input", () => {
  const text  = reviewInput.value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  charCount.textContent = `${chars} characters · ${words} words`;
});

// ── Sample pills ────────────────────────────────
document.querySelectorAll(".sample-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    reviewInput.value = pill.dataset.text;
    reviewInput.dispatchEvent(new Event("input"));
    reviewInput.focus();
  });
});

// ── Clear button ────────────────────────────────
clearBtn.addEventListener("click", () => {
  reviewInput.value = "";
  reviewInput.dispatchEvent(new Event("input"));
  resultCard.classList.add("hidden");
});

// ── Analyze button ──────────────────────────────
analyzeBtn.addEventListener("click", analyzeReview);
reviewInput.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "Enter") analyzeReview();
});

async function analyzeReview() {
  const review = reviewInput.value.trim();
  if (!review) { shake(reviewInput); return; }
  if (review.length < 10) {
    showInlineError("Review is too short. Please enter at least 10 characters.");
    return;
  }

  setLoading(true);

  try {
    const res  = await fetch("/predict", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ review }),
    });

    if (!res.ok) {
      const err = await res.json();
      showInlineError(err.error || "Something went wrong. Please try again.");
      return;
    }

    const data = await res.json();
    displayResult(data, review);
    addToHistory(data, review);

  } catch (err) {
    showInlineError("Network error. Make sure the Flask server is running.");
  } finally {
    setLoading(false);
  }
}

// ── Display result ──────────────────────────────
function displayResult(data, reviewText) {
  const { label, confidence, features, demo_mode } = data;
  const isFake = label === "FAKE";

  // Show card
  resultCard.classList.remove("hidden");
  resultCard.classList.add("animate-in");

  // Verdict badge
  const badge = document.getElementById("verdictBadge");
  badge.textContent = isFake ? "FAKE" : "REAL";
  badge.className   = `verdict-badge ${isFake ? "fake" : "real"}`;

  // Verdict title & sub
  const title = document.getElementById("verdictTitle");
  const sub   = document.getElementById("verdictSub");
  title.textContent = isFake ? "Likely a Fake Review" : "Looks Like a Real Review";
  title.className   = `verdict-title ${isFake ? "fake" : "real"}`;
  sub.textContent   = isFake
    ? "This review shows patterns commonly associated with deceptive content."
    : "This review appears authentic based on our feature analysis.";

  // Confidence ring
  animateConfidence(confidence, isFake);

  // Feature boxes
  document.getElementById("featWordCount").textContent   = features.word_count;
  document.getElementById("featSentiment").textContent   = sentimentLabel(features.sentiment_polarity);
  document.getElementById("featSubjectivity").textContent= subjectivityLabel(features.sentiment_subjectivity);
  document.getElementById("featExclamation").textContent = features.exclamation_count;

  // Demo notice
  const demoNotice = document.getElementById("demoNotice");
  if (demo_mode) {
    demoNotice.classList.remove("hidden");
  } else {
    demoNotice.classList.add("hidden");
    modelBadge.textContent = "LIVE MODEL";
    modelBadge.className   = "model-badge live";
  }

  // Scroll to result
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Confidence ring animation ───────────────────
function animateConfidence(pct, isFake) {
  const ring = document.getElementById("ringFill");
  const num  = document.getElementById("confidenceNum");
  const circumference = 201;

  ring.style.stroke = isFake ? "var(--fake)" : "var(--real)";

  // Animate number
  let current = 0;
  const target  = pct;
  const step    = target / 40;
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    num.textContent = Math.round(current);
    if (current >= target) clearInterval(interval);
  }, 25);

  // Animate ring
  const offset = circumference - (circumference * pct / 100);
  setTimeout(() => { ring.style.strokeDashoffset = offset; }, 50);
}

// ── History ─────────────────────────────────────
function addToHistory(data, reviewText) {
  analysisHistory.unshift({ data, reviewText, time: new Date() });
  if (analysisHistory.length > 5) analysisHistory.pop();
  renderHistory();
}

function renderHistory() {
  if (analysisHistory.length === 0) {
    historySection.classList.add("hidden");
    return;
  }
  historySection.classList.remove("hidden");
  historyList.innerHTML = analysisHistory.map(item => {
    const isFake = item.data.label === "FAKE";
    const preview = item.reviewText.slice(0, 80) + (item.reviewText.length > 80 ? "…" : "");
    return `
      <div class="history-item">
        <span class="history-label ${isFake ? "fake" : "real"}">${item.data.label}</span>
        <span class="history-text">${escapeHtml(preview)}</span>
        <span class="history-conf">${item.data.confidence}%</span>
      </div>`;
  }).join("");
}

clearHistoryBtn.addEventListener("click", () => {
  analysisHistory = [];
  renderHistory();
});

// ── Helpers ──────────────────────────────────────
function setLoading(state) {
  analyzeBtn.disabled = state;
  if (state) {
    analyzeBtn.classList.add("loading");
    analyzeBtn.querySelector(".btn-icon").textContent = "";
  } else {
    analyzeBtn.classList.remove("loading");
    analyzeBtn.querySelector(".btn-icon").textContent = "→";
  }
}

function shake(el) {
  el.style.animation = "none";
  el.offsetHeight; // reflow
  el.style.animation = "shake 0.4s ease";
  el.addEventListener("animationend", () => { el.style.animation = ""; }, { once: true });
}

function showInlineError(msg) {
  resultCard.classList.remove("hidden");
  resultCard.classList.add("animate-in");
  document.getElementById("verdictBadge").textContent = "!";
  document.getElementById("verdictBadge").className   = "verdict-badge fake";
  document.getElementById("verdictTitle").textContent = "Error";
  document.getElementById("verdictTitle").className   = "verdict-title fake";
  document.getElementById("verdictSub").textContent   = msg;
  document.getElementById("demoNotice").classList.add("hidden");
}

function sentimentLabel(score) {
  if (score >  0.5) return "Very +ve";
  if (score >  0.1) return "Positive";
  if (score > -0.1) return "Neutral";
  if (score > -0.5) return "Negative";
  return "Very -ve";
}

function subjectivityLabel(score) {
  if (score > 0.7) return "Opinionated";
  if (score > 0.4) return "Moderate";
  return "Objective";
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Shake animation
const style = document.createElement("style");
style.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    25%{transform:translateX(-6px)}
    75%{transform:translateX(6px)}
  }
`;
document.head.appendChild(style);

// ── Check model status on load ──────────────────
fetch("/health")
  .then(r => r.json())
  .then(data => {
    if (data.model_loaded && data.vectorizer_loaded) {
      modelBadge.textContent = "LIVE MODEL";
      modelBadge.className   = "model-badge live";
    }
  })
  .catch(() => {});
