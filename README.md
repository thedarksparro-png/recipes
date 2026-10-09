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

## Home page

The home page shows one tile per category with that category's top-rated recipe (highest average, then most reviews, then title). Categories with no ratings yet show their first recipe by title. Each tile has a **See all** button that opens the full list for that category. Typing in search or picking a category also shows the full matching list, and **Top picks** goes back.

The same example is commented out at the top of `recipes.js`. Removing the `// ` at the start of those lines is valid JavaScript, but the page only shows objects inside `window.RECIPES`.

## Ratings and comments

Visitors can leave a 1–5 star rating with an optional name and comment on any recipe page. No sign-in is needed, but they must enter the **review code**, which you give out. Recipe cards on the home page show the average and the count.

Reviews are stored in a free Supabase project called **dark-sparrow-eats**:

- Table `public.reviews` holds every review (`recipe_id`, `rating`, `name`, `comment`, `created_at`, `hidden`).
- View `public.review_stats` gives the average rating and count per recipe, skipping hidden reviews.
- Visitors post through the database function `public.submit_review`, which checks the review code before saving. They cannot write to the table directly.
- `config.js` has the project URL and the public (publishable) key. That key is safe in the browser. Never put a secret or `service_role` key in this site.
- The `recipe_id` saved with a review is the recipe's `id` in `recipes.js`. If you change an `id`, its old reviews stop showing.

Spam protection: visitors can only add reviews, never edit or delete them. The database rejects links in names and comments, and accepts at most 3 reviews per recipe and 10 site-wide per minute. The form also has a hidden honeypot field that bots tend to fill in.

### The review code

The code is checked by the database, not the browser, and is never stored in this repo. Only a bcrypt hash of it is kept in `private.review_code`, which visitors can't read. A visitor's browser remembers a correct code so they don't have to retype it.

To change the code, open **SQL Editor** in the Supabase project and run (replace `NEW_CODE`):

```sql
update private.review_code
set code_hash = extensions.crypt('NEW_CODE', extensions.gen_salt('bf')), updated_at = now();
```

If 20 wrong codes are tried across the site within 10 minutes, all review posting pauses until that window passes. This stops anyone guessing the code. Failed tries are logged in `private.review_code_failures`.

### Hide a bad comment

1. Sign in at https://supabase.com/dashboard and open the **dark-sparrow-eats** project.
2. Go to **Table Editor** and pick the **reviews** table.
3. Find the row, set **hidden** to `true`, and save.

The review disappears from the site and from the averages on the next page load. Set it back to `false` to show it again, or delete the row to remove it for good.
