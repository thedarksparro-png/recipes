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

  function card(recipe) {
    var id = recipeId(recipe);
    var title = str(recipe.title) || "Untitled";
    var category = str(recipe.category);
    var meta = [formatTime(recipe.timeMinutes), formatServings(recipe.servings)].filter(Boolean);
    var tags = stringList(recipe.tags);
    var image = safeSrc(recipe.image);
    var inner =
      (image ? '<span class="card-photo"><img src="' + esc(image) + '" alt=""></span>' : "") +
      '<span class="card-body">' +
      (category ? '<span class="kicker">' + esc(category) + "</span>" : "") +
      '<span class="card-title">' +
      esc(title) +
      "</span>" +
      (meta.length ? '<span class="meta">' + esc(meta.join(" · ")) + "</span>" : "") +
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
    if (!id) return '<article class="card">' + inner + "</article>";
    return '<a class="card" href="#/recipe/' + encodeURIComponent(id) + '">' + inner + "</a>";
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
    var list = filtered();
    if (!list.length) {
      results.innerHTML =
        '<div class="empty">' +
        leaf +
        '<p class="empty-kicker">No matches</p>' +
        "<h2>Nothing fits that filter</h2>" +
        "<p>Try a different word, or set the category back to all.</p>" +
        "</div>";
      return;
    }
    results.innerHTML = '<div class="grid">' + list.map(card).join("") + "</div>";
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
      '<div id="results"></div>' +
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
      document.title = "Recipes";
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
    document.title = title + " · Recipes";
    var category = str(recipe.category);
    var meta = [formatTime(recipe.timeMinutes), formatServings(recipe.servings)].filter(Boolean);
    var tags = stringList(recipe.tags);
    var ingredients = stringList(recipe.ingredients);
    var steps = stringList(recipe.steps);
    var notes = str(recipe.notes);
    var image = safeSrc(recipe.image);

    app.innerHTML =
      '<article class="detail">' +
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
      "</article>";
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
      document.title = "Recipes";
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
