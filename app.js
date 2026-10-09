(function () {
  "use strict";

  var app = document.getElementById("app");
  if (!app) return;

  var raw = Array.isArray(window.RECIPES) ? window.RECIPES : [];
  var recipes = raw.filter(function (recipe) {
    return recipe && typeof recipe === "object";
  });

  var state = { query: "", category: "" };

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function str(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function stringList(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map(function (item) {
        return item == null ? "" : String(item).trim();
      })
      .filter(Boolean);
  }

  function recipeId(recipe) {
    if (typeof recipe.id === "string" && recipe.id.trim()) return recipe.id.trim();
    if (typeof recipe.id === "number" && Number.isFinite(recipe.id)) return String(recipe.id);
    return "";
  }

  function safeSrc(value) {
    var src = str(value);
    if (!src) return "";
    if (/^(https?:)?\/\//i.test(src)) return src;
    if (/^data:image\//i.test(src)) return src;
    if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return "";
    return src;
  }

  function formatTime(mins) {
    if (mins == null || mins === "") return "";
    var n = Number(mins);
    if (!Number.isFinite(n) || n < 0) return "";
    var rounded = Math.round(n);
    var hours = Math.floor(rounded / 60);
    var minutes = rounded % 60;
    if (hours && minutes) return hours + " hr " + minutes + " min";
    if (hours) return hours === 1 ? "1 hr" : hours + " hr";
    return minutes === 1 ? "1 min" : minutes + " min";
  }

  function formatServings(value) {
    if (value == null || value === "") return "";
    if (typeof value === "string" && /^\s*\d+\s*[-–]\s*\d+\s*$/.test(value)) {
      return value.replace(/\s*[-–]\s*/, "–").trim() + " servings";
    }
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    var shown = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
    return shown + (n === 1 ? " serving" : " servings");
  }

  function categories() {
    var seen = Object.create(null);
    var list = [];
    recipes.forEach(function (recipe) {
      var category = str(recipe.category);
      if (!category || seen[category]) return;
      seen[category] = true;
      list.push(category);
    });
    list.sort(function (a, b) {
      return a.localeCompare(b);
    });
    return list;
  }

  function haystack(recipe) {
    return [
      str(recipe.title),
      str(recipe.category),
      str(recipe.notes),
      stringList(recipe.tags).join("\n"),
      stringList(recipe.ingredients).join("\n"),
      stringList(recipe.steps).join("\n")
    ]
      .join("\n")
      .toLowerCase();
  }

  function filtered() {
    var query = state.query.trim().toLowerCase();
    return recipes.filter(function (recipe) {
      if (state.category && str(recipe.category) !== state.category) return false;
      if (!query) return true;
      return haystack(recipe).indexOf(query) !== -1;
    });
  }

  var leaf =
    '<svg class="empty-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
    '<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M24 40c2-10 6-16 14-22-8 1-14 4-18 10 0-8-2-14-8-20 1 10 4 18 12 32z"></path>' +
    "</svg>";

  function tone(category) {
    var h = 0;
    for (var i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0;
    return " tone-" + (h % 4);
  }

  function card(recipe, badge) {
    var id = recipeId(recipe);
    var title = str(recipe.title) || "Untitled";
    var category = str(recipe.category);
    var meta = [formatTime(recipe.timeMinutes), formatServings(recipe.servings)].filter(Boolean);
    var tags = stringList(recipe.tags);
    var image = safeSrc(recipe.image);
    var inner =
      (image ? '<span class="card-photo"><img src="' + esc(image) + '" alt=""></span>' : "") +
      '<span class="card-body">' +
      (badge ? '<span class="top-badge"><span aria-hidden="true">★</span> Top rated</span>' : "") +
      (category ? '<span class="kicker">' + esc(category) + "</span>" : "") +
      '<span class="card-title">' +
      esc(title) +
      "</span>" +
      (meta.length ? '<span class="meta">' + esc(meta.join(" · ")) + "</span>" : "") +
      (id ? '<span class="card-rating" data-rating-for="' + esc(id) + '" hidden></span>' : "") +
      (tags.length
        ? '<span class="tags">' +
          tags
            .map(function (tag) {
              return "<span>" + esc(tag) + "</span>";
            })
            .join("") +
          "</span>"
        : "") +
      "</span>";
    var cls = "card" + tone(category);
    if (!id) return '<article class="' + cls + '">' + inner + "</article>";
    return '<a class="' + cls + '" href="#/recipe/' + encodeURIComponent(id) + '">' + inner + "</a>";
  }

  var statsMap = null;
  var paintToken = 0;

  function isTopView() {
    return !state.query.trim() && !state.category;
  }

  function titleOf(recipe) {
    return str(recipe.title) || "Untitled";
  }

  function byTitle(a, b) {
    return titleOf(a).localeCompare(titleOf(b));
  }

  function statFor(recipe) {
    var row = statsMap && statsMap[recipeId(recipe)];
    var count = row ? Number(row.review_count) || 0 : 0;
    return { avg: count ? Number(row.avg_rating) || 0 : 0, count: count };
  }

  function topPick(list) {
    var rated = list.filter(function (recipe) {
      return statFor(recipe).count > 0;
    });
    if (rated.length) {
      rated.sort(function (a, b) {
        var sa = statFor(a);
        var sb = statFor(b);
        if (sb.avg !== sa.avg) return sb.avg - sa.avg;
        if (sb.count !== sa.count) return sb.count - sa.count;
        return byTitle(a, b);
      });
      return { recipe: rated[0], rated: true };
    }
    return { recipe: list.slice().sort(byTitle)[0], rated: false };
  }

  function topHtml() {
    var tiles = categories().map(function (category) {
      var list = recipes.filter(function (recipe) {
        return str(recipe.category) === category;
      });
      var pick = topPick(list);
      return (
        '<section class="cat-tile' + tone(category) + '">' +
        '<div class="cat-head">' +
        '<h2 class="cat-name">' + esc(category) + "</h2>" +
        '<button type="button" class="see-all" data-category="' + esc(category) + '">' +
        "See all " + list.length + ' <span aria-hidden="true">→</span>' +
        '<span class="sr-only"> ' + esc(category) + " recipes</span></button>" +
        "</div>" +
        card(pick.recipe, pick.rated) +
        "</section>"
      );
    });
    var uncategorized = recipes.filter(function (recipe) {
      return !str(recipe.category);
    });
    if (uncategorized.length) {
      var pick = topPick(uncategorized);
      tiles.push(
        '<section class="cat-tile">' +
        '<div class="cat-head"><h2 class="cat-name">Other</h2></div>' +
        card(pick.recipe, pick.rated) +
        "</section>"
      );
    }
    return (
      '<div class="view-bar">' +
      '<p class="view-title">Top rated in each category</p>' +
      '<p class="view-note">' + recipes.length + (recipes.length === 1 ? " recipe" : " recipes") +
      " in all. Search, pick a category, or tap See all to browse everything.</p>" +
      "</div>" +
      '<div class="cat-grid">' + tiles.join("") + "</div>"
    );
  }

  function listBar(count) {
    var what = state.category ? esc(state.category) : "all categories";
    return (
      '<div class="view-bar">' +
      '<p class="view-title">' + count + (count === 1 ? " recipe" : " recipes") +
      (state.query.trim() ? " matching “" + esc(state.query.trim()) + "”" : "") +
      " in " + what + "</p>" +
      '<button type="button" class="back-top" data-top="1"><span aria-hidden="true">←</span> Top picks</button>' +
      "</div>"
    );
  }

  function showTop() {
    state.query = "";
    state.category = "";
    syncInputs();
    paintResults();
  }

  function showCategory(category) {
    state.query = "";
    state.category = category;
    syncInputs();
    paintResults();
    var filters = document.getElementById("filters");
    if (filters && filters.scrollIntoView) filters.scrollIntoView({ block: "start" });
  }

  function syncInputs() {
    var search = document.getElementById("search");
    var select = document.getElementById("category");
    if (search) search.value = state.query;
    if (select) select.value = state.category;
  }

  function paintTop(results) {
    results.innerHTML = topHtml();
    if (window.Reviews) window.Reviews.paintCards(results);
    if (statsMap || !window.Reviews || !window.Reviews.getStats) return;
    var token = paintToken;
    window.Reviews.getStats()
      .then(function (map) {
        statsMap = map || null;
        if (token !== paintToken || !results.isConnected || !isTopView()) return;
        results.innerHTML = topHtml();
        window.Reviews.paintCards(results);
      })
      .catch(function () {
        /* No ratings: keep the first recipe by title in each category. */
      });
  }

  function paintResults() {
    var results = document.getElementById("results");
    if (!results) return;
    if (!recipes.length) {
      results.innerHTML =
        '<div class="empty">' +
        leaf +
        '<p class="empty-kicker">Empty journal</p>' +
        "<h2>No recipes yet</h2>" +
        "<p>This page stays quiet until you add one. Open <code>recipes.js</code>, paste a recipe into the list, and refresh. Search and categories start working as soon as there is something to find.</p>" +
        "</div>";
      return;
    }
    paintToken += 1;
    if (isTopView()) {
      paintTop(results);
      return;
    }
    var list = filtered();
    if (!list.length) {
      results.innerHTML =
        listBar(0) +
        '<div class="empty">' +
        leaf +
        '<p class="empty-kicker">No matches</p>' +
        "<h2>Nothing fits that filter</h2>" +
        "<p>Try a different word, or set the category back to all.</p>" +
        "</div>";
      return;
    }
    results.innerHTML =
      listBar(list.length) +
      '<div class="grid">' +
      list
        .map(function (recipe) {
          return card(recipe, false);
        })
        .join("") +
      "</div>";
    if (window.Reviews) window.Reviews.paintCards(results);
  }

  function renderList() {
    var options =
      '<option value=""' +
      (state.category === "" ? " selected" : "") +
      ">All categories</option>" +
      categories()
        .map(function (category) {
          return (
            '<option value="' +
            esc(category) +
            '"' +
            (state.category === category ? " selected" : "") +
            ">" +
            esc(category) +
            "</option>"
          );
        })
        .join("");

    app.innerHTML =
      '<section class="list-view">' +
      '<form class="filters" id="filters" role="search">' +
      '<label class="field"><span class="label">Search</span>' +
      '<input id="search" type="search" name="q" placeholder="Title, ingredient, tag…" autocomplete="off" value="' +
      esc(state.query) +
      '">' +
      "</label>" +
      '<label class="field"><span class="label">Category</span>' +
      '<select id="category" name="category">' +
      options +
      "</select></label>" +
      "</form>" +
      '<div id="results" aria-live="polite"></div>' +
      "</section>";

    var form = document.getElementById("filters");
    var search = document.getElementById("search");
    var category = document.getElementById("category");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
    });
    search.addEventListener("input", function () {
      state.query = search.value;
      paintResults();
    });
    category.addEventListener("change", function () {
      state.category = category.value;
      paintResults();
    });
    document.getElementById("results").addEventListener("click", function (event) {
      var target = event.target.closest ? event.target.closest("button") : null;
      if (!target) return;
      if (target.hasAttribute("data-top")) {
        showTop();
        search.focus();
      } else if (target.hasAttribute("data-category")) {
        showCategory(target.getAttribute("data-category"));
      }
    });
    paintResults();
  }

  function renderDetail(id) {
    var recipe = null;
    for (var i = 0; i < recipes.length; i += 1) {
      if (recipeId(recipes[i]) === id) {
        recipe = recipes[i];
        break;
      }
    }

    if (!recipe) {
      document.title = "The Dark Sparrow Eats";
      app.innerHTML =
        '<article class="detail">' +
        '<a class="back" href="#/">← All recipes</a>' +
        '<div class="empty">' +
        leaf +
        '<p class="empty-kicker">Missing page</p>' +
        "<h2>That recipe is not here</h2>" +
        "<p>The link may be old, or the id in <code>recipes.js</code> changed.</p>" +
        "</div></article>";
      return;
    }

    var title = str(recipe.title) || "Untitled";
    document.title = title + " · The Dark Sparrow Eats";
    var category = str(recipe.category);
    var meta = [formatTime(recipe.timeMinutes), formatServings(recipe.servings)].filter(Boolean);
    var tags = stringList(recipe.tags);
    var ingredients = stringList(recipe.ingredients);
    var steps = stringList(recipe.steps);
    var notes = str(recipe.notes);
    var image = safeSrc(recipe.image);

    app.innerHTML =
      '<article class="detail' + tone(category) + '">' +
      '<a class="back" href="#/">← All recipes</a>' +
      (category ? '<p class="kicker">' + esc(category) + "</p>" : "") +
      '<h2 class="recipe-title">' +
      esc(title) +
      "</h2>" +
      (meta.length ? '<p class="meta">' + esc(meta.join(" · ")) + "</p>" : "") +
      (tags.length
        ? '<ul class="tags">' +
          tags
            .map(function (tag) {
              return "<li>" + esc(tag) + "</li>";
            })
            .join("") +
          "</ul>"
        : "") +
      (image ? '<figure class="photo"><img src="' + esc(image) + '" alt=""></figure>' : "") +
      '<div class="detail-grid">' +
      "<section><h3>Ingredients</h3>" +
      (ingredients.length
        ? '<ul class="ingredients">' +
          ingredients
            .map(function (item) {
              return "<li>" + esc(item) + "</li>";
            })
            .join("") +
          "</ul>"
        : '<p class="muted">No ingredients listed.</p>') +
      "</section>" +
      "<section><h3>Steps</h3>" +
      (steps.length
        ? '<ol class="steps">' +
          steps
            .map(function (step) {
              return "<li>" + esc(step) + "</li>";
            })
            .join("") +
          "</ol>"
        : '<p class="muted">No steps listed.</p>') +
      "</section></div>" +
      (notes ? '<section class="notes"><h3>Notes</h3><p>' + esc(notes) + "</p></section>" : "") +
      '<section class="reviews" id="reviews"></section>' +
      "</article>";

    var reviewsSection = document.getElementById("reviews");
    if (window.Reviews) {
      try {
        window.Reviews.mountDetail(reviewsSection, recipeId(recipe));
      } catch (err) {
        reviewsSection.remove();
      }
    } else if (reviewsSection) {
      reviewsSection.remove();
    }
  }

  function parseRoute() {
    var hash = location.hash.replace(/^#/, "");
    if (!hash || hash === "/") return { name: "list" };
    try {
      hash = decodeURIComponent(hash);
    } catch (err) {
      /* Keep the raw hash if it is not valid encoding. */
    }
    var match = hash.match(/^\/?recipe\/([^/]+)\/?$/);
    if (match) return { name: "detail", id: match[1] };
    return { name: "list" };
  }

  function route() {
    var next = parseRoute();
    document.body.classList.toggle("is-detail", next.name === "detail");
    if (next.name === "detail") renderDetail(next.id);
    else {
      document.title = "The Dark Sparrow Eats";
      renderList();
    }
    window.scrollTo(0, 0);
  }

  app.addEventListener(
    "error",
    function (event) {
      var target = event.target;
      if (!target || target.tagName !== "IMG") return;
      var frame = target.closest("figure, .card-photo");
      if (frame) frame.remove();
    },
    true
  );

  window.addEventListener("hashchange", route);
  route();
})();
