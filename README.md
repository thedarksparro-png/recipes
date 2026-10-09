# The Dark Sparrow Eats

A static site for recipes you type in yourself. No build step and no framework.

## Open the site

From this folder, start a static file server and open the address it prints.

```bash
cd /workspace/recipe-site
python3 -m http.server 8000
```

Then visit http://localhost:8000 . Stop the server with Ctrl+C when you are done.

Use a local server rather than opening `index.html` as a file. Some browsers block scripts on `file://` pages.

## Add a recipe

Edit `recipes.js`. Every recipe is one object inside `window.RECIPES`. The array starts empty, so the site shows an empty journal until you add one.

Copy this object into the array, then change the text. Keep a comma between recipes. `id` is the link: lowercase words separated by hyphens, and unique for each recipe.

```js
window.RECIPES = [
  {
    id: "weeknight-tomato-soup",
    title: "Weeknight tomato soup",
    category: "Soups",
    tags: ["vegetarian", "quick"],
    timeMinutes: 35,
    servings: 4,
    image: "",
    ingredients: [
      "2 tbsp olive oil",
      "1 onion, diced",
      "2 cans crushed tomatoes"
    ],
    steps: [
      "Warm the oil and soften the onion.",
      "Add the tomatoes and simmer for 20 minutes.",
      "Season and serve."
    ],
    notes: "Better the next day."
  }
];
```

Save the file and refresh the browser.

- `image` is a URL, a relative path such as `images/soup.jpg`, or `""` if there is no photo.
- Use `null` for `timeMinutes` or `servings` when you do not want them shown.
- `category` fills the category menu. `tags` are the small labels on each card.
- Search checks the title, category, tags, ingredients, steps, and notes.

The same example is commented out at the top of `recipes.js`. Removing the `// ` at the start of those lines is valid JavaScript, but the page only shows objects inside `window.RECIPES`.
