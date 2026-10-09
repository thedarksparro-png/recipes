/*
 * Star ratings and comments, backed by Supabase (see config.js and README.md).
 * Everything here is optional: if the service is unreachable, recipes still work.
 */
(function () {
  "use strict";

  var cfg = window.REVIEWS_CONFIG || {};
  var base = typeof cfg.url === "string" ? cfg.url.replace(/\/+$/, "") + "/rest/v1" : "";
  var key = typeof cfg.key === "string" ? cfg.key : "";
  var enabled = Boolean(base && key && window.fetch);
  var STORE = "dse-rated";
  var CODE_STORE = "dse-review-code";
  var statsCache = null;
  var statsAt = 0;
  var uid = 0;

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function request(path, options) {
    options = options || {};
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, 9000)
      : null;
    var headers = { apikey: key, Accept: "application/json" };
    if (options.body) headers["Content-Type"] = "application/json";
    if (options.prefer) headers.Prefer = options.prefer;
    return fetch(base + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller ? controller.signal : undefined,
      cache: "no-store"
    })
      .catch(function () {
        var err = new Error("network");
        err.kind = "network";
        throw err;
      })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res.text().then(function (text) {
          var data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            data = null;
          }
          if (!res.ok) {
            var err = new Error((data && data.message) || "http " + res.status);
            err.kind = "server";
            err.code = data && data.code;
            err.status = res.status;
            throw err;
          }
          return data;
        });
      });
  }

  function friendlyError(err) {
    var msg = (err && err.message) || "";
    if (err && err.kind === "network") {
      return "We couldn't reach the review service. Check your connection and try again.";
    }
    if (msg === "wrong_code") return "That code isn't right. Check with the cook and try again.";
    if (msg === "too_many_attempts") {
      return "Too many wrong codes were tried just now, so reviews are paused for a few minutes. Please try again later.";
    }
    if (msg === "invalid_input") {
      return "Something in that review didn't fit. Names can be up to 40 characters and comments up to 1,000.";
    }
    if (msg === "no_links") return "Links aren't allowed in reviews. Remove the link and try again.";
    if (msg === "rate_limited") return "Lots of reviews just came in. Give it a minute and try again.";
    if (err && err.code === "23514") {
      return "Something in that review didn't fit. Names can be up to 40 characters and comments up to 1,000.";
    }
    return "Sorry, that review didn't go through. Please try again in a moment.";
  }

  function readRated() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE) || "{}");
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {};
    }
  }

  function remember(recipeId, rating) {
    try {
      var data = readRated();
      data[recipeId] = { rating: rating, at: new Date().toISOString() };
      localStorage.setItem(STORE, JSON.stringify(data));
    } catch (e) {
      /* Private mode or storage full: not important. */
    }
  }

  function readCode() {
    try {
      return localStorage.getItem(CODE_STORE) || "";
    } catch (e) {
      return "";
    }
  }

  function saveCode(code) {
    try {
      localStorage.setItem(CODE_STORE, code);
    } catch (e) {
      /* Not important. */
    }
  }

  function clearCode() {
    try {
      localStorage.removeItem(CODE_STORE);
    } catch (e) {
      /* Not important. */
    }
  }

  function fmtAvg(avg) {
    var n = Math.round(Number(avg) * 10) / 10;
    return n.toFixed(1);
  }

  function meter(avg, extraClass) {
    var pct = Math.max(0, Math.min(100, (Number(avg) / 5) * 100));
    return (
      '<span class="star-meter' + (extraClass ? " " + extraClass : "") + '" aria-hidden="true">' +
      '<span class="star-meter-base">★★★★★</span>' +
      '<span class="star-meter-fill" style="width:' + pct.toFixed(1) + '%">★★★★★</span>' +
      "</span>"
    );
  }

  function ratingLine(avg, count) {
    return (
      meter(avg) +
      '<span class="rating-num">' + fmtAvg(avg) + "</span>" +
      '<span class="rating-count">(' + count + ")</span>" +
      '<span class="sr-only">Rated ' + fmtAvg(avg) + " out of 5 from " + count +
      (count === 1 ? " review" : " reviews") + "</span>"
    );
  }

  function relDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var secs = (Date.now() - d.getTime()) / 1000;
    if (secs < 60) return "just now";
    if (secs < 3600) return Math.floor(secs / 60) + " min ago";
    if (secs < 86400) return Math.floor(secs / 3600) + " hr ago";
    if (secs < 172800) return "yesterday";
    if (secs < 604800) return Math.floor(secs / 86400) + " days ago";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  /* ---------- Home page cards ---------- */

  function fetchStats() {
    if (statsCache && Date.now() - statsAt < 60000) return Promise.resolve(statsCache);
    return request("/review_stats?select=recipe_id,avg_rating,review_count").then(function (rows) {
      var map = Object.create(null);
      (Array.isArray(rows) ? rows : []).forEach(function (row) {
        if (row && row.recipe_id) map[row.recipe_id] = row;
      });
      statsCache = map;
      statsAt = Date.now();
      return map;
    });
  }

  function getStats() {
    if (!enabled) return Promise.reject(new Error("disabled"));
    return fetchStats();
  }

  function paintCards(root) {
    if (!enabled || !root) return;
    var slots = root.querySelectorAll("[data-rating-for]");
    if (!slots.length) return;
    fetchStats()
      .then(function (map) {
        Array.prototype.forEach.call(slots, function (slot) {
          var row = map[slot.getAttribute("data-rating-for")];
          var count = row ? Number(row.review_count) : 0;
          if (!count) return;
          slot.innerHTML = ratingLine(row.avg_rating, count);
          slot.hidden = false;
        });
      })
      .catch(function () {
        /* Ratings are a nice extra; stay quiet if they can't load. */
      });
  }

  /* ---------- Recipe page ---------- */

  function reviewItem(r) {
    var name = (typeof r.name === "string" && r.name.trim()) || "Anonymous";
    var rating = Math.max(1, Math.min(5, Number(r.rating) || 0));
    var comment = typeof r.comment === "string" ? r.comment.trim() : "";
    var when = relDate(r.created_at);
    return (
      '<li class="review">' +
      '<div class="review-head">' +
      '<span class="review-name">' + esc(name) + "</span>" +
      meter(rating, "is-small") +
      '<span class="sr-only">' + rating + " out of 5 stars</span>" +
      (when
        ? '<time class="review-date" datetime="' + esc(r.created_at) + '">' + esc(when) + "</time>"
        : "") +
      "</div>" +
      (comment ? '<p class="review-text">' + esc(comment) + "</p>" : "") +
      "</li>"
    );
  }

  function starInputs(prefix) {
    var html = "";
    for (var n = 1; n <= 5; n += 1) {
      html +=
        '<input class="star-radio" type="radio" name="rating" value="' + n + '" id="' + prefix + "-s" + n + '">' +
        '<label class="star-label" for="' + prefix + "-s" + n + '" data-n="' + n + '">' +
        '<span aria-hidden="true">★</span><span class="sr-only">' + n + (n === 1 ? " star" : " stars") + "</span>" +
        "</label>";
    }
    return html;
  }

  function mountDetail(section, recipeId) {
    if (!section) return;
    var prefix = "rv" + ++uid;
    var mine = readRated()[recipeId];

    section.innerHTML =
      '<div class="reviews-top">' +
      '<h3 id="' + prefix + '-h">Ratings &amp; comments</h3>' +
      '<p class="reviews-summary" aria-live="polite">' +
      (enabled ? '<span class="muted">Loading ratings…</span>' : "") +
      "</p>" +
      "</div>" +
      '<p class="you-rated"' + (mine ? "" : " hidden") + ">" +
      (mine ? "You rated this " + esc(mine.rating) + " ★ on this device. You're welcome to add another review." : "") +
      "</p>" +
      '<form class="review-form" novalidate>' +
      '<fieldset class="star-field">' +
      '<legend>Your rating</legend>' +
      '<div class="star-picker">' + starInputs(prefix) + "</div>" +
      "</fieldset>" +
      '<div class="review-fields">' +
      '<label class="field"><span class="label">Name <span class="optional">(optional)</span></span>' +
      '<input type="text" name="name" maxlength="40" autocomplete="nickname" placeholder="Anonymous"></label>' +
      '<label class="field field-wide"><span class="label">Comment <span class="optional">(optional)</span></span>' +
      '<textarea name="comment" rows="4" maxlength="1000" placeholder="How did it turn out? Any tweaks?"></textarea>' +
      '<span class="char-count" aria-hidden="true">0 / 1000</span></label>' +
      '<label class="field field-code"><span class="label">Review code</span>' +
      '<input type="text" name="code" inputmode="numeric" autocomplete="off" required maxlength="12" spellcheck="false" aria-describedby="' + prefix + '-codehelp">' +
      '<span class="field-help" id="' + prefix + '-codehelp">Ask the cook for the code.</span></label>' +
      '<div class="hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      "</div>" +
      '<div class="form-foot">' +
      '<button class="btn" type="submit">Post review</button>' +
      '<p class="form-msg" role="status" aria-live="polite"></p>' +
      "</div>" +
      "</form>" +
      '<ul class="review-list" aria-labelledby="' + prefix + '-h"></ul>';

    var form = section.querySelector(".review-form");
    var summary = section.querySelector(".reviews-summary");
    var list = section.querySelector(".review-list");
    var msg = section.querySelector(".form-msg");
    var btn = section.querySelector(".btn");
    var picker = section.querySelector(".star-picker");
    var labels = picker.querySelectorAll(".star-label");
    var textarea = form.elements.comment;
    var counter = section.querySelector(".char-count");
    var reviews = [];
    var codeInput = form.elements.code;
    codeInput.value = readCode();

    if (!enabled) {
      summary.innerHTML = '<span class="muted">Ratings are unavailable right now.</span>';
      form.hidden = true;
      return;
    }

    function selected() {
      var checked = picker.querySelector(".star-radio:checked");
      return checked ? Number(checked.value) : 0;
    }

    function light(n) {
      Array.prototype.forEach.call(labels, function (label) {
        label.classList.toggle("is-on", Number(label.getAttribute("data-n")) <= n);
      });
    }

    picker.addEventListener("change", function () {
      light(selected());
      if (msg.classList.contains("is-error")) setMsg("", "");
    });
    Array.prototype.forEach.call(labels, function (label) {
      label.addEventListener("mouseenter", function () {
        light(Number(label.getAttribute("data-n")));
      });
    });
    picker.addEventListener("mouseleave", function () {
      light(selected());
    });

    textarea.addEventListener("input", function () {
      counter.textContent = textarea.value.length + " / 1000";
    });

    function setMsg(text, kind) {
      msg.textContent = text;
      msg.className = "form-msg" + (kind ? " is-" + kind : "");
    }

    function paintSummary() {
      if (!reviews.length) {
        summary.innerHTML = '<span class="muted">No ratings yet. Be the first to rate it.</span>';
        return;
      }
      var total = 0;
      reviews.forEach(function (r) {
        total += Number(r.rating) || 0;
      });
      summary.innerHTML = ratingLine(total / reviews.length, reviews.length);
    }

    function paintList() {
      var withText = reviews.filter(function (r) {
        return typeof r.comment === "string" && r.comment.trim();
      });
      list.innerHTML = reviews.map(reviewItem).join("");
      list.hidden = !reviews.length;
      list.setAttribute("data-comments", String(withText.length));
    }

    request(
      "/reviews?select=id,name,rating,comment,created_at&recipe_id=eq." +
        encodeURIComponent(recipeId) +
        "&order=created_at.desc&limit=200"
    )
      .then(function (rows) {
        if (!section.isConnected) return;
        reviews = Array.isArray(rows) ? rows : [];
        paintSummary();
        paintList();
      })
      .catch(function () {
        if (!section.isConnected) return;
        summary.innerHTML = '<span class="muted">Ratings couldn\'t load right now. You can still leave one.</span>';
        list.hidden = true;
      });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (btn.disabled) return;

      var rating = selected();
      var name = form.elements.name.value.trim();
      var comment = textarea.value.trim();
      var code = codeInput.value.trim();

      if (form.elements.website.value) {
        /* Honeypot filled in: almost certainly a bot. Pretend all is well. */
        form.reset();
        light(0);
        setMsg("Thanks! Your review was posted.", "ok");
        return;
      }
      if (!rating) {
        setMsg("Pick a star rating first.", "error");
        picker.querySelector(".star-radio").focus();
        return;
      }
      if (/(https?:|www\.|:\/\/)/i.test(comment + " " + name)) {
        setMsg("Links aren't allowed in reviews. Remove the link and try again.", "error");
        return;
      }
      if (!code) {
        setMsg("Enter the review code first. Ask the cook for it.", "error");
        codeInput.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = "Posting…";
      setMsg("", "");

      request("/rpc/submit_review", {
        method: "POST",
        body: {
          p_recipe_id: recipeId,
          p_rating: rating,
          p_name: name || null,
          p_comment: comment || null,
          p_code: code
        }
      })
        .then(function (data) {
          if (!data || data.ok !== true) {
            var err = new Error((data && data.error) || "unknown");
            err.kind = "server";
            throw err;
          }
          var row = data.review && typeof data.review === "object"
            ? data.review
            : { name: name, rating: rating, comment: comment, created_at: new Date().toISOString() };
          saveCode(code);
          remember(recipeId, rating);
          statsCache = null;
          if (!section.isConnected) return;
          reviews.unshift(row);
          paintSummary();
          paintList();
          form.reset();
          codeInput.value = code;
          counter.textContent = "0 / 1000";
          light(0);
          var you = section.querySelector(".you-rated");
          you.textContent = "You rated this " + rating + " ★ on this device. You're welcome to add another review.";
          you.hidden = false;
          setMsg("Thanks! Your review is up.", "ok");
        })
        .catch(function (err) {
          if (err && err.message === "wrong_code") {
            clearCode();
            codeInput.value = "";
            if (section.isConnected) codeInput.focus();
          }
          setMsg(friendlyError(err), "error");
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "Post review";
        });
    });
  }

  window.Reviews = {
    enabled: enabled,
    paintCards: paintCards,
    getStats: getStats,
    mountDetail: mountDetail
  };
})();
