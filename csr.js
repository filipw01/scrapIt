const puppeteer = require("puppeteer");
const config = require("./config");

(async () => {
  const browser = await puppeteer.launch({ headless: config.headless });
  const page = await browser.newPage();
  // Get the "viewport" of the page, as reported by the page.

  //login
  await page.goto(config.loginPage, { waitUntil: "load", timeout: 0 });
  await page.waitForSelector("#user_login");
  await page.click("#user_login");
  await page.waitFor("#user_login");
  await page.$eval("#user_login", (el, username) => (el.value = username), config.username);
  await page.waitFor("#user_pass");
  await page.$eval("#user_pass", (el, password) => (el.value = password), config.password);
  await page.click("#wp-submit");

  await page.goto("https://www.concordiaubezpieczenia.pl/concordia/csr,84.html", {
    waitUntil: "load",
    timeout: 0,
  });
  const articles = await page.evaluate(async () => {
    let articles = [];
    const article = document.querySelectorAll(".nitem");
    day = "30";
    for (const articleSingle of article) {
      data = {};
      console.log(articleSingle);
      data.title = articleSingle.querySelector("h2").innerText;
      data.day = String(day);
      day--;
      data.month = "05";
      data.year = "2019";
      if (articleSingle.querySelector("img")) {
        data.thumbnail = articleSingle.querySelector("img").src;
      } else {
        data.thumbnail = null;
      }

      let myNode = articleSingle;
      let imgNode = articleSingle.querySelector("img");
      let h2Node = articleSingle.querySelector("h2");
      let tekst = myNode.innerHTML;
      while (!myNode.firstChild.contains(h2Node)) {
        myNode.removeChild(myNode.firstChild);
      }
      myNode.removeChild(myNode.firstChild);
      if (data.thumbnail !== null) {
        imgNode.remove();
      }
      tekst = myNode.innerHTML.replace(/(\r\n\t|\n|\r\t)/gm, "");
      tekst = myNode.innerHTML.replace("<p></p>", "");
      data.content = tekst;
      articles.push(data);
      console.log(data);
    }
    return articles;
  });
  for (const singleArticle of articles) {
    console.log("Completed " + singleArticle.title);
    if (singleArticle.thumbnail !== null) {
      await page.goto(singleArticle.thumbnail, { waitUntil: "load", timeout: 0 });
      await page.waitForSelector("img");
      const imageNode = await page.$("img");
      await imageNode.screenshot({ path: singleArticle.title.replace("/", "-") + ".jpeg" });
    }
    if (singleArticle.title != "Galeria Jednego Obrazu w Centrali Concordii") {
      await createPost(singleArticle);
    } else {
      await createPost(singleArticle);
      break;
    }
  }

  console.log(`Ukończono stronę`);

  async function createPost(data) {
    //open post
    await page.goto(config.loginPage, { waitUntil: "load", timeout: 0 });
    await page.waitForSelector("#menu-posts a");
    await page.click("#menu-posts a");
    await page.waitForSelector(".page-title-action");
    await page.click(".page-title-action");

    //hide tutorial
    if (data.day == "30") {
      await page.waitForSelector(".components-popover__content .components-button");
      await page.click(".components-popover__content .components-button");
      await page.waitFor(100);
      await page.click(".components-popover__content .components-button");
      await page.waitFor(100);
      await page.click(".components-popover__content .components-button");
      await page.waitFor(100);
      await page.click(".components-popover__content .components-button");
    }

    //add category
    if (data.day == "30") {
      await page.evaluate(async () => {
        document.querySelectorAll(".components-panel__body-toggle")[1].click();
      });
    }
    await page.waitForSelector("#editor-post-taxonomies-hierarchical-term-1");
    await page.click("#editor-post-taxonomies-hierarchical-term-1");

    //add date
    await page.waitForSelector("#edit-post-post-schedule__toggle-0");
    await page.click("#edit-post-post-schedule__toggle-0");
    page.select(".components-datetime__time-field-month-select", data.month);
    await page.waitFor(".components-datetime__time-field-day-input");
    await page.click(".components-datetime__time-field-day-input", { clickCount: 3 });
    await page.type(".components-datetime__time-field-day-input", data.day);
    await page.waitFor(".components-datetime__time-field-year-input");
    await page.click(".components-datetime__time-field-year-input", { clickCount: 3 });
    await page.type(".components-datetime__time-field-year-input", data.year);

    //add title and content
    await page.waitForSelector("#post-title-0");
    await page.type("#post-title-0", data.title);

    await page.click(".editor-inserter button");
    await page.waitForSelector(".editor-inserter__menu input");
    await page.type(".editor-inserter__menu input", "html");

    await page.click(".editor-inserter__menu ul button");
    await page.waitForSelector("textarea.editor-plain-text");
    await page.type("textarea.editor-plain-text", data.content);

    await page.mouse.move(200, 200);
    await page.click(".editor-block-settings-menu__toggle");
    await page.evaluate(async () => {
      document.querySelectorAll(".components-menu-item__button")[1].click();
    });
    await page.click(".edit-post-sidebar-header button");

    //add thumbnail
    if (data.thumbnail !== null) {
      if (data.day == "30") {
        await page.evaluate(async () => {
          const el = document.querySelectorAll(".components-panel__body-toggle")[3];
          el.click();
          el.parentElement.parentElement.querySelectorAll("button")[1].click();
        });
      } else {
        await page.evaluate(async () => {
          const el = document.querySelectorAll(".components-panel__body-toggle")[3];
          el.parentElement.parentElement.querySelectorAll("button")[1].click();
        });
      }
      await page.waitFor(100);
      await page.evaluate(async () => {
        document.querySelectorAll(".media-menu-item")[2].click();
      });
      await page.click("#__wp-uploader-id-1");
      const input = await page.$('input[type="file"]');
      input.uploadFile(`./${data.title.replace("/", "-")}.jpeg`);
      await page.waitForSelector(".media-button-select:not([disabled])");
      await page.click(".media-button-select:not([disabled])");
    }

    //publish
    await page.waitForSelector(".editor-post-publish-panel__toggle");
    await page.click(".editor-post-publish-panel__toggle");
    await page.waitFor(100);
    await page.waitForSelector(".editor-post-publish-button");
    await page.click(".editor-post-publish-button");
    await page.waitForSelector(".editor-post-publish-panel__header-published");
    console.log(`Opublikowano ${data.title}`);
  }
  await browser.close();
})();
