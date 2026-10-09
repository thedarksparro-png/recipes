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

## Ratings and comments

Visitors can leave a 1–5 star rating with an optional name and comment on any recipe page. No sign-in is needed. Recipe cards on the home page show the average and the count.

Reviews are stored in a free Supabase project called **dark-sparrow-eats**:

- Table `public.reviews` holds every review (`recipe_id`, `rating`, `name`, `comment`, `created_at`, `hidden`).
- View `public.review_stats` gives the average rating and count per recipe, skipping hidden reviews.
- `config.js` has the project URL and the public (publishable) key. That key is safe in the browser. Never put a secret or `service_role` key in this site.
- The `recipe_id` saved with a review is the recipe's `id` in `recipes.js`. If you change an `id`, its old reviews stop showing.

Spam protection: visitors can only add reviews, never edit or delete them. The database rejects links in names and comments, and accepts at most 3 reviews per recipe and 10 site-wide per minute. The form also has a hidden honeypot field that bots tend to fill in.

### Hide a bad comment

1. Sign in at https://supabase.com/dashboard and open the **dark-sparrow-eats** project.
2. Go to **Table Editor** and pick the **reviews** table.
3. Find the row, set **hidden** to `true`, and save.

The review disappears from the site and from the averages on the next page load. Set it back to `false` to show it again, or delete the row to remove it for good.
