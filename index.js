const puppeteer = require("puppeteer");
const config = require("./config");

(async () => {
  const browser = await puppeteer.launch({ headless: config.headless });
  const page = await browser.newPage();
  await page.goto("https://www.concordiaubezpieczenia.pl/concordia/o-firmie/aktualnosci,210.html", {
    waitUntil: "load",
    timeout: 0,
  });
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

  for (let pageNumber = 1; pageNumber < 80; pageNumber++) {
    let nextPage = `https://www.concordiaubezpieczenia.pl/concordia/o-firmie/aktualnosci,210.html?pg=${pageNumber}&`;

    const pageData = await page.evaluate(async () => {
      let links = [];
      const anchors = document.querySelectorAll(".main3boxmore a");
      for (const anchor of anchors) {
        links.push(anchor.href);
      }
      return links;
    });
    for (const link of pageData) {
      await getPageData(link);
    }
    console.log(`Ukończono stronę ${pageNumber}`);
    await page.goto(nextPage, { waitUntil: "load", timeout: 0 });
  }
  async function getPageData(link) {
    data = {};
    await page.goto(link, { waitUntil: "load", timeout: 0 });
    let title;
    try {
      await page.waitForSelector("h2");
      title = await page.$eval("h2", node => node.innerText);
    } catch (e) {
      console.error(e);
      console.log("Failed to get the title");
      title = "error";
    }
    data.title = title;
    let date;
    try {
      await page.waitForSelector(".data");
      date = await page.$eval(".data", node => node.innerText);
    } catch (e) {
      console.error(e);
      console.log("Failed to get the date");
      date = "error";
    }
    data.month = date.slice(5, 7);
    data.day = date.slice(8, 10);
    data.year = date.slice(0, 4);

    let image;
    try {
      await page.waitForSelector(".nitem img");
      image = await page.$eval(".nitem img", node => node.src);
    } catch (e) {
      console.error(e);
      console.log("Failed to get the image");
      image = "error";
    }
    data.image = image;

    const content = await page.evaluate(async () => {
      let myNode = document.querySelector(".nitem");
      let imgNode = document.querySelector(".nitem img");
      let h2Node = document.querySelector(".nitem h2");
      let tekst = myNode.innerHTML;
      while (!myNode.firstChild.contains(h2Node)) {
        myNode.removeChild(myNode.firstChild);
      }
      myNode.removeChild(myNode.firstChild);
      imgNode.remove();
      tekst = myNode.innerHTML.replace(/(\r\n\t|\n|\r\t)/gm, "");
      tekst = myNode.innerHTML.replace("<p></p>", "");
      return tekst;
    });
    data.content = content;
    console.log("Completed " + title);
    await page.goto(image, { waitUntil: "load", timeout: 0 });
    await page.waitForSelector("img");
    const imageNode = await page.$("img");
    await imageNode.screenshot({ path: title.replace("/", "-") + ".jpeg" });
    if (data.year >= 2016) {
      await createPost(data);
    }
  }

  async function createPost(data) {
    //open post
    await page.goto(config.loginPage, { waitUntil: "load", timeout: 0 });
    await page.waitForSelector("#menu-posts a");
    await page.click("#menu-posts a");
    await page.waitForSelector(".page-title-action");
    await page.click(".page-title-action");

    //hide tutorial
    if (data.title == "Concordia w półfinale plebiscytu na firmę przyjazną dla rolnika") {
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
    if (data.title == "Concordia w półfinale plebiscytu na firmę przyjazną dla rolnika") {
      await page.evaluate(async () => {
        document.querySelectorAll(".components-panel__body-toggle")[1].click();
      });
    }
    await page.waitForSelector("#editor-post-taxonomies-hierarchical-term-12");
    await page.click("#editor-post-taxonomies-hierarchical-term-12");

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
    if (data.title == "Concordia w półfinale plebiscytu na firmę przyjazną dla rolnika") {
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
