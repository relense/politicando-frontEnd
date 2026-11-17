# SEO and Google

## What the site does on its own

- **Titles, descriptions, canonical links.** Every public page has them. Filtered and search URLs (`/?q=…`,
  `/?fonte=…`) are `noindex, follow` and point to the page worth indexing.
- **Sitemap.** `/sitemap.xml` lists the static pages, plus what the backend's `/sitemap` reports: parties,
  deputies, Government members, elections, places, initiatives and blog posts, each with its last change.
- **robots.txt.** `/robots.txt` allows everything except `/admin` and `/api/`, and names the sitemap.
- **Kept out of search on purpose:**
  - `/article/:id`, which only shows another outlet's headline and excerpt;
  - forum threads, which readers write;
  - the moderation area.
- **Share images.** `opengraph-image` files generate a 1200×630 card for every page:
  - the site's own card by default;
  - a card per party, deputy, Government member, initiative, place, blog post and news article.
  - X, WhatsApp, Facebook and LinkedIn all use them.
- **Structured data (JSON-LD):**
  - Organization and WebSite on every page;
  - PoliticalParty, Person (deputies and Government), Legislation (initiatives) and BreadcrumbList on those pages;
  - NewsArticle/OpinionNewsArticle on posts;
  - the President and place pages carry their own.
- **Icons.** `/icon` (512 px), `/apple-icon` (180 px) and the web manifest.

## Settings that have to be right in production

1. `NEXT_PUBLIC_SITE_URL` must be the address the site really answers on, the one the others redirect to.
   - Today `politicando.pt` redirects to `www.politicando.pt`, so set it to `https://www.politicando.pt`.
     The other option is to make Render redirect www to the bare domain and keep the variable.
   - It is read at build time, so redeploy after changing it.
   - Check: `curl -s https://www.politicando.pt/robots.txt` must show
     `Sitemap: https://www.politicando.pt/sitemap.xml`, and the canonical link on any page must use the same host.
2. `NEXT_PUBLIC_API_URL` must reach the API from the server: the sitemap and every page's metadata come from it.

## Google Search Console, step by step

1. Open <https://search.google.com/search-console> with the Google account that should own the site.
2. **Add a property.** Pick **Domain**, type `politicando.pt`, and add the TXT record Google shows to the domain's
   DNS (at the registrar or wherever the DNS lives).
   - This covers www, the bare domain, http and https in one property.
   - The DNS can take from minutes to a day to update; then press **Verify**.
   - If DNS is out of reach, the **URL prefix** method works for `https://www.politicando.pt/`. The file
     `public/googlec7d7cdcf691bd2ba.html` is already served for its "HTML file" check. For the "HTML tag" check, set
     `GOOGLE_SITE_VERIFICATION` to the code and redeploy.
3. **Sitemaps** (left menu): submit `https://www.politicando.pt/sitemap.xml`. The status should turn to "Success"
   with the number of pages found.
4. **URL inspection** (top bar): paste the home page, then a party, a deputy and a blog post, and press
   **Request indexing** for each. That speeds up the first visit; the sitemap does the rest.
5. Over the next days, check:
   - **Pages:** why pages are or aren't indexed. "Excluded by noindex" for `/article/…` and forum threads is
     expected.
   - **Enhancements:** breadcrumbs, and any structured-data errors.
   - **Core Web Vitals:** speed on phones.
6. Optional: Bing Webmaster Tools (<https://www.bing.com/webmasters>) can import the property from Search Console
   in one click. Bing also feeds DuckDuckGo and Ecosia.

## Checking a page by hand

- Rich results: <https://search.google.com/test/rich-results>, with any party, deputy or post URL.
- Share card: <https://www.opengraph.xyz> or the Facebook sharing debugger
  (<https://developers.facebook.com/tools/debug/>). The second also clears Facebook's cache after a change.
